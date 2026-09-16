import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';
import { ConstructionProjectEntity, type ConstructionProjectStatus } from './entities/construction-project.entity';
import { ProjectSectionEntity } from './entities/project-section.entity';
import { ProjectExpenseEntity, type ProjectExpenseStatus, type ExpenseUnit, type ExpenseSource } from './entities/project-expense.entity';
import { ConstructionIntelligenceService } from './construction-intelligence.service';

// PROJECT COST TRACKER Chunk 1 — Project/Section/Expense are closely related
// (a nested read is the primary use case) and this is enough surface to
// warrant its own cohesive service, separate from ConstructionIntelligenceService
// (which stays material-rates/estimates-focused). Both live in the same
// construction_intelligence module/schema.

// ADMIN PROJECTS LIST — same default page size as
// PropertyIntelligenceService's DEFAULT_CONTRACTOR_PAGE_SIZE / house-plans.
const DEFAULT_PROJECT_PAGE_SIZE = 20;

export interface CreateProjectInput {
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
  // WHATSAPP INTEGRATION Phase 6a follow-up — MARKET OBSERVATIONS. Optional
  // key (not a required `city: string | null` like property_ref above) so
  // every existing caller/test that builds a CreateProjectInput without it
  // keeps compiling unchanged; defaults to null in createProject below.
  city?: string | null;
}

export interface ProjectResult {
  id: string;
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
  record_type: 'FACT';
  city: string | null;
}

function toProjectResult(e: ConstructionProjectEntity): ProjectResult {
  return {
    id: e.id,
    name: e.name,
    property_ref: e.property_ref,
    owner_contact: e.owner_contact,
    start_date: e.start_date,
    status: e.status,
    record_type: e.record_type,
    city: e.city,
  };
}

// ADMIN PROJECTS LIST — a lighter-weight row than ProjectResult: no
// property_ref/owner_contact/record_type (not shown in a list table), plus
// `total` — the same ACTIVE-only expense sum getProjectWithSectionsAndExpenses
// computes per-project, aggregated here across every section without needing
// the full nested sections/expenses tree per row.
export interface ProjectListItem {
  id: string;
  name: string;
  status: ConstructionProjectStatus;
  start_date: string;
  total: number;
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
  total_count: number;
  page: number;
  total_pages: number;
}

export interface CreateSectionInput {
  category: TradeCategory;
  display_order: number;
}

export interface SectionResult {
  id: string;
  project_ref: string;
  category: TradeCategory;
  display_order: number;
  record_type: 'FACT';
}

function toSectionResult(e: ProjectSectionEntity): SectionResult {
  return {
    id: e.id,
    project_ref: e.project_ref,
    category: e.category,
    display_order: e.display_order,
    record_type: e.record_type,
  };
}

export interface CreateExpenseInput {
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string | null;
  linked_contractor_id: string | null;
  linked_supplier_id: string | null;
  // "actual_cost" in the founder's brief — see ProjectExpenseEntity's
  // comment on why the column stays named `amount`. Optional (null) when
  // quantity+rate are both provided — resolveActualCost then computes it,
  // overriding whatever's sent here. Required otherwise; resolveActualCost
  // rejects the request (BadRequestException) if it's also missing. May
  // still be negative when explicitly typed — a correction to a prior
  // expense is a new row with a negative amount (Law 3: FACT records are
  // immutable). See ProjectExpenseEntity's comment.
  amount: number | null;
  // EXPENSE QUANTITY/RATE Chunk 1 — independent of each other and of
  // `amount`: quantity/unit may be saved alone (rate null) alongside a typed
  // amount; rate is never required just because quantity is present. See
  // resolveActualCost for the one rule that ties these together.
  quantity: number | null;
  unit: ExpenseUnit | null;
  rate: number | null;
  // WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. Optional (not required
  // of every existing caller/test) rather than adding a mandatory field to
  // every CreateExpenseInput site — defaults to null (same as an
  // unspecified manual entry) when omitted. See ProjectExpenseEntity.source.
  source?: ExpenseSource | null;
}

// EXPENSE EDIT/DELETE Chunk 1 — same field shape as create; a PATCH submits
// the full replacement content for the new superseding row, not a partial
// diff (see editExpense).
export type EditExpenseInput = CreateExpenseInput;

