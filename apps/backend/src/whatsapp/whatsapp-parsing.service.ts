import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAiClient, type ExpenseExtraction } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftExpenseEntity, type WhatsappDraftExpenseStatus } from './entities/whatsapp-draft-expense.entity';

// WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. How long a PENDING
// draft can sit unanswered before GET /v1/admin/whatsapp-drafts flags it
// `stale: true` — configurable (per the brief) rather than hardcoded, with
// the brief's own suggested default. Read once per call (not cached) so a
// config change takes effect without a restart-sensitive cache to worry
// about; this is a cheap Number() parse, not a network call.
const DEFAULT_STALE_HOURS = 24;

function isDraftStale(draft: WhatsappDraftExpenseEntity): boolean {
  // Staleness only means anything for a draft still awaiting a reply — a
  // CONFIRMED/VOID/etc. draft is resolved, never "stuck."
  if (draft.status !== 'PENDING') return false;

  const hours = Number(process.env.WHATSAPP_DRAFT_STALE_HOURS);
  const thresholdMs = (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_STALE_HOURS) * 60 * 60 * 1000;
  return Date.now() - draft.created_at.getTime() > thresholdMs;
}

// `stale` is deliberately NOT a stored column/status value (per the brief —
// don't invent a new status for this) — it's computed at query time from
// created_at, so it's always current and never needs a background job to
// keep it in sync.
export type WhatsappDraftListItem = WhatsappDraftExpenseEntity & { stale: boolean };

// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP. Plain-text summary of
// a parsed draft, sent back to the sender so they can reply YES to confirm
// or send a correction. Exported (not just used below) because
// WhatsappConfirmationService.correctDraft re-parses a reply as a fresh
// extraction attempt and needs to send the exact same shape of "here's what
// I understood now" message — one wording, not two copies to keep in sync.
//
// Deliberately NOT a summary of null fields for a LOW-confidence/unparseable
// extraction (per the brief) — that would read as a confirmed empty expense
// rather than what it actually is: "I couldn't understand this."
export function buildDraftSummaryText(extraction: ExpenseExtraction): string {
  if (extraction.confidence === 'LOW' || !extraction.item) {
    return (
      "I couldn't quite understand that as an expense. Could you clarify or rephrase — " +
      'e.g. "cement 50 bags @ 1490"?'
    );
  }

  const parts = [extraction.item];
  if (extraction.quantity != null && extraction.unit) {
    parts.push(`${extraction.quantity} ${extraction.unit}`);
  } else if (extraction.quantity != null) {
    parts.push(`${extraction.quantity}`);
  }
  const rateSuffix = extraction.rate != null ? ` @ ${extraction.rate}` : '';

  return `Got it: ${parts.join(', ')}${rateSuffix}. Reply YES to confirm, or send a correction.`;
}

// WHATSAPP INTEGRATION Phase 2 — AI PARSING. Turns one RECEIVED inbound
// message into one WhatsappDraftExpenseEntity row, then flips the source
// message to PARSED. Deliberately a separate service from WhatsappService
// (which owns webhook receipt/mapping) — this is a distinct concern
// (AI-parse → draft) that WhatsappService only needs to *trigger*
// fire-and-forget, matching the existing pattern of ConstructionIntelligenceService
// owning logObservation as a separately-callable, separately-testable unit.
@Injectable()
export class WhatsappParsingService {
  private readonly logger = new Logger(WhatsappParsingService.name);

  constructor(
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    @InjectRepository(WhatsappDraftExpenseEntity)
    private readonly draftRepo: Repository<WhatsappDraftExpenseEntity>,
    private readonly aiClient: WhatsappAiClient,
    // WHATSAPP INTEGRATION Phase 3 — reply to the sender with a summary of
    // the parsed draft. Required (not @Optional() like WhatsappService's
    // parsingSvc) since WhatsappModule always wires it; tests provide a mock.
    private readonly outboundClient: WhatsappOutboundClient,
  ) {}

