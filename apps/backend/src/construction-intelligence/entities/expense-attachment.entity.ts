import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// A bill or invoice attached to an expense. Kept separate from the expense
// row so the ledger row itself is never changed (Law 3). expense_ref is a
// plain UUID, no SQL foreign key. When an expense is edited, its bills move
// to the new version of the expense.
@Entity({ name: 'expense_attachments', schema: 'construction_intelligence' })
export class ExpenseAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  project_ref: string;

  @Index()
  @Column({ type: 'uuid' })
  expense_ref: string;

  @Column({ type: 'varchar', length: 500 })
  storage_ref: string;

  @Column({ type: 'varchar', length: 200 })
  filename: string;

  @Column({ type: 'varchar', length: 100 })
  content_type: string;

  @Column({ type: 'bigint', default: 0 })
  size_bytes: string;

  // Bills can carry phone numbers or CNICs, so they are admin-only until the
  // admin chooses to show them to the owner.
  @Column({ type: 'boolean', default: false })
  visible_to_owner: boolean;

  @CreateDateColumn()
  created_at: Date;
}
