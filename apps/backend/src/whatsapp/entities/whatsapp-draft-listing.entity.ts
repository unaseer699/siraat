import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP LISTING INGESTION — one row per PLOT, parsed from a forwarded
// real-estate-group inventory message. A multi-plot line ("FHC 7915 16") is
// split into two rows at parse time (one per plot_number), not stored as one
// row with two numbers — confirmed with the founder: "Multiplot means 7915
// and 7916... must be split into two separate listing rows."
//
// Satisfies Law 8 (UNTRUSTED_DATA tagging) the same way WhatsappDraftExpenseEntity
// does: every row starts (and can only ever start) `status: PENDING_REVIEW`,
// a verification queue of one. UNLIKE the expense flow, there is no
// confirm-reply loop here — the founder has already personally verified the
// source message before forwarding it (confirmed directly: "I will forward
// those message to Siraat after verifying them"), so promotion to a real,
// public PropertyListingEntity row is a single admin Publish action
// (WhatsappListingParsingService.publishDraft), not a second round-trip
// through WhatsApp.
//
// `data_acquisition` schema (Law 1: zero cross-context FKs), same as
// WhatsappDraftExpenseEntity. inbound_message_id references
// WhatsappInboundMessageEntity.id and listing_ref (once published) references
// PropertyListingEntity.id (property_intelligence schema) — both plain uuid
// columns, no TypeORM relation/SQL FK.
export type WhatsappDraftListingStatus = 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';

@Entity({ name: 'whatsapp_draft_listings', schema: 'data_acquisition' })
export class WhatsappDraftListingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The RECEIVED message this draft was parsed from. Not unique — one
  // message with multiple plots produces multiple draft rows.
  @Index()
  @Column({ type: 'uuid' })
  inbound_message_id: string;

  // The bold header line applying to all plots below it until the next
  // header (e.g. "Faisal hills") — kept raw/as-written, never normalized
  // against the Society directory here (that match happens, best-effort, at
  // publish time — see WhatsappListingParsingService.publishDraft).
  @Column({ type: 'text' })
  society_name_raw: string;

  // Block letter parsed out of an "FHC"-style code (Society abbreviation +
  // Block letter, confirmed: "FHC means Faisal Hills C block"). Null when no
  // block code is present in the line.
  @Column({ type: 'varchar', length: 20, nullable: true })
  block: string | null;

  @Column({ type: 'varchar', length: 20 })
  plot_number: string;

  // Plot size as written (e.g. "5 Marla") — most of the first sample batch
  // had no size at all (confirmed: "will send plot size as well"), so this
  // stays nullable rather than assumed-present.
  @Column({ type: 'text', nullable: true })
  size_raw: string | null;

  // Normalized to Marla where the AI can confidently convert (e.g. a stated
  // Kanal figure) — null whenever size_raw itself is null, or when the AI
  // can't confidently normalize what was written.
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  size_marla: number | null;

  // Always normalized to Lac as a decimal number (confirmed decimal rule:
  // "5450 lac means 54.50" — the AI applies the >2-digit insert-decimal rule
  // before this is stored, never a raw 4-digit integer).
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_lac: number | null;

  // Free-text legal-status flag, captured verbatim (confirmed: "Just mention
  // NDC open or Closed whatever mention in messsage") — deliberately NOT a
  // fixed enum, since the real messages use varying wording for this.
  @Column({ type: 'text', nullable: true })
  status_raw: string | null;

  // The exact source line(s) this row was parsed from, for admin review
  // (so a reviewer can see "7915 16" before trusting the split) and audit —
  // same "never discard what the source produced" convention as
  // WhatsappInboundMessageEntity.raw_payload.
  @Column({ type: 'text' })
  raw_line: string;

  @Column({ type: 'jsonb' })
  raw_ai_response: unknown;

  @Column({ type: 'varchar', length: 20, default: 'PENDING_REVIEW' })
  status: WhatsappDraftListingStatus;

  // Set only once status = PUBLISHED — the resulting PropertyListingEntity's
  // id (property_intelligence schema), plain uuid, no SQL FK (Law 1).
  @Column({ type: 'uuid', nullable: true })
  listing_ref: string | null;

  // Optional note, written on reject (mirrors WhatsappDraftExpenseEntity.void_reason).
  @Column({ type: 'text', nullable: true })
  review_note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
