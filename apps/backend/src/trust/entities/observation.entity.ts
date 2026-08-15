import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Append-only observation ledger — one row per meaningful state change on an
// entity owned by this context. Never updated or deleted (Law 3: FACT records
// are immutable; corrections create new rows, never overwrite history).
//
// Schema-per-context by design (Phase 2 domain model — "Observation owned by
// originating context, not Market Intelligence"). Property Intelligence and
// Construction Intelligence each own an identical-shaped table in their own
// schema; this one is Trust's copy — no shared table, no cross-schema FK.
@Index(['entity_ref', 'metric'])
@Entity({ name: 'observations', schema: 'trust' })
export class ObservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // UUID string reference to the Verification (or other in-context entity) this
  // observation is about — no SQL FK (Law 1: zero cross-context foreign keys).
  @Column('uuid')
  entity_ref: string;

  // e.g. "verification_status"
  @Column({ type: 'varchar', length: 100 })
  metric: string;

  // Nullable — the first-ever observation for an entity/metric pair has no prior value.
  @Column({ type: 'text', nullable: true })
  old_value: string | null;

  @Column({ type: 'text' })
  new_value: string;

  @Column({ type: 'text' })
  source_ref: string;

  @CreateDateColumn()
  recorded_at: Date;

  // Always FACT — an immutable record of a change that already happened (Law 3).
  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';
}
