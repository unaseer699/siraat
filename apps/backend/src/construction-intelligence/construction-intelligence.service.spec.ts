import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { ObservationEntity } from './entities/observation.entity';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    material_name: 'Cement - OPC 50kg bag',
    unit: 'per bag',
    price: 1550,
    city: 'Islamabad',
    source_tier: 'SUPPLIER_VERIFIED' as const,
    source_name: 'Al-Rehman Traders',
    source_contact: '+92 300 1234567',
    // SUPPLIER DIRECTORY Chunk 1 — required for SUPPLIER_VERIFIED as of this
    // chunk; defaulted here so every existing SUPPLIER_VERIFIED fixture in
    // this file keeps passing without having to thread it through everywhere.
    supplier_id: 'sup-uuid-001',
    recorded_date: isoDaysAgo(0),
    ...overrides,
  };
}

describe('ConstructionIntelligenceService', () => {
  let service: ConstructionIntelligenceService;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let qbMocks: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
    getRawOne: jest.Mock;
    getOne: jest.Mock;
  };
  let obsCreateMock: jest.Mock;
  let obsSaveMock: jest.Mock;
  let findMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn((data) => data);
    saveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'rate-uuid-001', created_at: new Date(), ...entity }),
    );
    findMock = jest.fn().mockResolvedValue([]);
    qbMocks = {
      select: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      getOne: jest.fn().mockResolvedValue(null), // no prior rate by default
    };
    qbMocks.select.mockReturnValue(qbMocks);
    qbMocks.where.mockReturnValue(qbMocks);
    qbMocks.andWhere.mockReturnValue(qbMocks);
    qbMocks.orderBy.mockReturnValue(qbMocks);
    obsCreateMock = jest.fn((data) => data);
    obsSaveMock = jest.fn((entity) => Promise.resolve({ id: 'new-obs-uuid', ...entity }));

    const module = await Test.createTestingModule({
      providers: [
        ConstructionIntelligenceService,
        {
          provide: getRepositoryToken(MaterialRateEntity),
          useValue: {
            create: createMock,
            save: saveMock,
            find: findMock,
            createQueryBuilder: jest.fn(() => qbMocks),
          },
        },
        {
          provide: getRepositoryToken(ObservationEntity),
          useValue: { create: obsCreateMock, save: obsSaveMock },
        },
      ],
    }).compile();

    service = module.get(ConstructionIntelligenceService);
  });

  describe('createMaterialRate', () => {
    // SUPPLIER DIRECTORY Chunk 1 — supplier_id replaces source_contact as the
    // required field for SUPPLIER_VERIFIED; source_name/source_contact are now
    // optional fallback fields for this tier (see the two tests below).
    it('rejects a SUPPLIER_VERIFIED rate with no supplier_id', async () => {
      await expect(
        service.createMaterialRate(buildInput({ supplier_id: null })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('accepts a SUPPLIER_VERIFIED rate with no source_contact, now that supplier_id links it', async () => {
      const result = await service.createMaterialRate(buildInput({ source_contact: null }));

      expect(result.source_contact).toBeNull();
      expect(result.supplier_id).toBe('sup-uuid-001');
      expect(saveMock).toHaveBeenCalled();
    });

    it('accepts a MARKET_REFERENCE rate with no source_contact and no supplier_id (unchanged Tier 2 behavior)', async () => {
      const result = await service.createMaterialRate(
        buildInput({
          source_tier: 'MARKET_REFERENCE',
          source_name: 'civilconstructionguide.com',
          source_contact: null,
          supplier_id: null,
        }),
      );
      expect(result.source_contact).toBeNull();
      expect(result.supplier_id).toBeNull();
      expect(saveMock).toHaveBeenCalled();
    });

    // SUPPLIER DIRECTORY Chunk 2 — source_name is now nullable; required only
    // for MARKET_REFERENCE (that tier has no supplier link at all).
    it('accepts a SUPPLIER_VERIFIED rate with no source_name, now that supplier_id links it', async () => {
      const result = await service.createMaterialRate(buildInput({ source_name: null }));

      expect(result.source_name).toBeNull();
      expect(result.supplier_id).toBe('sup-uuid-001');
      expect(saveMock).toHaveBeenCalled();
    });

    it('rejects a MARKET_REFERENCE rate with no source_name (unchanged Tier 2 requirement)', async () => {
      await expect(
        service.createMaterialRate(
          buildInput({ source_tier: 'MARKET_REFERENCE', source_name: null, supplier_id: null }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('sets record_type to FACT', async () => {
      const result = await service.createMaterialRate(buildInput());
      expect(result.record_type).toBe('FACT');
    });

    it('a 10-day-old SUPPLIER_VERIFIED (Tier 1) rate is fresh — threshold is 14 days', async () => {
      const result = await service.createMaterialRate(
        buildInput({ recorded_date: isoDaysAgo(10) }),
      );
      expect(result.is_stale).toBe(false);
      expect(result.staleness_threshold_days).toBe(14);
    });

    it('a 10-day-old MARKET_REFERENCE (Tier 2) rate is stale — threshold is 7 days', async () => {
      const result = await service.createMaterialRate(
        buildInput({
          source_tier: 'MARKET_REFERENCE',
          source_contact: null,
          recorded_date: isoDaysAgo(10),
        }),
      );
      expect(result.is_stale).toBe(true);
      expect(result.staleness_threshold_days).toBe(7);
    });
  });

  describe('createMaterialRate — Observation logging (Chunk 1)', () => {
    it('logs a material_price Observation when a prior rate exists at a different price', async () => {
      qbMocks.getOne.mockResolvedValue({ price: 1400 });

      await service.createMaterialRate(buildInput({ price: 1550 }));

      expect(obsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'material_price',
          old_value: '1400',
          new_value: '1550',
          source_ref: 'Al-Rehman Traders',
          record_type: 'FACT',
        }),
      );
      expect(obsSaveMock).toHaveBeenCalledTimes(1);
    });

    it('does not log an Observation when the price is unchanged from the prior rate', async () => {
      qbMocks.getOne.mockResolvedValue({ price: 1550 });

      await service.createMaterialRate(buildInput({ price: 1550 }));

      expect(obsSaveMock).not.toHaveBeenCalled();
    });

    it('does not log an Observation when no prior rate exists for the material/city combo', async () => {
      qbMocks.getOne.mockResolvedValue(null);

      await service.createMaterialRate(buildInput());

      expect(obsSaveMock).not.toHaveBeenCalled();
    });

    it('an Observation write failure does not break createMaterialRate', async () => {
      qbMocks.getOne.mockResolvedValue({ price: 1400 });
      obsSaveMock.mockRejectedValueOnce(new Error('db unavailable'));

      await expect(service.createMaterialRate(buildInput({ price: 1550 }))).resolves.toMatchObject({
        price: 1550,
      });
    });
  });

  // ─── SUPPLIER DIRECTORY Chunk 1 ────────────────────────────────────────────

  describe('findRatesBySupplierId', () => {
    it('returns rates filtered by supplier_id, most recent first', async () => {
      const rows = [{ id: 'rate-uuid-001', material_name: 'Steel Rebar Grade 60' }];
      findMock.mockResolvedValue(rows);

      const result = await service.findRatesBySupplierId('sup-uuid-001');

      expect(findMock).toHaveBeenCalledWith({
        where: { supplier_id: 'sup-uuid-001' },
        order: { recorded_date: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rate-uuid-001');
    });

    it('returns [] for a supplier with no rate submissions', async () => {
      findMock.mockResolvedValue([]);

      const result = await service.findRatesBySupplierId('sup-with-no-rates');

      expect(result).toEqual([]);
    });
  });

  describe('listMaterialRates', () => {
    it('filters by city and material when provided', async () => {
      await service.listMaterialRates({ city: 'Islamabad', material: 'Cement' });
      expect(qbMocks.andWhere).toHaveBeenCalledTimes(2);
    });

    it('applies no filters when none provided', async () => {
      await service.listMaterialRates({});
      expect(qbMocks.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('countDistinctMaterials', () => {
    it('returns the distinct material_name count from the query builder', async () => {
      qbMocks.getRawOne.mockResolvedValue({ count: '5' });

      const result = await service.countDistinctMaterials();

      expect(result).toBe(5);
      expect(qbMocks.select).toHaveBeenCalledWith('COUNT(DISTINCT r.material_name)', 'count');
    });

    it('returns 0 gracefully on an empty database (no rows, no error)', async () => {
      qbMocks.getRawOne.mockResolvedValue({ count: '0' });

      const result = await service.countDistinctMaterials();

      expect(result).toBe(0);
    });

    it('returns 0 (not NaN) if the query builder resolves undefined', async () => {
      qbMocks.getRawOne.mockResolvedValue(undefined);

      const result = await service.countDistinctMaterials();

      expect(result).toBe(0);
    });
  });
});