export interface ExpenseResult {
  id: string;
  section_ref: string;
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string | null;
  linked_contractor_id: string | null;
  linked_supplier_id: string | null;
  amount: number;
  quantity: number | null;
  unit: ExpenseUnit | null;
  rate: number | null;
  record_type: 'FACT';
  status: ProjectExpenseStatus;
  supersedes_id: string | null;
  void_reason: string | null;
  source: ExpenseSource | null;
}

// EXPENSE QUANTITY/RATE Chunk 1 — the one place `amount` is required vs.
// computed is decided (single source of truth, no frontend duplication):
//   - quantity AND rate present -> amount = round(quantity * rate),
//     overriding whatever `amount` the client sent (even if non-null).
//   - either missing -> `amount` must come from the client as before;
//     rejected if that's also missing.
//   - quantity/unit may still be saved with rate null (and vice versa) —
//     this function only decides what `amount` resolves to, it doesn't
//     touch quantity/unit on the entity at all.
function resolveActualCost(input: { amount: number | null; quantity: number | null; rate: number | null }): number {
  if (input.quantity != null && input.rate != null) {
    return Math.round(input.quantity * input.rate);
  }
  if (input.amount == null) {
    throw new BadRequestException(
      'amount is required unless both quantity and rate are provided (amount = quantity × rate)',
    );
  }
  return input.amount;
}

// amount/quantity/rate are `decimal` columns, which pg/TypeORM returns as
// strings — same Number() conversion MaterialRateEntity.price goes through
// in ConstructionIntelligenceService's toResult. quantity/rate stay null
// rather than becoming 0 when the column is null (Number(null) is 0, which
// would be wrong here).
function toExpenseResult(e: ProjectExpenseEntity): ExpenseResult {
  return {
    id: e.id,
    section_ref: e.section_ref,
    expense_date: e.expense_date,
    description: e.description,
    vendor_name: e.vendor_name,
    vendor_contact: e.vendor_contact,
    linked_contractor_id: e.linked_contractor_id,
    linked_supplier_id: e.linked_supplier_id,
    amount: Number(e.amount),
    quantity: e.quantity != null ? Number(e.quantity) : null,
    unit: e.unit,
    rate: e.rate != null ? Number(e.rate) : null,
    record_type: e.record_type,
    status: e.status,
    supersedes_id: e.supersedes_id,
    void_reason: e.void_reason,
    source: e.source ?? null,
  };
}

// Comparable snapshot of the fields an edit can actually change — used for
// the Observation's old_value/new_value (see editExpense). Excludes
// id/section_ref/record_type/status/supersedes_id/void_reason: those are
// either identity/lifecycle metadata, not "the expense," or (section_ref)
// never changes on an edit. `amount` here must always be the *resolved*
// cost — callers pass the already-computed value, never the raw (possibly
// null) client input.
function expenseValueSnapshot(e: {
  expense_date: string;
  description: string;
  vendor_name: string;
  vendor_contact: string | null;
  linked_contractor_id: string | null;
  linked_supplier_id: string | null;
  amount: number | string;
  quantity: number | string | null;
  unit: ExpenseUnit | null;
  rate: number | string | null;
}): string {
  return JSON.stringify({
    expense_date: e.expense_date,
    description: e.description,
    vendor_name: e.vendor_name,
    vendor_contact: e.vendor_contact,
    linked_contractor_id: e.linked_contractor_id,
    linked_supplier_id: e.linked_supplier_id,
    amount: Number(e.amount),
    quantity: e.quantity != null ? Number(e.quantity) : null,
    unit: e.unit,
    rate: e.rate != null ? Number(e.rate) : null,
  });
}

export interface SectionWithExpenses extends SectionResult {
  expenses: ExpenseResult[];
  subtotal: number;
}

// WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING. Live-computed, not a
// cached/denormalized table — this project's expense count is small enough
// that summing at query time (same pass as `total` below) is fine, and a
// cached summary would be a second source of truth that could go stale.
// ACTIVE-only, same as `total`/`subtotal` — a CORRECTED or VOID WhatsApp
// expense never counts here either.
export interface WhatsappActivitySummary {
  confirmed_count: number;
  total_amount: number;
}

