import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP INTEGRATION Phase 1 — how the founder manually links a WhatsApp
// number to a Project (no self-service onboarding flow yet — later phase).
// One project per number: `wa_id` is unique (enforced at the DB level here,
// and checked at the service level for a clean 409 rather than a raw
// Postgres unique-violation reaching the client) so an inbound message's
// mapping lookup is never ambiguous — see WhatsappService.processInboundMessage.
//
// Not a FACT/GENERATED entity per Law 3 — this is operational admin
// configuration (which number maps to which project), not domain evidence.
// Hard-deletable, same as CandidateSocietyEntity.
//
// `data_acquisition` schema (Law 1: zero cross-context FKs) — this table
// lives in the ingestion bounded context, not construction_intelligence,
// even though `project_ref` points at a ConstructionProjectEntity row
// there. project_ref stays a plain uuid string, never a SQL FK.
@Entity({ name: 'whatsapp_project_mappings', schema: 'data_acquisition' })
export class WhatsappProjectMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Meta's WhatsApp sender identifier (E.164-ish digits, no '+'), e.g. "923001234567".
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  wa_id: string;

  // UUID string, no SQL FK per Law 1 — references ConstructionProjectEntity.id
  // in the construction_intelligence schema.
  @Column({ type: 'uuid' })
  project_ref: string;

  // No User/Identity system exists yet (same limitation BearerGuard already
  // documents) — free-text identifier of who created the mapping (e.g. the
  // founder's name/email), not a real user id.
  @Column({ type: 'varchar', length: 255 })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;
}
