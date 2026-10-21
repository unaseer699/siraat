import { PublicBuildsService } from './public-builds.service';

const fc = (over: Record<string, unknown> = {}) => ({
  state: 'FULL',
  layout: { total_area_sqft: 2712, finish_level: 'STANDARD', floors: [{}, {}] },
  groups: [
    { label: 'Structure', estimated: 4_524_925, spent: 2_000_400, progress_pct: 50 },
    { label: 'Finishing', estimated: 3_339_507, spent: 0, progress_pct: null },
  ],
  estimated_total: 7_864_432,
  spent_total: 2_000_400,
  forecast_total: 8_300_000,
  per_sqft: 3060.4,
  confidence_score: 0.7,
  is_stale: false,
  ...over,
});

describe('PublicBuildsService', () => {
  const project: { id: string; public_title: string | null; status: string; start_date: string } = { id: 'p1', public_title: null, status: 'ACTIVE', start_date: '2026-03-14' };

  function make(forecast: unknown, rows = [project]) {
    const projects = { listPublicProjects: jest.fn().mockResolvedValue(rows), findPublicProject: jest.fn().mockResolvedValue(rows[0] ?? null) };
    const forecasts = { forecast: jest.fn().mockResolvedValue(forecast) };
    return new PublicBuildsService(projects as never, forecasts as never);
  }

  it('returns an anonymised, rounded summary with trust telemetry', async () => {
    const r = await make(fc()).list();
    expect(r.state).toBe('FULL');
    expect(r.confidence_score).toBe(0.7);
    expect(r.affiliation_disclosure).toBeNull();
    const b = r.builds[0];
    expect(b.title).toBe('2,700 sq ft home build');
    expect(b.started_month).toBe('2026-03');
    expect(b.estimated_total).toBe(7_864_000);
    expect(b.variance_pct).toBe(5.5);
    expect(b.overall_progress_pct).toBe(50);
    const keys = Object.keys(b).join(',');
    expect(keys).not.toMatch(/name|city|owner|contact|phone|address/);
  });

  it('uses the owner-approved title when set', async () => {
    const r = await make(fc(), [{ ...project, public_title: '5 Marla family home' }]).list();
    expect(r.builds[0].title).toBe('5 Marla family home');
  });

  it('shows a COMPLETE project with no layout using actual spending only', async () => {
    const noLayout = fc({ state: 'NOT_COVERED', layout: null, spent_total: 6_543_210, groups: [{ label: 'Structure', estimated: null, spent: 4_100_400, progress_pct: null }, { label: 'Finishing', estimated: null, spent: 2_442_810, progress_pct: null }, { label: 'Land', estimated: null, spent: 0, progress_pct: null }] });
    const r = await make(noLayout, [{ ...project, status: 'COMPLETE' }]).list();
    expect(r.state).toBe('FULL');
    const b = r.builds[0];
    expect(b.actuals_only).toBe(true);
    expect(b.spent_total).toBe(6_543_000);
    expect(b.estimated_total).toBeNull();
    expect(b.covered_area_sqft).toBeNull();
    expect(b.phases.map((x) => x.label)).toEqual(['Structure', 'Finishing']);
  });

  it('still hides an in-progress project without a confirmed layout', async () => {
    const r = await make(fc({ state: 'NOT_COVERED', layout: null })).list();
    expect(r.state).toBe('NOT_COVERED');
  });

  it('skips projects without a confirmed forecast and reports NOT_COVERED', async () => {
    const r = await make(fc({ state: 'NOT_COVERED', layout: null })).list();
    expect(r.state).toBe('NOT_COVERED');
    expect(r.builds).toEqual([]);
  });
});
