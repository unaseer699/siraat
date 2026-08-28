import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { DocumentType } from '@siraat/shared-types';

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

  // EVIDENCE DOCUMENT MODEL Chunk 1 — the real-world date the document
  // itself was issued/dated, distinct from created_at below (which only
  // reflects when it was entered into Siraat). NULLABLE: existing Evidence
  // rows predate this field and won't have it; new entries should always
  // populate it via the admin form, but the schema must not break on old
  // data. See TrustService's shared evidence-sort helper for the DESC-with-
  // created_at-fallback rule this enables.
  @Column({ type: 'date', nullable: true })
  document_date: string | null;

  // Distinct from claim_type on VerificationEntity — one claim (e.g. NOC)
  // can have multiple document types tied to it, e.g. both "NOC" and a
  // later "NOC Cancellation" document. NULLABLE for the same
  // predates-this-field reason as document_date above.
  @Column({ type: 'varchar', length: 30, nullable: true })
  document_type: DocumentType | null;

  // Always FACT — immutable once created (Law 3)
  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
