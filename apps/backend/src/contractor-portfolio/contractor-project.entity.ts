import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { ContractorProjectSource, ContractorProjectStatus } from '@siraat/shared-types';

export interface ProjectPhotoRef {
  key: string; // private, bucket-relative storage key
  content_type: string;
  size_bytes: number;
}

// CONTRACTOR PORTFOLIO — a past project with photos. Same schema as the
// contractors table, so the FK is same-context (not a Law 1 violation).
// Contractor-submitted rows are tagged UNTRUSTED_DATA and stay PENDING_REVIEW
// until an admin publishes them (Law 8). Never used as a source_ref.
@Index(['contractor_id'])
@Entity({ name: 'contractor_projects', schema: 'property_intelligence' })
export class ContractorProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  contractor_id: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  society_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plot_size: string | null;

  @Column({ type: 'int', nullable: true })
  completed_year: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  photos: ProjectPhotoRef[];

  @Column({ type: 'varchar', length: 20, default: 'PENDING_REVIEW' })
  status: ContractorProjectStatus;

  @Column({ type: 'varchar', length: 12, default: 'ADMIN' })
  source: ContractorProjectSource;

  @Column({ type: 'varchar', length: 20, default: 'ADMIN_ENTERED' })
  trust_tag: 'UNTRUSTED_DATA' | 'ADMIN_ENTERED';

  @CreateDateColumn()
  created_at: Date;
}
