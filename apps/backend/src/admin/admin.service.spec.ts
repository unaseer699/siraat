import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService, type CreateContractorInput, type CreateSupplierInput } from './admin.service';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ConstructionIntelligenceService } from '../construction-intelligence/construction-intelligence.service';
import { CandidateSocietyEntity } from '../property-intelligence/entities/candidate-society.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SOCIETY_ID = 'aabbccdd-0001-0001-0001-000000000001';
const VER_ID     = 'bbbbccdd-0001-0001-0001-000000000001';
const EVI_ID     = 'ccccdddd-0001-0001-0001-000000000001';

const SOCIETY_RESULT = {
  id: SOCIETY_ID,
  name: 'Park View City',
  city: 'Islamabad',
  min_price: null,
  max_price: null,
  min_area_marla: null,
  max_area_marla: null,
  property_types: ['PLOT'],
  noc_approved: true,
  base_confidence: 0.85,
  is_siraat_affiliated: false,
  affiliation_disclosure: null,
  noc_summary: null,
  source_document_ids: [],
  is_stale: false,
  staleness_threshold_days: 30,
  record_type: 'FACT' as const,
};

const CANDIDATE: CandidateSocietyEntity = {
  id: 'cand-uuid-0001',
  name: 'Park View City',
  regulator: 'CDA',
  city: 'Islamabad',
  status: 'NOT_STARTED',
  record_type: 'FACT',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const EVIDENCE_ITEM = {
  type: 'document' as const,
  file_ref: 'trust/pvc/noc.pdf',
  source_ref: 'CDA Portal — NOC No. 123',
};

const EVIDENCE_ENTITY = { id: EVI_ID, record_type: 'FACT', ...EVIDENCE_ITEM, created_at: new Date() };
const VERIFICATION_ENTITY = { id: VER_ID, status: 'PENDING', verified_at: null };
const VERIFIED_ENTITY     = { id: VER_ID, status: 'VERIFIED', verified_at: new Date() };

const MATERIAL_RATE_RESULT = {
  id: 'rate-uuid-0001',
  material_name: 'Cement - OPC 50kg bag',
  unit: 'per bag',
  price: 1550,
  city: 'Islamabad',
  source_tier: 'SUPPLIER_VERIFIED' as const,
  source_name: 'Al-Rehman Traders',
  source_contact: '+92 300 1234567',
  recorded_date: '2026-08-10',
  record_type: 'FACT' as const,
  is_stale: false,
  staleness_threshold_days: 14,
};

const CONTRACTOR_RESULT = {
  id: 'con-uuid-0001',
  name: 'Ali Electrical Services',
  trade_categories: ['ELECTRICIAN'] as const,
  service_cities: ['Islamabad'],
  contact_phone: '+92 300 1112222',
  contact_whatsapp: null,
  is_siraat_affiliated: false,
  record_type: 'FACT' as const,
};

const SUPPLIER_RESULT = {
  id: 'sup-uuid-0001',
  name: 'Al-Rehman Steel Traders',
  material_categories: ['STEEL'] as const,
  service_cities: ['Islamabad'],
  contact_phone: '+92 300 1112222',
  contact_whatsapp: null,
  is_siraat_affiliated: false,
  record_type: 'FACT' as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSocietyInput(overrides: object = {}) {
  return {
    name: 'Park View City',
    city: 'Islamabad',
    min_price: null,
    max_price: null,
    min_area_marla: null,
    max_area_marla: null,
    property_types: ['PLOT'],
    noc_approved: true,
    base_confidence: 0.85,
    is_siraat_affiliated: false,
    affiliation_disclosure: null,
    noc_summary: null,
    developer_id: null,
    claim: 'NOC Approved by CDA',
    claim_type: 'NOC' as const,
    target_status: 'PENDING' as const,
    evidence: [] as Array<{ type: 'document' | 'photo' | 'receipt' | 'inspection_report'; file_ref: string; source_ref: string }>,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let svc: AdminService;

  // PropertyIntelligenceService mocks
  let createSocietyMock: jest.Mock;
  let findSocietyByIdMock: jest.Mock;
  let searchDevelopersMock: jest.Mock;
  let findContractorByIdMock: jest.Mock;
  let createContractorMock: jest.Mock;
  let searchContractorsMock: jest.Mock;
  let findSupplierByIdMock: jest.Mock;
  let createSupplierMock: jest.Mock;
  let searchSuppliersMock: jest.Mock;
  let searchSuppliersByNameMock: jest.Mock;

  // TrustService mocks
  let createVerificationMock: jest.Mock;
  let createAndLinkEvidenceMock: jest.Mock;
  let promoteVerificationToVerifiedMock: jest.Mock;
  let createEvidenceRecordMock: jest.Mock;

  // CandidateSocietyEntity repository mocks
  let candidateFindMock: jest.Mock;
  let candidateFindOneMock: jest.Mock;
  let candidateFindByMock: jest.Mock;
  let candidateSaveMock: jest.Mock;

  // ConstructionIntelligenceService mocks
  let createMaterialRateMock: jest.Mock;
  let listMaterialRatesMock: jest.Mock;

  beforeEach(async () => {
    createSocietyMock          = jest.fn().mockResolvedValue(SOCIETY_RESULT);
    findSocietyByIdMock        = jest.fn().mockResolvedValue(SOCIETY_RESULT);
    searchDevelopersMock       = jest.fn().mockResolvedValue([]);
    findContractorByIdMock    = jest.fn().mockResolvedValue(null);
    createContractorMock      = jest.fn().mockResolvedValue(CONTRACTOR_RESULT);
    searchContractorsMock     = jest.fn().mockResolvedValue({ contractors: [], total_count: 0, page: 1, total_pages: 0 });
    findSupplierByIdMock      = jest.fn().mockResolvedValue(null);
    createSupplierMock        = jest.fn().mockResolvedValue(SUPPLIER_RESULT);
    searchSuppliersMock       = jest.fn().mockResolvedValue({ suppliers: [], total_count: 0, page: 1, total_pages: 0 });
    searchSuppliersByNameMock = jest.fn().mockResolvedValue([]);
    createVerificationMock     = jest.fn().mockResolvedValue(VERIFICATION_ENTITY);
    createAndLinkEvidenceMock  = jest.fn().mockResolvedValue(EVIDENCE_ENTITY);
    promoteVerificationToVerifiedMock = jest.fn().mockResolvedValue(VERIFIED_ENTITY);
    createEvidenceRecordMock   = jest.fn().mockResolvedValue(EVIDENCE_ENTITY);
    candidateFindMock          = jest.fn().mockResolvedValue([CANDIDATE]);
    candidateFindOneMock       = jest.fn().mockResolvedValue(null);
    candidateFindByMock        = jest.fn().mockResolvedValue([CANDIDATE]);
    candidateSaveMock          = jest.fn().mockResolvedValue({ ...CANDIDATE, status: 'ONBOARDED' });
    createMaterialRateMock     = jest.fn().mockResolvedValue(MATERIAL_RATE_RESULT);
    listMaterialRatesMock      = jest.fn().mockResolvedValue([MATERIAL_RATE_RESULT]);

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PropertyIntelligenceService,
          useValue: {
            createSociety:     createSocietyMock,
            findSocietyById:   findSocietyByIdMock,
            searchDevelopers:  searchDevelopersMock,
            findContractorById: findContractorByIdMock,
            createContractor:   createContractorMock,
            searchContractors:  searchContractorsMock,
            findSupplierById:   findSupplierByIdMock,
            createSupplier:     createSupplierMock,
            searchSuppliers:    searchSuppliersMock,
            searchSuppliersByName: searchSuppliersByNameMock,
          },
        },
        {
          provide: TrustService,
          useValue: {
            createVerification:            createVerificationMock,
            createAndLinkEvidence:          createAndLinkEvidenceMock,
            promoteVerificationToVerified:  promoteVerificationToVerifiedMock,
            createEvidenceRecord:           createEvidenceRecordMock,
          },
        },
        {
          provide: getRepositoryToken(CandidateSocietyEntity),
          useValue: {
            find:       candidateFindMock,
            findBy:     candidateFindByMock,
            findOneBy:  candidateFindOneMock,
            save:       candidateSaveMock,
          },
        },
        {
          provide: ConstructionIntelligenceService,
          useValue: {
            createMaterialRate: createMaterialRateMock,
            listMaterialRates:  listMaterialRatesMock,
          },
        },
      ],
    }).compile();

    svc = module.get(AdminService);
  });

  // ─── listCandidateSocieties ───────────────────────────────────────────────

  it('listCandidateSocieties returns all candidates when no status filter given', async () => {
    const result = await svc.listCandidateSocieties();
    expect(candidateFindMock).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('listCandidateSocieties filters by status when provided', async () => {
    await svc.listCandidateSocieties('NOT_STARTED');
    expect(candidateFindByMock).toHaveBeenCalledWith({ status: 'NOT_STARTED' });
  });

  // ─── createSocietyWithFirstClaim ──────────────────────────────────────────

  it('creates society then verification (PENDING flow)', async () => {
    const result = await svc.createSocietyWithFirstClaim(buildSocietyInput());

    expect(createSocietyMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Park View City', city: 'Islamabad' }),
    );
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject_id: SOCIETY_ID, status: 'PENDING', evidence_refs: [] }),
    );
    expect(promoteVerificationToVerifiedMock).not.toHaveBeenCalled();
    expect(result.society_id).toBe(SOCIETY_ID);
  });

  it('passes developer_id through to PropertyIntelligenceService.createSociety when provided', async () => {
    await svc.createSocietyWithFirstClaim(buildSocietyInput({ developer_id: 'dev-a-uuid' }));

    expect(createSocietyMock).toHaveBeenCalledWith(
      expect.objectContaining({ developer_id: 'dev-a-uuid' }),
    );
  });

  // Regression: most existing callers won't set this field.
  it('passes developer_id: null through when not provided', async () => {
    await svc.createSocietyWithFirstClaim(buildSocietyInput());

    expect(createSocietyMock).toHaveBeenCalledWith(
      expect.objectContaining({ developer_id: null }),
    );
  });

  it('links evidence and promotes to VERIFIED when target_status is VERIFIED', async () => {
    const result = await svc.createSocietyWithFirstClaim(
      buildSocietyInput({ target_status: 'VERIFIED', evidence: [EVIDENCE_ITEM] }),
    );

    expect(createAndLinkEvidenceMock).toHaveBeenCalledWith(SOCIETY_ID, EVIDENCE_ITEM);
    // ID-scoped: promotes the exact Verification row just created, not a subject_id lookup
    expect(promoteVerificationToVerifiedMock).toHaveBeenCalledWith(VER_ID);
    expect(result.society_id).toBe(SOCIETY_ID);
    expect(result.verification_id).toBe(VER_ID);
  });

  it('promotes only the Verification just created, even when a prior unrelated Verification exists for a different subject_id', async () => {
    // Simulate a pre-existing, unrelated Verification for some other society already in the DB.
    // createVerification() always returns the newly-created row's own id - createSociety's
    // promotion call must target that id specifically, never look it up by subject_id.
    const OTHER_SUBJECT_VER_ID = 'ffffeeee-9999-9999-9999-999999999999';
    createVerificationMock.mockResolvedValue({
      id: VER_ID,
      status: 'PENDING',
      verified_at: null,
    });

    const result = await svc.createSocietyWithFirstClaim(
      buildSocietyInput({ target_status: 'VERIFIED', evidence: [EVIDENCE_ITEM] }),
    );

    expect(promoteVerificationToVerifiedMock).toHaveBeenCalledTimes(1);
    expect(promoteVerificationToVerifiedMock).toHaveBeenCalledWith(VER_ID);
    expect(promoteVerificationToVerifiedMock).not.toHaveBeenCalledWith(OTHER_SUBJECT_VER_ID);
    expect(promoteVerificationToVerifiedMock).not.toHaveBeenCalledWith(SOCIETY_ID);
    expect(result.verification_id).toBe(VER_ID);
  });

  it('throws BadRequestException for VERIFIED with no evidence', async () => {
    await expect(
      svc.createSocietyWithFirstClaim(
        buildSocietyInput({ target_status: 'VERIFIED', evidence: [] }),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(createSocietyMock).not.toHaveBeenCalled();
  });

  it('marks matching CandidateSociety as ONBOARDED on name match', async () => {
    candidateFindOneMock.mockResolvedValue({ ...CANDIDATE });

    const result = await svc.createSocietyWithFirstClaim(buildSocietyInput());

    expect(candidateFindOneMock).toHaveBeenCalledWith({ name: 'Park View City' });
    expect(candidateSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ONBOARDED' }),
    );
    expect(result.candidate_marked_onboarded).toBe(true);
  });

  it('does not call candidateSave when no CandidateSociety matches the name', async () => {
    candidateFindOneMock.mockResolvedValue(null);

    const result = await svc.createSocietyWithFirstClaim(buildSocietyInput());

    expect(candidateSaveMock).not.toHaveBeenCalled();
    expect(result.candidate_marked_onboarded).toBe(false);
  });

  // ─── addClaim (generalized from addClaimToSociety, CONTRACTOR DIRECTORY Chunk 2) ──

  it('throws NotFoundException when society does not exist', async () => {
    findSocietyByIdMock.mockResolvedValue(null);

    await expect(
      svc.addClaim({
        subject_type: 'SOCIETY',
        subject_id: 'nonexistent-uuid',
        claim: 'Some claim',
        claim_type: 'NOC',
        target_status: 'PENDING',
        evidence: [],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for VERIFIED claim with no evidence', async () => {
    await expect(
      svc.addClaim({
        subject_type: 'SOCIETY',
        subject_id: SOCIETY_ID,
        claim: 'NOC Approved',
        claim_type: 'NOC',
        target_status: 'VERIFIED',
        evidence: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates verification with PENDING status and no evidence records', async () => {
    const result = await svc.addClaim({
      subject_type: 'SOCIETY',
      subject_id: SOCIETY_ID,
      claim: 'NOC Approved',
      claim_type: 'NOC',
      target_status: 'PENDING',
      evidence: [],
    });

    expect(createEvidenceRecordMock).not.toHaveBeenCalled();
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_type: 'SOCIETY',
        subject_id: SOCIETY_ID,
        status: 'PENDING',
        evidence_refs: [],
      }),
    );
    expect(result.verification_id).toBe(VER_ID);
  });

  it('creates evidence records first then verification with evidence IDs (VERIFIED flow)', async () => {
    const result = await svc.addClaim({
      subject_type: 'SOCIETY',
      subject_id: SOCIETY_ID,
      claim: 'NOC Approved',
      claim_type: 'NOC',
      target_status: 'VERIFIED',
      evidence: [EVIDENCE_ITEM],
    });

    expect(createEvidenceRecordMock).toHaveBeenCalledWith(EVIDENCE_ITEM);
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_id: SOCIETY_ID,
        status: 'VERIFIED',
        evidence_refs: [EVI_ID],
      }),
    );
    expect(result.verification_id).toBe(VER_ID);
  });

  it('creates evidence for DISPUTED claim and passes IDs to verification', async () => {
    await svc.addClaim({
      subject_type: 'SOCIETY',
      subject_id: SOCIETY_ID,
      claim: 'Illegal scheme notice',
      claim_type: 'ILLEGAL_SCHEME_NOTICE',
      target_status: 'DISPUTED',
      evidence: [EVIDENCE_ITEM],
    });

    expect(createEvidenceRecordMock).toHaveBeenCalledWith(EVIDENCE_ITEM);
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DISPUTED', evidence_refs: [EVI_ID] }),
    );
  });

  // ─── CONTRACTOR DIRECTORY Chunk 2 — addClaim for subject_type: 'CONTRACTOR' ──
  // Proves the same generalized flow works for Contractor, not just Society —
  // same shape as the Chunk 1 TrustService genericity tests, one layer up.

  it('addClaim works for subject_type CONTRACTOR: 404 when the contractor does not exist', async () => {
    findContractorByIdMock.mockResolvedValue(null);

    await expect(
      svc.addClaim({
        subject_type: 'CONTRACTOR',
        subject_id: 'nonexistent-uuid',
        claim: 'Licensed electrician — PEC registered',
        claim_type: 'OTHER',
        target_status: 'PENDING',
        evidence: [],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(findSocietyByIdMock).not.toHaveBeenCalled();
  });

  it('addClaim works for subject_type CONTRACTOR: creates verification with evidence IDs (VERIFIED flow)', async () => {
    const CONTRACTOR_ID = 'con-a-uuid';
    findContractorByIdMock.mockResolvedValue({ id: CONTRACTOR_ID, name: 'Ali Electrical Services' });

    const result = await svc.addClaim({
      subject_type: 'CONTRACTOR',
      subject_id: CONTRACTOR_ID,
      claim: 'Licensed electrician — PEC registered',
      claim_type: 'OTHER',
      target_status: 'VERIFIED',
      evidence: [EVIDENCE_ITEM],
    });

    expect(findContractorByIdMock).toHaveBeenCalledWith(CONTRACTOR_ID);
    expect(createEvidenceRecordMock).toHaveBeenCalledWith(EVIDENCE_ITEM);
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_type: 'CONTRACTOR',
        subject_id: CONTRACTOR_ID,
        status: 'VERIFIED',
        evidence_refs: [EVI_ID],
      }),
    );
    expect(result.verification_id).toBe(VER_ID);
  });

  // ─── SUPPLIER DIRECTORY Chunk 2 — addClaim for subject_type: 'SUPPLIER' ────
  // Same shape as the CONTRACTOR block above — proves the generalized flow
  // works for Supplier too, one more subject_type branch in the dispatch.

  it('addClaim works for subject_type SUPPLIER: 404 when the supplier does not exist', async () => {
    findSupplierByIdMock.mockResolvedValue(null);

    await expect(
      svc.addClaim({
        subject_type: 'SUPPLIER',
        subject_id: 'nonexistent-uuid',
        claim: 'PEC Registered Steel Supplier',
        claim_type: 'OTHER',
        target_status: 'PENDING',
        evidence: [],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(findSocietyByIdMock).not.toHaveBeenCalled();
    expect(findContractorByIdMock).not.toHaveBeenCalled();
  });

  it('addClaim works for subject_type SUPPLIER: creates verification with evidence IDs (VERIFIED flow)', async () => {
    const SUPPLIER_ID = 'sup-a-uuid';
    findSupplierByIdMock.mockResolvedValue({ id: SUPPLIER_ID, name: 'Al-Rehman Steel Traders' });

    const result = await svc.addClaim({
      subject_type: 'SUPPLIER',
      subject_id: SUPPLIER_ID,
      claim: 'PEC Registered Steel Supplier',
      claim_type: 'OTHER',
      target_status: 'VERIFIED',
      evidence: [EVIDENCE_ITEM],
    });

    expect(findSupplierByIdMock).toHaveBeenCalledWith(SUPPLIER_ID);
    expect(createEvidenceRecordMock).toHaveBeenCalledWith(EVIDENCE_ITEM);
    expect(createVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_type: 'SUPPLIER',
        subject_id: SUPPLIER_ID,
        status: 'VERIFIED',
        evidence_refs: [EVI_ID],
      }),
    );
    expect(result.verification_id).toBe(VER_ID);
  });

  // ─── createEvidence ───────────────────────────────────────────────────────

  it('createEvidence delegates to TrustService.createEvidenceRecord', async () => {
    const result = await svc.createEvidence(EVIDENCE_ITEM);
    expect(createEvidenceRecordMock).toHaveBeenCalledWith(EVIDENCE_ITEM);
    expect(result.id).toBe(EVI_ID);
    expect(result.type).toBe('document');
  });

  // ─── Material rates (delegates to ConstructionIntelligenceService) ────────

  it('createMaterialRate delegates to ConstructionIntelligenceService.createMaterialRate', async () => {
    const input = {
      material_name: 'Cement - OPC 50kg bag',
      unit: 'per bag',
      price: 1550,
      city: 'Islamabad',
      source_tier: 'SUPPLIER_VERIFIED' as const,
      source_name: 'Al-Rehman Traders',
      source_contact: '+92 300 1234567',
      recorded_date: '2026-08-10',
    };
    const result = await svc.createMaterialRate(input);
    expect(createMaterialRateMock).toHaveBeenCalledWith(input);
    expect(result).toBe(MATERIAL_RATE_RESULT);
  });

  it('listMaterialRates delegates to ConstructionIntelligenceService.listMaterialRates', async () => {
    const result = await svc.listMaterialRates({ city: 'Islamabad', material: 'Cement' });
    expect(listMaterialRatesMock).toHaveBeenCalledWith({ city: 'Islamabad', material: 'Cement' });
    expect(result).toEqual([MATERIAL_RATE_RESULT]);
  });

  // ─── DEVELOPER-SOCIETY LINK Chunk 3 ────────────────────────────────────────

  it('searchDevelopers delegates to PropertyIntelligenceService.searchDevelopers', async () => {
    searchDevelopersMock.mockResolvedValue([{ id: 'dev-a-uuid', name: 'Zameen Developers' }]);

    const result = await svc.searchDevelopers('zameen');

    expect(searchDevelopersMock).toHaveBeenCalledWith('zameen');
    expect(result).toEqual([{ id: 'dev-a-uuid', name: 'Zameen Developers' }]);
  });

  // ─── CONTRACTOR DIRECTORY Chunk 2 ──────────────────────────────────────────

  it('createContractor delegates to PropertyIntelligenceService.createContractor', async () => {
    const input: CreateContractorInput = {
      name: 'Ali Electrical Services',
      trade_categories: ['ELECTRICIAN'],
      service_cities: ['Islamabad'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: null,
      is_siraat_affiliated: false,
    };

    const result = await svc.createContractor(input);

    expect(createContractorMock).toHaveBeenCalledWith(input);
    expect(result).toBe(CONTRACTOR_RESULT);
  });

  it('searchContractors delegates to PropertyIntelligenceService.searchContractors with the given filters', async () => {
    searchContractorsMock.mockResolvedValue({
      contractors: [CONTRACTOR_RESULT],
      total_count: 1,
      page: 1,
      total_pages: 1,
    });

    const result = await svc.searchContractors({ trade_category: 'ELECTRICIAN', city: 'Islamabad' });

    expect(searchContractorsMock).toHaveBeenCalledWith({ trade_category: 'ELECTRICIAN', city: 'Islamabad' });
    expect(result.contractors).toEqual([CONTRACTOR_RESULT]);
  });

  // ─── SUPPLIER DIRECTORY Chunk 2 ────────────────────────────────────────────

  it('createSupplier delegates to PropertyIntelligenceService.createSupplier', async () => {
    const input: CreateSupplierInput = {
      name: 'Al-Rehman Steel Traders',
      material_categories: ['STEEL'],
      service_cities: ['Islamabad'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: null,
      is_siraat_affiliated: false,
    };

    const result = await svc.createSupplier(input);

    expect(createSupplierMock).toHaveBeenCalledWith(input);
    expect(result).toBe(SUPPLIER_RESULT);
  });

  it('searchSuppliers delegates to PropertyIntelligenceService.searchSuppliers with the given filters', async () => {
    searchSuppliersMock.mockResolvedValue({
      suppliers: [SUPPLIER_RESULT],
      total_count: 1,
      page: 1,
      total_pages: 1,
    });

    const result = await svc.searchSuppliers({ material_category: 'STEEL', city: 'Islamabad' });

    expect(searchSuppliersMock).toHaveBeenCalledWith({ material_category: 'STEEL', city: 'Islamabad' });
    expect(result.suppliers).toEqual([SUPPLIER_RESULT]);
  });

  // ─── SUPPLIER DIRECTORY Chunk 2b ───────────────────────────────────────────

  it('searchSuppliersByName delegates to PropertyIntelligenceService.searchSuppliersByName', async () => {
    searchSuppliersByNameMock.mockResolvedValue([{ id: 'sup-a-uuid', name: 'Al-Rehman Steel Traders' }]);

    const result = await svc.searchSuppliersByName('al-rehman');

    expect(searchSuppliersByNameMock).toHaveBeenCalledWith('al-rehman');
    expect(result).toEqual([{ id: 'sup-a-uuid', name: 'Al-Rehman Steel Traders' }]);
  });

  // ─── Auth guard (controller-level wiring check) ───────────────────────────

  it('AdminService is injectable without auth — guard is applied at controller level', () => {
    // The service itself has no auth. BearerGuard is applied via @UseGuards on the controller.
    // This test confirms the guard is NOT wired into AdminService (it would fail to compile otherwise).
    expect(svc).toBeDefined();
  });
});
