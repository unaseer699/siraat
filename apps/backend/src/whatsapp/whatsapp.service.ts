import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappConfirmationService } from './whatsapp-confirmation.service';
import { maskPhone } from './whatsapp-phone.util';

export { maskPhone };

// WHATSAPP INTEGRATION Phase 1 — parsed shape pulled out of Meta's webhook
// entry[].changes[].value.messages[] before it's stored. Kept separate from
// the raw Meta payload shape so WhatsappService's own logic never has to
// re-navigate that nesting past extractInboundMessages.
//
// WHATSAPP INTEGRATION Phase 3 — contextId added: WhatsApp's own native
// "reply" feature (long-press a message -> Reply) stamps the replied-to
// message's id onto `context.id` of the new message. Used by
// WhatsappConfirmationService.findMatchingPendingDraft to thread a reply
// back to the exact draft it was replying to, when the sender uses that
// feature; null when they didn't (plain reply), which falls back to
// "most recent PENDING draft for this sender's project" instead.
export interface ParsedWhatsappMessage {
  id: string;
  from: string;
  type: string;
  text: string | null;
  timestamp: Date;
  rawPayload: unknown;
  contextId: string | null;
}

export interface CreateMappingInput {
  wa_id: string;
  project_ref: string;
  created_by: string;
}

// ── [SECURITY] constant-time comparison ──────────────────────────────────
// Buffer length must match before timingSafeEqual (it throws otherwise) —
// the early-exit on length is an accepted, unavoidable part of this idiom;
// only the *content* comparison needs to be constant-time.
function constantTimeStringEquals(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// Postgres unique-violation error code — used to catch a concurrent
// duplicate-delivery race that lands between an idempotency findOneBy check
// and the following save (see processInboundMessage / createMapping).
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

function parseOneMessage(raw: unknown): ParsedWhatsappMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const { id, from, type, timestamp: timestampRaw } = m;
  if (
    typeof id !== 'string' ||
    typeof from !== 'string' ||
    typeof type !== 'string' ||
    typeof timestampRaw !== 'string'
  ) {
    // Malformed entry — skip it, don't fail the whole webhook delivery over
    // one bad message (Meta batches multiple messages per delivery).
    return null;
  }

  const textBody = (m.text as Record<string, unknown> | undefined)?.body;
  const text = type === 'text' && typeof textBody === 'string' ? textBody : null;

  // WHATSAPP INTEGRATION Phase 3 — messages[].context.id, present only when
  // the sender used WhatsApp's native reply feature.
  const contextIdRaw = (m.context as Record<string, unknown> | undefined)?.id;
  const contextId = typeof contextIdRaw === 'string' ? contextIdRaw : null;

  return {
    id,
    from,
    type,
    text,
    timestamp: new Date(Number(timestampRaw) * 1000),
    rawPayload: raw,
    contextId,
  };
}

