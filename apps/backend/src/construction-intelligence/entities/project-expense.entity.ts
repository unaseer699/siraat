import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// PROJECT COST TRACKER Chunk 1 — a single dated line item within a
// ProjectSection (e.g. one Wood Work invoice). IMMUTABLE — the one hard rule
// for this entity: corrections add a new expense entry (e.g. a negative
// amount, or an explicit correction note in `description`), never edit or
// overwrite an existing row. Enforced by NOT building an update-in-place
// method/endpoint for this entity in this chunk — see
// ConstructionProjectService, which has create/read only for expenses.
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

  @CreateDateColumn()
  created_at: Date;
}
