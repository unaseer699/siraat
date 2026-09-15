import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { buildDraftSummaryText } from './whatsapp-parsing.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { maskPhone } from './whatsapp-phone.util';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
import type { ExpenseUnit } from '../construction-intelligence/entities/project-expense.entity';

// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP. Closes the loop Phase
// 2 opened: a PENDING draft becomes a real Expense only once the founder
// explicitly confirms it over WhatsApp. Deliberately a separate service from
// WhatsappParsingService (which owns fresh AI-parse -> draft) — this is a
// distinct concern (existing draft -> confirm-or-correct) that
// WhatsappService only needs to *trigger*, same separation-of-concerns
// reasoning as WhatsappParsingService's own class comment.

// Hardcoded, explicit whitelist — NOT AI-interpreted. Per the brief: a
// mismatch between what the AI thinks "yes" means and what the founder
// meant is exactly the kind of ambiguity FACT immutability (Law 3) exists to
// prevent, so confirmation intent is matched against this fixed list only.
// FOR FOUNDER REVIEW — the exact words recognized as confirmation:
//   yes, y, confirm, confirmed, correct, ok, okay
// Matching is exact (after trim/lowercase/stripping trailing .!?), not
// substring — "yeah I guess" or "yes but check the price" are deliberately
// NOT confirmations; anything not on this list falls through to the
// correction (re-parse) path instead of being treated as ambiguous-but-close.
export const CONFIRMATION_WHITELIST: readonly string[] = [
  'yes',
  'y',
  'confirm',
  'confirmed',
  'correct',
  'ok',
  'okay',
];

export function isConfirmationReply(text: string | null): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, '');
  return CONFIRMATION_WHITELIST.includes(normalized);
}

// Free-text unit as the AI extracted it (WhatsappDraftExpenseEntity.parsed_unit)
// mapped onto ProjectExpenseEntity's closed ExpenseUnit enum. Unrecognized
// or absent input maps to null — quantity/rate still drive the Expense's
// amount regardless of whether the unit itself was recognized (see
// ConstructionProjectService.resolveActualCost).
const UNIT_ALIASES: Record<string, ExpenseUnit> = {
  pcs: 'PCS',
  pc: 'PCS',
  piece: 'PCS',
  pieces: 'PCS',
  kg: 'KG',
  kgs: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  ton: 'TON',
  tons: 'TON',
  tonne: 'TON',
  tonnes: 'TON',
  bag: 'BAG',
  bags: 'BAG',
  cft: 'CFT',
  sft: 'SFT',
  rft: 'RFT',
  ltr: 'LTR',
  liter: 'LTR',
  liters: 'LTR',
  litre: 'LTR',
  litres: 'LTR',
};

function mapToExpenseUnit(rawUnit: string | null): ExpenseUnit | null {
  if (!rawUnit) return null;
  return UNIT_ALIASES[rawUnit.trim().toLowerCase()] ?? null;
}

@Injectable()
export class WhatsappConfirmationService {
  private readonly logger = new Logger(WhatsappConfirmationService.name);

  constructor(
    @InjectRepository(WhatsappDraftExpenseEntity)
    private readonly draftRepo: Repository<WhatsappDraftExpenseEntity>,
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    private readonly aiClient: WhatsappAiClient,
    private readonly outboundClient: WhatsappOutboundClient,
    // Public-API-call reuse, not a second Expense-creation path (Law 9: no
    // god context) — see confirmDraft below. Same cross-module composition
    // pattern AdminService already uses for cpSvc.
    private readonly cpSvc: ConstructionProjectService,
  ) {}

  // Called for every RECEIVED inbound message before WhatsappService decides
  // whether to fresh-parse it (see WhatsappService.processInboundMessage).
  // Returns null (not a reply to anything pending) rather than throwing —
  // "no matching draft" is an expected, common outcome, not a failure.
  //
  // MATCHING STRATEGY (flagged for founder review per the brief, rather than
  // over-engineered): native WhatsApp reply-threading (context.id) is tried
  // first. If that doesn't resolve to a still-PENDING draft — either because
  // the sender didn't use the reply feature (no context.id) OR because they
  // replied to something that isn't a live PENDING draft anymore (e.g. an
  // old, already-confirmed message) — this falls back to "the sender's most
  // recent PENDING draft for their mapped project," the simplest behavior
  // that's still correct for the common case of one open draft per project
  // at a time. Edge case worth a founder's attention: a sender who natively
  // replies to the WRONG old message will still land on whatever draft IS
  // currently PENDING for their project, not "no match." Revisit if that
  // becomes a real complaint — not addressed further here.
  async findMatchingPendingDraft(
    message: WhatsappInboundMessageEntity,
    contextWaMessageId: string | null,
  ): Promise<WhatsappDraftExpenseEntity | null> {
    if (contextWaMessageId) {
      const originalMessage = await this.inboundRepo.findOneBy({ wa_message_id: contextWaMessageId });
      if (originalMessage) {
        const draft = await this.draftRepo.findOne({
          where: { inbound_message_id: originalMessage.id, status: 'PENDING' },
          order: { created_at: 'DESC' },
        });
        if (draft) return draft;
      }
    }

    if (!message.project_ref) return null;
    return this.draftRepo.findOne({
      where: { project_ref: message.project_ref, status: 'PENDING' },
      order: { created_at: 'DESC' },
    });
  }

