import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// One row per daily (or manual) news check, so "last checked" reflects when the
// job ran, not when a relevant headline last turned up.
@Entity({ name: 'project_refresh_runs', schema: 'market_intelligence' })
export class ProjectRefreshRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  finished_at: Date;

  @Column({ type: 'varchar', length: 10, default: 'SCHEDULE' })
  trigger: 'SCHEDULE' | 'MANUAL';

  @Column({ type: 'int', default: 0 })
  feeds_ok: number;

  @Column({ type: 'int', default: 0 })
  feeds_failed: number;

  @Column({ type: 'int', default: 0 })
  headlines_seen: number;

  @Column({ type: 'int', default: 0 })
  relevant: number;

  @Column({ type: 'int', default: 0 })
  inserted: number;

  // Which feeds failed and why, one per line. NULL when all worked.
  @Column({ type: 'text', nullable: true })
  failed_feeds: string | null;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';
}
