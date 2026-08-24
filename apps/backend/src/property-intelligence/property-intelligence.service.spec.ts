import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, In, MoreThan } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import type { TradeCategory, MaterialCategory, HousePlanStyle } from '@siraat/shared-types';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { ContractorEntity } from './entities/contractor.entity';
import { SupplierEntity } from './entities/supplier.entity';
import { HousePlanEntity } from './entities/house-plan.entity';
import { CandidateSocietyEntity } from './entities/candidate-society.entity';
import { ObservationEntity } from './entities/observation.entity';
import { TrustService } from '../trust/trust.service';
import { ConstructionIntelligenceService } from '../construction-intelligence/construction-intelligence.service';

describe('PropertyIntelligenceService', () => {
  let service: PropertyIntelligenceService;
  let qbMocks: {
    select: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getRawMany: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let contractorQbMocks: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let supplierQbMocks: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let housePlanQbMocks: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let deriveVerificationStatusMock: jest.Mock;
  let trustGetVerificationsMock: jest.Mock;
  let trustGetObservationsSinceMock: jest.Mock;
  let obsCreateMock: jest.Mock;
  let obsSaveMock: jest.Mock;
  let obsFindMock: jest.Mock;
  let societyFindOneByMock: jest.Mock;
  let societyFindByMock: jest.Mock;
  let societyCreateMock: jest.Mock;
  let societySaveMock: jest.Mock;
  let developerFindOneByMock: jest.Mock;
  let developerFindMock: jest.Mock;
  let contractorCreateMock: jest.Mock;
  let contractorSaveMock: jest.Mock;
  let contractorFindOneByMock: jest.Mock;
  let supplierCreateMock: jest.Mock;
  let supplierSaveMock: jest.Mock;
  let supplierFindOneByMock: jest.Mock;
  let housePlanCreateMock: jest.Mock;
  let housePlanSaveMock: jest.Mock;
  let housePlanFindOneByMock: jest.Mock;
  let housePlanUpdateMock: jest.Mock;
  let housePlanDeleteMock: jest.Mock;
  let candidateFindOneByMock: jest.Mock;
  let candidateSaveMock: jest.Mock;
  let candidateDeleteMock: jest.Mock;
  // CLEANUP — added alongside listCandidateSocieties/markCandidateSocietyOnboarded,
  // migrated here from AdminService's own now-removed repository access.
  let candidateFindMock: jest.Mock;
  let candidateFindByMock: jest.Mock;
  let ciFindRatesBySupplierIdMock: jest.Mock;

  beforeEach(async () => {
    qbMocks = {
      select: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    qbMocks.select.mockReturnValue(qbMocks);
    qbMocks.andWhere.mockReturnValue(qbMocks);
    qbMocks.orderBy.mockReturnValue(qbMocks);
    qbMocks.skip.mockReturnValue(qbMocks);
    qbMocks.take.mockReturnValue(qbMocks);

    contractorQbMocks = {
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    contractorQbMocks.andWhere.mockReturnValue(contractorQbMocks);
    contractorQbMocks.orderBy.mockReturnValue(contractorQbMocks);
    contractorQbMocks.skip.mockReturnValue(contractorQbMocks);
    contractorQbMocks.take.mockReturnValue(contractorQbMocks);

    supplierQbMocks = {
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    supplierQbMocks.andWhere.mockReturnValue(supplierQbMocks);
    supplierQbMocks.orderBy.mockReturnValue(supplierQbMocks);
    supplierQbMocks.skip.mockReturnValue(supplierQbMocks);
    supplierQbMocks.take.mockReturnValue(supplierQbMocks);

    housePlanQbMocks = {
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    housePlanQbMocks.andWhere.mockReturnValue(housePlanQbMocks);
    housePlanQbMocks.orderBy.mockReturnValue(housePlanQbMocks);
    housePlanQbMocks.skip.mockReturnValue(housePlanQbMocks);
    housePlanQbMocks.take.mockReturnValue(housePlanQbMocks);

    deriveVerificationStatusMock = jest.fn().mockResolvedValue('PENDING');
    trustGetVerificationsMock = jest.fn().mockResolvedValue([]);
    trustGetObservationsSinceMock = jest.fn().mockResolvedValue([]);
    obsCreateMock = jest.fn((data) => data);
    obsSaveMock = jest.fn((entity) => Promise.resolve({ id: 'new-obs-uuid', ...entity }));
    obsFindMock = jest.fn().mockResolvedValue([]);
    societyFindOneByMock = jest.fn().mockResolvedValue(null);
    societyFindByMock = jest.fn().mockResolvedValue([]);
    societyCreateMock = jest.fn((data) => data);
    societySaveMock = jest.fn((entity) => Promise.resolve({ id: 'soc-new-uuid', ...entity }));
    developerFindOneByMock = jest.fn().mockResolvedValue(null);
    developerFindMock = jest.fn().mockResolvedValue([]);
    contractorCreateMock = jest.fn((data) => data);
    contractorSaveMock = jest.fn((entity) => Promise.resolve({ id: 'con-new-uuid', ...entity }));
    contractorFindOneByMock = jest.fn().mockResolvedValue(null);
    supplierCreateMock = jest.fn((data) => data);
    supplierSaveMock = jest.fn((entity) => Promise.resolve({ id: 'sup-new-uuid', ...entity }));
    supplierFindOneByMock = jest.fn().mockResolvedValue(null);
    housePlanCreateMock = jest.fn((data) => data);
    housePlanSaveMock = jest.fn((entity) => Promise.resolve({ id: 'hp-new-uuid', ...entity }));
    housePlanFindOneByMock = jest.fn().mockResolvedValue(null);
    housePlanUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    housePlanDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });
    candidateFindOneByMock = jest.fn().mockResolvedValue(null);
    candidateSaveMock = jest.fn((entity) => Promise.resolve(entity));
    candidateDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });
    candidateFindMock = jest.fn().mockResolvedValue([]);
    candidateFindByMock = jest.fn().mockResolvedValue([]);
    ciFindRatesBySupplierIdMock = jest.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        PropertyIntelligenceService,
        {
          provide: getRepositoryToken(SocietyEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => qbMocks),
            findOneBy: societyFindOneByMock,
            findBy: societyFindByMock,
            create: societyCreateMock,
            save: societySaveMock,
          },
        },
        { provide: getRepositoryToken(PropertyEntity), useValue: {} },
        {
          provide: getRepositoryToken(DeveloperEntity),
          useValue: { findOneBy: developerFindOneByMock, find: developerFindMock },
        },
        {
          provide: getRepositoryToken(ContractorEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => contractorQbMocks),
            findOneBy: contractorFindOneByMock,
            create: contractorCreateMock,
            save: contractorSaveMock,
          },
        },
        {
          provide: getRepositoryToken(SupplierEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => supplierQbMocks),
            findOneBy: supplierFindOneByMock,
            create: supplierCreateMock,
            save: supplierSaveMock,
          },
        },
        {
          provide: getRepositoryToken(HousePlanEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => housePlanQbMocks),
            findOneBy: housePlanFindOneByMock,
            create: housePlanCreateMock,
            save: housePlanSaveMock,
            update: housePlanUpdateMock,
            delete: housePlanDeleteMock,
          },
        },
        {
          provide: getRepositoryToken(CandidateSocietyEntity),
          useValue: {
            findOneBy: candidateFindOneByMock,
            save: candidateSaveMock,
            delete: candidateDeleteMock,
            find: candidateFindMock,
            findBy: candidateFindByMock,
          },
        },
        {
          provide: getRepositoryToken(ObservationEntity),
          useValue: { create: obsCreateMock, save: obsSaveMock, find: obsFindMock },
        },
        {
          provide: TrustService,
          useValue: {
            deriveVerificationStatus: deriveVerificationStatusMock,
            getVerifications: trustGetVerificationsMock,
            getObservationsSince: trustGetObservationsSinceMock,
          },
        },
        {
          provide: ConstructionIntelligenceService,
          useValue: { findRatesBySupplierId: ciFindRatesBySupplierIdMock },
        },
      ],
    }).compile();

    service = module.get(PropertyIntelligenceService);
  });

  describe('listDistinctCities', () => {
    it('returns distinct city values, sorted', async () => {
      qbMocks.getRawMany.mockResolvedValue([
        { city: 'Rawalpindi' },
        { city: 'Islamabad' },
      ]);

      const result = await service.listDistinctCities();

      expect(result).toEqual(['Islamabad', 'Rawalpindi']);
      expect(qbMocks.select).toHaveBeenCalledWith('DISTINCT s.city', 'city');
    });

    it('returns an empty array gracefully on an empty database (no rows, no error)', async () => {
      qbMocks.getRawMany.mockResolvedValue([]);

      const result = await service.listDistinctCities();

      expect(result).toEqual([]);
    });
  });

  // ─── BROWSE SOCIETIES Chunk 1 ────────────────────────────────────────────────

  describe('listSocieties', () => {
    const SOCIETY_A: Partial<SocietyEntity> = {
      id: 'soc-a-uuid',
      name: 'Taj Residencia',
      city: 'Rawalpindi',
      min_price: 5000000,
      max_price: 15000000,
      min_area_marla: 5,
      max_area_marla: 20,
      property_types: ['plot', 'house'],
    };
    const SOCIETY_B: Partial<SocietyEntity> = {
      id: 'soc-b-uuid',
      name: 'Bahria Town',
      city: 'Islamabad',
      min_price: 8000000,
      max_price: 30000000,
      min_area_marla: 5,
      max_area_marla: 20,
      property_types: ['plot'],
    };

    it('returns paginated results with total_count, page, and total_pages', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A, SOCIETY_B], 2]);

      const result = await service.listSocieties({ page: 1, limit: 20 });

      expect(result.societies).toHaveLength(2);
      expect(result.total_count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
      expect(qbMocks.skip).toHaveBeenCalledWith(0);
      expect(qbMocks.take).toHaveBeenCalledWith(20);
    });

    it('maps price_range, area_range, and property_types from the entity', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A], 1]);

      const result = await service.listSocieties({});

      expect(result.societies[0]).toMatchObject({
        id: 'soc-a-uuid',
        name: 'Taj Residencia',
        city: 'Rawalpindi',
        price_range: { min: 5000000, max: 15000000 },
        area_range: { min: 5, max: 20 },
        property_types: ['plot', 'house'],
      });
    });

    it('derives verification_status per society via TrustService (reused, not re-implemented)', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A, SOCIETY_B], 2]);
      deriveVerificationStatusMock
        .mockResolvedValueOnce('VERIFIED')
        .mockResolvedValueOnce('DISPUTED');

      const result = await service.listSocieties({});

      expect(deriveVerificationStatusMock).toHaveBeenCalledWith('SOCIETY', 'soc-a-uuid');
      expect(deriveVerificationStatusMock).toHaveBeenCalledWith('SOCIETY', 'soc-b-uuid');
      expect(result.societies.find((s) => s.id === 'soc-a-uuid')!.verification_status).toBe('VERIFIED');
      expect(result.societies.find((s) => s.id === 'soc-b-uuid')!.verification_status).toBe('DISPUTED');
    });

    it('applies the city filter case-insensitively', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[SOCIETY_A], 1]);

      await service.listSocieties({ city: 'rawalpindi' });

      expect(qbMocks.andWhere).toHaveBeenCalledWith('LOWER(s.city) = LOWER(:city)', {
        city: 'rawalpindi',
      });
    });

    it('does not filter by city when none is provided', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listSocieties({});

      expect(qbMocks.andWhere).not.toHaveBeenCalled();
    });

    it('returns an empty array, not an error, on an empty database', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listSocieties({});

      expect(result.societies).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    it('defaults to page 1 and limit 20 when not provided', async () => {
      qbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listSocieties({});

      expect(result.page).toBe(1);
      expect(qbMocks.skip).toHaveBeenCalledWith(0);
      expect(qbMocks.take).toHaveBeenCalledWith(20);
    });
  });

  // ─── DEVELOPER-SOCIETY LINK Chunk 1 ──────────────────────────────────────────

  describe('createSociety', () => {
    function buildInput(overrides: object = {}) {
      return {
        name: 'Test Society',
        city: 'Islamabad',
        min_price: null,
        max_price: null,
        min_area_marla: null,
        max_area_marla: null,
        property_types: ['PLOT'],
        noc_approved: false,
        base_confidence: 0.5,
        is_siraat_affiliated: false,
        affiliation_disclosure: null,
        noc_summary: null,
        developer_id: null,
        ...overrides,
      };
    }

    it('stores developer_id when provided', async () => {
      const result = await service.createSociety(buildInput({ developer_id: 'dev-a-uuid' }));

      expect(societyCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ developer_id: 'dev-a-uuid' }),
      );
      expect(result.developer_id).toBe('dev-a-uuid');
    });

    // Regression: most existing fixtures/callers won't set this field.
    it('a society with developer_id: null still works correctly', async () => {
      const result = await service.createSociety(buildInput());

      expect(societyCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ developer_id: null }),
      );
      expect(result.developer_id).toBeNull();
    });
  });

  describe('findSocietiesByDeveloperId', () => {
    it('returns every society linked to a developer with 2+ linked societies', async () => {
      societyFindByMock.mockResolvedValue([
        { id: 'soc-a-uuid', name: 'Green Valley', city: 'Islamabad', developer_id: 'dev-a-uuid' },
        { id: 'soc-b-uuid', name: 'Green Valley Phase 2', city: 'Islamabad', developer_id: 'dev-a-uuid' },
      ]);

      const result = await service.findSocietiesByDeveloperId('dev-a-uuid');

      expect(societyFindByMock).toHaveBeenCalledWith({ developer_id: 'dev-a-uuid' });
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toEqual(['soc-a-uuid', 'soc-b-uuid']);
    });

    it('returns [] for a developer with no linked societies', async () => {
      societyFindByMock.mockResolvedValue([]);

      const result = await service.findSocietiesByDeveloperId('dev-a-uuid');

      expect(result).toEqual([]);
    });
  });

  // ─── DEVELOPER-SOCIETY LINK Chunk 3 ──────────────────────────────────────────

  describe('searchDevelopers', () => {
    it('returns matching developers (id, name only) for a non-empty query', async () => {
      developerFindMock.mockResolvedValue([
        { id: 'dev-a-uuid', name: 'Zameen Developers', project_history: [], is_siraat_affiliated: false },
      ]);

      const result = await service.searchDevelopers('zameen');

      expect(result).toEqual([{ id: 'dev-a-uuid', name: 'Zameen Developers' }]);
    });

    it('performs a case-insensitive substring match capped at the search limit', async () => {
      await service.searchDevelopers('zam');

      expect(developerFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: ILike('%zam%') },
          take: 10,
        }),
      );
    });

    it('returns [] for an empty or whitespace-only query, without hitting the repository', async () => {
      const empty = await service.searchDevelopers('');
      const whitespace = await service.searchDevelopers('   ');

      expect(empty).toEqual([]);
      expect(whitespace).toEqual([]);
      expect(developerFindMock).not.toHaveBeenCalled();
    });

    it('returns [] when no developer name matches', async () => {
      developerFindMock.mockResolvedValue([]);

      const result = await service.searchDevelopers('no-such-developer');

      expect(result).toEqual([]);
    });
  });

  // ─── DEVELOPER PROFILE Chunk 1 ────────────────────────────────────────────────

  describe('getDeveloperStats', () => {
    const DEV_A: Partial<DeveloperEntity> = {
      id: 'dev-a-uuid',
      name: 'Zameen Developers',
      project_history: ['Green Valley Phase 1', 'Green Valley Phase 2'],
      is_siraat_affiliated: true,
    };

    it('returns null for a non-existent developer id (controller maps this to 404)', async () => {
      developerFindOneByMock.mockResolvedValue(null);

      const result = await service.getDeveloperStats('missing-uuid');

      expect(result).toBeNull();
    });

    it('derives verification_status via TrustService, same as Browse (reused, not re-implemented)', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      deriveVerificationStatusMock.mockResolvedValue('DISPUTED');
      trustGetVerificationsMock.mockResolvedValue([]);

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(deriveVerificationStatusMock).toHaveBeenCalledWith('DEVELOPER', DEV_A.id);
      expect(result!.verification_status).toBe('DISPUTED');
    });

    it('sums evidence across every claim on the developer (multi-claim fixture)', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      deriveVerificationStatusMock.mockResolvedValue('VERIFIED');
      trustGetVerificationsMock.mockResolvedValue([
        { verification: { id: 'ver-1', claim_type: 'NOC' }, evidence: [{ id: 'e1' }, { id: 'e2' }] },
        { verification: { id: 'ver-2', claim_type: 'SHOW_CAUSE_NOTICE' }, evidence: [{ id: 'e3' }] },
      ]);

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(result!.evidence_count).toBe(3);
    });

    it('returns evidence_count: 0 for a developer with no claims yet', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      deriveVerificationStatusMock.mockResolvedValue('PENDING');
      trustGetVerificationsMock.mockResolvedValue([]);

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(result!.evidence_count).toBe(0);
    });

    it('maps developer_id, developer_name, project_history, and is_siraat_affiliated from the entity', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      deriveVerificationStatusMock.mockResolvedValue('PENDING');
      trustGetVerificationsMock.mockResolvedValue([]);

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(result).toMatchObject({
        developer_id: 'dev-a-uuid',
        developer_name: 'Zameen Developers',
        project_history: ['Green Valley Phase 1', 'Green Valley Phase 2'],
        is_siraat_affiliated: true,
      });
    });

    it('returns linked_societies: [] for a developer with no linked societies', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      deriveVerificationStatusMock.mockResolvedValue('PENDING');
      trustGetVerificationsMock.mockResolvedValue([]);
      societyFindByMock.mockResolvedValue([]);

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(result!.linked_societies).toEqual([]);
    });

    // DEVELOPER-SOCIETY LINK Chunk 1 — real linked_societies via
    // findSocietiesByDeveloperId, no longer hardcoded to [].
    it('returns real linked_societies, each with its own derived verification_status', async () => {
      developerFindOneByMock.mockResolvedValue(DEV_A);
      trustGetVerificationsMock.mockResolvedValue([]);
      societyFindByMock.mockResolvedValue([
        { id: 'soc-a-uuid', name: 'Green Valley Phase 1', city: 'Islamabad', developer_id: DEV_A.id },
        { id: 'soc-b-uuid', name: 'Green Valley Phase 2', city: 'Islamabad', developer_id: DEV_A.id },
      ]);
      deriveVerificationStatusMock.mockImplementation((subjectType: string, subjectId: string) => {
        if (subjectType === 'DEVELOPER') return Promise.resolve('PARTIAL');
        return Promise.resolve(subjectId === 'soc-a-uuid' ? 'VERIFIED' : 'PENDING');
      });

      const result = await service.getDeveloperStats(DEV_A.id!);

      expect(societyFindByMock).toHaveBeenCalledWith({ developer_id: DEV_A.id });
      expect(result!.linked_societies).toEqual([
        { id: 'soc-a-uuid', name: 'Green Valley Phase 1', city: 'Islamabad', verification_status: 'VERIFIED' },
        { id: 'soc-b-uuid', name: 'Green Valley Phase 2', city: 'Islamabad', verification_status: 'PENDING' },
      ]);
    });
  });

  // ─── CONTRACTOR DIRECTORY Chunk 1 ────────────────────────────────────────────

  function buildContractorInput(overrides: object = {}) {
    return {
      name: 'Ali Electrical Services',
      trade_categories: ['ELECTRICIAN'] as TradeCategory[],
      service_cities: ['Islamabad'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: null,
      is_siraat_affiliated: false,
      ...overrides,
    };
  }

  describe('createContractor', () => {
    it('creates a contractor with multiple trade_categories', async () => {
      const input = buildContractorInput({ trade_categories: ['TILE_WORK', 'PAINTER'] });

      const result = await service.createContractor(input);

      expect(contractorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ trade_categories: ['TILE_WORK', 'PAINTER'], record_type: 'FACT' }),
      );
      expect(result.trade_categories).toEqual(['TILE_WORK', 'PAINTER']);
      expect(result.record_type).toBe('FACT');
    });

    it('creates a contractor with a single trade category', async () => {
      const result = await service.createContractor(buildContractorInput());

      expect(result.trade_categories).toEqual(['ELECTRICIAN']);
      expect(result.name).toBe('Ali Electrical Services');
      expect(result.contact_whatsapp).toBeNull();
      expect(result.is_siraat_affiliated).toBe(false);
    });
  });

  describe('findContractorById', () => {
    it('returns the contractor when found', async () => {
      contractorFindOneByMock.mockResolvedValue({
        id: 'con-a-uuid',
        name: 'Ali Electrical Services',
        trade_categories: ['ELECTRICIAN'],
        service_cities: ['Islamabad'],
        contact_phone: '+92 300 1112222',
        contact_whatsapp: null,
        is_siraat_affiliated: false,
        record_type: 'FACT',
      });

      const result = await service.findContractorById('con-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Ali Electrical Services');
    });

    it('returns null when no contractor matches the id', async () => {
      contractorFindOneByMock.mockResolvedValue(null);

      const result = await service.findContractorById('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('searchContractors', () => {
    const CONTRACTOR_ROW = {
      id: 'con-a-uuid',
      name: 'Ali Electrical Services',
      trade_categories: ['ELECTRICIAN'],
      service_cities: ['Islamabad', 'Rawalpindi'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
      record_type: 'FACT',
    };

    it('filters by trade_category using the same array-containment pattern as property_type', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[CONTRACTOR_ROW], 1]);

      const result = await service.searchContractors({ trade_category: 'ELECTRICIAN' });

      expect(contractorQbMocks.andWhere).toHaveBeenCalledWith(
        ':category = ANY(c.trade_categories)',
        { category: 'ELECTRICIAN' },
      );
      expect(result.contractors).toHaveLength(1);
      expect(result.contractors[0].id).toBe('con-a-uuid');
    });

    it('filters by city case-insensitively across the service_cities array', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[CONTRACTOR_ROW], 1]);

      await service.searchContractors({ city: 'islamabad' });

      expect(contractorQbMocks.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('unnest(c.service_cities)'),
        { city: 'islamabad' },
      );
    });

    it('combines trade_category and city filters together', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[CONTRACTOR_ROW], 1]);

      await service.searchContractors({ trade_category: 'ELECTRICIAN', city: 'Islamabad' });

      expect(contractorQbMocks.andWhere).toHaveBeenCalledTimes(2);
    });

    it('returns [] with total_count 0 when no contractors match', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchContractors({ trade_category: 'PLUMBER' });

      expect(result.contractors).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    // ─── Pagination — matches the Browse Societies (listSocieties) pattern ───

    it('defaults to page 1, limit 20 — same defaults as listSocieties', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[CONTRACTOR_ROW], 1]);

      const result = await service.searchContractors({});

      expect(contractorQbMocks.skip).toHaveBeenCalledWith(0);
      expect(contractorQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });

    it('applies page/limit and computes total_pages via skip/take/getManyAndCount, same as listSocieties', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[CONTRACTOR_ROW], 45]);

      const result = await service.searchContractors({ page: 2, limit: 10 });

      expect(contractorQbMocks.skip).toHaveBeenCalledWith(10);
      expect(contractorQbMocks.take).toHaveBeenCalledWith(10);
      expect(contractorQbMocks.orderBy).toHaveBeenCalledWith('c.name', 'ASC');
      expect(result.page).toBe(2);
      expect(result.total_count).toBe(45);
      expect(result.total_pages).toBe(5);
    });

    it('falls back to defaults for a non-positive page/limit, same guard as listSocieties', async () => {
      contractorQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchContractors({ page: 0, limit: -5 });

      expect(contractorQbMocks.skip).toHaveBeenCalledWith(0);
      expect(contractorQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });
  });

  // ─── SUPPLIER DIRECTORY Chunk 1 ──────────────────────────────────────────────
  // Same fixtures/assertions shape as CONTRACTOR DIRECTORY Chunk 1 above —
  // proves createSupplier/findSupplierById/searchSuppliers work the same way,
  // just a different entity/subject.

  function buildSupplierInput(overrides: object = {}) {
    return {
      name: 'Al-Rehman Steel Traders',
      material_categories: ['STEEL'] as MaterialCategory[],
      service_cities: ['Islamabad'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: null,
      is_siraat_affiliated: false,
      ...overrides,
    };
  }

  describe('createSupplier', () => {
    it('creates a supplier with multiple material_categories', async () => {
      const input = buildSupplierInput({ material_categories: ['STEEL', 'CEMENT'] });

      const result = await service.createSupplier(input);

      expect(supplierCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ material_categories: ['STEEL', 'CEMENT'], record_type: 'FACT' }),
      );
      expect(result.material_categories).toEqual(['STEEL', 'CEMENT']);
      expect(result.record_type).toBe('FACT');
    });

    it('creates a supplier with a single material category', async () => {
      const result = await service.createSupplier(buildSupplierInput());

      expect(result.material_categories).toEqual(['STEEL']);
      expect(result.name).toBe('Al-Rehman Steel Traders');
      expect(result.contact_whatsapp).toBeNull();
      expect(result.is_siraat_affiliated).toBe(false);
    });
  });

  describe('findSupplierById', () => {
    it('returns the supplier when found', async () => {
      supplierFindOneByMock.mockResolvedValue({
        id: 'sup-a-uuid',
        name: 'Al-Rehman Steel Traders',
        material_categories: ['STEEL'],
        service_cities: ['Islamabad'],
        contact_phone: '+92 300 1112222',
        contact_whatsapp: null,
        is_siraat_affiliated: false,
        record_type: 'FACT',
      });

      const result = await service.findSupplierById('sup-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Al-Rehman Steel Traders');
    });

    it('returns null when no supplier matches the id', async () => {
      supplierFindOneByMock.mockResolvedValue(null);

      const result = await service.findSupplierById('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('searchSuppliers', () => {
    const SUPPLIER_ROW = {
      id: 'sup-a-uuid',
      name: 'Al-Rehman Steel Traders',
      material_categories: ['STEEL'],
      service_cities: ['Islamabad', 'Rawalpindi'],
      contact_phone: '+92 300 1112222',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
      record_type: 'FACT',
    };

    it('filters by material_category using the same array-containment pattern as trade_category', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[SUPPLIER_ROW], 1]);

      const result = await service.searchSuppliers({ material_category: 'STEEL' });

      expect(supplierQbMocks.andWhere).toHaveBeenCalledWith(
        ':category = ANY(s.material_categories)',
        { category: 'STEEL' },
      );
      expect(result.suppliers).toHaveLength(1);
      expect(result.suppliers[0].id).toBe('sup-a-uuid');
    });

    it('filters by city case-insensitively across the service_cities array', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[SUPPLIER_ROW], 1]);

      await service.searchSuppliers({ city: 'islamabad' });

      expect(supplierQbMocks.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('unnest(s.service_cities)'),
        { city: 'islamabad' },
      );
    });

    it('combines material_category and city filters together', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[SUPPLIER_ROW], 1]);

      await service.searchSuppliers({ material_category: 'STEEL', city: 'Islamabad' });

      expect(supplierQbMocks.andWhere).toHaveBeenCalledTimes(2);
    });

    it('returns [] with total_count 0 when no suppliers match', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchSuppliers({ material_category: 'TILES' });

      expect(result.suppliers).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    // ─── Pagination — matches the Browse Societies (listSocieties) pattern ───

    it('defaults to page 1, limit 20 — same defaults as listSocieties', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[SUPPLIER_ROW], 1]);

      const result = await service.searchSuppliers({});

      expect(supplierQbMocks.skip).toHaveBeenCalledWith(0);
      expect(supplierQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });

    it('applies page/limit and computes total_pages via skip/take/getManyAndCount, same as listSocieties', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[SUPPLIER_ROW], 45]);

      const result = await service.searchSuppliers({ page: 2, limit: 10 });

      expect(supplierQbMocks.skip).toHaveBeenCalledWith(10);
      expect(supplierQbMocks.take).toHaveBeenCalledWith(10);
      expect(supplierQbMocks.orderBy).toHaveBeenCalledWith('s.name', 'ASC');
      expect(result.page).toBe(2);
      expect(result.total_count).toBe(45);
      expect(result.total_pages).toBe(5);
    });

    it('falls back to defaults for a non-positive page/limit, same guard as listSocieties', async () => {
      supplierQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchSuppliers({ page: 0, limit: -5 });

      expect(supplierQbMocks.skip).toHaveBeenCalledWith(0);
      expect(supplierQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });
  });

  // ─── HOUSE PLANS DIRECTORY Chunk 1 ───────────────────────────────────────────

  function buildHousePlanInput(overrides: object = {}) {
    return {
      title: '5 Marla Modern Home',
      area_marla: 5,
      bedrooms: 3,
      style: 'MODERN' as HousePlanStyle,
      preview_image_ref: 'house-plans/hp-a-uuid/preview.jpg',
      description: 'A compact modern layout with an open-plan lounge.',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
      ...overrides,
    };
  }

  describe('createHousePlan', () => {
    it('creates a house plan with all fields', async () => {
      const input = buildHousePlanInput();

      const result = await service.createHousePlan(input);

      expect(housePlanCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: '5 Marla Modern Home', style: 'MODERN', record_type: 'FACT' }),
      );
      expect(result.title).toBe('5 Marla Modern Home');
      expect(result.area_marla).toBe(5);
      expect(result.bedrooms).toBe(3);
      expect(result.style).toBe('MODERN');
      expect(result.contact_whatsapp).toBe('+92 300 1112222');
      expect(result.record_type).toBe('FACT');
    });

    it('converts a string-typed decimal area_marla column back to a number', async () => {
      // pg/TypeORM returns `decimal` columns as strings — same conversion
      // toSocietyResult/findPropertyById already rely on elsewhere.
      housePlanSaveMock.mockResolvedValue({
        id: 'hp-new-uuid',
        ...buildHousePlanInput(),
        area_marla: '5.00',
        record_type: 'FACT',
      });

      const result = await service.createHousePlan(buildHousePlanInput());

      expect(result.area_marla).toBe(5);
      expect(typeof result.area_marla).toBe('number');
    });
  });

  describe('findHousePlanById', () => {
    it('returns the house plan when found', async () => {
      housePlanFindOneByMock.mockResolvedValue({
        id: 'hp-a-uuid',
        ...buildHousePlanInput(),
        record_type: 'FACT',
      });

      const result = await service.findHousePlanById('hp-a-uuid');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('5 Marla Modern Home');
    });

    it('returns null when no house plan matches the id', async () => {
      housePlanFindOneByMock.mockResolvedValue(null);

      const result = await service.findHousePlanById('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('searchHousePlans', () => {
    const HOUSE_PLAN_ROW = {
      id: 'hp-a-uuid',
      title: '5 Marla Modern Home',
      area_marla: '5.00',
      bedrooms: 3,
      style: 'MODERN',
      preview_image_ref: 'house-plans/hp-a-uuid/preview.jpg',
      description: 'A compact modern layout with an open-plan lounge.',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
      record_type: 'FACT',
    };

    it('filters by area_marla range (min and max)', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 1]);

      const result = await service.searchHousePlans({ area_marla_min: 4, area_marla_max: 6 });

      expect(housePlanQbMocks.andWhere).toHaveBeenCalledWith('h.area_marla >= :areaMin', { areaMin: 4 });
      expect(housePlanQbMocks.andWhere).toHaveBeenCalledWith('h.area_marla <= :areaMax', { areaMax: 6 });
      expect(result.house_plans).toHaveLength(1);
      expect(result.house_plans[0].area_marla).toBe(5);
    });

    it('filters by bedrooms', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 1]);

      await service.searchHousePlans({ bedrooms: 3 });

      expect(housePlanQbMocks.andWhere).toHaveBeenCalledWith('h.bedrooms = :bedrooms', { bedrooms: 3 });
    });

    it('filters by style', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 1]);

      await service.searchHousePlans({ style: 'MODERN' });

      expect(housePlanQbMocks.andWhere).toHaveBeenCalledWith('h.style = :style', { style: 'MODERN' });
    });

    it('combines area range, bedrooms, and style filters together', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 1]);

      await service.searchHousePlans({ area_marla_min: 4, area_marla_max: 6, bedrooms: 3, style: 'MODERN' });

      expect(housePlanQbMocks.andWhere).toHaveBeenCalledTimes(4);
    });

    it('returns [] with total_count 0 when no house plans match', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchHousePlans({ style: 'MINIMALIST' });

      expect(result.house_plans).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.total_pages).toBe(0);
    });

    // ─── Pagination — matches the Browse Societies (listSocieties) pattern ───

    it('defaults to page 1, limit 20 — same defaults as listSocieties', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 1]);

      const result = await service.searchHousePlans({});

      expect(housePlanQbMocks.skip).toHaveBeenCalledWith(0);
      expect(housePlanQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });

    it('applies page/limit and computes total_pages via skip/take/getManyAndCount, same as listSocieties', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[HOUSE_PLAN_ROW], 45]);

      const result = await service.searchHousePlans({ page: 2, limit: 10 });

      expect(housePlanQbMocks.skip).toHaveBeenCalledWith(10);
      expect(housePlanQbMocks.take).toHaveBeenCalledWith(10);
      expect(housePlanQbMocks.orderBy).toHaveBeenCalledWith('h.title', 'ASC');
      expect(result.page).toBe(2);
      expect(result.total_count).toBe(45);
      expect(result.total_pages).toBe(5);
    });

    it('falls back to defaults for a non-positive page/limit, same guard as listSocieties', async () => {
      housePlanQbMocks.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchHousePlans({ page: 0, limit: -5 });

      expect(housePlanQbMocks.skip).toHaveBeenCalledWith(0);
      expect(housePlanQbMocks.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
    });
  });

  describe('updateHousePlanPreviewImage', () => {
    it('persists the new preview_image_ref by id', async () => {
      await service.updateHousePlanPreviewImage('hp-a-uuid', 'house-plans/hp-a-uuid/new.jpg');

      expect(housePlanUpdateMock).toHaveBeenCalledWith(
        { id: 'hp-a-uuid' },
        { preview_image_ref: 'house-plans/hp-a-uuid/new.jpg' },
      );
    });
  });

  // ─── ADMIN CRUD PHASE 1 Chunk 1 ──────────────────────────────────────────────

  describe('updateHousePlan', () => {
    const EXISTING_PLAN = {
      id: 'hp-a-uuid',
      title: '5 Marla Modern Home',
      area_marla: 5,
      bedrooms: 3,
      style: 'MODERN' as HousePlanStyle,
      preview_image_ref: 'house-plans/hp-a-uuid/preview.jpg',
      description: 'A compact modern layout with an open-plan lounge.',
      contact_whatsapp: '+92 300 1112222',
      is_siraat_affiliated: false,
      record_type: 'FACT' as const,
    };

    it('updates the given fields and returns the updated plan', async () => {
      housePlanFindOneByMock.mockResolvedValue({ ...EXISTING_PLAN });
      housePlanSaveMock.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateHousePlan('hp-a-uuid', {
        title: '5 Marla Contemporary Home',
        bedrooms: 4,
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe('5 Marla Contemporary Home');
      expect(result!.bedrooms).toBe(4);
      // Untouched fields survive the partial update.
      expect(result!.style).toBe('MODERN');
      expect(housePlanSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: '5 Marla Contemporary Home', bedrooms: 4 }),
      );
    });

    it('never touches preview_image_ref, even if somehow present in the data', async () => {
      housePlanFindOneByMock.mockResolvedValue({ ...EXISTING_PLAN });
      housePlanSaveMock.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateHousePlan('hp-a-uuid', { title: 'Renamed' });

      expect(result!.preview_image_ref).toBe('house-plans/hp-a-uuid/preview.jpg');
    });

    it('returns null when no house plan matches the id', async () => {
      housePlanFindOneByMock.mockResolvedValue(null);

      const result = await service.updateHousePlan('non-existent-uuid', { title: 'X' });

      expect(result).toBeNull();
      expect(housePlanSaveMock).not.toHaveBeenCalled();
    });
  });

  describe('deleteHousePlan', () => {
    it('returns true when a row was deleted', async () => {
      housePlanDeleteMock.mockResolvedValue({ affected: 1 });

      const result = await service.deleteHousePlan('hp-a-uuid');

      expect(housePlanDeleteMock).toHaveBeenCalledWith({ id: 'hp-a-uuid' });
      expect(result).toBe(true);
    });

    it('returns false when no row matched the id', async () => {
      housePlanDeleteMock.mockResolvedValue({ affected: 0 });

      const result = await service.deleteHousePlan('non-existent-uuid');

      expect(result).toBe(false);
    });
  });

  describe('updateCandidateSociety', () => {
    const EXISTING_CANDIDATE = {
      id: 'cand-a-uuid',
      name: 'Park View City',
      regulator: 'CDA' as const,
      city: 'Islamabad',
      status: 'NOT_STARTED' as const,
      record_type: 'FACT' as const,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };

    it('updates the given fields and returns the updated candidate', async () => {
      candidateFindOneByMock.mockResolvedValue({ ...EXISTING_CANDIDATE });

      const result = await service.updateCandidateSociety('cand-a-uuid', { status: 'IN_PROGRESS' });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('IN_PROGRESS');
      // Untouched fields survive the partial update.
      expect(result!.name).toBe('Park View City');
      expect(candidateSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS' }),
      );
    });

    it('supports reverting status back to NOT_STARTED (manual override)', async () => {
      candidateFindOneByMock.mockResolvedValue({ ...EXISTING_CANDIDATE, status: 'ONBOARDED' });

      const result = await service.updateCandidateSociety('cand-a-uuid', { status: 'NOT_STARTED' });

      expect(result!.status).toBe('NOT_STARTED');
    });

    it('returns null when no candidate matches the id', async () => {
      candidateFindOneByMock.mockResolvedValue(null);

      const result = await service.updateCandidateSociety('non-existent-uuid', { status: 'IN_PROGRESS' });

      expect(result).toBeNull();
      expect(candidateSaveMock).not.toHaveBeenCalled();
    });
  });

  describe('deleteCandidateSociety', () => {
    it('returns true when a row was deleted', async () => {
      candidateDeleteMock.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCandidateSociety('cand-a-uuid');

      expect(candidateDeleteMock).toHaveBeenCalledWith({ id: 'cand-a-uuid' });
      expect(result).toBe(true);
    });

    it('returns false when no row matched the id', async () => {
      candidateDeleteMock.mockResolvedValue({ affected: 0 });

      const result = await service.deleteCandidateSociety('non-existent-uuid');

      expect(result).toBe(false);
    });
  });

  // CLEANUP — listCandidateSocieties/markCandidateSocietyOnboarded moved here
  // from AdminService's own direct repository access (which is now removed).

  describe('listCandidateSocieties', () => {
    const CANDIDATE_ROW = {
      id: 'cand-a-uuid',
      name: 'Park View City',
      regulator: 'CDA' as const,
      city: 'Islamabad',
      status: 'NOT_STARTED' as const,
      record_type: 'FACT' as const,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };

    it('returns all candidates when no status filter given', async () => {
      candidateFindMock.mockResolvedValue([CANDIDATE_ROW]);

      const result = await service.listCandidateSocieties();

      expect(candidateFindMock).toHaveBeenCalled();
      expect(candidateFindByMock).not.toHaveBeenCalled();
      expect(result).toEqual([CANDIDATE_ROW]);
    });

    it('filters by status when provided', async () => {
      candidateFindByMock.mockResolvedValue([CANDIDATE_ROW]);

      const result = await service.listCandidateSocieties('NOT_STARTED');

      expect(candidateFindByMock).toHaveBeenCalledWith({ status: 'NOT_STARTED' });
      expect(candidateFindMock).not.toHaveBeenCalled();
      expect(result).toEqual([CANDIDATE_ROW]);
    });
  });

  describe('markCandidateSocietyOnboarded', () => {
    const CANDIDATE_ROW = {
      id: 'cand-a-uuid',
      name: 'Park View City',
      regulator: 'CDA' as const,
      city: 'Islamabad',
      status: 'NOT_STARTED' as const,
      record_type: 'FACT' as const,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };

    it('marks the matching candidate ONBOARDED and returns true', async () => {
      candidateFindOneByMock.mockResolvedValue({ ...CANDIDATE_ROW });

      const result = await service.markCandidateSocietyOnboarded('Park View City');

      expect(candidateFindOneByMock).toHaveBeenCalledWith({ name: 'Park View City' });
      expect(candidateSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ONBOARDED' }),
      );
      expect(result).toBe(true);
    });

    it('returns false and does not save when no candidate matches the name', async () => {
      candidateFindOneByMock.mockResolvedValue(null);

      const result = await service.markCandidateSocietyOnboarded('Unknown Society');

      expect(candidateSaveMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('findMaterialRatesBySupplierId', () => {
    it('delegates to ConstructionIntelligenceService.findRatesBySupplierId (cross-module public-API call, Law 9)', async () => {
      const rates = [{ id: 'rate-uuid-001', material_name: 'Steel Rebar Grade 60' }];
      ciFindRatesBySupplierIdMock.mockResolvedValue(rates);

      const result = await service.findMaterialRatesBySupplierId('sup-a-uuid');

      expect(ciFindRatesBySupplierIdMock).toHaveBeenCalledWith('sup-a-uuid');
      expect(result).toBe(rates);
    });
  });

  // ─── OBSERVATION LOGGING Chunk 1 ─────────────────────────────────────────────

  describe('logObservation', () => {
    it('writes a FACT Observation row with the given fields', async () => {
      await service.logObservation({
        entity_ref: 'soc-a-uuid',
        metric: 'confidence_score',
        old_value: '0.80',
        new_value: '0.93',
        source_ref: 'ScoringService.computeAndSave',
      });

      expect(obsCreateMock).toHaveBeenCalledWith({
        entity_ref: 'soc-a-uuid',
        metric: 'confidence_score',
        old_value: '0.80',
        new_value: '0.93',
        source_ref: 'ScoringService.computeAndSave',
        record_type: 'FACT',
      });
      expect(obsSaveMock).toHaveBeenCalledTimes(1);
    });

    it('swallows a write failure instead of throwing', async () => {
      obsSaveMock.mockRejectedValueOnce(new Error('db unavailable'));

      await expect(
        service.logObservation({
          entity_ref: 'soc-a-uuid',
          metric: 'confidence_score',
          old_value: '0.80',
          new_value: '0.93',
          source_ref: 'ScoringService.computeAndSave',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── WATCHLIST Chunk 1 ────────────────────────────────────────────────────

  describe('getObservationsSince', () => {
    it('queries observations scoped to the given entity_refs and recorded after since', async () => {
      const since = new Date('2026-08-01');
      const recentObservation = {
        entity_ref: 'soc-a-uuid',
        metric: 'confidence_score',
        old_value: '0.80',
        new_value: '0.93',
        recorded_at: new Date('2026-08-10'),
      };
      obsFindMock.mockResolvedValue([recentObservation]);

      const result = await service.getObservationsSince(['soc-a-uuid'], since);

      expect(result).toEqual([recentObservation]);
      expect(obsFindMock).toHaveBeenCalledWith({
        where: { entity_ref: In(['soc-a-uuid']), recorded_at: MoreThan(since) },
        order: { recorded_at: 'DESC' },
      });
    });

    it('returns [] without querying when entityRefs is empty', async () => {
      const result = await service.getObservationsSince([], new Date('2026-08-01'));

      expect(result).toEqual([]);
      expect(obsFindMock).not.toHaveBeenCalled();
    });
  });

  describe('getSocietyChangesSince', () => {
    const SOCIETY_A = { id: 'soc-a-uuid', name: 'Taj Residencia' };
    const since = '2026-08-01';

    beforeEach(() => {
      societyFindOneByMock.mockImplementation(({ id }: { id: string }) =>
        Promise.resolve(id === SOCIETY_A.id ? SOCIETY_A : null),
      );
    });

    it('aggregates observations from both Property Intelligence and Trust for the same society', async () => {
      obsFindMock.mockResolvedValue([
        {
          entity_ref: SOCIETY_A.id,
          metric: 'confidence_score',
          old_value: '0.80',
          new_value: '0.93',
          recorded_at: new Date('2026-08-10'),
        },
      ]);
      trustGetVerificationsMock.mockResolvedValue([
        { verification: { id: 'ver-1' }, evidence: [] },
      ]);
      trustGetObservationsSinceMock.mockResolvedValue([
        {
          entity_ref: 'ver-1',
          metric: 'verification_status',
          old_value: 'PENDING',
          new_value: 'VERIFIED',
          recorded_at: new Date('2026-08-12'),
        },
      ]);

      const result = await service.getSocietyChangesSince([SOCIETY_A.id], since);

      expect(result.changes).toHaveLength(1);
      const change = result.changes[0];
      expect(change.society_id).toBe(SOCIETY_A.id);
      expect(change.society_name).toBe('Taj Residencia');
      expect(change.has_changes).toBe(true);
      expect(change.observations).toHaveLength(2);
      expect(change.observations.map((o) => o.metric)).toEqual(
        expect.arrayContaining(['confidence_score', 'verification_status']),
      );
      // Verification-scoped lookup, not society-scoped — Trust's schema is
      // read via its public API, never entity_ref = society id directly.
      expect(trustGetObservationsSinceMock).toHaveBeenCalledWith(['ver-1'], expect.any(Date));
    });

    it('has_changes: false and empty observations[] for a society with no changes since the given date', async () => {
      obsFindMock.mockResolvedValue([]);
      trustGetVerificationsMock.mockResolvedValue([{ verification: { id: 'ver-1' }, evidence: [] }]);
      trustGetObservationsSinceMock.mockResolvedValue([]);

      const result = await service.getSocietyChangesSince([SOCIETY_A.id], since);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({ has_changes: false, observations: [] });
    });

    it('drops a society_id that does not exist rather than erroring the whole batch', async () => {
      const result = await service.getSocietyChangesSince(['unknown-uuid'], since);

      expect(result.changes).toEqual([]);
    });

    it('rejects a batch larger than the max size with a clear error', async () => {
      const tooMany = Array.from({ length: 21 }, (_, i) => `soc-${i}-uuid`);

      await expect(service.getSocietyChangesSince(tooMany, since)).rejects.toThrow(
        BadRequestException,
      );
      expect(societyFindOneByMock).not.toHaveBeenCalled();
    });

    it('accepts a batch at exactly the max size', async () => {
      const exactlyMax = Array.from({ length: 20 }, () => SOCIETY_A.id);

      await expect(service.getSocietyChangesSince(exactlyMax, since)).resolves.toBeDefined();
    });

    it('rejects an invalid since value with a clear error', async () => {
      await expect(
        service.getSocietyChangesSince([SOCIETY_A.id], 'not-a-date'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
