import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type ProjectExpenseStatus = 'ACTIVE' | 'CORRECTED' | 'VOID';

// PROJECT COST TRACKER Chunk 1 — a single dated line item within a
// ProjectSection (e.g. one Wood Work invoice). IMMUTABLE — the one hard rule
// for this entity: no column is ever mutated in place after creation.
//
// EXPENSE EDIT/DELETE Chunk 1 — "immutable" doesn't mean "can't be
// corrected or voided," it means corrections/voids never overwrite history:
//   - Edit creates a NEW row (supersedes_id -> the row it replaces, status
//     ACTIVE) and flips the old row's status to CORRECTED. The old row's
//     amount/description/date/etc. are never touched.
//   - Delete flips status to VOID (+ void_reason) in place — this is the one
//     column that IS allowed to change post-creation, since it's metadata
//     about the row's lifecycle, not a fact about the expense itself. No row
//     is ever hard-deleted.
// See ConstructionProjectService.editExpense/voidExpense — there is still no
// method that rewrites amount/description/vendor_name/etc. on an existing row.
// Every @Column explicitly typed — see ConstructionProjectEntity's comment
// for why.
@Entity({ name: 'project_expenses', schema: 'construction_intelligence' })
export class ProjectExpenseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // UUID string, no SQL FK per Law 2 — references ProjectSectionEntity.id.
  @Column({ type: 'uuid' })
  section_ref: string;

  @Column({ type: 'date' })
  expense_date: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  vendor_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendor_contact: string | null;

  // Optional link if the vendor happens to be a real Contractor in the
  // directory — UUID string, no SQL FK per Law 2 (property_intelligence is a
  // different schema). Stays null when the vendor is free text only.
  @Column({ type: 'uuid', nullable: true })
  linked_contractor_id: string | null;

  // Same as linked_contractor_id above, for Supplier.
  @Column({ type: 'uuid', nullable: true })
  linked_supplier_id: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  // EXPENSE EDIT/DELETE Chunk 1 — every read/list/sum site must filter to
  // ACTIVE by default (see ConstructionProjectService.getProjectWithSectionsAndExpenses,
  // the single query site all of admin + the public project page share).
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' })
  status: ProjectExpenseStatus;

  // Points at the row this one corrects — UUID string, not a real SQL FK.
  // Same-table self-reference, but every other cross-row link in this file
  // (section_ref, linked_contractor_id, linked_supplier_id) is already a
  // plain uuid column rather than a TypeORM relation, so this stays
  // consistent rather than being the one exception.
  @Column({ type: 'uuid', nullable: true })
  supersedes_id: string | null;

  // Set only when status = VOID (the delete endpoint requires a non-empty
  // reason). Left null for ACTIVE/CORRECTED rows.
  @Column({ type: 'text', nullable: true })
  void_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
