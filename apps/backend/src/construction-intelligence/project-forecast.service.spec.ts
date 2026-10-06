import { ProjectForecastService } from './project-forecast.service';

function make(layout: any, sections: any[] = []) {
  const repo: any = { findOneBy: jest.fn().mockResolvedValue(layout) };
  const cp: any = { getProjectWithSectionsAndExpenses: jest.fn().mockResolvedValue({ sections }) };
  return new ProjectForecastService(repo, cp);
}
const layout = (over: any = {}) => ({
  id: 'L1', project_ref: 'P1', floors: [{ name: 'Ground', area_sqft: 1000 }, { name: 'First', area_sqft: 1000 }, { name: 'Mumty', area_sqft: 293 }],
  finish_level: 'STANDARD', price_factors: null, status: 'CONFIRMED', source_note: null, confirmed_at: new Date(), ...over,
});

describe('ProjectForecastService', () => {
  it('returns NOT_COVERED without a layout', async () => {
    const r = await make(null).forecast('P1');
    expect(r.state).toBe('NOT_COVERED');
    expect(r.confidence_score).toBe(0);
  });
  it('confirmed layout gives FULL with reference-rate estimate and telemetry', async () => {
    const r = await make(layout()).forecast('P1', new Date('2026-10-06'));
    expect(r.state).toBe('FULL');
    expect(r.derived_from).toEqual(['L1']);
    expect(r.estimated_total).toBeGreaterThan(8_000_000);
    expect(r.estimated_total).toBeLessThan(9_000_000);
    expect(r.confidence_score).toBeGreaterThan(0);
    expect(r.confidence_score).toBeLessThanOrEqual(1);
    expect(r.is_stale).toBe(true);
    expect(r.affiliation_disclosure).toBeNull();
  });
  it('unconfirmed layout is DEGRADED_SUCCESS with lower confidence', async () => {
    const r = await make(layout({ status: 'UNTRUSTED_DATA' })).forecast('P1');
    expect(r.state).toBe('DEGRADED_SUCCESS');
    expect(r.confidence_score).toBeLessThan(0.55);
  });
  it('finish level and overspend move the forecast', async () => {
    const std = await make(layout()).forecast('P1');
    const prem = await make(layout({ finish_level: 'PREMIUM' })).forecast('P1');
    expect(prem.estimated_total).toBeGreaterThan(std.estimated_total);
    const over = await make(layout(), [{ category: 'CEMENT', subtotal: 9_000_000 }]).forecast('P1');
    const st = over.groups.find((g) => g.group === 'STRUCTURE')!;
    expect(st.forecast_at_completion).toBe(9_000_000);
    expect(st.remaining).toBe(0);
  });
  it('uses the typed area but notes the drawing area and allowable', async () => {
    const r = await make(
      layout({ floors: [{ name: 'Mumty', area_sqft: 500, drawing_area_sqft: 293, allowed_area_sqft: 250 }] }),
    ).forecast('P1');
    expect(r.layout!.total_area_sqft).toBe(500);
    expect(r.notes.join(' ')).toContain('drawing shows 293');
    expect(r.notes.join(' ')).toContain('above the allowable 250');
  });
});
