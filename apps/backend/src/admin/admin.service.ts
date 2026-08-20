import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  TradeCategory,
  MaterialCategory,
  ContractorSummary,
  ContractorListResponse,
  SupplierSummary,
  SupplierListResponse,
} from '@siraat/shared-types';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService, ClaimType } from '../trust/trust.service';
import { CandidateSocietyEntity } from '../property-intelligence/entities/candidate-society.entity';
import {
  ConstructionIntelligenceService,
  CreateMaterialRateInput,
  MaterialRateResult,
} from '../construction-intelligence/construction-intelligence.service';

export type { ClaimType };
export type { CreateMaterialRateInput, MaterialRateResult };

export interface EvidenceInput {
  type: 'document' | 'photo' | 'receipt' | 'inspection_report';
  file_ref: string;
  source_ref: string;
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
  target_status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
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

@Injectable()
export class AdminService {
  constructor(
    private readonly piSvc: PropertyIntelligenceService,
    private readonly trustSvc: TrustService,
    private readonly ciSvc: ConstructionIntelligenceService,
    @InjectRepository(CandidateSocietyEntity)
    private readonly candidateRepo: Repository<CandidateSocietyEntity>,
  ) {}

  async listCandidateSocieties(
    status?: string,
  ): Promise<CandidateSocietyEntity[]> {
    if (status) {
      return this.candidateRepo.findBy({
        status: status as CandidateSocietyEntity['status'],
      });
    }
    return this.candidateRepo.find();
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

    // Mark matching CandidateSociety ONBOARDED (exact name match)
    const candidate = await this.candidateRepo.findOneBy({ name: data.name });
    let candidateMarked = false;
    if (candidate) {
      candidate.status = 'ONBOARDED';
      await this.candidateRepo.save(candidate);
      candidateMarked = true;
    }

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

  async createMaterialRate(data: CreateMaterialRateInput): Promise<MaterialRateResult> {
    return this.ciSvc.createMaterialRate(data);
  }

  async listMaterialRates(filters: { city?: string; material?: string }): Promise<MaterialRateResult[]> {
    return this.ciSvc.listMaterialRates(filters);
  }

  // DEVELOPER-SOCIETY LINK Chunk 3 — GET /v1/admin/developers?search=
  async searchDevelopers(query: string): Promise<{ id: string; name: string }[]> {
    return this.piSvc.searchDevelopers(query);
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
}
