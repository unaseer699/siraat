import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type {
  TradeCategory,
  MaterialCategory,
  HousePlanStyle,
  ContractorSummary,
  ContractorListResponse,
  SupplierSummary,
  SupplierListResponse,
  HousePlanSummary,
  HousePlanListResponse,
  DocumentType,
} from '@siraat/shared-types';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService, ClaimType } from '../trust/trust.service';
import { StorageService } from '../trust/storage.service';
import { CandidateSocietyEntity } from '../property-intelligence/entities/candidate-society.entity';
import {
  ConstructionIntelligenceService,
  CreateMaterialRateInput,
  MaterialRateResult,
} from '../construction-intelligence/construction-intelligence.service';
import {
  ConstructionProjectService,
  type CreateProjectInput,
  type ProjectResult,
  type ProjectListResponse,
  type CreateSectionInput,
  type SectionResult,
  type CreateExpenseInput,
  type EditExpenseInput,
  type ExpenseResult,
  type ProjectWithSectionsAndExpenses,
} from '../construction-intelligence/construction-project.service';

export type { ClaimType };
export type { CreateMaterialRateInput, MaterialRateResult };
export type {
  CreateProjectInput,
  ProjectResult,
  ProjectListResponse,
  CreateSectionInput,
  SectionResult,
  CreateExpenseInput,
  EditExpenseInput,
  ExpenseResult,
  ProjectWithSectionsAndExpenses,
};

// GET /v1/admin/material-rates response shape — MaterialRateResult plus the
// linked supplier's resolved name (see listMaterialRates below). Admin-only;
// not in shared-types since no other consumer needs supplier_name.
export interface MaterialRateListItem extends MaterialRateResult {
  supplier_name: string | null;
}

export interface EvidenceInput {
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  file_ref: string;
  source_ref: string;
  // EVIDENCE DOCUMENT MODEL Chunk 1 — see TrustService.createEvidenceRecord/
  // createAndLinkEvidence.
  document_date: string | null;
  document_type: DocumentType | null;
}

export interface CreateSocietyInput {
  name: string;
  city: string;
  min_price: number | null;
  max_price: number | null;
  min_area_marla: number | null;
  max_area_marla: number | null;
  property_types: string[];
  noc_approved: boolean;
  base_confidence: number;
  is_siraat_affiliated: boolean;
  affiliation_disclosure: string | null;
  noc_summary: string | null;
  developer_id: string | null;
  claim: string;
  claim_type: ClaimType;
  target_status: 'VERIFIED' | 'PENDING';
  evidence: EvidenceInput[];
}

// CONTRACTOR/SUPPLIER DIRECTORY Chunks 2 — generalized from the old
// society-only { society_id } shape. Restricted to 'SOCIETY' | 'CONTRACTOR' |
// 'SUPPLIER' here (not the full VerificationSubjectType) because those are
// the only subjects with an admin claim-adding entry point today; DEVELOPER
// claims are still seeded outside this flow.
export interface AddClaimInput {
  subject_type: 'SOCIETY' | 'CONTRACTOR' | 'SUPPLIER';
  subject_id: string;
  claim: string;
  claim_type: ClaimType;
  target_status: 'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED';
  evidence: EvidenceInput[];
}

export interface CreateContractorInput {
  name: string;
  trade_categories: TradeCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
}

export interface CreateSupplierInput {
  name: string;
  material_categories: MaterialCategory[];
  service_cities: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  is_siraat_affiliated: boolean;
}

export interface CreateHousePlanInput {
  title: string;
  area_marla: number;
  bedrooms: number;
  style: HousePlanStyle;
  preview_image_ref: string;
  description: string;
  contact_whatsapp: string;
  is_siraat_affiliated: boolean;
}

// POST /v1/admin/house-plans/:id/upload-image — no @fastify/multipart plugin
// installed (this app runs on the Fastify adapter, not Express, so
// @nestjs/platform-express's FileInterceptor/multer isn't usable here
// either), so the file travels as a base64 string in a JSON body rather than
// multipart/form-data. Minimal, matches the Chunk 1 scope note.
export interface UploadHousePlanImageInput {
  filename: string;
  content_type: string;
  data_base64: string;
}