// Walks Meta's webhook envelope (entry[].changes[].value.messages[]) and
// returns every parseable message. A `changes[].value` with no `messages`
// key (e.g. a `statuses` delivery/read receipt, which Meta also posts to
// this same webhook) is silently skipped — not an inbound message, not an
// error either.
export function extractInboundMessages(body: unknown): ParsedWhatsappMessage[] {
  const out: ParsedWhatsappMessage[] = [];
  if (!body || typeof body !== 'object') return out;

  const entries = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown } | null)?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const rawMessages = (change as { value?: { messages?: unknown } } | null)?.value?.messages;
      if (!Array.isArray(rawMessages)) continue;

      for (const raw of rawMessages) {
        const parsed = parseOneMessage(raw);
        if (parsed) out.push(parsed);
      }
    }
  }

  return out;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    @InjectRepository(WhatsappProjectMappingEntity)
    private readonly mappingRepo: Repository<WhatsappProjectMappingEntity>,
    // @Optional() — WHATSAPP INTEGRATION Phase 2. Lighter test setups (e.g.
    // whatsapp-webhook.controller.spec.ts) construct WhatsappService without
    // wiring up AI parsing at all; this keeps that DI graceful (parsing is
    // simply skipped, see processInboundMessage below) rather than forcing
    // every existing test module to know about a dependency it doesn't
    // exercise. The real app (WhatsappModule) always provides it.
    @Optional()
    private readonly parsingSvc?: WhatsappParsingService,
    // WHATSAPP INTEGRATION Phase 3 — same @Optional() reasoning as
    // parsingSvc above: lighter test setups don't need to know about the
    // confirm/correct loop at all. The real app (WhatsappModule) always
    // provides it.
    @Optional()
    private readonly confirmationSvc?: WhatsappConfirmationService,
  ) {}

  // ── [SECURITY] Webhook verification handshake (GET) ──────────────────────

  verifyToken(token: string | undefined): boolean {
    return constantTimeStringEquals(process.env.WHATSAPP_VERIFY_TOKEN, token);
  }

  // ── [SECURITY] X-Hub-Signature-256 (POST) ─────────────────────────────────
  // Must be computed over the RAW body bytes, not the JSON-parsed body — a
  // re-serialized JSON.stringify(parsedBody) will not byte-for-byte match
  // what Meta signed (key order, whitespace, unicode escaping can all
  // differ), which is why this takes a Buffer, not the parsed object. See
  // main.ts's `rawBody: true` NestFactory option and the controller's
  // @Req() rawBody access.
  verifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret || !rawBody || !signatureHeader) return false;

    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    return constantTimeStringEquals(expected, signatureHeader);
  }

  // ── Inbound message handling ───────────────────────────────────────────────

  async handleWebhookPayload(body: unknown): Promise<void> {
    const messages = extractInboundMessages(body);
    for (const msg of messages) {
      await this.processInboundMessage(msg);
    }
  }

  // Idempotent by Meta's own message id — see the entity's comment on
  // wa_message_id. Never touches Expense/project data beyond snapshotting
  // project_ref from whatever mapping exists right now (Phase 1 scope).
  async processInboundMessage(
    msg: ParsedWhatsappMessage,
  ): Promise<{ stored: boolean; duplicate: boolean; message?: WhatsappInboundMessageEntity }> {
    const existing = await this.inboundRepo.findOneBy({ wa_message_id: msg.id });
    if (existing) {
      this.logger.log(`Duplicate WhatsApp message id=${msg.id} from ${maskPhone(msg.from)} — no-op`);
      return { stored: false, duplicate: true };
    }

    const mapping = await this.mappingRepo.findOneBy({ wa_id: msg.from });
    const entity = this.inboundRepo.create({
      wa_message_id: msg.id,
      wa_id: msg.from,
      message_type: msg.type,
      message_text: msg.text,
      wa_timestamp: msg.timestamp,
      raw_payload: msg.rawPayload,
      project_ref: mapping?.project_ref ?? null,
      status: mapping ? 'RECEIVED' : 'UNMAPPED',
    });

    try {
      const saved = await this.inboundRepo.save(entity);
      this.logger.log(
        `Stored WhatsApp message id=${msg.id} from ${maskPhone(msg.from)} status=${saved.status}`,
      );

      await this.routeReceivedMessage(saved, msg.contextId);

      return { stored: true, duplicate: false, message: saved };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Concurrent duplicate delivery landed between the findOneBy check
        // above and this save — same idempotent outcome, not an error.
        this.logger.log(`Duplicate WhatsApp message id=${msg.id} from ${maskPhone(msg.from)} (race) — no-op`);
        return { stored: false, duplicate: true };
      }
      throw err;
    }
  }

  // WHATSAPP INTEGRATION Phase 2/3 routing, extracted out of
  // processInboundMessage so WHATSAPP INTEGRATION Phase 4's
  // reprocessUnmappedMessages (below) can reuse the exact same
  // mapped-message decision logic on an OLD, already-stored row instead of
  // duplicating the branching (per the Phase 4 brief). No-op for anything
  // other than a RECEIVED message (an UNMAPPED one has nothing to route).
  private async routeReceivedMessage(message: WhatsappInboundMessageEntity, contextId: string | null): Promise<void> {
    if (message.status !== 'RECEIVED') return;

    // WHATSAPP INTEGRATION Phase 3 — before treating this as a fresh
    // message to parse, check whether it's actually a reply to an existing
    // PENDING draft (native WhatsApp reply-threading, or — falling back —
    // the sender's most recent PENDING draft for their mapped project; see
    // WhatsappConfirmationService.findMatchingPendingDraft). This lookup is
    // a couple of indexed DB reads, not a slow external call, so it's
    // awaited here (same "DB writes are awaited, only the slow external
    // call is fire-and-forgotten" line Phase 1/2 already draw) rather than
    // adding it to the fire-and-forget branch below.
    const matchedDraft = await this.confirmationSvc?.findMatchingPendingDraft(message, contextId);
    if (matchedDraft) {
      void this.confirmationSvc?.handleReply(matchedDraft, message);
      return;
    }

    // WHATSAPP INTEGRATION Phase 2 — fire-and-forget AI parsing. Not
    // awaited — matching the existing fire-and-forget Observation-logging
    // pattern (ConstructionProjectService's `void this.ciSvc.logObservation(...)`)
    // so a slow/failed LLM call never delays this method's caller, and in
    // turn never delays the webhook controller's fast 200 ack to Meta.
    void this.parsingSvc?.parseAndStoreDraft(message);
  }

  // ── WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE ─────────────────────

  // GET /v1/admin/whatsapp-unmapped
  async listUnmappedMessages(): Promise<WhatsappInboundMessageEntity[]> {
    return this.inboundRepo.find({ where: { status: 'UNMAPPED' }, order: { created_at: 'DESC' } });
  }

  // Used by AdminService.reprocessUnmappedWhatsappMessages to resolve the
  // mapping's own wa_id/project_ref before reprocessing — same "ID-scoped,
  // not a raw findOneBy the caller assembles itself" pattern as
  // deleteMapping's find-by-id.
  async findMappingById(id: string): Promise<WhatsappProjectMappingEntity | null> {
    return this.mappingRepo.findOneBy({ id });
  }

  // Retroactively resolves a sender's still-UNMAPPED messages after an
  // admin creates a mapping for them — explicit, admin-triggered only,
  // never automatic (per the brief: silently turning old messages into
  // Expenses without a fresh look is exactly what this must NOT do on its
  // own). Flips each matching row to RECEIVED with the new project_ref,
  // then routes it through routeReceivedMessage — the exact same
  // mapped-message logic a freshly-arrived message goes through, not a
  // second copy of that branching.
  //
  // Only this wa_id's still-UNMAPPED rows are touched (scoped `where`
  // clause below) — any of their other messages already RECEIVED/PARSED,
  // and every other sender's messages, are left untouched.
  //
  // No native WhatsApp context.id exists for an old, already-stored message
  // (it was never re-delivered) — reply-threading has nothing to match
  // against here, so this always falls to routeReceivedMessage's
  // "most recent PENDING draft for this project" fallback, same as any
  // reply sent without using WhatsApp's native reply feature.
  async reprocessUnmappedMessages(waId: string, projectRef: string): Promise<{ reprocessed: number }> {
    const unmapped = await this.inboundRepo.find({ where: { wa_id: waId, status: 'UNMAPPED' } });

    for (const message of unmapped) {
      await this.inboundRepo.update({ id: message.id }, { status: 'RECEIVED', project_ref: projectRef });
      await this.routeReceivedMessage({ ...message, status: 'RECEIVED', project_ref: projectRef }, null);
    }

    return { reprocessed: unmapped.length };
  }

  // ── Admin mapping CRUD (POST/GET/DELETE /v1/admin/whatsapp-mappings) ─────

  async createMapping(data: CreateMappingInput): Promise<WhatsappProjectMappingEntity> {
    const existing = await this.mappingRepo.findOneBy({ wa_id: data.wa_id });
    if (existing) {
      throw new ConflictException({
        error_code: 'DUPLICATE_MAPPING',
        message: 'This WhatsApp number is already mapped to a project',
      });
    }

    const mapping = this.mappingRepo.create(data);
    try {
      return await this.mappingRepo.save(mapping);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          error_code: 'DUPLICATE_MAPPING',
          message: 'This WhatsApp number is already mapped to a project',
        });
      }
      throw err;
    }
  }

  async listMappings(): Promise<WhatsappProjectMappingEntity[]> {
    return this.mappingRepo.find({ order: { created_at: 'DESC' } });
  }

  async deleteMapping(id: string): Promise<void> {
    const result = await this.mappingRepo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`WhatsApp mapping ${id} not found`);
    }
  }
}
