import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { EstimateLineItem, QualityTier } from '@siraat/shared-types';

// Only FULL / DEGRADED_SUCCESS estimates are ever persisted — NOT_COVERED means
// there was nothing to compute (mirrors RecommendationsService, which never
// persists a Score for a NOT_COVERED search).
export type ConstructionEstimateState = 'FULL' | 'DEGRADED_SUCCESS';

// Material rates change slowly (weekly, per the staleness thresholds in
// staleness.ts), so estimates reuse the same staleness-window caching pattern as
// ScoreEntity/ScoringService.computeAndSave — recompute only once the cached row
// ages past ESTIMATE_STALENESS_THRESHOLD_DAYS, rather than on every request.
@Index(['city', 'area_marla', 'quality_tier'])
@Entity({ name: 'construction_estimates', schema: 'construction_intelligence' })
export class ConstructionEstimateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  area_marla: number;

  @Column({ type: 'varchar', length: 20 })
  quality_tier: QualityTier;

  @Column({ type: 'varchar', length: 20 })
  state: ConstructionEstimateState;

  @Column({ type: 'jsonb' })
  line_items: EstimateLineItem[];

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  total_estimate: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  partial_subtotal: number | null;

  @Column({ type: 'text', array: true, default: '{}' })
  missing_materials: string[];

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence_score: number;

  @Column({ type: 'boolean' })
  is_stale: boolean;

  @Column({ type: 'int', default: 7 })
  staleness_threshold_days: number;

  // MaterialRate FACT ids actually used to price a line — Law 3 (GENERATED
  // records carry derived_from pointing to FACT ids).
  @Column({ type: 'text', array: true, default: '{}' })
  derived_from: string[];

  // Always null today — MaterialRateEntity carries no is_siraat_affiliated field
  // (out of Chunk 1 scope), so the Law 6 condition ("non-null iff any derived_from
  // entity is affiliated") is trivially never satisfied yet.
  @Column({ type: 'text', nullable: true })
  affiliation_disclosure: string | null;

  // Always GENERATED — estimates are never FACTs (Law 3).
  @Column({ type: 'varchar', length: 10, default: 'GENERATED' })
  record_type: 'GENERATED';

  @CreateDateColumn()
  computed_at: Date;

  // Reserved for future SCOS entities per docs/08-database-schema.md — not read
  // or written anywhere yet.
  @Column({ type: 'jsonb', nullable: true })
  extended_attributes: Record<string, unknown> | null;
}
