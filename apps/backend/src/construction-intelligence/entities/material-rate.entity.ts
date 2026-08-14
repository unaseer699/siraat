import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export type MaterialRateSourceTier = 'SUPPLIER_VERIFIED' | 'MARKET_REFERENCE';

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

  @Column({ length: 255 })
  source_name: string;

  // Required for SUPPLIER_VERIFIED (traceability back to the supplier); optional for MARKET_REFERENCE
  @Column({ type: 'text', nullable: true })
  source_contact: string | null;

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