  // Fire-and-forget entry point (see WhatsappService.processInboundMessage —
  // called as `void this.confirmationSvc.handleReply(matchedDraft, saved)`,
  // never awaited). Never throws — same "every failure path caught and
  // logged" contract as WhatsappParsingService.parseAndStoreDraft, for the
  // same reason: a caller that doesn't await this could never catch
  // anything it threw anyway.
  async handleReply(draft: WhatsappDraftExpenseEntity, message: WhatsappInboundMessageEntity): Promise<void> {
    try {
      if (isConfirmationReply(message.message_text)) {
        await this.confirmDraft(draft, message);
      } else {
        await this.correctDraft(draft, message);
      }
    } catch (err) {
      this.logger.error(
        `Failed to handle WhatsApp reply for draft id=${draft.id} from ${maskPhone(message.wa_id)}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async confirmDraft(draft: WhatsappDraftExpenseEntity, message: WhatsappInboundMessageEntity): Promise<void> {
    // An explicit "yes" doesn't manufacture missing data. Expense.amount can
    // only come from quantity × rate here (WhatsappDraftExpenseEntity has no
    // separate "total" field) — Law 3/the brief: never invent a
    // quantity/rate just because the founder confirmed, and never silently
    // drop the reply either. Ask for the missing detail instead; the draft
    // stays PENDING.
    if (!draft.parsed_item || draft.parsed_quantity == null || draft.parsed_rate == null) {
      await this.sendReplySafely(
        message.wa_id,
        "I don't have enough detail to record this yet (need item, quantity, and rate). " +
          'Please resend with more detail, e.g. "cement 50 bags @ 1490".',
      );
      return;
    }

    const sectionId = await this.findOrCreateSection(draft.project_ref, draft.parsed_trade_category ?? 'MISCELLANEOUS');

    const expense = await this.cpSvc.createExpense(sectionId, {
      // Dated to when the expense was originally reported over WhatsApp
      // (the draft's own creation time), not the — possibly much later —
      // confirmation reply.
      expense_date: draft.created_at.toISOString().slice(0, 10),
      description: draft.parsed_item,
      // No vendor capture in this phase's AI extraction schema (item/
      // quantity/unit/rate/trade_category only) — FOR FOUNDER REVIEW, not
      // over-engineered into a second AI field this phase didn't ask for.
      vendor_name: 'WhatsApp submission (vendor not captured)',
      vendor_contact: null,
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: null,
      quantity: draft.parsed_quantity,
      unit: mapToExpenseUnit(draft.parsed_unit),
      rate: draft.parsed_rate,
      // WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. The one call site
      // that actually knows this Expense originated from a confirmed
      // WhatsApp draft; every other createExpense caller leaves this null.
      source: 'WHATSAPP',
    });

    await this.draftRepo.update({ id: draft.id }, { status: 'CONFIRMED' });

    const quantityPart =
      draft.parsed_quantity != null
        ? `, ${draft.parsed_quantity}${draft.parsed_unit ? ` ${draft.parsed_unit}` : ''}`
        : '';
    await this.sendReplySafely(
      message.wa_id,
      `Recorded: ${draft.parsed_item}${quantityPart} — total ${expense.amount}. Thanks!`,
    );
  }

  // Not a recognized confirmation phrase -> treat as a correction: re-run
  // the reply text through the same AI parser Phase 2 uses (a fresh
  // extraction attempt, not a second AI call meant to interpret intent —
  // see CONFIRMATION_WHITELIST's comment for why confirmation intent
  // itself is never AI-interpreted) and update the SAME draft row in place.
  private async correctDraft(draft: WhatsappDraftExpenseEntity, message: WhatsappInboundMessageEntity): Promise<void> {
    const text = message.message_text;
    const outcome =
      text && text.trim().length > 0
        ? await this.aiClient.extractExpense(text)
        : {
            extraction: {
              item: null,
              quantity: null,
              unit: null,
              rate: null,
              trade_category: null,
              confidence: 'LOW' as const,
            },
            raw: { skipped: 'empty_message_text' },
          };

    await this.draftRepo.update(
      { id: draft.id },
      {
        parsed_item: outcome.extraction.item,
        parsed_quantity: outcome.extraction.quantity,
        parsed_unit: outcome.extraction.unit,
        parsed_rate: outcome.extraction.rate,
        parsed_trade_category: outcome.extraction.trade_category,
        confidence: outcome.extraction.confidence,
        // TypeORM's update() QueryDeepPartialEntity can't map a plain
        // `unknown`-typed jsonb column the way create()+save() can (see
        // WhatsappParsingService.parseAndStoreDraft, which hits the same
        // column via create() with no cast needed) — narrow cast only,
        // value itself is untouched.
        raw_ai_response: outcome.raw as WhatsappDraftExpenseEntity['raw_ai_response'] & object,
        // Explicit, not incidental — this loop can run more than once
        // (correction after correction) before a confirmation ever lands.
        status: 'PENDING',
      },
    );

    await this.sendReplySafely(message.wa_id, buildDraftSummaryText(outcome.extraction));
  }

  // Finds the project's existing section for this trade category, or
  // creates one — via ConstructionProjectService's own public methods only
  // (Law 9: no reaching into its repos/schema directly), same as
  // AdminService's composition-at-the-orchestrator pattern.
  private async findOrCreateSection(projectId: string, category: TradeCategory): Promise<string> {
    const project = await this.cpSvc.getProjectWithSectionsAndExpenses(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found — cannot record confirmed WhatsApp expense`);
    }

    const existing = project.sections.find((s) => s.category === category);
    if (existing) return existing.id;

    const created = await this.cpSvc.createSection(projectId, {
      category,
      display_order: project.sections.length,
    });
    return created.id;
  }

  // Best-effort send — caught and logged here, never propagated, per the
  // brief's "outbound send must not block or fail the flow that triggered
  // it." Whatever core action (confirm/correct) already happened stands
  // regardless of whether the WhatsApp reply itself made it out.
  private async sendReplySafely(to: string, text: string): Promise<void> {
    try {
      await this.outboundClient.sendTextMessage(to, text);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply to ${maskPhone(to)}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
