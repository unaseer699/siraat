import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// GROUND-CONDITION REPORTS — raw user submission, tagged UNTRUSTED_DATA
// (Law 8) and held in the review queue; never read by any public endpoint.
// `data_acquisition` schema. reporter_phone is private (spam control and
// follow-up verification only). fact_ref is a plain uuid (Law 1).
export type GroundReportStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

@Entity({ name: 'ground_report_submissions', schema: 'data_acquisition' })
export class GroundReportSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  society_name_raw: string;

  @Column({ type: 'varchar', length: 20 })
  block: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plot_number: string | null;

  @Column({ type: 'varchar', length: 20 })
  reporter_role: string;

  @Column({ type: 'varchar', length: 32 })
  reporter_phone: string;

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

  @Column({ type: 'varchar', length: 20, default: 'UNTRUSTED_DATA' })
  trust_tag: 'UNTRUSTED_DATA';

  @Column({ type: 'varchar', length: 20, default: 'PENDING_REVIEW' })
  status: GroundReportStatus;

  @Column({ type: 'text', nullable: true })
  review_note: string | null;

  @Column({ type: 'uuid', nullable: true })
  fact_ref: string | null;

  @CreateDateColumn()
  created_at: Date;
}
