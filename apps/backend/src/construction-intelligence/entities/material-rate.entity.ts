import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP INTEGRATION Phase 6a — MARKET OBSERVATIONS. FIELD_REPORTED added
// for founder/site-reported actual purchase prices confirmed over WhatsApp —
// a first-party FACT, distinct from a third-party MARKET_REFERENCE price and
// from a SUPPLIER_VERIFIED quote (no supplier_id link here).
export type MaterialRateSourceTier = 'SUPPLIER_VERIFIED' | 'MARKET_REFERENCE' | 'FIELD_REPORTED';

@Index(['city', 'material_name'])
@Entity({ name: 'material_rates', schema: 'construction_intelligence' })
export class MaterialRateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  material_name: string;

  @Column({ length: 50 })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 20 })
  source_tier: MaterialRateSourceTier;

  // SUPPLIER DIRECTORY Chunk 2 — nullable as of this chunk: required only for
  // MARKET_REFERENCE (enforced in ConstructionIntelligenceService.createMaterialRate,
  // not at the DB level), optional for SUPPLIER_VERIFIED now that supplier_id
  // carries the real identity. Explicit `type: 'varchar'` is required here —
  // a `string | null` union has no usable design:type reflect-metadata
  // (TypeScript emits `Object` for it), the same DataTypeNotSupportedError
  // class of bug ContractorEntity.contact_whatsapp hit earlier.
  @Column({ type: 'varchar', length: 255, nullable: true })
  source_name: string | null;

  // No longer required for SUPPLIER_VERIFIED now that supplier_id below gives
  // a real link back to the supplier — kept as an optional fallback/override
  // display value. Still optional for MARKET_REFERENCE (unchanged).
  @Column({ type: 'text', nullable: true })
  source_contact: string | null;

  // SUPPLIER DIRECTORY Chunk 1 — UUID string, no SQL FK per Law 2 (references
  // SupplierEntity.id, which lives in a different schema: property_intelligence).
  // Required when source_tier is SUPPLIER_VERIFIED (enforced in
  // ConstructionIntelligenceService.createMaterialRate, not at the DB level —
  // same pattern as source_contact above); stays null for MARKET_REFERENCE.
  @Column({ type: 'uuid', nullable: true })
  supplier_id: string | null;

  // Settable independently of insert time — operator may enter a rate a day or two after receiving it
  @Column({ type: 'date' })
  recorded_date: string;

  // Always FACT — manually operator-entered rates via the admin dashboard, no scraping (Law 3)
  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  // Computed at write time from recorded_date vs. the tier's staleness threshold.
  // Same pattern as Score.is_stale (Law 5), but an independent field — per-rate, not per-society.
  @Column({ type: 'boolean' })
  is_stale: boolean;

  @CreateDateColumn()
  created_at: Date;
}
