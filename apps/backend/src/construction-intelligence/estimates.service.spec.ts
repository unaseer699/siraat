import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstimatesService } from './estimates.service';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import type { MaterialRateEntity } from './entities/material-rate.entity';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function rate(overrides: Partial<MaterialRateEntity> = {}): MaterialRateEntity {
  return {
    id: 'rate-id',
    material_name: 'Cement',
    unit: 'per bag',
    price: 1000,
    city: 'Islamabad',
    source_tier: 'MARKET_REFERENCE',
    source_name: 'Some Source',
    source_contact: null,
    recorded_date: isoDaysAgo(0),
    record_type: 'FACT',
    is_stale: false,
    created_at: new Date(),
    ...overrides,
  } as MaterialRateEntity;
}

// One fresh MARKET_REFERENCE rate per core material — enough for a FULL estimate.
function fullCoverageRates(): MaterialRateEntity[] {
  return [
    rate({ id: 'r-cement', material_name: 'Cement - OPC 50kg bag', price: 1550 }),
    rate({ id: 'r-steel', material_name: 'Steel - Grade 60 rebar', price: 280 }),
    rate({ id: 'r-bricks', material_name: 'Bricks - Class A', price: 14 }),
    rate({ id: 'r-sand', material_name: 'Sand - coarse', price: 45 }),
    rate({ id: 'r-crush', material_name: 'Crush - 3/4 inch', price: 90 }),
  ];
}

