import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'evidence_submissions', schema: 'trust' })
export class EvidenceSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // UUID string of the subject being verified (society_id) — never a SQL FK (Law 1)
  @Column('uuid')
  linked_to: string;

  @Column({ type: 'varchar', length: 30 })
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';

  @Column({ type: 'text' })
  source_ref: string;

  @Column({ type: 'text' })
  file_ref: string;

  @Column({ type: 'varchar', length: 20, default: 'pending_review' })
  status: 'pending_review' | 'accepted' | 'rejected';

  // No User entity yet — same pattern as Property.owner_ref
  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  // Phase 9 Law 8: user-submitted data is always UNTRUSTED_DATA until human review
  @Column({ type: 'varchar', length: 20, default: 'UNTRUSTED_DATA' })
  data_classification: string;

  @CreateDateColumn()
  submitted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;
}
