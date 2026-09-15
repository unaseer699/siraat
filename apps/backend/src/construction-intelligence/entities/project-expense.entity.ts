import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type ProjectExpenseStatus = 'ACTIVE' | 'CORRECTED' | 'VOID';

// WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. Which channel created
// this row. Not an enum of every possible future channel — just the two
// that exist today.
export type ExpenseSource = 'WHATSAPP' | 'MANUAL';

// EXPENSE QUANTITY/RATE Chunk 1 — enum, not free-text, same discipline
// TradeCategory/MaterialCategory already follow elsewhere in this schema.
export type ExpenseUnit = 'PCS' | 'KG' | 'TON' | 'BAG' | 'CFT' | 'SFT' | 'RFT' | 'LTR';

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

  // "actual_cost" in the founder's brief — kept as `amount`, the name this
  // column has had since Chunk 1, rather than renaming every call site for
  // no functional gain. Always resolved to a definite number before save —
  // see ConstructionProjectService.resolveActualCost — never null in a
  // persisted row, even though the client may submit it as null when
  // quantity+rate are both present instead.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // EXPENSE QUANTITY/RATE Chunk 1 — optional structured cost inputs. Real
  // B-17 data showed material costs (bricks/steel/cement/sand/crush) are
  // naturally qty×rate, and hand-typed `amount` totals are error-prone; when
  // both are present, `amount` is computed from them instead of typed (see
  // resolveActualCost). All three independent/nullable — no DB-level
  // all-or-nothing constraint; quantity/unit may be saved alone (rate null)
  // alongside a typed `amount`. The cross-field "amount required unless
  // quantity+rate both present" rule is enforced in the service layer only,
  // so it can evolve without a migration.
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  quantity: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  unit: ExpenseUnit | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  rate: number | null;

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

  // WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. Traceability for where
  // this row came from. Set explicitly, once, at the one call site that
  // actually knows the channel — WhatsappConfirmationService.confirmDraft
  // passes 'WHATSAPP'; every other creation path (the plain manual Project
  // Cost Tracker flow) leaves it null. Never inferred at read time by
  // joining back to whatsapp_draft_expenses — that would be a cross-context
  // reach (Law 1) and slower than reading a column already on this row.
  // Nullable with no DB default: every pre-Phase-5 row reads back as an
  // explicit SQL NULL via TypeORM's ALTER TABLE ADD COLUMN (synchronize),
  // same migration-safe shape as quantity/unit/rate above.
  @Column({ type: 'varchar', length: 10, nullable: true })
  source: ExpenseSource | null;

  @CreateDateColumn()
  created_at: Date;
}
