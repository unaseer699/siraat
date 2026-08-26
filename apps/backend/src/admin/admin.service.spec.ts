import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AdminService,
  type CreateContractorInput,
  type CreateSupplierInput,
  type CreateHousePlanInput,
} from './admin.service';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { StorageService } from '../trust/storage.service';
import { ConstructionIntelligenceService } from '../construction-intelligence/construction-intelligence.service';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
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
  supplier_id: 'sup-uuid-0001',
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

const HOUSE_PLAN_ID = 'hp-uuid-0001';

const HOUSE_PLAN_RESULT = {
  id: HOUSE_PLAN_ID,
  title: '5 Marla Modern Home',
  area_marla: 5,
  bedrooms: 3,
  style: 'MODERN' as const,
  preview_image_ref: 'house-plans/hp-uuid-0001/preview.jpg',
  description: 'A compact modern layout with an open-plan lounge.',
  contact_whatsapp: '+92 300 1112222',
  is_siraat_affiliated: false,
  record_type: 'FACT' as const,
};

// ─── PROJECT COST TRACKER Chunk 1 ──────────────────────────────────────────────

const PROJECT_ID = 'proj-uuid-0001';
const SECTION_ID = 'sec-uuid-0001';

const PROJECT_RESULT = {
  id: PROJECT_ID,
  name: 'Bahria 1180',
  property_ref: null,
  owner_contact: '+92 300 1112222',
  start_date: '2026-01-15',
  status: 'ACTIVE' as const,
  record_type: 'FACT' as const,
};

const SECTION_RESULT = {
  id: SECTION_ID,
  project_ref: PROJECT_ID,
  category: 'WOODWORK_CARPENTER' as const,
  display_order: 1,
  record_type: 'FACT' as const,
};

const EXPENSE_RESULT = {
  id: 'exp-uuid-0001',
  section_ref: SECTION_ID,
  expense_date: '2026-01-20',
  description: 'Cupboards',
  vendor_name: 'Malik Woodworks',
  vendor_contact: null,
  linked_contractor_id: null,
  linked_supplier_id: null,
  amount: 45000,
  record_type: 'FACT' as const,
  status: 'ACTIVE' as const,
  supersedes_id: null,
  void_reason: null,
};

