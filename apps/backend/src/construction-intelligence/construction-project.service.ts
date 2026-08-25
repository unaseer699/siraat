import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';
import { ConstructionProjectEntity, type ConstructionProjectStatus } from './entities/construction-project.entity';
import { ProjectSectionEntity } from './entities/project-section.entity';
import { ProjectExpenseEntity } from './entities/project-expense.entity';

// PROJECT COST TRACKER Chunk 1 — Project/Section/Expense are closely related
// (a nested read is the primary use case) and this is enough surface to
// warrant its own cohesive service, separate from ConstructionIntelligenceService
// (which stays material-rates/estimates-focused). Both live in the same
// construction_intelligence module/schema.

export interface CreateProjectInput {
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
}

export interface ProjectResult {
  id: string;
  name: string;
  property_ref: string | null;
  owner_contact: string;
  start_date: string;
  status: ConstructionProjectStatus;
  record_type: 'FACT';
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
  };
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
  // May be negative — a correction to a prior expense is a new row with a
  // negative amount (or an explicit note in `description`), never an edit to
  // the original (Law 3: FACT records are immutable). See
  // ProjectExpenseEntity's comment.
  amount: number;
}

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
  record_type: 'FACT';
}

// amount is a `decimal` column, which pg/TypeORM returns as a string — same
// Number() conversion MaterialRateEntity.price goes through in
// ConstructionIntelligenceService's toResult.
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
    record_type: e.record_type,
  };
}

export interface SectionWithExpenses extends SectionResult {
  expenses: ExpenseResult[];
  subtotal: number;
}

export interface ProjectWithSectionsAndExpenses extends ProjectResult {
  sections: SectionWithExpenses[];
  total: number;
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
  ) {}

  async createProject(data: CreateProjectInput): Promise<ProjectResult> {
    const entity = this.projectRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.projectRepo.save(entity);
    return toProjectResult(saved);
  }

  async findProjectById(id: string): Promise<ProjectResult | null> {
    const entity = await this.projectRepo.findOneBy({ id });
    return entity ? toProjectResult(entity) : null;
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

  // No updateExpense/deleteExpense method exists here, deliberately — Law 3
  // (FACT records are immutable). Corrections are a new createExpense call.
  async createExpense(sectionId: string, data: CreateExpenseInput): Promise<ExpenseResult> {
    const entity = this.expenseRepo.create({ ...data, section_ref: sectionId, record_type: 'FACT' });
    const saved = await this.expenseRepo.save(entity);
    return toExpenseResult(saved);
  }

  // The full nested view: project → sections (ordered by display_order) →
  // expenses (ordered by expense_date), with a computed total and per-section
  // subtotals. Two queries total (sections, then all their expenses in one
  // IN() call) rather than one query per section.
  async getProjectWithSectionsAndExpenses(projectId: string): Promise<ProjectWithSectionsAndExpenses | null> {
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
            where: { section_ref: In(sectionIds) },
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
    const sectionsWithExpenses: SectionWithExpenses[] = sections.map((s) => {
      const sectionExpenses = expensesBySectionRef.get(s.id) ?? [];
      const subtotal = sectionExpenses.reduce((sum, e) => sum + e.amount, 0);
      total += subtotal;
      return { ...toSectionResult(s), expenses: sectionExpenses, subtotal };
    });

    return { ...toProjectResult(project), sections: sectionsWithExpenses, total };
  }
}
