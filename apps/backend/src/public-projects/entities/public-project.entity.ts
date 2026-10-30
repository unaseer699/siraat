import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export const PROJECT_CATEGORIES = ['ROADS', 'TRANSIT', 'NEW_CITY', 'HOUSING_PROGRAMME', 'POLICY_TAX', 'MASTER_PLAN'] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_STATUSES = ['PLANNED', 'ANNOUNCED', 'APPROVED', 'TENDERED', 'UNDER_CONSTRUCTION', 'DELAYED', 'COMPLETED', 'ONGOING'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// A government development that can change what an area is worth (road, rail,
// new city, housing programme, tax rule). Identity fields only: this row is a
// FACT and is never edited. Status and target changes are appended to
// project_status_events, so the delay history is kept (invariant 3).
@Entity({ name: 'public_projects', schema: 'market_intelligence' })
export class PublicProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  category: ProjectCategory;

  @Column({ type: 'varchar', length: 200 })
  region: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  province: string | null;

  @Column({ type: 'text', nullable: true })
  agencies: string | null;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  cost_pkr_bn: string | null;

  @Column({ type: 'date', nullable: true })
  original_target: string | null;

  // Lower-case phrases; a news headline containing one is linked to this project.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  keywords: string[];

  @Column({ type: 'text' })
  source_url: string;

  @Column({ type: 'varchar', length: 10, default: 'OFFICIAL' })
  source_kind: 'OFFICIAL' | 'MEDIA';

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