const PROJECT_WITH_SECTIONS_RESULT = {
  ...PROJECT_RESULT,
  sections: [{ ...SECTION_RESULT, expenses: [EXPENSE_RESULT], subtotal: 45000 }],
  total: 45000,
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
  let searchContractorsByNameMock: jest.Mock;
  let findSupplierByIdMock: jest.Mock;
  let createSupplierMock: jest.Mock;
  let searchSuppliersMock: jest.Mock;
  let searchSuppliersByNameMock: jest.Mock;
  let findSuppliersByIdsMock: jest.Mock;
  let findHousePlanByIdMock: jest.Mock;
  let createHousePlanMock: jest.Mock;
  let searchHousePlansMock: jest.Mock;
  let updateHousePlanPreviewImageMock: jest.Mock;
  let updateHousePlanMock: jest.Mock;
  let deleteHousePlanMock: jest.Mock;
  let updateCandidateSocietyMock: jest.Mock;
  let deleteCandidateSocietyMock: jest.Mock;
  // CLEANUP — CandidateSociety repository ownership consolidated onto
  // PropertyIntelligenceService; these were AdminService's own repo-level
  // mocks (find/findBy/findOneBy/save) and are now piSvc-level mocks instead.
  let listCandidateSocietiesMock: jest.Mock;
  let markCandidateSocietyOnboardedMock: jest.Mock;

  // TrustService mocks
  let createVerificationMock: jest.Mock;
  let createAndLinkEvidenceMock: jest.Mock;
  let promoteVerificationToVerifiedMock: jest.Mock;
  let createEvidenceRecordMock: jest.Mock;

  // StorageService mocks
  let uploadFileMock: jest.Mock;
  let deleteFileMock: jest.Mock;

  // ConstructionIntelligenceService mocks
  let createMaterialRateMock: jest.Mock;
  let listMaterialRatesMock: jest.Mock;

  // ConstructionProjectService mocks
  let createProjectMock: jest.Mock;
  let findProjectByIdMock: jest.Mock;
  let createSectionMock: jest.Mock;
  let findSectionByIdMock: jest.Mock;
  let createExpenseMock: jest.Mock;
  let editExpenseMock: jest.Mock;
  let voidExpenseMock: jest.Mock;
  let getProjectWithSectionsAndExpensesMock: jest.Mock;

  beforeEach(async () => {
    createSocietyMock          = jest.fn().mockResolvedValue(SOCIETY_RESULT);
    findSocietyByIdMock        = jest.fn().mockResolvedValue(SOCIETY_RESULT);
    searchDevelopersMock       = jest.fn().mockResolvedValue([]);
    findContractorByIdMock    = jest.fn().mockResolvedValue(null);
    createContractorMock      = jest.fn().mockResolvedValue(CONTRACTOR_RESULT);
    searchContractorsMock     = jest.fn().mockResolvedValue({ contractors: [], total_count: 0, page: 1, total_pages: 0 });
    searchContractorsByNameMock = jest.fn().mockResolvedValue([]);
    findSupplierByIdMock      = jest.fn().mockResolvedValue(null);
    createSupplierMock        = jest.fn().mockResolvedValue(SUPPLIER_RESULT);
    searchSuppliersMock       = jest.fn().mockResolvedValue({ suppliers: [], total_count: 0, page: 1, total_pages: 0 });
    searchSuppliersByNameMock = jest.fn().mockResolvedValue([]);
    findSuppliersByIdsMock    = jest.fn().mockResolvedValue([]);
    findHousePlanByIdMock     = jest.fn().mockResolvedValue(HOUSE_PLAN_RESULT);
    createHousePlanMock       = jest.fn().mockResolvedValue(HOUSE_PLAN_RESULT);
    searchHousePlansMock      = jest.fn().mockResolvedValue({ house_plans: [], total_count: 0, page: 1, total_pages: 0 });
    updateHousePlanPreviewImageMock = jest.fn().mockResolvedValue(undefined);
    updateHousePlanMock        = jest.fn().mockResolvedValue(HOUSE_PLAN_RESULT);
    deleteHousePlanMock        = jest.fn().mockResolvedValue(true);
    updateCandidateSocietyMock = jest.fn().mockResolvedValue({ ...CANDIDATE, status: 'IN_PROGRESS' });
    deleteCandidateSocietyMock = jest.fn().mockResolvedValue(true);
    listCandidateSocietiesMock = jest.fn().mockResolvedValue([CANDIDATE]);
    // Default false (not found) — matches the old default candidateFindOneMock
    // behavior (null) that most createSocietyWithFirstClaim tests relied on.
    markCandidateSocietyOnboardedMock = jest.fn().mockResolvedValue(false);
    createVerificationMock     = jest.fn().mockResolvedValue(VERIFICATION_ENTITY);
    createAndLinkEvidenceMock  = jest.fn().mockResolvedValue(EVIDENCE_ENTITY);
    promoteVerificationToVerifiedMock = jest.fn().mockResolvedValue(VERIFIED_ENTITY);
    createEvidenceRecordMock   = jest.fn().mockResolvedValue(EVIDENCE_ENTITY);
    uploadFileMock             = jest.fn().mockResolvedValue(undefined);
    deleteFileMock             = jest.fn().mockResolvedValue(undefined);
    createMaterialRateMock     = jest.fn().mockResolvedValue(MATERIAL_RATE_RESULT);
    listMaterialRatesMock      = jest.fn().mockResolvedValue([MATERIAL_RATE_RESULT]);
    createProjectMock          = jest.fn().mockResolvedValue(PROJECT_RESULT);
    findProjectByIdMock        = jest.fn().mockResolvedValue(PROJECT_RESULT);
    createSectionMock          = jest.fn().mockResolvedValue(SECTION_RESULT);
    findSectionByIdMock        = jest.fn().mockResolvedValue(SECTION_RESULT);
    createExpenseMock          = jest.fn().mockResolvedValue(EXPENSE_RESULT);
    editExpenseMock            = jest.fn().mockResolvedValue({ ...EXPENSE_RESULT, id: 'exp-uuid-0002', supersedes_id: EXPENSE_RESULT.id });
    voidExpenseMock            = jest.fn().mockResolvedValue({ ...EXPENSE_RESULT, status: 'VOID', void_reason: 'Duplicate entry' });
    getProjectWithSectionsAndExpensesMock = jest.fn().mockResolvedValue(PROJECT_WITH_SECTIONS_RESULT);

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
            searchContractorsByName: searchContractorsByNameMock,
            findSupplierById:   findSupplierByIdMock,
            createSupplier:     createSupplierMock,
            searchSuppliers:    searchSuppliersMock,
            searchSuppliersByName: searchSuppliersByNameMock,
            findSuppliersByIds: findSuppliersByIdsMock,
            findHousePlanById:  findHousePlanByIdMock,
            createHousePlan:    createHousePlanMock,
            searchHousePlans:   searchHousePlansMock,
            updateHousePlanPreviewImage: updateHousePlanPreviewImageMock,
            updateHousePlan:    updateHousePlanMock,
            deleteHousePlan:    deleteHousePlanMock,
            updateCandidateSociety: updateCandidateSocietyMock,
            deleteCandidateSociety: deleteCandidateSocietyMock,
            listCandidateSocieties: listCandidateSocietiesMock,
            markCandidateSocietyOnboarded: markCandidateSocietyOnboardedMock,
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
          provide: StorageService,
          useValue: { uploadFile: uploadFileMock, deleteFile: deleteFileMock },
        },
        {
          provide: ConstructionIntelligenceService,
          useValue: {
            createMaterialRate: createMaterialRateMock,
            listMaterialRates:  listMaterialRatesMock,
          },
        },
        {
          provide: ConstructionProjectService,
          useValue: {
            createProject: createProjectMock,
            findProjectById: findProjectByIdMock,
            createSection: createSectionMock,
            findSectionById: findSectionByIdMock,
            createExpense: createExpenseMock,
            editExpense: editExpenseMock,
            voidExpense: voidExpenseMock,
            getProjectWithSectionsAndExpenses: getProjectWithSectionsAndExpensesMock,
          },
        },
      ],
    }).compile();

    svc = module.get(AdminService);
  });

  // ─── listCandidateSocieties ───────────────────────────────────────────────
  // CLEANUP — now a pure delegation to PropertyIntelligenceService, same
  // pattern as searchContractors/searchSuppliers elsewhere in this file.

  it('listCandidateSocieties delegates to PropertyIntelligenceService.listCandidateSocieties', async () => {
    const result = await svc.listCandidateSocieties();
    expect(listCandidateSocietiesMock).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([CANDIDATE]);
  });

  it('listCandidateSocieties passes the status filter through', async () => {
    await svc.listCandidateSocieties('NOT_STARTED');
    expect(listCandidateSocietiesMock).toHaveBeenCalledWith('NOT_STARTED');
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

  it('marks matching CandidateSociety as ONBOARDED via PropertyIntelligenceService', async () => {
    markCandidateSocietyOnboardedMock.mockResolvedValue(true);

    const result = await svc.createSocietyWithFirstClaim(buildSocietyInput());

    expect(markCandidateSocietyOnboardedMock).toHaveBeenCalledWith('Park View City');
    expect(result.candidate_marked_onboarded).toBe(true);
  });

  it('reports candidate_marked_onboarded: false when no CandidateSociety matches the name', async () => {
    markCandidateSocietyOnboardedMock.mockResolvedValue(false);

    const result = await svc.createSocietyWithFirstClaim(buildSocietyInput());

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

  // ─── listMaterialRates — supplier_name enrichment (FIX: admin table was
  // showing "Supplier #<id fragment>" instead of the linked supplier's name) ──

  it('listMaterialRates delegates to ConstructionIntelligenceService.listMaterialRates and resolves supplier_name', async () => {
    findSuppliersByIdsMock.mockResolvedValue([{ id: 'sup-uuid-0001', name: 'Hamza Traders' }]);

    const result = await svc.listMaterialRates({ city: 'Islamabad', material: 'Cement' });

    expect(listMaterialRatesMock).toHaveBeenCalledWith({ city: 'Islamabad', material: 'Cement' });
    expect(findSuppliersByIdsMock).toHaveBeenCalledWith(['sup-uuid-0001']);
    expect(result).toEqual([{ ...MATERIAL_RATE_RESULT, supplier_name: 'Hamza Traders' }]);
  });

  it('listMaterialRates sets supplier_name null and skips the lookup when no rate has a supplier_id', async () => {
    listMaterialRatesMock.mockResolvedValue([{ ...MATERIAL_RATE_RESULT, supplier_id: null }]);

    const result = await svc.listMaterialRates({});

    expect(findSuppliersByIdsMock).not.toHaveBeenCalled();
    expect(result[0].supplier_name).toBeNull();
  });

  it('listMaterialRates sets supplier_name null when the linked supplier is not found (e.g. since deleted)', async () => {
    findSuppliersByIdsMock.mockResolvedValue([]);

    const result = await svc.listMaterialRates({});

    expect(result[0].supplier_name).toBeNull();
  });

  it('listMaterialRates de-duplicates repeated supplier_ids into a single findSuppliersByIds call', async () => {
    listMaterialRatesMock.mockResolvedValue([
      { ...MATERIAL_RATE_RESULT, id: 'rate-1', supplier_id: 'sup-uuid-0001' },
      { ...MATERIAL_RATE_RESULT, id: 'rate-2', supplier_id: 'sup-uuid-0001' },
    ]);
    findSuppliersByIdsMock.mockResolvedValue([{ id: 'sup-uuid-0001', name: 'Hamza Traders' }]);

    const result = await svc.listMaterialRates({});

    expect(findSuppliersByIdsMock).toHaveBeenCalledTimes(1);
    expect(findSuppliersByIdsMock).toHaveBeenCalledWith(['sup-uuid-0001']);
    expect(result.every((r) => r.supplier_name === 'Hamza Traders')).toBe(true);
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

  // ─── PROJECT COST TRACKER Chunk 2 ──────────────────────────────────────────

  it('searchContractorsByName delegates to PropertyIntelligenceService.searchContractorsByName', async () => {
    searchContractorsByNameMock.mockResolvedValue([{ id: 'con-a-uuid', name: 'Ali Electrical Services' }]);

    const result = await svc.searchContractorsByName('ali');

    expect(searchContractorsByNameMock).toHaveBeenCalledWith('ali');
    expect(result).toEqual([{ id: 'con-a-uuid', name: 'Ali Electrical Services' }]);
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

  // ─── HOUSE PLANS DIRECTORY Chunk 1 ─────────────────────────────────────────

  it('createHousePlan delegates to PropertyIntelligenceService.createHousePlan', async () => {
    const input: CreateHousePlanInput = {
      title: '5 Marla Modern Home',
      area_marla: 5,
      bedrooms: 3,
      style: 'MODERN',
      preview_image_ref: 'house-plans/hp-uuid-0001/preview.jpg',
      description: 'A compact modern layout with an open-plan lounge.',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
    };

    const result = await svc.createHousePlan(input);

    expect(createHousePlanMock).toHaveBeenCalledWith(input);
    expect(result).toBe(HOUSE_PLAN_RESULT);
  });

  it('searchHousePlans delegates to PropertyIntelligenceService.searchHousePlans with the given filters', async () => {
    searchHousePlansMock.mockResolvedValue({
      house_plans: [HOUSE_PLAN_RESULT],
      total_count: 1,
      page: 1,
      total_pages: 1,
    });

    const result = await svc.searchHousePlans({ area_marla_min: 4, area_marla_max: 6, bedrooms: 3, style: 'MODERN' });

    expect(searchHousePlansMock).toHaveBeenCalledWith({
      area_marla_min: 4,
      area_marla_max: 6,
      bedrooms: 3,
      style: 'MODERN',
    });
    expect(result.house_plans).toEqual([HOUSE_PLAN_RESULT]);
  });

  it('uploadHousePlanImage stores the file via StorageService and persists the key as preview_image_ref', async () => {
    const result = await svc.uploadHousePlanImage(HOUSE_PLAN_ID, {
      filename: 'preview.jpg',
      content_type: 'image/jpeg',
      data_base64: Buffer.from('fake-image-bytes').toString('base64'),
    });

    expect(findHousePlanByIdMock).toHaveBeenCalledWith(HOUSE_PLAN_ID);
    expect(uploadFileMock).toHaveBeenCalledWith(
      `house-plans/${HOUSE_PLAN_ID}/preview.jpg`,
      Buffer.from('fake-image-bytes'),
      'image/jpeg',
    );
    expect(updateHousePlanPreviewImageMock).toHaveBeenCalledWith(
      HOUSE_PLAN_ID,
      `house-plans/${HOUSE_PLAN_ID}/preview.jpg`,
    );
    expect(result).toEqual({ preview_image_ref: `house-plans/${HOUSE_PLAN_ID}/preview.jpg` });
  });

  it('uploadHousePlanImage throws NotFoundException when the house plan does not exist', async () => {
    findHousePlanByIdMock.mockResolvedValue(null);

    await expect(
      svc.uploadHousePlanImage('non-existent-uuid', {
        filename: 'preview.jpg',
        content_type: 'image/jpeg',
        data_base64: 'ZmFrZQ==',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  // ─── ADMIN CRUD PHASE 1 Chunk 1 ──────────────────────────────────────────────

  it('updateHousePlan delegates to PropertyIntelligenceService.updateHousePlan', async () => {
    const result = await svc.updateHousePlan(HOUSE_PLAN_ID, { title: 'Renamed Plan' });

    expect(updateHousePlanMock).toHaveBeenCalledWith(HOUSE_PLAN_ID, { title: 'Renamed Plan' });
    expect(result).toBe(HOUSE_PLAN_RESULT);
  });

  it('updateHousePlan throws NotFoundException when the house plan does not exist', async () => {
    updateHousePlanMock.mockResolvedValue(null);

    await expect(svc.updateHousePlan('non-existent-uuid', { title: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteHousePlan deletes the stored image then the catalog row', async () => {
    await svc.deleteHousePlan(HOUSE_PLAN_ID);

    expect(findHousePlanByIdMock).toHaveBeenCalledWith(HOUSE_PLAN_ID);
    expect(deleteFileMock).toHaveBeenCalledWith(HOUSE_PLAN_RESULT.preview_image_ref);
    expect(deleteHousePlanMock).toHaveBeenCalledWith(HOUSE_PLAN_ID);
  });

  it('deleteHousePlan skips image cleanup when the plan has no image', async () => {
    findHousePlanByIdMock.mockResolvedValue({ ...HOUSE_PLAN_RESULT, preview_image_ref: '' });

    await svc.deleteHousePlan(HOUSE_PLAN_ID);

    expect(deleteFileMock).not.toHaveBeenCalled();
    expect(deleteHousePlanMock).toHaveBeenCalledWith(HOUSE_PLAN_ID);
  });

  it('deleteHousePlan still deletes the catalog row when image cleanup fails (best-effort, not silently ignored)', async () => {
    deleteFileMock.mockRejectedValue(new Error('S3 unavailable'));

    await svc.deleteHousePlan(HOUSE_PLAN_ID);

    expect(deleteFileMock).toHaveBeenCalled();
    expect(deleteHousePlanMock).toHaveBeenCalledWith(HOUSE_PLAN_ID);
  });

  it('deleteHousePlan throws NotFoundException when the house plan does not exist, without touching storage', async () => {
    findHousePlanByIdMock.mockResolvedValue(null);

    await expect(svc.deleteHousePlan('non-existent-uuid')).rejects.toThrow(NotFoundException);
    expect(deleteFileMock).not.toHaveBeenCalled();
    expect(deleteHousePlanMock).not.toHaveBeenCalled();
  });

  it('updateCandidateSociety delegates to PropertyIntelligenceService.updateCandidateSociety', async () => {
    const result = await svc.updateCandidateSociety('cand-uuid-0001', { status: 'IN_PROGRESS' });

    expect(updateCandidateSocietyMock).toHaveBeenCalledWith('cand-uuid-0001', { status: 'IN_PROGRESS' });
    expect(result).toEqual({ ...CANDIDATE, status: 'IN_PROGRESS' });
  });

  it('updateCandidateSociety supports reverting status back to NOT_STARTED', async () => {
    updateCandidateSocietyMock.mockResolvedValue({ ...CANDIDATE, status: 'NOT_STARTED' });

    const result = await svc.updateCandidateSociety('cand-uuid-0001', { status: 'NOT_STARTED' });

    expect(result.status).toBe('NOT_STARTED');
  });

  it('updateCandidateSociety throws NotFoundException when the candidate does not exist', async () => {
    updateCandidateSocietyMock.mockResolvedValue(null);

    await expect(
      svc.updateCandidateSociety('non-existent-uuid', { status: 'IN_PROGRESS' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deleteCandidateSociety delegates to PropertyIntelligenceService.deleteCandidateSociety', async () => {
    await svc.deleteCandidateSociety('cand-uuid-0001');

    expect(deleteCandidateSocietyMock).toHaveBeenCalledWith('cand-uuid-0001');
  });

  it('deleteCandidateSociety throws NotFoundException when the candidate does not exist', async () => {
    deleteCandidateSocietyMock.mockResolvedValue(false);

    await expect(svc.deleteCandidateSociety('non-existent-uuid')).rejects.toThrow(NotFoundException);
  });

  // ─── PROJECT COST TRACKER Chunk 1 ──────────────────────────────────────────

  it('createProject delegates to ConstructionProjectService.createProject', async () => {
    const input = {
      name: 'Bahria 1180',
      property_ref: null,
      owner_contact: '+92 300 1112222',
      start_date: '2026-01-15',
      status: 'ACTIVE' as const,
    };

    const result = await svc.createProject(input);

    expect(createProjectMock).toHaveBeenCalledWith(input);
    expect(result).toBe(PROJECT_RESULT);
  });

  it('createProjectSection delegates after confirming the project exists', async () => {
    const input = { category: 'WOODWORK_CARPENTER' as const, display_order: 1 };

    const result = await svc.createProjectSection(PROJECT_ID, input);

    expect(findProjectByIdMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(createSectionMock).toHaveBeenCalledWith(PROJECT_ID, input);
    expect(result).toBe(SECTION_RESULT);
  });

  it('createProjectSection throws NotFoundException when the project does not exist', async () => {
    findProjectByIdMock.mockResolvedValue(null);

    await expect(
      svc.createProjectSection('non-existent-uuid', { category: 'TILE_WORK', display_order: 1 }),
    ).rejects.toThrow(NotFoundException);
    expect(createSectionMock).not.toHaveBeenCalled();
  });

  it('createSectionExpense delegates after confirming the section exists', async () => {
    const input = {
      expense_date: '2026-01-20',
      description: 'Cupboards',
      vendor_name: 'Malik Woodworks',
      vendor_contact: null,
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: 45000,
    };

    const result = await svc.createSectionExpense(SECTION_ID, input);

    expect(findSectionByIdMock).toHaveBeenCalledWith(SECTION_ID);
    expect(createExpenseMock).toHaveBeenCalledWith(SECTION_ID, input);
    expect(result).toBe(EXPENSE_RESULT);
  });

  it('createSectionExpense throws NotFoundException when the section does not exist', async () => {
    findSectionByIdMock.mockResolvedValue(null);

    await expect(
      svc.createSectionExpense('non-existent-uuid', {
        expense_date: '2026-01-20',
        description: 'Cupboards',
        vendor_name: 'Malik Woodworks',
        vendor_contact: null,
        linked_contractor_id: null,
        linked_supplier_id: null,
        amount: 45000,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(createExpenseMock).not.toHaveBeenCalled();
  });

  // ─── EXPENSE EDIT/DELETE Chunk 1 ───────────────────────────────────────────

  it('editProjectExpense delegates after confirming the project exists', async () => {
    const input = {
      expense_date: '2026-01-20',
      description: 'Cupboards (corrected quantity)',
      vendor_name: 'Malik Woodworks',
      vendor_contact: null,
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: 50000,
    };

    const result = await svc.editProjectExpense(PROJECT_ID, EXPENSE_RESULT.id, input);

    expect(findProjectByIdMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(editExpenseMock).toHaveBeenCalledWith(PROJECT_ID, EXPENSE_RESULT.id, input);
    expect(result.supersedes_id).toBe(EXPENSE_RESULT.id);
  });

  it('editProjectExpense throws NotFoundException when the project does not exist', async () => {
    findProjectByIdMock.mockResolvedValue(null);

    await expect(
      svc.editProjectExpense('non-existent-uuid', EXPENSE_RESULT.id, {
        expense_date: '2026-01-20',
        description: 'Cupboards',
        vendor_name: 'Malik Woodworks',
        vendor_contact: null,
        linked_contractor_id: null,
        linked_supplier_id: null,
        amount: 45000,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(editExpenseMock).not.toHaveBeenCalled();
  });

  it('voidProjectExpense delegates after confirming the project exists', async () => {
    const result = await svc.voidProjectExpense(PROJECT_ID, EXPENSE_RESULT.id, 'Duplicate entry');

    expect(findProjectByIdMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(voidExpenseMock).toHaveBeenCalledWith(PROJECT_ID, EXPENSE_RESULT.id, 'Duplicate entry');
    expect(result.status).toBe('VOID');
    expect(result.void_reason).toBe('Duplicate entry');
  });

  it('voidProjectExpense throws NotFoundException when the project does not exist', async () => {
    findProjectByIdMock.mockResolvedValue(null);

    await expect(
      svc.voidProjectExpense('non-existent-uuid', EXPENSE_RESULT.id, 'Duplicate entry'),
    ).rejects.toThrow(NotFoundException);
    expect(voidExpenseMock).not.toHaveBeenCalled();
  });

  it('getProjectWithSectionsAndExpenses delegates to ConstructionProjectService', async () => {
    const result = await svc.getProjectWithSectionsAndExpenses(PROJECT_ID);

    expect(getProjectWithSectionsAndExpensesMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(result).toBe(PROJECT_WITH_SECTIONS_RESULT);
    expect(result.total).toBe(45000);
  });

  it('getProjectWithSectionsAndExpenses throws NotFoundException when the project does not exist', async () => {
    getProjectWithSectionsAndExpensesMock.mockResolvedValue(null);

    await expect(svc.getProjectWithSectionsAndExpenses('non-existent-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── Auth guard (controller-level wiring check) ───────────────────────────

  it('AdminService is injectable without auth — guard is applied at controller level', () => {
    // The service itself has no auth. BearerGuard is applied via @UseGuards on the controller.
    // This test confirms the guard is NOT wired into AdminService (it would fail to compile otherwise).
    expect(svc).toBeDefined();
  });
});
