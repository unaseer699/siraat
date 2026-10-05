import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP LISTING INGESTION — sender allowlist. A message from a wa_id in
// this table is routed to WhatsappListingParsingService instead of the
// construction-expense flow (see WhatsappService.processInboundMessage),
// reusing the single existing WhatsApp number rather than provisioning a
// second Meta line. Deliberately separate from WhatsappProjectMappingEntity
// (a listing forwarder has no project — see PropertyListingEntity, which has
// no FK into construction_intelligence at all) even though both are
// "wa_id -> routing decision" tables; merging them would mean giving every
// listing forwarder a fake project_ref just to satisfy that table's shape.
//
// `data_acquisition` schema (Law 1: zero cross-context FKs), same as
// WhatsappProjectMappingEntity. Not a FACT/GENERATED entity per Law 3 — this
// is operational routing configuration, not domain evidence. Hard-deletable,
// same as WhatsappProjectMappingEntity.
@Entity({ name: 'whatsapp_listing_forwarders', schema: 'data_acquisition' })
export class WhatsappListingForwarderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  wa_id: string;

  // Human-readable identifier of who/what this number is (e.g. "Founder —
  // personal number", "Faisal Hills group admin") — purely descriptive, no
  // behavior depends on it.
  @Column({ type: 'varchar', length: 255 })
  label: string;

  // Same "free-text identifier, no real User/Identity system yet" situation
  // as WhatsappProjectMappingEntity.created_by.
  @Column({ type: 'varchar', length: 255 })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;
}
