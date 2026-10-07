import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { BoqRequest } from '@siraat/shared-types';
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

// One fresh MARKET_REFERENCE rate per one of the 6 "major" items (Core
// Materials) — enough for a FULL estimate. Excavation (available, but not
// major) is deliberately left unpriced in most fixtures below to exercise
// the "major-only gates the grand total, but its subtotal still counts"
// distinction.
function fullMajorCoverageRates(): MaterialRateEntity[] {
  return [
    rate({ id: 'r-cement', material_name: 'Cement - OPC 50kg bag', unit: 'bag', price: 1550 }),
    rate({ id: 'r-steel', material_name: 'Steel - Grade 60 rebar', unit: 'kg', price: 280 }),
    rate({ id: 'r-bricks', material_name: 'Bricks - Class A', unit: 'bricks', price: 14 }),
    rate({ id: 'r-sand', material_name: 'Sand - coarse', unit: 'cft', price: 45 }),
    rate({ id: 'r-crush', material_name: 'Crush - 3/4 inch', unit: 'cft', price: 90 }),
    rate({ id: 'r-paint', material_name: 'Paint - emulsion', unit: 'Ltr', price: 850 }),
  ];
}

const TIER_C_KEYS = [
  'BORING',
  'MARBLE_STAIRS',
  'KITCHEN_WOODWORK',
  'HARDWARE',
];

