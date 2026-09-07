import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';

// WHATSAPP INTEGRATION Phase 1 — parsed shape pulled out of Meta's webhook
// entry[].changes[].value.messages[] before it's stored. Kept separate from
// the raw Meta payload shape so WhatsappService's own logic never has to
// re-navigate that nesting past extractInboundMessages.
export interface ParsedWhatsappMessage {
  id: string;
  from: string;
  type: string;
  text: string | null;
  timestamp: Date;
  rawPayload: unknown;
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

// [SECURITY] No PII beyond what's needed in logs — last 4 digits only.
export function maskPhone(waId: string): string {
  if (waId.length <= 4) return '*'.repeat(waId.length);
  return '*'.repeat(waId.length - 4) + waId.slice(-4);
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

  return {
    id,
    from,
    type,
    text,
    timestamp: new Date(Number(timestampRaw) * 1000),
    rawPayload: raw,
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
