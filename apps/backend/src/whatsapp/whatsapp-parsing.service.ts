import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';

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
    } catch (err) {
      this.logger.error(
        `Failed to parse WhatsApp message id=${message.id} — left at status RECEIVED for retry`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // GET /v1/admin/whatsapp-drafts — "returns pending drafts" per the brief,
  // so this always filters to status = PENDING (the only status this phase
  // ever writes, but explicit rather than incidental — once Phase 3 adds
  // CONFIRMED/REJECTED/EDITED, this endpoint should keep showing only what
  // still needs review). Read-only: no confirm/edit/reject actions exist yet.
  async listDrafts(project_ref?: string): Promise<WhatsappDraftExpenseEntity[]> {
    return this.draftRepo.find({
      where: project_ref ? { project_ref, status: 'PENDING' } : { status: 'PENDING' },
      order: { created_at: 'DESC' },
    });
  }
}
