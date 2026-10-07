import { isMarketRateMessage, parseMarketRateMessage } from './market-rate-parser';
import { MarketRateService } from './market-rate.service';
import { ProjectForecastService } from './project-forecast.service';

describe('market rate message parser', () => {
  const msg = `Market Rates
Date: 07-10-2026
Cement: 1,320 /bag
Bricks - Rs 22 per pc
Sand 78/cft
Crush: 95 /cft
Steel: 235000 /ton`;

  it('recognises the heading', () => {
    expect(isMarketRateMessage(msg)).toBe(true);
    expect(isMarketRateMessage('Project Expenses\nCement 1000')).toBe(false);
    expect(isMarketRateMessage(null)).toBe(false);
  });

  it('reads date, rates, and converts steel per ton to per kg', () => {
    const r = parseMarketRateMessage(msg);
    expect(r.rate_date).toBe('2026-10-07');
    expect(r.rejected).toEqual([]);
    const by = Object.fromEntries(r.lines.map((l) => [l.item.key, l.rate]));
    expect(by).toEqual({ CEMENT: 1320, BRICKS: 22, SAND: 78, CRUSH: 95, STEEL: 235 });
  });

  it('rejects out-of-range, unknown and unreadable lines but keeps the rest', () => {
    const r = parseMarketRateMessage('Market Rates\nCement: 132 /bag\nFurniture: 500\nSand: 75 /cft\nhello world');
    expect(r.lines.map((l) => l.item.key)).toEqual(['SAND']);
    expect(r.rejected).toHaveLength(3);
  });

  it('accepts the date in other layouts and leaves it null when absent', () => {
    expect(parseMarketRateMessage('Market Rates\n2026-10-06\nSand: 75 /cft').rate_date).toBe('2026-10-06');
    expect(parseMarketRateMessage('Market Rates\nSand: 75 /cft').rate_date).toBeNull();
  });
});