export interface ProjectWithSectionsAndExpenses extends ProjectResult {
  sections: SectionWithExpenses[];
  total: number;
  whatsapp_activity: WhatsappActivitySummary;
}

@Injectable()
export class ConstructionProjectService {
  constructor(
    @InjectRepository(ConstructionProjectEntity)
    private readonly projectRepo: Repository<ConstructionProjectEntity>,
    @InjectRepository(ProjectSectionEntity)
    private readonly sectionRepo: Repository<ProjectSectionEntity>,
    @InjectRepository(ProjectExpenseEntity)
    private readonly expenseRepo: Repository<ProjectExpenseEntity>,
    // Reused for logObservation only — same public-API-call pattern
    // ScoringService uses to call PropertyIntelligenceService.logObservation
    // cross-module; here it's intra-module (both providers live in
    // ConstructionIntelligenceModule) but the principle is the same: call
    // the existing public method rather than duplicating an Observation
    // repo/helper a third time in this schema.
    private readonly ciSvc: ConstructionIntelligenceService,
  ) {}

  async createProject(data: CreateProjectInput): Promise<ProjectResult> {
    const entity = this.projectRepo.create({ ...data, city: data.city ?? null, record_type: 'FACT' });
    const saved = await this.projectRepo.save(entity);
    return toProjectResult(saved);
  }

  async findProjectById(id: string): Promise<ProjectResult | null> {
    const entity = await this.projectRepo.findOneBy({ id });
    return entity ? toProjectResult(entity) : null;
  }

  // ADMIN PROJECTS LIST — GET /v1/admin/projects. Same pagination pattern as
  // PropertyIntelligenceService.searchContractors/searchSuppliers (page/limit
  // params, getManyAndCount, total_pages = ceil(total_count/limit)). Newest
  // first, matching an admin's "what am I actively tracking" use case.
  //
  // Two queries total (paginated projects, then one grouped SUM over their
  // expenses) rather than N+1 — same "two queries, not one per row" shape as
  // getProjectWithSectionsAndExpenses's sections->expenses IN() call. The sum
  // is ACTIVE-only via the same status filter as that method, computed with
  // a join to ProjectSectionEntity since ProjectExpenseEntity has no direct
  // project_ref (only section_ref) — no SQL FK either way (Law 2), this is a
  // plain query-time join, not a TypeORM relation.
  async listProjects(params: { page?: number; limit?: number }): Promise<ProjectListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_PROJECT_PAGE_SIZE;

