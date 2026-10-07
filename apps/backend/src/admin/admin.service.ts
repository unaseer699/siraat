import { Injectable, BadRequestException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { GroundReportSubmissionService } from '../ground-reports/ground-report-submission.service';
import type { GroundReportStatus } from '../ground-reports/ground-report-submission.entity';
import type {
  SectionCategory,
  ExpenseKind,
  TradeCategory,
  MaterialCategory,
  HousePlanStyle,
  ContractorSummary,
  ContractorListResponse,
  SupplierSummary,
  SupplierListResponse,
  HousePlanSummary,
  HousePlanListResponse,
  HousePlanImage,
  HousePlanImageType,
  HousePlanAccessTier,
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
  type UpdateProjectInput,
  type ProjectResult,
  type ProjectListResponse,
  type CreateSectionInput,
  type SectionResult,
  type CreateExpenseInput,
  type EditExpenseInput,
  type ExpenseResult,
  type ImportExpenseLine,
  type ProjectWithSectionsAndExpenses,
} from '../construction-intelligence/construction-project.service';
import {
  WhatsappService,
  type CreateMappingInput as WhatsappCreateMappingInput,
} from '../whatsapp/whatsapp.service';
import { WhatsappParsingService, type WhatsappDraftListItem } from '../whatsapp/whatsapp-parsing.service';
import {
  WhatsappBusinessLinkService,
  type ApproveSuggestedLinkInput,
} from '../whatsapp/whatsapp-business-link.service';
import {
  WhatsappListingForwarderService,
  type CreateListingForwarderInput,
} from '../whatsapp/whatsapp-listing-forwarder.service';
import { WhatsappListingParsingService, type WhatsappDraftListingWithFlags } from '../whatsapp/whatsapp-listing-parsing.service';
import type { WhatsappProjectMappingEntity } from '../whatsapp/entities/whatsapp-project-mapping.entity';
import type {
  WhatsappDraftExpenseEntity,
  WhatsappDraftExpenseStatus,
} from '../whatsapp/entities/whatsapp-draft-expense.entity';
import type { WhatsappInboundMessageEntity } from '../whatsapp/entities/whatsapp-inbound-message.entity';
import type { WhatsappSuggestedBusinessLinkEntity } from '../whatsapp/entities/whatsapp-suggested-business-link.entity';
import type { WhatsappListingForwarderEntity } from '../whatsapp/entities/whatsapp-listing-forwarder.entity';
import type { WhatsappDraftListingEntity, WhatsappDraftListingStatus } from '../whatsapp/entities/whatsapp-draft-listing.entity';

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

// WHATSAPP INTEGRATION Phase 1 — re-exported so callers (admin.controller.ts)
// don't need to reach into ../whatsapp/whatsapp.service directly.
export type CreateWhatsappMappingInput = WhatsappCreateMappingInput;

import { ProjectForecastService, FinishLevel } from '../construction-intelligence/project-forecast.service';
import { WhatsappOutboundClient } from '../whatsapp/whatsapp-outbound.client';
import { ProjectDocumentService } from '../construction-intelligence/project-document.service';
import { LayoutExtractorService } from '../construction-intelligence/layout-extractor.service';
import type { ProjectDocumentKind } from '../construction-intelligence/entities/project-document.entity';
import { LayoutFloor, LayoutExtras } from '../construction-intelligence/entities/project-layout.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly piSvc: PropertyIntelligenceService,
    private readonly trustSvc: TrustService,
    private readonly ciSvc: ConstructionIntelligenceService,
    private readonly storageSvc: StorageService,
    private readonly cpSvc: ConstructionProjectService,
    private readonly waSvc: WhatsappService,
    private readonly waParsingSvc: WhatsappParsingService,
    private readonly waLinkSvc: WhatsappBusinessLinkService,
    private readonly waListingForwarderSvc: WhatsappListingForwarderService,
    private readonly waListingParsingSvc: WhatsappListingParsingService,
    private readonly groundReportSvc: GroundReportSubmissionService,
    @Optional() private readonly forecastSvc?: ProjectForecastService,
    @Optional() private readonly docSvc?: ProjectDocumentService,
    @Optional() private readonly extractorSvc?: LayoutExtractorService,
    @Optional() private readonly waOutbound?: WhatsappOutboundClient,
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
    await this.cleanupReplacedFile(plan.preview_image_ref, key, `house plan ${id} preview image`);

    return { preview_image_ref: key };
  }

  // PRE-DATA-POPULATION REVIEW finding #7/#8 — re-uploading a cover or
  // gallery image (either the base64 path or the presigned-URL path) stores
  // the new file under a fresh key but previously left the old key's object
  // sitting in the bucket forever, since storage keys are content-addressed
  // by filename, not overwritten in place. This is the shared cleanup used
  // by all four upload-completion call sites below, mirroring the exact
  // best-effort, non-blocking pattern already used in deleteHousePlan and
  // deleteHousePlanImage: a failure here must never block the request that
  // already succeeded at its real job (persisting the new reference) — it
  // just risks one more orphaned file, which is logged loudly so it can be
  // swept later rather than silently lost.
  private async cleanupReplacedFile(
    oldKey: string | null | undefined,
    newKey: string,
    description: string,
  ): Promise<void> {
    if (!oldKey || oldKey === newKey) return;

    try {
      await this.storageSvc.deleteFile(oldKey);
    } catch (err) {
      this.logger.error(
        `Failed to delete replaced file for ${description} (old key=${oldKey}) — file may be orphaned in the bucket`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // Large-file path for the cover image — same reasoning/shape as
  // requestHousePlanImageUploadUrl/finalizeHousePlanImageUpload below
  // (Vercel's 4.5MB serverless body cap on the base64 route above).
  async requestHousePlanPreviewImageUploadUrl(
    id: string,
    data: { filename: string; content_type: string },
  ): Promise<{ upload_url: string; key: string; content_type: string }> {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);

    const key = `house-plans/${id}/${data.filename}`;
    const upload_url = await this.storageSvc.getPresignedUploadUrl(key, data.content_type);
    return { upload_url, key, content_type: data.content_type };
  }

  async finalizeHousePlanPreviewImageUpload(
    id: string,
    data: { key: string; content_type: string },
  ): Promise<{ preview_image_ref: string }> {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);

    await this.piSvc.updateHousePlanPreviewImage(id, data.key);
    await this.cleanupReplacedFile(plan.preview_image_ref, data.key, `house plan ${id} preview image`);
    return { preview_image_ref: data.key };
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

  // ─── HOUSE PLAN GALLERY ────────────────────────────────────────────────

  async createHousePlanImage(
    housePlanId: string,
    data: { image_type: HousePlanImageType; access_tier: HousePlanAccessTier; price: number; display_order: number },
  ): Promise<HousePlanImage> {
    const plan = await this.piSvc.findHousePlanById(housePlanId);
    if (!plan) throw new NotFoundException(`House plan ${housePlanId} not found`);
    return this.piSvc.createHousePlanImage(housePlanId, data);
  }

  async listHousePlanImages(housePlanId: string): Promise<{ images: HousePlanImage[] }> {
    const plan = await this.piSvc.findHousePlanById(housePlanId);
    if (!plan) throw new NotFoundException(`House plan ${housePlanId} not found`);
    return { images: await this.piSvc.listHousePlanImages(housePlanId) };
  }

  // Same StorageService + PropertyIntelligenceService orchestration pattern
  // as uploadHousePlanImage above, keyed one level deeper (per image id, not
  // per plan) so each gallery image gets its own object in the bucket.
  async uploadHousePlanImageFile(
    housePlanId: string,
    imageId: string,
    data: UploadHousePlanImageInput,
  ): Promise<HousePlanImage> {
    const image = await this.piSvc.findHousePlanImageById(imageId);
    if (!image || image.house_plan_id !== housePlanId) {
      throw new NotFoundException(`Image ${imageId} not found for house plan ${housePlanId}`);
    }

    const key = `house-plans/${housePlanId}/images/${imageId}/${data.filename}`;
    const buffer = Buffer.from(data.data_base64, 'base64');
    await this.storageSvc.uploadFile(key, buffer, data.content_type);
    await this.piSvc.updateHousePlanImageFile(imageId, key, data.content_type);
    await this.cleanupReplacedFile(image.storage_ref, key, `house plan image ${imageId}`);

    return {
      id: image.id,
      house_plan_id: image.house_plan_id,
      image_type: image.image_type,
      access_tier: image.access_tier,
      price: Number(image.price),
      display_order: image.display_order,
      has_file: true,
      content_type: data.content_type,
    };
  }

  // Large-file path — see StorageService.getPresignedUploadUrl. The browser
  // PUTs the raw file straight to the bucket with the URL this returns, so
  // the file itself never passes through this server (or, for the deployed
  // app, through Vercel's proxy route and its 4.5MB body cap).
  async requestHousePlanImageUploadUrl(
    housePlanId: string,
    imageId: string,
    data: { filename: string; content_type: string },
  ): Promise<{ upload_url: string; key: string; content_type: string }> {
    const image = await this.piSvc.findHousePlanImageById(imageId);
    if (!image || image.house_plan_id !== housePlanId) {
      throw new NotFoundException(`Image ${imageId} not found for house plan ${housePlanId}`);
    }

    const key = `house-plans/${housePlanId}/images/${imageId}/${data.filename}`;
    const upload_url = await this.storageSvc.getPresignedUploadUrl(key, data.content_type);
    return { upload_url, key, content_type: data.content_type };
  }

  // Called once the browser's direct PUT (above) has completed — persists
  // storage_ref/content_type exactly as uploadHousePlanImageFile does, minus
  // the actual file transfer.
  async finalizeHousePlanImageUpload(
    housePlanId: string,
    imageId: string,
    data: { key: string; content_type: string },
  ): Promise<HousePlanImage> {
    const image = await this.piSvc.findHousePlanImageById(imageId);
    if (!image || image.house_plan_id !== housePlanId) {
      throw new NotFoundException(`Image ${imageId} not found for house plan ${housePlanId}`);
    }

    await this.piSvc.updateHousePlanImageFile(imageId, data.key, data.content_type);
    await this.cleanupReplacedFile(image.storage_ref, data.key, `house plan image ${imageId}`);

    return {
      id: image.id,
      house_plan_id: image.house_plan_id,
      image_type: image.image_type,
      access_tier: image.access_tier,
      price: Number(image.price),
      display_order: image.display_order,
      has_file: true,
      content_type: data.content_type,
    };
  }

  async updateHousePlanImage(
    imageId: string,
    data: Partial<{ access_tier: HousePlanAccessTier; price: number; display_order: number }>,
  ): Promise<HousePlanImage> {
    const updated = await this.piSvc.updateHousePlanImageTier(imageId, data);
    if (!updated) throw new NotFoundException(`Image ${imageId} not found`);
    return updated;
  }

  // Same best-effort storage-cleanup-then-row-delete pattern as deleteHousePlan
  // above — a cleanup failure is logged loudly but must not block removing
  // the gallery row itself.
  async deleteHousePlanImage(housePlanId: string, imageId: string): Promise<void> {
    const image = await this.piSvc.findHousePlanImageById(imageId);
    if (!image || image.house_plan_id !== housePlanId) {
      throw new NotFoundException(`Image ${imageId} not found for house plan ${housePlanId}`);
    }

    if (image.storage_ref) {
      try {
        await this.storageSvc.deleteFile(image.storage_ref);
      } catch (err) {
        this.logger.error(
          `Failed to delete stored file for house plan image ${imageId} (key=${image.storage_ref}) — file may be orphaned in the bucket`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    await this.piSvc.deleteHousePlanImage(imageId);
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

  // PATCH /v1/admin/projects/:id — thin passthrough. Unlike
  // createProjectSection/editProjectExpense below, there's no separate
  // "does the project it belongs to exist" check needed here: this route
  // edits the project row itself, and ConstructionProjectService.updateProject
  // already loads that exact row to diff old vs. new values, throwing its own
  // NotFoundException if it's missing.
  async updateProject(id: string, data: UpdateProjectInput): Promise<ProjectResult> {
    return this.cpSvc.updateProject(id, data);
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

  async moveProjectExpenses(
    projectId: string,
    expenseIds: string[],
    category: SectionCategory,
    kind: ExpenseKind | null,
  ): Promise<{ moved: number; skipped: number }> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.cpSvc.moveExpenses(projectId, expenseIds, category, kind);
  }

  private forecast(): ProjectForecastService {
    if (!this.forecastSvc) throw new BadRequestException('Forecast service unavailable');
    return this.forecastSvc;
  }

  private docs(): ProjectDocumentService {
    if (!this.docSvc) throw new BadRequestException('Document service unavailable');
    return this.docSvc;
  }

  private async requireProject(projectId: string): Promise<void> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
  }

  async requestProjectDocumentUpload(projectId: string, data: { filename: string; content_type: string }) {
    await this.requireProject(projectId);
    return this.docs().requestUpload(projectId, data);
  }

  async finalizeProjectDocument(
    projectId: string,
    data: { key: string; content_type: string; kind: ProjectDocumentKind; title: string; visible_to_owner: boolean },
  ) {
    await this.requireProject(projectId);
    return this.docs().finalize(projectId, data);
  }

  async listProjectDocuments(projectId: string) {
    await this.requireProject(projectId);
    return this.docs().list(projectId, { ownerView: false });
  }

  async setProjectDocumentVisibility(projectId: string, docId: string, visible: boolean) {
    await this.docs().setVisibility(projectId, docId, visible);
    return { ok: true };
  }

  async deleteProjectDocument(projectId: string, docId: string) {
    await this.docs().remove(projectId, docId);
    return { ok: true };
  }

  async startProjectLayoutRead(projectId: string, docId: string) {
    if (!this.extractorSvc) throw new BadRequestException('Layout reader unavailable');
    await this.requireProject(projectId);
    const { status } = this.extractorSvc.start(projectId, docId);
    return { status };
  }

  async getProjectLayoutRead(projectId: string, docId: string) {
    if (!this.extractorSvc) throw new BadRequestException('Layout reader unavailable');
    await this.requireProject(projectId);
    const job = this.extractorSvc.status(docId);
    return { status: job.status, result: job.result ?? null, error: job.error ?? null };
  }

  async diagnoseWhatsapp(to: string | null) {
    if (!this.waOutbound) throw new BadRequestException('WhatsApp client unavailable');
    return this.waOutbound.diagnose(to);
  }

  async getProjectForecast(projectId: string) {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.forecast().forecast(projectId);
  }

  async saveProjectLayout(
    projectId: string,
    input: { floors: LayoutFloor[]; finish_level: FinishLevel; price_factors?: Record<string, number> | null; source_note?: string | null; extras?: LayoutExtras | null },
  ) {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.forecast().saveLayout(projectId, input);
    return this.forecast().forecast(projectId);
  }

  async saveProjectProgress(projectId: string, progress: Record<string, number>) {
    await this.requireProject(projectId);
    await this.forecast().saveProgress(projectId, progress);
    return this.forecast().forecast(projectId);
  }

  async confirmProjectLayout(projectId: string) {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.forecast().confirmLayout(projectId);
    return this.forecast().forecast(projectId);
  }

  async importProjectExpenses(
    projectId: string,
    lines: ImportExpenseLine[],
  ): Promise<{ imported: number; total: number }> {
    const project = await this.cpSvc.findProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return this.cpSvc.importExpenses(projectId, lines);
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

  // ─── WHATSAPP INTEGRATION Phase 1 ──────────────────────────────────────
  // Thin delegation, same as addEvidenceToVerification above — WhatsappService
  // owns the conflict/not-found logic itself (throws ConflictException /
  // NotFoundException directly), nothing to re-check here.

  async createWhatsappMapping(data: CreateWhatsappMappingInput): Promise<WhatsappProjectMappingEntity> {
    return this.waSvc.createMapping(data);
  }

  async listWhatsappMappings(): Promise<WhatsappProjectMappingEntity[]> {
    return this.waSvc.listMappings();
  }

  async deleteWhatsappMapping(id: string): Promise<void> {
    return this.waSvc.deleteMapping(id);
  }

  // ─── WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE ─────────────────
  // POST /v1/admin/whatsapp-mappings/:id/reprocess-unmapped — resolves the
  // mapping's own wa_id/project_ref first (find-or-404, same pattern as
  // every other route in this file), then delegates the actual reprocessing
  // to WhatsappService, which reuses processInboundMessage's own routing
  // logic rather than a second copy of it.
  async reprocessUnmappedWhatsappMessages(mappingId: string): Promise<{ reprocessed: number }> {
    const mapping = await this.waSvc.findMappingById(mappingId);
    if (!mapping) throw new NotFoundException(`WhatsApp mapping ${mappingId} not found`);
    return this.waSvc.reprocessUnmappedMessages(mapping.wa_id, mapping.project_ref);
  }

  // GET /v1/admin/whatsapp-unmapped
  async listUnmappedWhatsappMessages(): Promise<WhatsappInboundMessageEntity[]> {
    return this.waSvc.listUnmappedMessages();
  }

  // ─── WHATSAPP INTEGRATION Phase 2 — AI PARSING ─────────────────────────
  // Thin delegation to WhatsappParsingService, same as every other
  // cross-module call in this file.
  //
  // WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. `status` now passes
  // through (defaults to PENDING inside WhatsappParsingService.listDrafts
  // when omitted, matching this endpoint's original Phase 2 behavior).
  async listWhatsappDrafts(
    project_ref?: string,
    status?: WhatsappDraftExpenseStatus,
  ): Promise<WhatsappDraftListItem[]> {
    return this.waParsingSvc.listDrafts(project_ref, status);
  }

  // POST /v1/admin/whatsapp-drafts/:id/void — WhatsappParsingService owns
  // the not-found/state-guard logic itself, nothing to re-check here.
  async voidWhatsappDraft(id: string, reason: string | null): Promise<WhatsappDraftExpenseEntity> {
    return this.waParsingSvc.voidDraft(id, reason);
  }

  // POST /v1/admin/whatsapp-drafts/:id/resend-prompt
  async resendWhatsappDraftPrompt(id: string): Promise<{ sent: true }> {
    return this.waParsingSvc.resendDraftPrompt(id);
  }

  // ─── WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION
  // DETECTION (REVIEW-GATED) ─────────────────────────────────────────────
  // Same plain-passthrough delegation as the whatsapp-drafts routes above —
  // all the actual logic (fuzzy matching, the Trust-side link on approve)
  // lives on WhatsappBusinessLinkService.

  // GET /v1/admin/whatsapp-suggested-links
  async listWhatsappSuggestedLinks(): Promise<WhatsappSuggestedBusinessLinkEntity[]> {
    return this.waLinkSvc.listPendingSuggestions();
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/approve
  async approveWhatsappSuggestedLink(
    id: string,
    override: ApproveSuggestedLinkInput,
  ): Promise<WhatsappSuggestedBusinessLinkEntity> {
    return this.waLinkSvc.approve(id, override);
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/reject
  async rejectWhatsappSuggestedLink(id: string, reason: string | null): Promise<WhatsappSuggestedBusinessLinkEntity> {
    return this.waLinkSvc.reject(id, reason);
  }

  // ─── WHATSAPP LISTING INGESTION ─────────────────────────────────────────
  // Same plain-passthrough delegation as every other WhatsApp admin route
  // above — all the actual logic lives on WhatsappListingForwarderService/
  // WhatsappListingParsingService.

  // POST /v1/admin/whatsapp-listing-forwarders
  async createListingForwarder(data: CreateListingForwarderInput): Promise<WhatsappListingForwarderEntity> {
    return this.waListingForwarderSvc.createForwarder(data);
  }

  // GET /v1/admin/whatsapp-listing-forwarders
  async listListingForwarders(): Promise<WhatsappListingForwarderEntity[]> {
    return this.waListingForwarderSvc.listForwarders();
  }

  // DELETE /v1/admin/whatsapp-listing-forwarders/:id
  async deleteListingForwarder(id: string): Promise<void> {
    return this.waListingForwarderSvc.deleteForwarder(id);
  }

  // GET /v1/admin/whatsapp-listing-drafts
  async listWhatsappListingDrafts(status?: WhatsappDraftListingStatus): Promise<WhatsappDraftListingWithFlags[]> {
    return this.waListingParsingSvc.listDrafts(status);
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/publish
  async publishWhatsappListingDraft(id: string, contactPhone?: string | null): Promise<WhatsappDraftListingEntity> {
    return this.waListingParsingSvc.publishDraft(id, contactPhone);
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/reject
  async rejectWhatsappListingDraft(id: string, note: string | null): Promise<WhatsappDraftListingEntity> {
    return this.waListingParsingSvc.rejectDraft(id, note);
  }

  // GROUND-CONDITION REPORTS — review queue (delegates to the owning module).
  listGroundReports(status?: GroundReportStatus) {
    return this.groundReportSvc.list(status);
  }

  approveGroundReport(id: string) {
    return this.groundReportSvc.approve(id);
  }

  getGroundReportAttachmentUrl(id: string, index: number) {
    return this.groundReportSvc.getAttachmentUrl(id, index);
  }

  rejectGroundReport(id: string, reason: string | null) {
    return this.groundReportSvc.reject(id, reason);
  }

  // POST /v1/admin/whatsapp-listing-drafts/publish-clean
  async publishCleanWhatsappListingDrafts() {
    return this.waListingParsingSvc.publishClean();
  }

  // GET /v1/admin/property-listings?active=true
  async listPropertyListings(onlyActive: boolean) {
    return this.piSvc.listPropertyListingsForAdmin(onlyActive);
  }

  // POST /v1/admin/property-listings/:id/mark-sold
  async markPropertyListingSold(id: string) {
    const result = await this.piSvc.markPlotSold(id);
    if (!result) throw new NotFoundException(`Listing ${id} not found`);
    return result;
  }
}
