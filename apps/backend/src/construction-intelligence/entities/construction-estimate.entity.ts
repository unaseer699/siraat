import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { BoqAreaUnit, BoqFloors, BoqLineItem, FinishLevel } from '@siraat/shared-types';

// MATERIAL + WORKS BOQ ESTIMATOR v1 — replaces the original grey-structure-
// only estimate cache entirely (old columns: area_marla/quality_tier/
// missing_materials — see git history for the retired shape). No other
// consumer reads this table (verified before this rewrite), so the schema
// change is a clean replacement, not an additive migration.
//
// Only FULL / DEGRADED_SUCCESS estimates are ever persisted — NOT_COVERED is
// never actually produced by BoqEstimatorService in v1 (quantities are pure
// geometry/ratio math with no dependency on city rate coverage), but the
// column stays wide enough for the type if that ever changes.
export type ConstructionEstimateState = 'FULL' | 'DEGRADED_SUCCESS';

// Material rates change slowly (weekly, per staleness.ts), so estimates reuse
// the same staleness-window caching pattern as ScoreEntity/ScoringService —
// recompute only once the cached row ages past
// ESTIMATE_STALENESS_THRESHOLD_DAYS, rather than on every request.
@Index(['city', 'area_sqft', 'floors', 'basement', 'finish_level'])
@Entity({ name: 'construction_estimates', schema: 'construction_intelligence' })
export class ConstructionEstimateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  area: number;

  @Column({ type: 'varchar', length: 10 })
  area_unit: BoqAreaUnit;

  // Always the converted covered-area value in sqft (1 marla = 225 sqft) —
  // stored alongside the raw area/area_unit the user actually entered so the
  // cache key and every downstream ratio calc use one canonical number.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  area_sqft: number;

  @Column({ type: 'smallint' })
  floors: BoqFloors;

  @Column({ type: 'boolean' })
  basement: boolean;

  @Column({ type: 'varchar', length: 20 })
  finish_level: FinishLevel;

  @Column({ type: 'varchar', length: 20 })
  state: ConstructionEstimateState;

  @Column({ type: 'jsonb' })
  line_items: BoqLineItem[];

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  total_estimate: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  partial_subtotal: number | null;

  // Step 0's "major" items (the 6 Core Materials) missing a verified rate —
  // named missing_major_items to match the response shape; only major items
  // ever block the grand total (see BOQ_MAJOR_ITEM_KEYS).
  @Column({ type: 'text', array: true, default: '{}' })
  missing_major_items: string[];

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

  // Always null today — MaterialRateEntity carries no is_siraat_affiliated
  // field, so the Law 6 condition is trivially never satisfied yet.
  @Column({ type: 'text', nullable: true })
  affiliation_disclosure: string | null;

  // Always GENERATED — estimates are never FACTs (Law 3).
  @Column({ type: 'varchar', length: 10, default: 'GENERATED' })
  record_type: 'GENERATED';

  @CreateDateColumn()
  computed_at: Date;

  // Reserved for future SCOS entities per docs/08-database-schema.md — not
  // read or written anywhere yet.
  @Column({ type: 'jsonb', nullable: true })
  extended_attributes: Record<string, unknown> | null;
}
