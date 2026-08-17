import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

export interface AddClaimInput {
  society_id: string;
  claim: string;
  claim_type: ClaimType;
  target_status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
  evidence: EvidenceInput[];
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

  async addClaimToSociety(
    data: AddClaimInput,
  ): Promise<{ verification_id: string }> {
    if (data.target_status === 'VERIFIED' && data.evidence.length === 0) {
      throw new BadRequestException(
        'VERIFIED status requires at least one evidence item',
      );
    }

    const society = await this.piSvc.findSocietyById(data.society_id);
    if (!society) {
      throw new NotFoundException(`Society ${data.society_id} not found`);
    }

    // Collect evidence IDs before creating the verification (matches CLI script pattern)
    const evidenceIds: string[] = [];
    for (const item of data.evidence) {
      const ev = await this.trustSvc.createEvidenceRecord(item);
      evidenceIds.push(ev.id);
    }

    const verification = await this.trustSvc.createVerification({
      subject_type: 'SOCIETY',
      subject_id: data.society_id,
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
}