describe('EstimatesService', () => {
  let service: EstimatesService;
  let listRawRatesForCityMock: jest.Mock;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let qbMocks: { where: jest.Mock; andWhere: jest.Mock; orderBy: jest.Mock; getOne: jest.Mock };

  beforeEach(async () => {
    listRawRatesForCityMock = jest.fn();
    createMock = jest.fn((data) => data);
    saveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'estimate-uuid-001', computed_at: new Date(), ...entity }),
    );
    qbMocks = {
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    qbMocks.where.mockReturnValue(qbMocks);
    qbMocks.andWhere.mockReturnValue(qbMocks);
    qbMocks.orderBy.mockReturnValue(qbMocks);

    const module = await Test.createTestingModule({
      providers: [
        EstimatesService,
        {
          provide: ConstructionIntelligenceService,
          useValue: { listRawRatesForCity: listRawRatesForCityMock },
        },
        {
          provide: getRepositoryToken(ConstructionEstimateEntity),
          useValue: {
            create: createMock,
            save: saveMock,
            createQueryBuilder: jest.fn(() => qbMocks),
          },
        },
      ],
    }).compile();

    service = module.get(EstimatesService);
  });

  const req = { city: 'Islamabad', area_marla: 5, quality_tier: 'STANDARD' as const };

  it('NOT_COVERED when zero rates exist for the requested city', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const result = await service.getEstimate(req);
    expect(result.state).toBe('NOT_COVERED');
    if (result.state === 'NOT_COVERED') {
      expect(result.city).toBe('Islamabad');
    }
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('FULL state when all 5 core materials have fresh rates for a city', async () => {
    listRawRatesForCityMock.mockResolvedValue(fullCoverageRates());
    const result = await service.getEstimate(req);

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');
    expect(result.line_items).toHaveLength(5);
    expect(result.line_items.every((li) => li.unit_rate !== null)).toBe(true);
    expect(result.total_estimate).toBeGreaterThan(0);
    expect(result.is_stale).toBe(false);
    expect(result.derived_from).toHaveLength(5);
    expect(result.record_type).toBe('GENERATED');
    expect(saveMock).toHaveBeenCalled();
  });

  it('total_estimate exactly equals the sum of the displayed line-item subtotals', async () => {
    // Fractional rates and a fractional area_marla, chosen to exercise binary
    // floating-point summation (e.g. 0.1 + 0.2 !== 0.3) rather than an all-integer
    // fixture that would pass this check by accident.
    const rates = [
      rate({ id: 'r-cement', material_name: 'Cement', price: 1550.35 }),
      rate({ id: 'r-steel', material_name: 'Steel', price: 280.1 }),
      rate({ id: 'r-bricks', material_name: 'Bricks', price: 14.75 }),
      rate({ id: 'r-sand', material_name: 'Sand', price: 45.2 }),
      rate({ id: 'r-crush', material_name: 'Crush', price: 90.05 }),
    ];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate({ city: 'Islamabad', area_marla: 3.3, quality_tier: 'PREMIUM' });

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');

    // Sum of the exact subtotal values shown on each line — what a user adding
    // up the breakdown by hand would get.
    const summedSubtotals = result.line_items.reduce((sum, li) => sum + (li.subtotal ?? 0), 0);
    // total_estimate is only ever off from that hand-sum by binary floating-point
    // noise (e.g. 736392.775000001 vs 736392.775) — never by a rounding choice
    // that diverges from what's displayed. Snapping the hand-sum to the same
    // cent precision as every displayed subtotal must land exactly on
    // total_estimate, byte for byte, not just "close enough".
    expect(result.total_estimate).toBe(Math.round(summedSubtotals * 100) / 100);
    // And confirm that snap was actually a no-op — summedSubtotals was already
    // cent-precise, so total_estimate isn't silently absorbing a rounding delta.
    expect(result.total_estimate).toBeCloseTo(summedSubtotals, 9);
  });

  it('DEGRADED_SUCCESS when some materials are missing/stale, response clearly lists which', async () => {
    const rates = fullCoverageRates().filter((r) => r.id !== 'r-steel'); // steel missing
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('DEGRADED_SUCCESS');
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    expect(result.missing_materials).toEqual(['Steel']);
    expect(result.total_estimate).toBeNull();
    expect(result.partial_subtotal).toBeGreaterThan(0);
    const steelLine = result.line_items.find((li) => li.material_key === 'STEEL');
    expect(steelLine?.unit_rate).toBeNull();
    expect(steelLine?.is_stale).toBe(true);
    expect(result.is_stale).toBe(true);
  });

  it('DEGRADED_SUCCESS when a material rate exists but is stale', async () => {
    const rates = fullCoverageRates().map((r) =>
      r.id === 'r-bricks' ? { ...r, recorded_date: isoDaysAgo(30), source_tier: 'MARKET_REFERENCE' as const } : r,
    );
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('DEGRADED_SUCCESS');
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    expect(result.missing_materials).toEqual(['Bricks']);
  });

  it('prefers SUPPLIER_VERIFIED over MARKET_REFERENCE for the same material/city', async () => {
    const rates = [
      rate({ id: 'r-cement-market', material_name: 'Cement', price: 1000, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(1) }),
      rate({ id: 'r-cement-supplier', material_name: 'Cement', price: 1200, source_tier: 'SUPPLIER_VERIFIED', recorded_date: isoDaysAgo(2) }),
      ...fullCoverageRates().filter((r) => !r.material_name.toLowerCase().includes('cement')),
    ];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');
    const cementLine = result.line_items.find((li) => li.material_key === 'CEMENT');
    expect(cementLine?.unit_rate).toBe(1200);
    expect(cementLine?.source_tier).toBe('SUPPLIER_VERIFIED');
  });

  it('picks the most recent rate when multiple fresh rates share a tier', async () => {
    const rates = [
      rate({ id: 'r-cement-older', material_name: 'Cement', price: 1000, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(3) }),
      rate({ id: 'r-cement-newer', material_name: 'Cement', price: 1100, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(1) }),
      ...fullCoverageRates().filter((r) => !r.material_name.toLowerCase().includes('cement')),
    ];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    if (result.state !== 'FULL') throw new Error('expected FULL');
    const cementLine = result.line_items.find((li) => li.material_key === 'CEMENT');
    expect(cementLine?.unit_rate).toBe(1100);
  });

  it('reuses a cached non-stale estimate within the staleness window instead of recomputing', async () => {
    listRawRatesForCityMock.mockResolvedValue(fullCoverageRates());
    const cached = {
      id: 'cached-id',
      city: 'Islamabad',
      area_marla: 5,
      quality_tier: 'STANDARD',
      state: 'FULL',
      line_items: [],
      total_estimate: 12345,
      partial_subtotal: null,
      missing_materials: [],
      confidence_score: 1,
      is_stale: false,
      staleness_threshold_days: 7,
      derived_from: [],
      affiliation_disclosure: null,
      record_type: 'GENERATED',
      computed_at: new Date(),
      extended_attributes: null,
    };
    qbMocks.getOne.mockResolvedValue(cached);

    const result = await service.getEstimate(req);

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');
    expect(result.id).toBe('cached-id');
    expect(result.total_estimate).toBe(12345);
    expect(saveMock).not.toHaveBeenCalled();
  });
});