  // Fire-and-forget entry point (see WhatsappService.processInboundMessage —
  // called as `void this.parsingSvc.parseAndStoreDraft(saved)`, never
  // awaited, so a slow/failed AI call never delays the webhook's fast ack).
  // Never throws — every failure path here is caught and logged, exactly
  // like ConstructionIntelligenceService.logObservation, since a caller that
  // doesn't await this method could never catch anything it threw anyway.
  //
  // RETRY APPROACH (flagged per the brief for review): on any failure below
  // (AI call error/timeout, unexpected exception), the message is simply
  // left at status RECEIVED rather than being flipped to any kind of
  // "FAILED" state. There is no queue/worker infrastructure in this codebase
  // yet (REDIS_URL exists in .env.example but nothing consumes it) to retry
  // against, so building one here would be scope creep beyond this phase.
  // Leaving status untouched means a message that failed to parse is
  // indistinguishable from "not parsed yet" — which is exactly the queryable
  // state (`status = 'RECEIVED' AND project_ref IS NOT NULL`) a future retry
  // job or manual reprocessing script needs, with no new column/status value
  // required. The trade-off: nothing currently re-drives that query
  // automatically in this phase — a stuck message stays RECEIVED until
  // something does. Only a successful parse (confident or not) advances a
  // message to PARSED.
  async parseAndStoreDraft(message: WhatsappInboundMessageEntity): Promise<void> {
    if (message.status !== 'RECEIVED' || !message.project_ref) {
      // UNMAPPED messages (no project_ref) have nothing to parse against —
      // guarded here too (not just at the call site) so this method is safe
      // to call directly, e.g. from a future retry job, without relying on
      // the caller to have already checked.
      return;
    }

    try {
      const text = message.message_text;
      const outcome =
        text && text.trim().length > 0
          ? await this.aiClient.extractExpense(text)
          : {
              extraction: { item: null, quantity: null, unit: null, rate: null, trade_category: null, confidence: 'LOW' as const },
              raw: { skipped: 'empty_message_text' },
            };

      const draft = this.draftRepo.create({
        inbound_message_id: message.id,
        project_ref: message.project_ref,
        parsed_item: outcome.extraction.item,
        parsed_quantity: outcome.extraction.quantity,
        parsed_unit: outcome.extraction.unit,
        parsed_rate: outcome.extraction.rate,
        parsed_trade_category: outcome.extraction.trade_category,
        confidence: outcome.extraction.confidence,
        raw_ai_response: outcome.raw,
        status: 'PENDING',
      });
      await this.draftRepo.save(draft);

      // Only advance the source message once its draft is actually
      // persisted — a save failure above throws before this line, leaving
      // the message at RECEIVED (see RETRY APPROACH) rather than marking it
      // PARSED with no corresponding draft.
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });

      this.logger.log(
        `Parsed WhatsApp message id=${message.id} confidence=${outcome.extraction.confidence}`,
      );

