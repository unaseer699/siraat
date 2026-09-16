import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export type WhatsappSuggestedBusinessLinkStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

// WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION
// (REVIEW-GATED). data_acquisition schema, same as WhatsappDraftExpenseEntity/
// WhatsappInboundMessageEntity (Law 1: zero cross-context FKs) — draft_expense_id
// references WhatsappDraftExpenseEntity.id (same schema) and
// matched_contractor_id/matched_supplier_id reference property_intelligence
// rows, all as plain uuid columns with no TypeORM relation/SQL FK, matching
// this codebase's existing convention (see WhatsappDraftExpenseEntity's own
// comment on inbound_message_id/project_ref).
//
// A row here is always just a SUGGESTION — never a link. Trust's standing
// law (verification is human-only, disclosure not inference) is exactly why
// this exists as a review queue rather than an auto-applied link:
// WhatsappBusinessLinkService.approve() is the ONLY place that ever creates
// a real Trust-side Verification claim from a WhatsApp mention, and only on
// an explicit admin action.
@Index(['status'])
@Entity({ name: 'whatsapp_suggested_business_links', schema: 'data_acquisition' })
export class WhatsappSuggestedBusinessLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The draft whose AI extraction produced this mention — one detection
  // attempt per parsed message, not re-run on corrections (see
  // WhatsappDraftExpenseEntity.parsed_mentioned_business's own comment).
  @Column({ type: 'uuid' })
  draft_expense_id: string;

  // Raw text as extracted by the AI — never itself used as a link target
  // anywhere (same discipline Phase 6a's material-price Observation
  // follows for entity_ref): only matched_contractor_id/matched_supplier_id,
  // once approved, ever back a real link.
  @Column({ type: 'text' })
  mentioned_name: string;

  // Fuzzy-match suggestions only (WhatsappBusinessLinkService.detectAndSuggest,
  // via PropertyIntelligenceService.searchContractorsByName/searchSuppliersByName)
  // — never auto-populated as a confirmed link, and mutually exclusive (a
  // name is suggested against at most one directory). Both null means no
  // plausible match was found; still surfaced to the admin as a possible new
  // business per the brief, rather than discarded. Re-populated with
  // whichever id actually got linked once approve() runs (may differ from
  // the original auto-match if the admin provided an override).
  @Column({ type: 'uuid', nullable: true })
  matched_contractor_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  matched_supplier_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING_REVIEW' })
  status: WhatsappSuggestedBusinessLinkStatus;

  // No User/Identity system exists yet — same "always null via HTTP today"
  // situation as EvidenceSubmissionEntity.submitted_by, kept for when one does.
  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  // Optional reject reason (per the brief) — not used on approve.
  @Column({ type: 'text', nullable: true })
  review_note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