    const [projects, total_count] = await this.projectRepo
      .createQueryBuilder('p')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const projectIds = projects.map((p) => p.id);
    const sums =
      projectIds.length > 0
        ? await this.expenseRepo
            .createQueryBuilder('e')
            .innerJoin(ProjectSectionEntity, 's', 's.id = e.section_ref')
            .select('s.project_ref', 'project_id')
            .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
            .where('e.status = :status', { status: 'ACTIVE' })
            .andWhere('s.project_ref IN (:...projectIds)', { projectIds })
            .groupBy('s.project_ref')
            .getRawMany<{ project_id: string; total: string }>()
        : [];
    const totalByProjectId = new Map(sums.map((s) => [s.project_id, Number(s.total)]));

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        start_date: p.start_date,
        total: totalByProjectId.get(p.id) ?? 0,
      })),
      total_count,
      page,
      total_pages: Math.ceil(total_count / limit),
    };
  }

  async createSection(projectId: string, data: CreateSectionInput): Promise<SectionResult> {
    const entity = this.sectionRepo.create({ ...data, project_ref: projectId, record_type: 'FACT' });
    const saved = await this.sectionRepo.save(entity);
    return toSectionResult(saved);
  }

  async findSectionById(id: string): Promise<SectionResult | null> {
    const entity = await this.sectionRepo.findOneBy({ id });
    return entity ? toSectionResult(entity) : null;
  }

  async createExpense(sectionId: string, data: CreateExpenseInput): Promise<ExpenseResult> {
    // Resolved (and validated) before touching the repo at all — see
    // resolveActualCost. Overrides data.amount, which may be null on input.
    const amount = resolveActualCost(data);
    // status/supersedes_id/void_reason set explicitly rather than relying on
    // the column defaults — same reason record_type is passed explicitly
    // below even though its column also has a DB default: TypeORM doesn't
    // reflect plain `default:` values back into the returned JS entity after
    // save(), so toExpenseResult(saved) would otherwise report status as
    // undefined instead of 'ACTIVE'.
    const entity = this.expenseRepo.create({
      ...data,
      amount,
      section_ref: sectionId,
      record_type: 'FACT',
      status: 'ACTIVE',
      supersedes_id: null,
      void_reason: null,
      // Explicit rather than relying on `...data` alone — same reasoning as
      // record_type/status above: makes it unmistakable that this is the one
      // field a caller (WhatsappConfirmationService.confirmDraft) sets to
      // trace the row's origin, defaulting to null for every other caller.
      source: data.source ?? null,
    });
    const saved = await this.expenseRepo.save(entity);
    return toExpenseResult(saved);
  }

  // EXPENSE EDIT/DELETE Chunk 1 — resolves an expense and confirms it
  // actually belongs to `projectId` (via its section), not just that the id
  // exists somewhere. Shared by editExpense/voidExpense below.
  private async findExpenseInProject(projectId: string, expenseId: string): Promise<ProjectExpenseEntity> {
    const expense = await this.expenseRepo.findOneBy({ id: expenseId });
    if (!expense) throw new NotFoundException(`Expense ${expenseId} not found`);

    const section = await this.sectionRepo.findOneBy({ id: expense.section_ref });
    if (!section || section.project_ref !== projectId) {
      throw new NotFoundException(`Expense ${expenseId} not found in project ${projectId}`);
    }
    return expense;
  }

  private assertActive(expense: ProjectExpenseEntity, action: 'edited' | 'deleted'): void {
    if (expense.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Expense ${expense.id} cannot be ${action} — it is already ${expense.status}. ` +
          'Corrections and voids only apply to the current ACTIVE version of an expense.',
      );
    }
  }

  // Edit is NOT a field update (Law 3: FACT records are immutable — no
  // column on an existing row is ever mutated to reflect a correction).
  // Instead: a new ACTIVE row is created with the submitted values
  // (supersedes_id -> the original), and the original flips to CORRECTED.
  // Both writes happen in one transaction so a crash between them can never
  // leave two ACTIVE rows (or zero) for the same logical expense.
  async editExpense(projectId: string, expenseId: string, data: EditExpenseInput): Promise<ExpenseResult> {
    const original = await this.findExpenseInProject(projectId, expenseId);
    this.assertActive(original, 'edited');

    // Resolved (and validated) before opening the transaction — same
    // resolveActualCost rule as createExpense (requirement #3: edit
    // recomputes amount exactly like a fresh create would).
    const amount = resolveActualCost(data);

    const replacement = await this.expenseRepo.manager.transaction(async (manager) => {
      const newRow = manager.create(ProjectExpenseEntity, {
        ...data,
        amount,
        section_ref: original.section_ref,
        record_type: 'FACT',
        status: 'ACTIVE',
        supersedes_id: original.id,
        void_reason: null,
      });
      const saved = await manager.save(newRow);

      // Partial update — only status changes on the original row. Nothing
      // else about it is ever touched.
      await manager.update(ProjectExpenseEntity, { id: original.id }, { status: 'CORRECTED' });

      return saved;
    });

    // Fire-and-forget, reusing the existing helper Score/Verification/
    // Material rate Observations already go through — never blocks or fails
    // the edit itself (logObservation swallows its own write failures).
    void this.ciSvc.logObservation({
      entity_ref: original.id,
      metric: 'project_expense_correction',
      old_value: expenseValueSnapshot(original),
      new_value: expenseValueSnapshot({ ...data, amount }),
      source_ref: `Correction of expense ${original.id}`,
    });

    return toExpenseResult(replacement);
  }

  // Delete never removes a row (Law 3) — it voids it in place. void_reason
  // is mandatory (enforced by VoidExpenseBodySchema at the controller, not
  // re-validated here). A targeted update() rather than save(original) —
  // the SQL only ever touches status/void_reason here, never re-writing
  // amount/description/etc. even as a no-op.
  async voidExpense(projectId: string, expenseId: string, reason: string): Promise<ExpenseResult> {
    const original = await this.findExpenseInProject(projectId, expenseId);
    this.assertActive(original, 'deleted');

    await this.expenseRepo.update({ id: original.id }, { status: 'VOID', void_reason: reason });

    void this.ciSvc.logObservation({
      entity_ref: original.id,
      metric: 'project_expense_void',
      old_value: 'ACTIVE',
      new_value: 'VOID',
      source_ref: reason,
    });

    return toExpenseResult({ ...original, status: 'VOID', void_reason: reason });
  }

  // The full nested view: project → sections (ordered by display_order) →
  // expenses (ordered by expense_date), with a computed total and per-section
  // subtotals. Two queries total (sections, then all their expenses in one
  // IN() call) rather than one query per section.
  //
  // status: 'ACTIVE' is the default read filter — every section subtotal and
  // the project total are always derived from ACTIVE rows only, regardless
  // of `includeAllStatuses` below, so CORRECTED/VOID rows never double-count
  // or linger in a sum no matter who calls this or how. This is the query
  // the public project page (ConstructionProjectController) and the admin
  // dashboard (AdminController.getProject) both go through — there is no
  // second read path for expenses to have missed.
  //
  // EXPENSE EDIT/DELETE Chunk 2 — includeAllStatuses is admin-only surface
  // (only AdminController exposes it, via ?include_all_statuses=true; the
  // public ConstructionProjectController never passes it, so the public
  // dashboard's behavior is unchanged). It widens which rows land in each
  // section's `expenses` array (for the admin's collapsed-by-default
  // CORRECTED/VOID history reveal) — it never widens what `subtotal`/`total`
  // are computed from.
  async getProjectWithSectionsAndExpenses(
    projectId: string,
    options?: { includeAllStatuses?: boolean },
  ): Promise<ProjectWithSectionsAndExpenses | null> {
    const project = await this.projectRepo.findOneBy({ id: projectId });
    if (!project) return null;

    const sections = await this.sectionRepo.find({
      where: { project_ref: projectId },
      order: { display_order: 'ASC' },
    });

    const sectionIds = sections.map((s) => s.id);
    const expenses =
      sectionIds.length > 0
        ? await this.expenseRepo.find({
            where: options?.includeAllStatuses
              ? { section_ref: In(sectionIds) }
              : { section_ref: In(sectionIds), status: 'ACTIVE' },
            order: { expense_date: 'ASC' },
          })
        : [];

    const expensesBySectionRef = new Map<string, ExpenseResult[]>();
    for (const e of expenses) {
      const list = expensesBySectionRef.get(e.section_ref) ?? [];
      list.push(toExpenseResult(e));
      expensesBySectionRef.set(e.section_ref, list);
    }

    let total = 0;
    let whatsappConfirmedCount = 0;
    let whatsappTotalAmount = 0;
    const sectionsWithExpenses: SectionWithExpenses[] = sections.map((s) => {
      const sectionExpenses = expensesBySectionRef.get(s.id) ?? [];
      // Always ACTIVE-only, even when includeAllStatuses widened `expenses`
      // itself — subtotal/total must never reflect CORRECTED/VOID rows.
      const activeExpenses = sectionExpenses.filter((e) => e.status === 'ACTIVE');
      const subtotal = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
      total += subtotal;

      // WHATSAPP INTEGRATION Phase 5 — same ACTIVE-only pass, no separate
      // query (Law 9/"don't invent a second source of truth" — see
      // WhatsappActivitySummary's comment).
      for (const e of activeExpenses) {
        if (e.source === 'WHATSAPP') {
          whatsappConfirmedCount += 1;
          whatsappTotalAmount += e.amount;
        }
      }

      return { ...toSectionResult(s), expenses: sectionExpenses, subtotal };
    });

    return {
      ...toProjectResult(project),
      sections: sectionsWithExpenses,
      total,
      whatsapp_activity: { confirmed_count: whatsappConfirmedCount, total_amount: whatsappTotalAmount },
    };
  }
}
