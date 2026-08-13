import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { ScoreBreakdown } from '@siraat/shared-types';

@Entity({ name: 'scores', schema: 'market_intelligence' })
export class ScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  subject_type: string;

  // UUID string reference to property_intelligence.societies — never a SQL FK (Law 1)
  @Column('uuid')
  subject_id: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence_score: number;

  @Column({ type: 'boolean' })
  is_stale: boolean;

  @Column({ type: 'int', default: 30 })
  staleness_threshold_days: number;

  // Copied from Society.source_document_ids at computation time (citation trail)
  @Column({ type: 'text', array: true, default: '{}' })
  derived_from: string[];

  // Required key, nullable value — non-null IFF subject society is_siraat_affiliated (Law 6)
  @Column({ type: 'text', nullable: true })
  affiliation_disclosure: string | null;

  @Column({ type: 'text' })
  reasoning_summary: string;

  @Column({ type: 'jsonb', nullable: true })
  breakdown: ScoreBreakdown | null;

  @CreateDateColumn()
  computed_at: Date;

  // Always GENERATED — scores are never FACTs (Law 3)
  @Column({ type: 'varchar', length: 10, default: 'GENERATED' })
  record_type: 'GENERATED';
}
