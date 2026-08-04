import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Index(['city', 'min_price', 'max_price'])
@Index('idx_societies_property_types', { synchronize: false })
@Entity({ name: 'societies', schema: 'property_intelligence' })
export class SocietyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  min_price: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  max_price: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  min_area_marla: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  max_area_marla: number | null;

  @Column({ type: 'text', array: true, default: '{}' })
  property_types: string[];

  @Column({ type: 'boolean', default: false })
  noc_approved: boolean;

  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.5 })
  base_confidence: number;

  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'text', nullable: true })
  affiliation_disclosure: string | null;

  @Column({ type: 'text', nullable: true })
  noc_summary: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  source_document_ids: string[];

  @Column({ type: 'boolean', default: false })
  is_stale: boolean;

  @Column({ type: 'int', default: 30 })
  staleness_threshold_days: number;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT' | 'GENERATED';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
