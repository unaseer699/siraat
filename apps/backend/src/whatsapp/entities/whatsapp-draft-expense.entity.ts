import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';

// WHATSAPP INTEGRATION Phase 2 — AI PARSING. The output of parsing one
// RECEIVED inbound message is one draft row here. This is explicitly NOT the
// real Expense table (ProjectExpenseEntity, construction_intelligence schema)
// — no FK into Section or Expense exists yet. That link only forms in Phase 3
// once a human confirms a draft; until then this is scratch/working data, not
// a Fact about the project (Law 3 doesn't apply here the way it applies to
// ProjectExpenseEntity — there's no `record_type` column because this row is
// never itself a FACT or GENERATED record, just a parse attempt).
//
// This also satisfies Law 8 (UNTRUSTED_DATA tagging) in spirit without a
// literal UNTRUSTED_DATA column: every row here starts (and in this phase,
// stays) `status: PENDING` — a verification queue of one, sitting in front of
// the real Expense table exactly like the brief's "held in verification
// queue, never auto-promoted without human review" requirement. Phase 3 adds
// CONFIRMED/REJECTED/EDITED as the actions that move a row out of that queue.
//
// `data_acquisition` schema (Law 1: zero cross-context FKs), same as
// WhatsappInboundMessageEntity/WhatsappProjectMappingEntity. inbound_message_id
// references WhatsappInboundMessageEntity.id and project_ref references
// ConstructionProjectEntity.id (construction_intelligence schema) — both stay
// plain uuid columns, no TypeORM relation/SQL FK, matching this codebase's
// existing convention of not special-casing same-schema references either
// (see ProjectSectionEntity.project_ref's comment).
export type WhatsappDraftExpenseStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EDITED' | 'VOID';
export type WhatsappDraftConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

@Entity({ name: 'whatsapp_draft_expenses', schema: 'data_acquisition' })
export class WhatsappDraftExpenseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The RECEIVED message this draft was parsed from. Not unique — a future
  // parser revision could in principle produce more than one line item per
  // message — but indexed since a lookup "which draft(s) came from message X"
  // is a reasonable access pattern.
  @Index()
  @Column({ type: 'uuid' })
  inbound_message_id: string;

  // Snapshot of the source message's project_ref at parse time (same
  // snapshot-not-live-lookup convention as
  // WhatsappInboundMessageEntity.project_ref). Indexed — this is exactly the
  // filter GET /v1/admin/whatsapp-drafts?project_ref= uses.
  @Index()
  @Column({ type: 'uuid' })
  project_ref: string;

  // Nullable despite the brief listing it without a nullable qualifier: an
  // ambiguous/non-expense message (e.g. "hey is the site open today") has no
  // item to extract at all, and the brief is explicit that this case must
  // still produce a stored draft ("confidence: LOW (or null structured
  // fields)") rather than a row with a fabricated item value. Every other
  // parsed_* column already allows null for the same reason.
  @Column({ type: 'text', nullable: true })
  parsed_item: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  parsed_quantity: number | null;

  // Free-text unit as the AI extracted it (e.g. "bags") — deliberately not
  // constrained to ProjectExpenseEntity's ExpenseUnit enum. The brief asks
  // for that mapping discipline on parsed_trade_category only; unit
  // normalization into ExpenseUnit is Phase 3's job (confirm/edit), once a
  // human is in the loop to fix whatever the AI guessed wrong.
  @Column({ type: 'varchar', length: 50, nullable: true })
  parsed_unit: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  parsed_rate: number | null;

  // Must be one of TRADE_CATEGORIES (@siraat/shared-types) — same "stored as
  // plain varchar, not DB-constrained" convention as
  // ProjectSectionEntity.category. The AI prompt is given the actual list and
  // told not to invent categories (see WhatsappAiClient); this column is the
  // landing spot for whatever it picks, or null if it can't tell.
  @Column({ type: 'varchar', length: 30, nullable: true })
  parsed_trade_category: TradeCategory | null;

  // WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION.
  // Raw text as extracted (mirrors parsed_item's own convention) — kept
  // current across corrections the same way every other parsed_* column is,
  // but only the very first parse (WhatsappParsingService.parseAndStoreDraft)
  // ever creates a WhatsappSuggestedBusinessLink row from it; a correction
  // that reveals a new/changed mention is not separately re-detected (FOR
  // FOUNDER REVIEW, same kind of scope note as this file's other ones).
  @Column({ type: 'text', nullable: true })
  parsed_mentioned_business: string | null;

  // How sure the parse is — HIGH/MEDIUM/LOW rather than a raw 0-1 float
  // (unlike Law 5's confidence_score) since there's no scoring math here to
  // justify float precision, just the AI's own self-reported certainty
  // bucketed into a fixed vocabulary the admin UI can filter/sort on.
  @Column({ type: 'varchar', length: 10 })
  confidence: WhatsappDraftConfidence;

  // Full raw AI output (the whole API response, not just the extracted
  // fields) for debugging/audit — same "keep everything, don't discard
  // anything the source produced" convention as
  // WhatsappInboundMessageEntity.raw_payload.
  @Column({ type: 'jsonb' })
  raw_ai_response: unknown;

  // PENDING is the only value ever written in this phase — CONFIRMED/
  // REJECTED/EDITED are Phase 3 actions (the confirm-reply loop is out of
  // scope here). Widened to the full union now so Phase 3 doesn't need a
  // migration to add values, matching WhatsappInboundMessageStatus's own
  // "later phases add more states" precedent.
  //
  // WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. VOID added: a manual
  // admin action (WhatsappParsingService.voidDraft) for a stuck PENDING
  // draft the sender never replied to. Never a hard delete — same
  // corrections/void-never-deletion principle as ProjectExpenseEntity.
  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: WhatsappDraftExpenseStatus;

  // Set only when status = VOID (optional — the admin isn't required to
  // give a reason, unlike ProjectExpenseEntity.void_reason's mandatory
  // one). Left null otherwise.
  @Column({ type: 'text', nullable: true })
  void_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