// ADMIN CRUD PHASE 1 Chunk 1 — PATCH bodies. Deliberately all-optional
// (partial update) and, for house plans, deliberately without
// preview_image_ref — that field is only ever set via uploadHousePlanImage.
export interface UpdateCandidateSocietyInput {
  name?: string;
  regulator?: CandidateSocietyEntity['regulator'];
  city?: string;
  status?: CandidateSocietyEntity['status'];
}

export interface UpdateHousePlanInput {
  title?: string;
  area_marla?: number;
  bedrooms?: number;
  style?: HousePlanStyle;
  description?: string;
  contact_whatsapp?: string;
  is_siraat_affiliated?: boolean;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly piSvc: PropertyIntelligenceService,
    private readonly trustSvc: TrustService,
    private readonly ciSvc: ConstructionIntelligenceService,
    private readonly storageSvc: StorageService,
    private readonly cpSvc: ConstructionProjectService,
  ) {}

  // CLEANUP — was AdminService's own CandidateSocietyEntity repository
  // access (via AdminModule's own TypeOrmModule.forFeature registration,
  // now removed); delegates to PropertyIntelligenceService instead, same
  // cross-module public-method-call pattern used everywhere else here
  // (piSvc/ciSvc/trustSvc) rather than a second repo owner for one table.
  async listCandidateSocieties(status?: string): Promise<CandidateSocietyEntity[]> {
    return this.piSvc.listCandidateSocieties(status);
  }

  async createSocietyWithFirstClaim(
    data: CreateSocietyInput,
  ): Promise<{ society_id: string; verification_id: string; candidate_marked_onboarded: boolean }> {
    if (data.target_status === 'VERIFIED' && data.evidence.length === 0) {
      throw new BadRequestException(
        'VERIFIED status requires at least one evidence item',
      );
    }

    const society = await this.piSvc.createSociety({
      name: data.name,
      city: data.city,
      min_price: data.min_price,
      max_price: data.max_price,
      min_area_marla: data.min_area_marla,
      max_area_marla: data.max_area_marla,
      property_types: data.property_types,
      noc_approved: data.noc_approved,
      base_confidence: data.base_confidence,
      is_siraat_affiliated: data.is_siraat_affiliated,
      affiliation_disclosure: data.affiliation_disclosure,
      noc_summary: data.noc_summary,
      developer_id: data.developer_id,
    });

    // Create PENDING verification first so createAndLinkEvidence can find and update it
    const verification = await this.trustSvc.createVerification({
      subject_type: 'SOCIETY',
      subject_id: society.id,
      claim: data.claim,
      claim_type: data.claim_type,
      status: 'PENDING',
      evidence_refs: [],
    });

    for (const item of data.evidence) {
      await this.trustSvc.createAndLinkEvidence(society.id, item);
    }

    let verificationId = '';
    if (data.target_status === 'VERIFIED') {
      // ID-scoped promotion - targets this exact Verification row, never a subject_id lookup
      // that could match a different (unrelated) Verification for the same society.
      const ver = await this.trustSvc.promoteVerificationToVerified(verification.id);
      verificationId = ver.id;
    }

    // Mark matching CandidateSociety ONBOARDED (exact name match) — CLEANUP:
    // delegates to PropertyIntelligenceService.markCandidateSocietyOnboarded
    // now, same as listCandidateSocieties above.
    const candidateMarked = await this.piSvc.markCandidateSocietyOnboarded(data.name);

    return {
      society_id: society.id,
      verification_id: verificationId,
      candidate_marked_onboarded: candidateMarked,
    };
  }

  // CONTRACTOR DIRECTORY Chunk 2 — generalized from addClaimToSociety(). Same
  // logic as before (evidence-collection loop, then createVerification), just
  // no longer hardcoded to SOCIETY: the existence check dispatches on
  // subject_type and subject_type/subject_id flow straight through to
  // TrustService.createVerification, which (per Chunk 1) was already generic.
  async addClaim(
    data: AddClaimInput,
  ): Promise<{ verification_id: string }> {
    if (data.target_status === 'VERIFIED' && data.evidence.length === 0) {
      throw new BadRequestException(
        'VERIFIED status requires at least one evidence item',
      );
    }

    // SUPPLIER DIRECTORY Chunk 2 — one more branch, same dispatch-on-subject_type
    // pattern; everything below (evidence collection, createVerification) is
    // already fully generic and needed zero changes.
    const subject =
      data.subject_type === 'SOCIETY'
        ? await this.piSvc.findSocietyById(data.subject_id)
        : data.subject_type === 'CONTRACTOR'
          ? await this.piSvc.findContractorById(data.subject_id)
          : await this.piSvc.findSupplierById(data.subject_id);
    if (!subject) {
      const label =
        data.subject_type === 'SOCIETY'
          ? 'Society'
          : data.subject_type === 'CONTRACTOR'
            ? 'Contractor'
            : 'Supplier';
      throw new NotFoundException(`${label} ${data.subject_id} not found`);
    }

    // Collect evidence IDs before creating the verification (matches CLI script pattern)
    const evidenceIds: string[] = [];
    for (const item of data.evidence) {
      const ev = await this.trustSvc.createEvidenceRecord(item);
      evidenceIds.push(ev.id);
    }

    const verification = await this.trustSvc.createVerification({
      subject_type: data.subject_type,
      subject_id: data.subject_id,
      claim: data.claim,
      claim_type: data.claim_type,
      status: data.target_status,
      evidence_refs: evidenceIds,
    });

    return { verification_id: verification.id };
  }

  async createEvidence(
    data: EvidenceInput,
  ): Promise<{ id: string; type: string; source_ref: string }> {
    const ev = await this.trustSvc.createEvidenceRecord(data);
    return { id: ev.id, type: ev.type, source_ref: ev.source_ref };
  }

  // ADD EVIDENCE TO EXISTING CLAIM — POST
  // /v1/admin/verifications/:verificationId/evidence. The one admin action
  // for adding a second (or third...) piece of evidence to a claim that
  // already exists — until now the only admin path was "create a new claim
  // with its first evidence" (addClaim above). 404 (via TrustService) if
  // the verification id doesn't exist; never touches the claim's status.
  async addEvidenceToVerification(
    verificationId: string,
    data: EvidenceInput,
  ): Promise<{
    id: string;
    type: string;
    file_ref: string;
    source_ref: string;
    document_date: string | null;
    document_type: DocumentType | null;
  }> {
    const ev = await this.trustSvc.addEvidenceToVerification(verificationId, data);
    return {
      id: ev.id,
      type: ev.type,
      file_ref: ev.file_ref,
      source_ref: ev.source_ref,
      document_date: ev.document_date,
      document_type: ev.document_type,
    };
  }

  async createMaterialRate(data: CreateMaterialRateInput): Promise<MaterialRateResult> {
    return this.ciSvc.createMaterialRate(data);
  }

  // Enriches each rate with the linked supplier's name — MaterialRateEntity
  // (construction_intelligence) only carries a bare supplier_id UUID (Law 1:
  // no cross-context FK), so the admin table was rendering a truncated ID
  // instead of a name. Resolved here rather than in ConstructionIntelligenceService
  // itself, since that service must not reach into property_intelligence
  // (Law 9) — AdminService already holds both piSvc and ciSvc, same
  // composition-at-the-orchestrator pattern as createSocietyWithFirstClaim.
  async listMaterialRates(filters: { city?: string; material?: string }): Promise<MaterialRateListItem[]> {
    const rates = await this.ciSvc.listMaterialRates(filters);

    const supplierIds = [...new Set(rates.map((r) => r.supplier_id).filter((id): id is string => !!id))];
    const suppliers = supplierIds.length > 0 ? await this.piSvc.findSuppliersByIds(supplierIds) : [];
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

    return rates.map((r) => ({
      ...r,
      supplier_name: r.supplier_id ? (nameById.get(r.supplier_id) ?? null) : null,
    }));
  }

  // DEVELOPER-SOCIETY LINK Chunk 3 — GET /v1/admin/developers?search=
  async searchDevelopers(query: string): Promise<{ id: string; name: string }[]> {
    return this.piSvc.searchDevelopers(query);
  }

  // DUPLICATE SOCIETY PREVENTION — GET /v1/admin/societies/search?name=&city=
  // Live-check powering new-society/page.tsx's warning, before the operator
  // ever submits. Wraps PropertyIntelligenceService.findSocietyByNameAndCity
  // (the same exact-match rule createSociety's hard block uses) into the
  // array shape every other admin search-as-you-type endpoint returns
  // (searchDevelopers/searchContractorsByName/searchSuppliersByName) —
  // 0 or 1 entries in practice, since name+city is effectively unique here.
  async searchSocieties(name: string, city: string): Promise<{ id: string; name: string; city: string }[]> {
    const match = await this.piSvc.findSocietyByNameAndCity(name, city);
    return match ? [{ id: match.id, name: match.name, city: match.city }] : [];
  }

  // CONTRACTOR DIRECTORY Chunk 2 — POST /v1/admin/contractors
  async createContractor(data: CreateContractorInput): Promise<ContractorSummary> {
    return this.piSvc.createContractor(data);
  }

  // CONTRACTOR DIRECTORY Chunk 2 — GET /v1/admin/contractors, same delegation
  // pattern as listMaterialRates above.
  async searchContractors(filters: {
    trade_category?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<ContractorListResponse> {
    return this.piSvc.searchContractors(filters);
  }

  // PROJECT COST TRACKER Chunk 2 — GET /v1/admin/contractors/search?q=, same
  // delegation pattern as searchDevelopers/searchSuppliersByName above;
  // powers the contractor picker on the admin project expense form.
  async searchContractorsByName(query: string): Promise<{ id: string; name: string }[]> {
    return this.piSvc.searchContractorsByName(query);
  }

  // SUPPLIER DIRECTORY Chunk 2 — POST /v1/admin/suppliers, same delegation
  // pattern as createContractor above.
  async createSupplier(data: CreateSupplierInput): Promise<SupplierSummary> {
    return this.piSvc.createSupplier(data);
  }

  // SUPPLIER DIRECTORY Chunk 2 — GET /v1/admin/suppliers, same delegation
  // pattern as searchContractors above.
  async searchSuppliers(filters: {
    material_category?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<SupplierListResponse> {
    return this.piSvc.searchSuppliers(filters);
  }

  // SUPPLIER DIRECTORY Chunk 2b — GET /v1/admin/suppliers/search?q=, same
  // delegation pattern as searchDevelopers above; powers the supplier picker
  // on the admin material-rate form.
  async searchSuppliersByName(query: string): Promise<{ id: string; name: string }[]> {
    return this.piSvc.searchSuppliersByName(query);
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — POST /v1/admin/house-plans, same
  // delegation pattern as createContractor/createSupplier above.
  async createHousePlan(data: CreateHousePlanInput): Promise<HousePlanSummary> {
    return this.piSvc.createHousePlan(data);
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — GET /v1/admin/house-plans, same
  // delegation pattern as searchContractors/searchSuppliers above.
  async searchHousePlans(filters: {
    area_marla_min?: number;
    area_marla_max?: number;
    bedrooms?: number;
    style?: string;
    page?: number;
    limit?: number;
  }): Promise<HousePlanListResponse> {
    return this.piSvc.searchHousePlans(filters);
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — POST /v1/admin/house-plans/:id/upload-image.
  // Orchestrates across StorageService (raw S3 write) and
  // PropertyIntelligenceService (persists the resulting key) — same
  // composition-at-the-orchestrator pattern as listMaterialRates above.
  async uploadHousePlanImage(
    id: string,
    data: UploadHousePlanImageInput,
  ): Promise<{ preview_image_ref: string }> {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);

    const key = `house-plans/${id}/${data.filename}`;
    const buffer = Buffer.from(data.data_base64, 'base64');
    await this.storageSvc.uploadFile(key, buffer, data.content_type);
    await this.piSvc.updateHousePlanPreviewImage(id, key);

    return { preview_image_ref: key };
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — PATCH /v1/admin/house-plans/:id, same
  // find-or-404 delegation pattern as addClaim's subject lookups above.
  async updateHousePlan(id: string, data: UpdateHousePlanInput): Promise<HousePlanSummary> {
    const updated = await this.piSvc.updateHousePlan(id, data);
    if (!updated) throw new NotFoundException(`House plan ${id} not found`);
    return updated;
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — DELETE /v1/admin/house-plans/:id.
  // Orchestrates across StorageService (image cleanup) and
  // PropertyIntelligenceService (the catalog row itself) — same
  // composition-at-the-orchestrator pattern as uploadHousePlanImage above.
  // Image cleanup is best-effort: a failure here is logged loudly (not
  // silently swallowed — it does leave an orphaned file in the bucket) but
  // must not block deleting the catalog record itself, e.g. if the object
  // was already gone or the storage backend has a transient blip.
  async deleteHousePlan(id: string): Promise<void> {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);

    if (plan.preview_image_ref) {
      try {
        await this.storageSvc.deleteFile(plan.preview_image_ref);
      } catch (err) {
        this.logger.error(
          `Failed to delete stored image for house plan ${id} (key=${plan.preview_image_ref}) — file may be orphaned in the bucket`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    await this.piSvc.deleteHousePlan(id);
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — PATCH /v1/admin/candidate-societies/:id.
  // Candidate Societies are a todo-list with no Trust/Observation history
  // pointing at them, so plain update is safe here in a way it would not be
  // for Society/Developer/Contractor/Supplier.
  async updateCandidateSociety(
    id: string,
    data: UpdateCandidateSocietyInput,
  ): Promise<CandidateSocietyEntity> {
    const updated = await this.piSvc.updateCandidateSociety(id, data);
    if (!updated) throw new NotFoundException(`Candidate society ${id} not found`);
    return updated;
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — DELETE /v1/admin/candidate-societies/:id.
  // No storage cleanup needed — Candidate Societies carry no file references.
  async deleteCandidateSociety(id: string): Promise<void> {
    const deleted = await this.piSvc.deleteCandidateSociety(id);
    if (!deleted) throw new NotFoundException(`Candidate society ${id} not found`);
  }

  // ─── PROJECT COST TRACKER Chunk 1 ──────────────────────────────────────────

  // POST /v1/admin/projects — no existence check needed, this is the create path.
  async createProject(data: CreateProjectInput): Promise<ProjectResult> {
    return this.cpSvc.createProject(data);
  }

  // GET /v1/admin/projects — admin projects list. Same plain-passthrough
  // delegation as searchContractors/searchSuppliers above (no existence
  // check needed, this is the list path).
  async listProjects(params: { page?: number; limit?: number }): Promise<ProjectListResponse> {
    return this.cpSvc.listProjects(params);
  }

  // POST /v1/admin/projects/:id/sections — existence-checked here (not in
  // ConstructionProjectService) same as every other find-or-404 in this file.
  async createProjectSection(projectId: string, data: CreateSectionInput): Promise<SectionResult> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.cpSvc.createSection(projectId, data);
  }

  // POST /v1/admin/sections/:id/expenses
  async createSectionExpense(sectionId: string, data: CreateExpenseInput): Promise<ExpenseResult> {
    const section = await this.cpSvc.findSectionById(sectionId);
    if (!section) throw new NotFoundException(`Section ${sectionId} not found`);
    return this.cpSvc.createExpense(sectionId, data);
  }

  // PATCH /v1/admin/projects/:projectId/expenses/:id — project existence
  // checked here (same find-or-404 pattern as every other route in this
  // file); expense-belongs-to-project and status=ACTIVE are checked inside
  // ConstructionProjectService.editExpense, since resolving that requires
  // the expense's section anyway.
  async editProjectExpense(
    projectId: string,
    expenseId: string,
    data: EditExpenseInput,
  ): Promise<ExpenseResult> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.cpSvc.editExpense(projectId, expenseId, data);
  }

  // DELETE /v1/admin/projects/:projectId/expenses/:id — voids, never deletes.
  async voidProjectExpense(projectId: string, expenseId: string, reason: string): Promise<ExpenseResult> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.cpSvc.voidExpense(projectId, expenseId, reason);
  }

  // GET /v1/admin/projects/:id — full nested view (project → sections →
  // expenses) with a computed total and per-section subtotals.
  // includeAllStatuses (EXPENSE EDIT/DELETE Chunk 2) is admin-only surface —
  // see ConstructionProjectService.getProjectWithSectionsAndExpenses. The
  // public route (ConstructionProjectController) never passes this.
  async getProjectWithSectionsAndExpenses(
    id: string,
    includeAllStatuses?: boolean,
  ): Promise<ProjectWithSectionsAndExpenses> {
    const result = await this.cpSvc.getProjectWithSectionsAndExpenses(id, { includeAllStatuses });
    if (!result) throw new NotFoundException(`Project ${id} not found`);
    return result;
  }
}
