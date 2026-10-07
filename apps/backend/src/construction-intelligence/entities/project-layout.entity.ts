import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export interface LayoutFloor {
  name: string;
  area_sqft: number;
  drawing_area_sqft?: number | null;
  allowed_area_sqft?: number | null;
}

export type LayoutExtraKind = 'FRONT_SHADE' | 'BACK_SHADE' | 'BALCONY' | 'PORCH';
export interface LayoutExtras {
  boundary_wall?: { length_ft: number; rate_per_ft: number } | null;
  items?: { kind: LayoutExtraKind; name: string; area_sqft: number }[];
}

// Configuration for a project's cost forecast: the covered area per floor
// (read from the architect's drawings), the finish level, and per-group price
// factors. Floor areas start as UNTRUSTED_DATA and only drive a FULL forecast
// once a human confirms them. Not a FACT record; forecasts computed from it
// are GENERATED and never stored.
@Entity({ name: 'project_layouts', schema: 'construction_intelligence' })
export class ProjectLayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  project_ref: string;

  @Column({ type: 'jsonb' })
  floors: LayoutFloor[];

  @Column({ type: 'jsonb', nullable: true })
  extras: LayoutExtras | null;

  // Percent complete per group (0-100), set by the admin as work proceeds.
  // Progress updates do not reset the layout's confirmation.
  @Column({ type: 'jsonb', nullable: true })
  progress: Record<string, number> | null;

  @Column({ type: 'varchar', length: 10, default: 'STANDARD' })
  finish_level: string;

  @Column({ type: 'jsonb', nullable: true })
  price_factors: Record<string, number> | null;

  @Column({ type: 'varchar', length: 20, default: 'UNTRUSTED_DATA' })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source_note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
