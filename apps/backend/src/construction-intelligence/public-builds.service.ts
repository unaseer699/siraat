import { Injectable } from '@nestjs/common';
import { sectionGroupOf, SECTION_GROUP_LABELS } from '@siraat/shared-types';
import type { PublicBuild, PublicBuildsResponse, PublicBuildExpensesResponse, SectionCategory, SectionGroup } from '@siraat/shared-types';
import { ConstructionProjectService } from './construction-project.service';
import { ProjectForecastService, STALENESS_THRESHOLD_DAYS } from './project-forecast.service';

const round = (n: number, step: number) => Math.round(n / step) * step;

const NOTES = [
  'Shared by the owner. Name, location and contact details are never shown.',
  'Costs are owner-reported and rounded; estimates come from the Siraat estimator. Not a verification of any contractor or supplier.',
];

// REAL BUILDS — reads only through the project and forecast services' public
// methods (Law 9). Only projects the owner opted in, and only those with a
// confirmed layout, are shown so draft numbers never become public.
@Injectable()
export class PublicBuildsService {
  constructor(
    private readonly projects: ConstructionProjectService,
    private readonly forecasts: ProjectForecastService,
  ) {}

  private async build(p: { id: string; public_title: string | null; status: PublicBuild['status']; start_date: string }): Promise<{ build: PublicBuild; confidence: number; stale: boolean } | null> {
    const fc = await this.forecasts.forecast(p.id);
    // A finished project is shown by what was actually spent, not against an
    // estimate (with or without a layout). Land is left out of the per sq ft figure.
    if (p.status === 'COMPLETE' && fc.spent_total > 0) {
      const area = fc.layout?.total_area_sqft ?? 0;
      return {
        confidence: 1,
        stale: false,
        build: {
          id: p.id,
          title: p.public_title?.trim() || 'Completed home build',
          status: p.status,
          started_month: p.start_date.slice(0, 7),
          actuals_only: true,
          covered_area_sqft: area > 0 ? round(area, 50) : null,
          floors: fc.layout ? fc.layout.floors.length : null,
          finish_level: fc.layout ? fc.layout.finish_level : null,
          estimated_total: null,
          spent_total: round(fc.spent_total, 1000),
          forecast_total: round(fc.spent_total, 1000),
          variance_pct: null,
          per_sqft: area > 0 ? round((fc.spent_total - (fc.groups.find((g) => g.group === 'LAND')?.spent ?? 0)) / area, 10) : null,
          overall_progress_pct: 100,
          phases: fc.groups
            .filter((g) => g.spent > 0)
            .map((g) => ({ label: g.label, estimated: null, spent: round(g.spent, 1000), progress_pct: 100 })),
        },
      };
    }
    if (fc.state !== 'FULL' || !fc.layout) return null;
    const area = fc.layout.total_area_sqft;
    const phases = fc.groups.map((g) => ({
      label: g.label,
      estimated: g.estimated === null ? null : round(g.estimated, 1000),
      spent: round(g.spent, 1000),
      progress_pct: g.progress_pct,
    }));
    const weighted = fc.groups.filter((g) => g.progress_pct !== null && (g.estimated ?? 0) > 0);
    const w = weighted.reduce((s, g) => s + (g.estimated as number), 0);
    const overall = w > 0 ? Math.round(weighted.reduce((s, g) => s + (g.estimated as number) * (g.progress_pct as number), 0) / w) : null;
    const est = fc.estimated_total;
    return {
      confidence: fc.confidence_score,
      stale: fc.is_stale,
      build: {
        id: p.id,
        title: p.public_title?.trim() || `${round(area, 50).toLocaleString('en-US')} sq ft home build`,
        status: p.status,
        started_month: p.start_date.slice(0, 7),
        actuals_only: false,
        covered_area_sqft: round(area, 50),
        floors: fc.layout.floors.length,
        finish_level: fc.layout.finish_level,
        estimated_total: round(est, 1000),
        spent_total: round(fc.spent_total, 1000),
        forecast_total: round(fc.forecast_total, 1000),
        variance_pct: est > 0 ? Math.round(((fc.forecast_total - est) / est) * 1000) / 10 : null,
        per_sqft: fc.per_sqft === null ? null : round(fc.per_sqft, 10),
        overall_progress_pct: overall,
        phases,
      },
    };
  }

  private wrap(items: Array<{ build: PublicBuild; confidence: number; stale: boolean }>): PublicBuildsResponse {
    return {
      state: items.length === 0 ? 'NOT_COVERED' : 'FULL',
      record_type: 'GENERATED',
      derived_from: items.map((i) => i.build.id),
      builds: items.map((i) => i.build),
      confidence_score: items.length === 0 ? 0 : Math.min(...items.map((i) => i.confidence)),
      is_stale: items.some((i) => i.stale),
      staleness_threshold_days: STALENESS_THRESHOLD_DAYS,
      affiliation_disclosure: null,
      notes: NOTES,
    };
  }

  async list(): Promise<PublicBuildsResponse> {
    const rows = await this.projects.listPublicProjects();
    const out: Array<{ build: PublicBuild; confidence: number; stale: boolean }> = [];
    for (const r of rows) {
      const b = await this.build(r);
      if (b) out.push(b);
    }
    return this.wrap(out);
  }

  // Full expense list of a shared build, for the build's detail page and PDF.
  async expenses(id: string): Promise<PublicBuildExpensesResponse> {
    const row = await this.projects.findPublicProject(id);
    const full = row ? await this.projects.getProjectWithSectionsAndExpenses(id) : null;
    if (!row || !full) return { state: 'NOT_COVERED', title: '', total: 0, phases: [] };
    const order: SectionGroup[] = ['LAND', 'STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'];
    const byGroup = new Map<SectionGroup, PublicBuildExpensesResponse['phases'][number]['sections']>();
    for (const s of full.sections) {
      const lines = s.expenses
        .filter((e) => e.status === 'ACTIVE')
        .map((e) => ({ date: e.expense_date, description: e.description, amount: e.amount, quantity: e.quantity, unit: e.unit }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (lines.length === 0) continue;
      const g = sectionGroupOf(s.category as SectionCategory);
      const list = byGroup.get(g) ?? [];
      list.push({ category: s.category, subtotal: lines.reduce((t, l) => t + l.amount, 0), expenses: lines });
      byGroup.set(g, list);
    }
    const phases = order
      .filter((g) => byGroup.has(g))
      .map((g) => {
        const sections = byGroup.get(g)!;
        return { label: SECTION_GROUP_LABELS[g], total: sections.reduce((t, x) => t + x.subtotal, 0), sections };
      });
    return {
      state: phases.length === 0 ? 'NOT_COVERED' : 'FULL',
      title: row.public_title?.trim() || 'Home build',
      total: phases.reduce((t, p) => t + p.total, 0),
      phases,
    };
  }

  async get(id: string): Promise<PublicBuildsResponse> {
    const row = await this.projects.findPublicProject(id);
    const b = row ? await this.build(row) : null;
    return this.wrap(b ? [b] : []);
  }
}