describe('MarketRateService carry-forward', () => {
  const q = (item_key: string, rate_date: string, rate: number) => ({ id: `${item_key}-${rate_date}`, item_key, rate_date, rate, status: 'ACTIVE', created_at: new Date() });
  const rows = [q('CEMENT', '2026-10-05', 1300), q('CEMENT', '2026-10-07', 1320), q('SAND', '2026-10-03', 75)];
  const repo: any = {
    findOne: jest.fn(async ({ where }: any) => {
      const lte = where.rate_date?.value ?? where.rate_date;
      return rows.filter((r) => r.item_key === where.item_key && r.rate_date <= lte).sort((a, b) => b.rate_date.localeCompare(a.rate_date))[0] ?? null;
    }),
    find: jest.fn(async () => rows),
  };
  const svc = new MarketRateService(repo);

  it('uses the same-day rate when present and carries forward otherwise', async () => {
    const cur = await svc.currentRates('2026-10-07');
    const cement = cur.find((c) => c.key === 'CEMENT')!;
    const sand = cur.find((c) => c.key === 'SAND')!;
    expect(cement.rate).toBe(1320);
    expect(cement.carried_forward).toBe(false);
    expect(sand.rate).toBe(75);
    expect(sand.carried_forward).toBe(true);
    expect(sand.age_days).toBe(4);
  });

  it('history fills gaps from the previous quote, newest first', async () => {
    const h = await svc.history(4, '2026-10-07');
    expect(h.map((d) => d.date)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04']);
    expect(h[1].rates.CEMENT).toMatchObject({ rate: 1300, carried_forward: true });
    expect(h[0].rates.CEMENT).toMatchObject({ rate: 1320, carried_forward: false });
    expect(h[3].rates.SAND).toMatchObject({ rate: 75, carried_forward: true });
    expect(h[3].rates.STEEL).toBeNull();
  });
});

describe('forecast uses market rates', () => {
  const layout: any = {
    id: 'L1', project_ref: 'P1', floors: [{ name: 'Ground', area_sqft: 1000 }], finish_level: 'STANDARD',
    price_factors: null, status: 'CONFIRMED', source_note: null, confirmed_at: new Date(),
  };
  const baselineMap: any = { CEMENT: { rate: 1299 }, TILES: { rate: 100 }, WIRE_7_29: { rate: 10000 } };
  const make = (market: any[]) =>
    new ProjectForecastService(
      { findOneBy: async () => layout } as any,
      { getProjectWithSectionsAndExpenses: async () => ({ sections: [] }) } as any,
      { currentRates: async () => market, baselines: async () => baselineMap } as any,
    );
  const m = (key: string, rate: number, age = 0) => ({ key, label: key, unit: 'x', rate, rate_date: '2026-10-07', carried_forward: age > 0, age_days: age, quote_id: 'q' });

  it('prices structure from market rates, and flags stale rates', async () => {
    const base = await make([]).forecast('P1');
    const dear = await make([m('CEMENT', 1299 * 1.2)]).forecast('P1');
    expect(dear.structure_index_source).toBe('MARKET');
    expect(dear.groups.find((g) => g.group === 'STRUCTURE')!.estimated!).toBeGreaterThan(base.groups.find((g) => g.group === 'STRUCTURE')!.estimated!);
    expect(dear.is_stale).toBe(false);
    expect(dear.staleness_threshold_days).toBe(7);
    const old = await make([m('CEMENT', 1300, 9)]).forecast('P1');
    expect(old.is_stale).toBe(true);
  });

  it('reprices item by item and the detail adds up to the group estimate', async () => {
    const base = await make([]).forecast('P1');
    const r = await make([m('TILES', 120), m('CEMENT', 1299)]).forecast('P1');
    const fin = r.groups.find((g) => g.group === 'FINISHING')!;
    const fin0 = base.groups.find((g) => g.group === 'FINISHING')!;
    // tiles are 694,750 of 3,339,507: +20% on tiles only
    expect(fin.price_factor).toBeCloseTo(1 + (694_750 / 3_339_507) * 0.2, 5);
    expect(fin.estimated!).toBeGreaterThan(fin0.estimated!);
    const sum = fin.items.reduce((s, i) => s + i.estimated, 0) + (fin.other_not_repriced ?? 0);
    expect(Math.abs(sum - fin.estimated!)).toBeLessThanOrEqual(fin.items.length + 1);
    expect(fin.items.find((i) => i.key === 'TILES')!.priced_from).toBe('MARKET');
    expect(fin.items.find((i) => i.key === 'DOORS')!.priced_from).toBeNull();
    // unchanged cement leaves structure at reference
    expect(r.groups.find((g) => g.group === 'STRUCTURE')!.estimated).toBe(base.groups.find((g) => g.group === 'STRUCTURE')!.estimated);
  });

  it('a manual group factor overrides the item rates', async () => {
    layout.price_factors = { FINISHING: 1 };
    const r = await make([m('TILES', 150)]).forecast('P1');
    layout.price_factors = null;
    expect(r.groups.find((g) => g.group === 'FINISHING')!.price_factor).toBe(1);
  });
});

describe('detailed rate parser', () => {
  it('reads labour, wire and tile lines with their units', () => {
    const r = parseMarketRateMessage(`Market Rates
Date: 07-10-2026
STRUCTURE
Mason labour: 380 /sqft
SERVICES
Wire 7/29: 9,800 /roll
Wiring labour: 55 per sq ft
FINISHING
Tiles: 95 /sqft
Labour tiles: 60 /sft
Wood: 2100 /cft
Paint material: ___ /sqft
Doors: ___`);
    expect(r.rejected).toEqual([]);
    const by = Object.fromEntries(r.lines.map((l) => [l.item.key, l.rate]));
    expect(by).toEqual({ MASON_LABOUR: 380, WIRE_7_29: 9800, ELECTRIC_LABOUR: 55, TILES: 95, TILE_LABOUR: 60, WOOD: 2100 });
  });

  it('rejects a unit that does not match the item', () => {
    const r = parseMarketRateMessage('Market Rates\nTiles: 95 /bag\nSteel: 230000 /ton');
    expect(r.lines.map((l) => l.item.key)).toEqual(['STEEL']);
    expect(r.lines[0].rate).toBe(230);
    expect(r.rejected).toHaveLength(1);
  });
});
