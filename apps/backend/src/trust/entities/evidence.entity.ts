import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'evidence', schema: 'trust' })
export class EvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';

  // Bucket-relative path only — e.g. 'trust/society-name/document.pdf'.
  // Never prefix with the bucket name; StorageService supplies Bucket separately.
  @Column({ type: 'text' })
  file_ref: string;

  @Column({ type: 'text' })
  source_ref: string;

  // Always FACT — immutable once created (Law 3)
  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