      // WHATSAPP INTEGRATION Phase 3 — reply with a plain-text summary so
      // the sender can confirm or correct. Its own try/catch, separate from
      // the one below: a failed *send* here must never look like a failed
      // *parse* (the draft is already safely saved by this point) and, per
      // the brief, must never throw back into this method's caller — this
      // method is itself always called fire-and-forget (see
      // WhatsappService.processInboundMessage) and never throws regardless.
      try {
        await this.outboundClient.sendTextMessage(message.wa_id, buildDraftSummaryText(outcome.extraction));
      } catch (err) {
        this.logger.error(
          `Failed to send WhatsApp draft summary for message id=${message.id} — draft was still saved`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to parse WhatsApp message id=${message.id} — left at status RECEIVED for retry`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // GET /v1/admin/whatsapp-drafts — defaults to PENDING (this endpoint's
  // original Phase 2 behavior, unchanged for an existing caller that never
  // passes `status`).
  //
  // WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. `status` is now a
  // real filter (not hardcoded) so CONFIRMED drafts can be surfaced for
  // review-after-the-fact, and every returned row carries a derived `stale`
  // flag (see isDraftStale) so the admin can spot a PENDING draft nobody
  // ever replied to without cross-referencing created_at by hand.
  async listDrafts(
    project_ref?: string,
    status: WhatsappDraftExpenseStatus = 'PENDING',
  ): Promise<WhatsappDraftListItem[]> {
    const drafts = await this.draftRepo.find({
      where: project_ref ? { project_ref, status } : { status },
      order: { created_at: 'DESC' },
    });
    return drafts.map((draft) => ({ ...draft, stale: isDraftStale(draft) }));
  }

  // ── WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE ─────────────────────
  // Manual resolution actions for a draft that never advanced — a failed AI
  // call, a low-confidence draft nobody replied to, an orphaned correction.
  // Both actions below are scoped to PENDING only (same "corrections/void
  // only apply to the current live state" guard ConstructionProjectService
  // uses for ACTIVE expenses) — a CONFIRMED draft already has a real
  // Expense; voiding or re-prompting the draft row itself afterward would
  // be meaningless at best, misleading at worst.

  // POST /v1/admin/whatsapp-drafts/:id/void — never deletes the row (Law 3
  // / this codebase's standing corrections-not-deletion principle, same as
  // ProjectExpenseEntity.void_reason). `reason` is optional here (unlike
  // ProjectExpenseEntity's mandatory one) per the brief.
  async voidDraft(id: string, reason: string | null): Promise<WhatsappDraftExpenseEntity> {
    const draft = await this.draftRepo.findOneBy({ id });
    if (!draft) throw new NotFoundException(`WhatsApp draft ${id} not found`);
    if (draft.status !== 'PENDING') {
      throw new BadRequestException(
        `Draft ${id} cannot be voided — it is already ${draft.status}. Voiding only applies to a stuck PENDING draft.`,
      );
    }

    await this.draftRepo.update({ id }, { status: 'VOID', void_reason: reason });
    return { ...draft, status: 'VOID', void_reason: reason };
  }

  // POST /v1/admin/whatsapp-drafts/:id/resend-prompt — re-sends the exact
  // same draft-summary text Phase 3 sends right after parsing (reusing
  // buildDraftSummaryText, not a re-derived copy), in case the original
  // send never reached the sender (e.g. an outbound-credential
  // misconfiguration — the scenario this endpoint exists for).
  //
  // FAILURE HANDLING — deliberately NOT fire-and-forget, unlike the
  // background sends in parseAndStoreDraft/WhatsappConfirmationService:
  // those happen off a webhook the sender never sees a direct response to,
  // so swallow-and-log is the only sane behavior. This is an explicit admin
  // action — the admin clicked "resend" and is waiting for a result — so a
  // send failure is surfaced back to THEM as a real error (502, since the
  // failure is WhatsApp's/the network's, not a bad request) instead of a
  // silent "200 OK, nothing happened." It's still logged either way, same
  // as every other outbound failure in this codebase.
  async resendDraftPrompt(id: string): Promise<{ sent: true }> {
    const draft = await this.draftRepo.findOneBy({ id });
    if (!draft) throw new NotFoundException(`WhatsApp draft ${id} not found`);
    if (draft.status !== 'PENDING') {
      throw new BadRequestException(
        `Draft ${id} cannot be re-prompted — it is already ${draft.status}. Only a stuck PENDING draft can be re-prompted.`,
      );
    }

    const originalMessage = await this.inboundRepo.findOneBy({ id: draft.inbound_message_id });
    if (!originalMessage) {
      // Shouldn't happen (inbound_message_id always references a real row —
      // see the entity's own comment) but defensive rather than assumed.
      throw new NotFoundException(`Original WhatsApp message for draft ${id} not found — cannot resend`);
    }

    const extraction: ExpenseExtraction = {
      item: draft.parsed_item,
      quantity: draft.parsed_quantity,
      unit: draft.parsed_unit,
      rate: draft.parsed_rate,
      trade_category: draft.parsed_trade_category,
      confidence: draft.confidence,
    };

    try {
      await this.outboundClient.sendTextMessage(originalMessage.wa_id, buildDraftSummaryText(extraction));
    } catch (err) {
      this.logger.error(
        `Failed to resend WhatsApp draft prompt for draft id=${id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException('Failed to send the WhatsApp message — see server logs for detail');
    }

    return { sent: true };
  }
}
