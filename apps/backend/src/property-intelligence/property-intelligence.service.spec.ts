import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, In, MoreThan } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { ObservationEntity } from './entities/observation.entity';
import { TrustService } from '../trust/trust.service';

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
