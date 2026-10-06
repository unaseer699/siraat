import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// GROUND-CONDITION REPORTS — an immutable FACT (Law 3): created only when an
// admin approves a GroundReportSubmissionEntity (Law 8), never updated; a
// correction is a new fact. `property_intelligence` schema; society_ref and
// source_ref are plain uuid strings (Law 1). Carries NO reporter contact.
@Entity({ name: 'ground_condition_facts', schema: 'property_intelligence' })
export class GroundConditionFactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  society_ref: string | null;

  @Column({ type: 'varchar', length: 255 })
  society_name_raw: string;

  @Column({ type: 'varchar', length: 20 })
  block: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plot_number: string | null;

  @Column({ type: 'varchar', length: 20 })
  reporter_role: string;

  @Column({ type: 'varchar', length: 20 })
  ground_condition: 'SOLID' | 'FILLED' | 'MIXED';

  @Column({ type: 'boolean', default: false })
  soil_test_done: boolean;

  @Column({ type: 'varchar', length: 20 })
  foundation_type: 'STANDARD' | 'RAFT' | 'DEEP_STRIP' | 'PILING';

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  foundation_depth_ft: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  extra_cost_lac: number | null;

  @Column({ type: 'smallint', nullable: true })
  build_year: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid' })
  source_ref: string;

  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @Column({ type: 'timestamptz', default: () => 'now()' })
  verified_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
