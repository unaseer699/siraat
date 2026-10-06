import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export const PROJECT_DOCUMENT_KINDS = ['ARCHITECTURAL', 'STRUCTURAL', 'ELECTRICAL', 'PLUMBING', 'SOIL', 'OTHER'] as const;
export type ProjectDocumentKind = (typeof PROJECT_DOCUMENT_KINDS)[number];

// A drawing or report attached to a project (architect's layout, structural
// set, soil report...). The file lives in the bucket; this row is the
// reference. visible_to_owner controls whether it shows on the owner's
// dashboard.
@Entity({ name: 'project_documents', schema: 'construction_intelligence' })
export class ProjectDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  project_ref: string;

  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  storage_ref: string;

  @Column({ type: 'varchar', length: 100 })
  content_type: string;

  @Column({ type: 'bigint', default: 0 })
  size_bytes: string;

  @Column({ type: 'boolean', default: true })
  visible_to_owner: boolean;

  @CreateDateColumn()
  created_at: Date;
}