describe('EstimatesService (Material + Works BOQ Estimator v1)', () => {
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

  const req: BoqRequest = {
    city: 'Islamabad',
    area: 5,
    area_unit: 'MARLA',
    floors: 1,
    basement: false,
    finish_level: 'STANDARD',
  };

  it('always returns all 15 items, even with zero rates for the city (never NOT_COVERED)', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const result = await service.getEstimate(req);

    // Quantities are pure geometry/ratio math — no dependency on rate
    // coverage — so this always resolves to DEGRADED_SUCCESS, never
    // NOT_COVERED (unlike the retired grey-structure-only estimate).
    expect(result.state).toBe('DEGRADED_SUCCESS');
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    expect(result.line_items).toHaveLength(15);
    expect(saveMock).toHaveBeenCalled();
  });

  it('Tier C items always show available=false, quantity=null, never a rate — even when a matching rate exists', async () => {
    const rates = [...fullMajorCoverageRates(), rate({ id: 'r-fake-hardware', material_name: 'Hardware', price: 500 })];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    if (result.state === 'NOT_COVERED') throw new Error('expected FULL or DEGRADED_SUCCESS');
    for (const key of TIER_C_KEYS) {
      const line = result.line_items.find((li) => li.item_key === key);
      expect(line).toBeDefined();
      expect(line?.available).toBe(false);
      expect(line?.quantity).toBeNull();
      expect(line?.unit_rate).toBeNull();
      expect(line?.subtotal).toBeNull();
      expect(line?.notes).toBeTruthy();
    }
  });

  it('FULL state when all 6 major items have fresh rates (Excavation may still be unpriced)', async () => {
    listRawRatesForCityMock.mockResolvedValue(fullMajorCoverageRates());
    const result = await service.getEstimate(req);

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');
    expect(result.line_items).toHaveLength(15);
    const majorLines = result.line_items.filter((li) => li.is_major);
    expect(majorLines).toHaveLength(6);
    expect(majorLines.every((li) => li.unit_rate !== null)).toBe(true);
    expect(result.total_estimate).toBeGreaterThan(0);
    expect(result.is_stale).toBe(false);
    expect(result.derived_from).toHaveLength(6);
    expect(result.record_type).toBe('GENERATED');
    expect(saveMock).toHaveBeenCalled();
  });

  it('total_estimate includes a priced non-major item (Excavation) on top of the major items', async () => {
    const rates = [...fullMajorCoverageRates(), rate({ id: 'r-excavation', material_name: 'Excavation', unit: 'cft', price: 25 })];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    if (result.state !== 'FULL') throw new Error('expected FULL');
    const excavationLine = result.line_items.find((li) => li.item_key === 'EXCAVATION');
    expect(excavationLine?.unit_rate).toBe(25);
    expect(excavationLine?.subtotal).toBeGreaterThan(0);
    const summed = result.line_items.reduce((sum, li) => sum + (li.subtotal ?? 0), 0);
    expect(result.total_estimate).toBe(Math.round(summed * 100) / 100);
  });

  it('DEGRADED_SUCCESS when a major item (Steel) is missing, response lists it by name', async () => {
    const rates = fullMajorCoverageRates().filter((r) => r.id !== 'r-steel');
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('DEGRADED_SUCCESS');
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    expect(result.missing_major_items).toEqual(['Steel (rebar)']);
    expect(result.total_estimate).toBeNull();
    expect(result.partial_subtotal).toBeGreaterThan(0);
    const steelLine = result.line_items.find((li) => li.item_key === 'STEEL');
    expect(steelLine?.unit_rate).toBeNull();
    // No rate means nothing to be stale at line level; the estimate as a whole is still stale.
    expect(steelLine?.is_stale).toBe(false);
    expect(result.is_stale).toBe(true);
  });

  it('DEGRADED_SUCCESS when a major item rate exists but is stale', async () => {
    const rates = fullMajorCoverageRates().map((r) =>
      r.id === 'r-bricks' ? { ...r, recorded_date: isoDaysAgo(30), source_tier: 'MARKET_REFERENCE' as const } : r,
    );
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('DEGRADED_SUCCESS');
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    expect(result.missing_major_items).toEqual(['Bricks']);
  });

  it('prefers SUPPLIER_VERIFIED over MARKET_REFERENCE for the same item/city', async () => {
    const rates = [
      rate({ id: 'r-cement-market', material_name: 'Cement', price: 1000, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(1) }),
      rate({ id: 'r-cement-supplier', material_name: 'Cement', price: 1200, source_tier: 'SUPPLIER_VERIFIED', recorded_date: isoDaysAgo(2) }),
      ...fullMajorCoverageRates().filter((r) => !r.material_name.toLowerCase().includes('cement')),
    ];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    expect(result.state).toBe('FULL');
    if (result.state !== 'FULL') throw new Error('expected FULL');
    const cementLine = result.line_items.find((li) => li.item_key === 'CEMENT');
    expect(cementLine?.unit_rate).toBe(1200);
    expect(cementLine?.source_tier).toBe('SUPPLIER_VERIFIED');
  });

  it('picks the most recent rate when multiple fresh rates share a tier', async () => {
    const rates = [
      rate({ id: 'r-cement-older', material_name: 'Cement', price: 1000, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(3) }),
      rate({ id: 'r-cement-newer', material_name: 'Cement', price: 1100, source_tier: 'MARKET_REFERENCE', recorded_date: isoDaysAgo(1) }),
      ...fullMajorCoverageRates().filter((r) => !r.material_name.toLowerCase().includes('cement')),
    ];
    listRawRatesForCityMock.mockResolvedValue(rates);
    const result = await service.getEstimate(req);

    if (result.state !== 'FULL') throw new Error('expected FULL');
    const cementLine = result.line_items.find((li) => li.item_key === 'CEMENT');
    expect(cementLine?.unit_rate).toBe(1100);
  });

  // ── Quantity formulas (Step 0, approved) ──────────────────────────────

  it('core material quantities scale with total covered area (sum across floors) and finish-level multiplier', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const result = await service.getEstimate({ ...req, area: 10, area_unit: 'MARLA', finish_level: 'PREMIUM' });
    if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
    const cementLine = result.line_items.find((li) => li.item_key === 'CEMENT');
    // 55 bags/marla * 10 marla * 1.15 (PREMIUM)
    expect(cementLine?.quantity).toBe(632.5);
  });

  it('1 marla = 225 sqft conversion is applied consistently regardless of input unit', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const marlaResult = await service.getEstimate({ ...req, area: 10, area_unit: 'MARLA' });
    const sqftResult = await service.getEstimate({ ...req, area: 2250, area_unit: 'SQFT' });
    if (marlaResult.state !== 'DEGRADED_SUCCESS' || sqftResult.state !== 'DEGRADED_SUCCESS') {
      throw new Error('expected DEGRADED_SUCCESS');
    }
    expect(marlaResult.area_sqft).toBe(2250);
    expect(sqftResult.area_sqft).toBe(2250);
    const cementByMarla = marlaResult.line_items.find((li) => li.item_key === 'CEMENT')?.quantity;
    const cementBySqft = sqftResult.line_items.find((li) => li.item_key === 'CEMENT')?.quantity;
    expect(cementByMarla).toBe(cementBySqft);
  });

  it('Excavation is not scaled by finish level', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const economy = await service.getEstimate({ ...req, finish_level: 'ECONOMY' });
    const premium = await service.getEstimate({ ...req, finish_level: 'PREMIUM' });
    if (economy.state !== 'DEGRADED_SUCCESS' || premium.state !== 'DEGRADED_SUCCESS') {
      throw new Error('expected DEGRADED_SUCCESS');
    }
    const economyExcavation = economy.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity;
    const premiumExcavation = premium.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity;
    expect(economyExcavation).toBe(premiumExcavation);
  });

  it('basement adds a separate full-footprint excavation volume on top of the footing trench', async () => {
    listRawRatesForCityMock.mockResolvedValue([]);
    const noBasement = await service.getEstimate({ ...req, basement: false });
    const withBasement = await service.getEstimate({ ...req, basement: true });
    if (noBasement.state !== 'DEGRADED_SUCCESS' || withBasement.state !== 'DEGRADED_SUCCESS') {
      throw new Error('expected DEGRADED_SUCCESS');
    }
    const noBasementQty = noBasement.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity ?? 0;
    const withBasementQty = withBasement.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity ?? 0;
    expect(withBasementQty).toBeGreaterThan(noBasementQty);
  });

  it('more floors increases excavation footing depth, holding per-floor footprint constant', async () => {
    // area scales WITH floors here so footprint-per-floor (and therefore
    // perimeter) stays identical between cases — isolating the footing-depth
    // effect from the footprint-shrinks-as-floors-grow effect that "same
    // total area, more floors" would otherwise also introduce (a smaller
    // per-floor footprint means less trench perimeter, which can outweigh a
    // deeper trench — a real, correct consequence of the approved formula,
    // not a bug, but not what this test is isolating).
    listRawRatesForCityMock.mockResolvedValue([]);
    const oneFloor = await service.getEstimate({ ...req, area: 9, floors: 1 });
    const threeFloors = await service.getEstimate({ ...req, area: 27, floors: 3 });
    if (oneFloor.state !== 'DEGRADED_SUCCESS' || threeFloors.state !== 'DEGRADED_SUCCESS') {
      throw new Error('expected DEGRADED_SUCCESS');
    }
    const q1 = oneFloor.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity ?? 0;
    const q3 = threeFloors.line_items.find((li) => li.item_key === 'EXCAVATION')?.quantity ?? 0;
    expect(q3).toBeGreaterThan(q1);
  });

  it('reuses a cached non-stale estimate within the staleness window instead of recomputing', async () => {
    listRawRatesForCityMock.mockResolvedValue(fullMajorCoverageRates());
    const cached = {
      id: 'cached-id',
      city: 'Islamabad',
      area: 5,
      area_unit: 'MARLA',
      area_sqft: 1125,
      floors: 1,
      basement: false,
      finish_level: 'STANDARD',
      state: 'FULL',
      line_items: [],
      total_estimate: 12345,
      partial_subtotal: null,
      missing_major_items: [],
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

  describe('rate unit conversion', () => {
    const tenMarla: BoqRequest = { ...req, area: 10, area_unit: 'MARLA' };

    it('prices a per-ton steel rate against a kg quantity: 3,930 kg x 250,000/1000 kg = PKR 9.825 Lakh', async () => {
      const rates = [rate({ id: 'r-steel-ton', material_name: 'Steel', unit: '1 ton', price: 250000 })];
      listRawRatesForCityMock.mockResolvedValue(rates);
      const result = await service.getEstimate(tenMarla);

      if (result.state === 'NOT_COVERED') throw new Error('expected FULL or DEGRADED_SUCCESS');
      const steel = result.line_items.find((li) => li.item_key === 'STEEL');
      expect(steel?.unit).toBe('kg');
      expect(steel?.quantity).toBe(3930);
      expect(steel?.unit_rate).toBe(250); // per kg
      expect(steel?.subtotal).toBe(982_500); // PKR 9.825 Lakh, not 98 Crore
      expect(steel?.subtotal).not.toBe(3930 * 250000);
    });

    it('computes the line total from the unrounded per-unit price, not the rounded display rate', async () => {
      // 14,333 per 1000 bricks = 14.333 per brick; displayed as 14.33.
      const rates = [rate({ id: 'r-bricks-k', material_name: 'Bricks', unit: '1000 bricks', price: 14333 })];
      listRawRatesForCityMock.mockResolvedValue(rates);
      const result = await service.getEstimate(tenMarla);

      if (result.state === 'NOT_COVERED') throw new Error('expected FULL or DEGRADED_SUCCESS');
      const bricks = result.line_items.find((li) => li.item_key === 'BRICKS');
      expect(bricks?.quantity).toBe(39580);
      expect(bricks?.unit_rate).toBe(14.33);
      expect(bricks?.subtotal).toBe(567_300.14); // 39,580 x 14,333 / 1000, not 39,580 x 14.33
    });

    it('treats a rate with an unlisted unit as unavailable, and logs the skipped rate', async () => {
      const warnSpy = jest.spyOn((service as unknown as { logger: { warn: jest.Mock } }).logger, 'warn').mockImplementation();
      const rates = [rate({ id: 'r-steel-maund', material_name: 'Steel', unit: 'maund', price: 10000 })];
      listRawRatesForCityMock.mockResolvedValue(rates);
      const result = await service.getEstimate(tenMarla);

      if (result.state !== 'DEGRADED_SUCCESS') throw new Error('expected DEGRADED_SUCCESS');
      const steel = result.line_items.find((li) => li.item_key === 'STEEL');
      expect(steel?.unit_rate).toBeNull();
      expect(steel?.subtotal).toBeNull();
      expect(result.missing_major_items).toContain('Steel (rebar)');
      expect(result.derived_from).not.toContain('r-steel-maund');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('r-steel-maund'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"maund"'));
    });

    it('prices a rate whose unit matches the BOQ unit apart from case and whitespace, with no conversion', async () => {
      const rates = [rate({ id: 'r-steel-kg', material_name: 'Steel', unit: ' KG ', price: 280 })];
      listRawRatesForCityMock.mockResolvedValue(rates);
      const result = await service.getEstimate(tenMarla);

      if (result.state === 'NOT_COVERED') throw new Error('expected FULL or DEGRADED_SUCCESS');
      const steel = result.line_items.find((li) => li.item_key === 'STEEL');
      expect(steel?.unit_rate).toBe(280);
      expect(steel?.subtotal).toBe(3930 * 280);
    });
  });
});

describe('EstimatesService with daily market rates', () => {
  const build = (market: any) => {
    const qb: any = { where: () => qb, andWhere: () => qb, orderBy: () => qb, getOne: async () => null };
    return new EstimatesService(
      { listRawRatesForCity: async () => [] } as any,
      { create: (d: any) => d, save: async (e: any) => ({ id: 'est-1', computed_at: new Date(), ...e }), createQueryBuilder: () => qb } as any,
      market,
    );
  };
  const today = new Date().toISOString().slice(0, 10);
  const market = {
    latestQuoteAt: async () => null,
    currentRates: async () => [
      { key: 'CEMENT', label: 'Cement', unit: 'bag', rate: 1490, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-cement' },
      { key: 'BRICKS', label: 'Bricks', unit: 'pc', rate: 22, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-bricks' },
      { key: 'TILES', label: 'Tiles', unit: 'sqft', rate: 95, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-tiles' },
    ],
  };
  const req: BoqRequest = { city: 'Islamabad', area: 5, area_unit: 'MARLA', floors: 1, basement: false, finish_level: 'STANDARD' };

  it('prices cement and bricks from the daily rates for Islamabad', async () => {
    const r: any = await build(market).getEstimate(req);
    const cement = r.line_items.find((l: any) => l.item_key === 'CEMENT');
    const bricks = r.line_items.find((l: any) => l.item_key === 'BRICKS');
    expect(cement.unit_rate).toBe(1490);
    expect(bricks.unit_rate).toBe(22);
    expect(r.derived_from).toEqual(expect.arrayContaining(['q-cement', 'q-bricks']));
    expect(r.derived_from).not.toContain('q-tiles');
  });

  it('sizes doors and windows from the finished house and prices them from daily rates', async () => {
    const m2 = {
      latestQuoteAt: async () => null,
      currentRates: async () => [
        { key: 'DOORS', label: 'Doors', unit: 'pc', rate: 16000, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-doors' },
        { key: 'ALUMINIUM_WINDOWS', label: 'Aluminium windows', unit: 'sqft', rate: 1000, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-win' },
      ],
    };
    const r: any = await build(m2).getEstimate({ ...req, area: 12, area_unit: 'MARLA' });
    const doors = r.line_items.find((l: any) => l.item_key === 'DOORS');
    const win = r.line_items.find((l: any) => l.item_key === 'WINDOWS');
    expect(doors.quantity).toBe(16);
    expect(doors.subtotal).toBe(256000);
    expect(win.quantity).toBe(440);
    expect(win.subtotal).toBe(440000);
  });

  it('prices electrical and plumbing rough-in per sq ft of covered area', async () => {
    const m3 = {
      latestQuoteAt: async () => null,
      currentRates: async () => [
        { key: 'ELECTRICAL_ROUGH_IN', label: 'Electrical rough-in', unit: 'sqft', rate: 170, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-el' },
        { key: 'PLUMBING_ROUGH_IN', label: 'Plumbing rough-in', unit: 'sqft', rate: 145, rate_date: today, carried_forward: false, age_days: 0, quote_id: 'q-pl' },
      ],
    };
    const r: any = await build(m3).getEstimate({ ...req, area: 12, area_unit: 'MARLA' });
    const el = r.line_items.find((l: any) => l.item_key === 'ELECTRICAL_ROUGH_IN');
    const pl = r.line_items.find((l: any) => l.item_key === 'PLUMBING_ROUGH_IN');
    expect(el.quantity).toBe(2700);
    expect(el.subtotal).toBe(459000);
    expect(pl.subtotal).toBe(391500);
  });

  it('does not use them for other cities', async () => {
    const r: any = await build(market).getEstimate({ ...req, city: 'Lahore' });
    expect(r.line_items.find((l: any) => l.item_key === 'CEMENT').unit_rate).toBeNull();
  });
});

describe('whole-house estimate', () => {
  const build = (market: any) => {
    const qb: any = { where: () => qb, andWhere: () => qb, orderBy: () => qb, getOne: async () => null };
    return new EstimatesService(
      { listRawRatesForCity: async () => [] } as any,
      { create: (d: any) => d, save: async (e: any) => ({ id: 'est-1', computed_at: new Date(), ...e }), createQueryBuilder: () => qb } as any,
      market,
    );
  };
  const req: BoqRequest = { city: 'Islamabad', area: 2700, area_unit: 'SQFT', floors: 2, basement: false, finish_level: 'STANDARD' };

  it('matches the reference house at its own area with no rate change', async () => {
    const r: any = await build({ latestQuoteAt: async () => null, currentRates: async () => [], baselines: async () => ({}) }).getEstimate(req);
    expect(r.whole_house.total).toBe(10_176_514);
    expect(r.whole_house.per_sqft).toBe(3769);
    expect(r.whole_house.record_type).toBe('GENERATED');
    expect(r.whole_house.affiliation_disclosure).toBeNull();
  });

  it('lists the build in order and the phases add up', async () => {
    const r: any = await build(undefined).getEstimate(req);
    const ph = r.whole_house.phases;
    expect(ph.map((p: any) => p.key)).toEqual(['PLOT', 'MAP', 'SOIL', 'EXCAVATION', 'GREY', 'ROUGH_IN', 'CEILING', 'TILES', 'WOOD', 'STEEL', 'WINDOWS', 'PAINT', 'HANDOVER']);
    expect(ph.map((p: any) => p.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(ph.find((p: any) => p.key === 'PLOT').amount).toBeNull();
    const scaled = ph.filter((p: any) => p.basis === 'SCALED').reduce((s: number, p: any) => s + p.amount, 0);
    expect(scaled).toBe(r.whole_house.total);
    expect(r.whole_house.before_building_total).toBe(404_500);
    expect(ph.find((p: any) => p.key === 'GREY').amount).toBe(4_524_925);
  });

  it('scales with area and finish level, and moves with market rates', async () => {
    const half: any = await build(undefined).getEstimate({ ...req, area: 1350 });
    expect(half.whole_house.total).toBe(5_088_258);
    const prem: any = await build(undefined).getEstimate({ ...req, finish_level: 'PREMIUM' });
    expect(prem.whole_house.total).toBeGreaterThan(10_176_514);
    const dear: any = await build({
      latestQuoteAt: async () => null,
      currentRates: async () => [{ key: 'CEMENT', label: 'Cement', unit: 'bag', rate: 1299 * 1.2, rate_date: new Date().toISOString().slice(0, 10), carried_forward: false, age_days: 0, quote_id: 'q1' }],
      baselines: async () => ({ CEMENT: { rate: 1299 } }),
    }).getEstimate(req);
    expect(dear.whole_house.total).toBeGreaterThan(10_176_514);
    expect(dear.whole_house.derived_from).toEqual(['q1']);
  });
});
