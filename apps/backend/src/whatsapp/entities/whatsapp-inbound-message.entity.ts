import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP INTEGRATION Phase 1 — receiving/verification/mapping layer only.
// This is intentionally NOT tied to Expense creation yet: no Expense row is
// ever created from this table. Status starts RECEIVED (mapped number) or
// UNMAPPED (no WhatsappProjectMapping found for the sender at receipt time).
//
// WHATSAPP INTEGRATION Phase 2 — AI PARSING adds PARSED: a RECEIVED message
// moves to PARSED once WhatsappParsingService has produced a
// WhatsappDraftExpenseEntity for it (confident or not — see that entity's
// comment). UNMAPPED messages never transition; they stay UNMAPPED until a
// mapping exists and a later admin review queue (Phase 4) handles the
// backlog. Later phases add CONFIRMED-related states as the
// confirm-loop → admin-review pipeline is built out further.
//
// `data_acquisition` schema (Law 1) — cross-context reference to a Project
// (construction_intelligence) is `project_ref`, a plain uuid string, never a
// SQL FK.
export type WhatsappInboundMessageStatus = 'RECEIVED' | 'UNMAPPED' | 'PARSED';

@Entity({ name: 'whatsapp_inbound_messages', schema: 'data_acquisition' })
export class WhatsappInboundMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Meta's own message id (messages[].id in the webhook payload) — the
  // idempotency key. Meta retries on any non-2xx/timeout, so duplicate
  // deliveries of the same id are expected, not exceptional. Unique at the
  // DB level as the source of truth against a concurrent-delivery race;
  // WhatsappService also does a cheap findOneBy check first for the common
  // case. See WhatsappService.processInboundMessage.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  wa_message_id: string;

  // Sender's WhatsApp id (phone digits, no '+'). Raw value stored here is
  // fine — the "no PII beyond what's needed" rule (Law/brief SECURITY
  // requirement) is about LOG output, not this record; see
  // WhatsappService.maskPhone, used only when this value is logged.
  @Column({ type: 'varchar', length: 32 })
  wa_id: string;

  // Meta's message type (e.g. 'text', 'image', 'document', ...). Kept
  // alongside message_text (rather than assuming every inbound message is
  // text) since Phase 1 stores whatever arrives — AI parsing in a later
  // phase decides what's actionable, not this layer.
  @Column({ type: 'varchar', length: 32 })
  message_type: string;

  // Only populated for type = 'text' (messages[].text.body). Null for any
  // other message type in this phase.
  @Column({ type: 'text', nullable: true })
  message_text: string | null;

  // Meta's own message timestamp (messages[].timestamp, unix epoch
  // seconds), converted to a real timestamp — not the row's own created_at,
  // which is "when Siraat received/stored it."
  @Column({ type: 'timestamptz' })
  wa_timestamp: Date;

  // Full raw webhook entry for this message, for auditability/future
  // reprocessing — nothing Meta sent is ever discarded even though only a
  // few fields are pulled into their own columns above.
  @Column({ type: 'jsonb' })
  raw_payload: unknown;

  // Resolved from WhatsappProjectMappingEntity at receipt time (a snapshot,
  // not a live lookup) — null when status is UNMAPPED. If a mapping is
  // added later, this row is NOT retroactively updated in this phase; a
  // later admin review queue (Phase 4) handles unmapped backlog.
  @Column({ type: 'uuid', nullable: true })
  project_ref: string | null;

  @Column({ type: 'varchar', length: 16 })
  status: WhatsappInboundMessageStatus;

  @CreateDateColumn()
  created_at: Date;
}
