import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sectionGroupOf, SECTION_GROUP_LABELS, SectionCategory, SectionGroup } from '@siraat/shared-types';
import { ProjectLayoutEntity, LayoutFloor } from './entities/project-layout.entity';
import { ConstructionProjectService } from './construction-project.service';

export type FinishLevel = 'BASIC' | 'STANDARD' | 'PREMIUM';
export const FINISH_LEVELS: FinishLevel[] = ['BASIC', 'STANDARD', 'PREMIUM'];

// Reference: the founder's finished 25 x 50 house (2,700 sq ft, May 2026).
// Group totals are the sums of the BOQ rows; pre-construction and land are
// not forecast from area.
export const REFERENCE_AREA_SQFT = 2700;
export const REFERENCE_GROUP_COST: Partial<Record<SectionGroup, number>> = {
  STRUCTURE: 4_524_925,
  SERVICES: 1_914_232,
  FINISHING: 3_339_507,
  SITE_OTHER: 397_850,
};
export const REFERENCE_DATE = '2026-05-31';
export const STALENESS_THRESHOLD_DAYS = 90;

// Assumptions, not measurements: how much the reference's per-sq-ft cost
// moves with the finish level. Standard is the reference itself.
export const FINISH_MULTIPLIER: Record<FinishLevel, Partial<Record<SectionGroup, number>>> = {
  BASIC: { STRUCTURE: 0.95, SERVICES: 0.85, FINISHING: 0.75, SITE_OTHER: 1 },
  STANDARD: { STRUCTURE: 1, SERVICES: 1, FINISHING: 1, SITE_OTHER: 1 },
  PREMIUM: { STRUCTURE: 1.05, SERVICES: 1.2, FINISHING: 1.5, SITE_OTHER: 1 },
};

export interface LayoutResult {
  id: string;
  project_ref: string;
  floors: LayoutFloor[];
  total_area_sqft: number;
  finish_level: FinishLevel;
  price_factors: Record<string, number>;
  status: 'UNTRUSTED_DATA' | 'CONFIRMED';
  source_note: string | null;
  confirmed_at: string | null;
}

export interface ForecastGroup {
  group: SectionGroup;
  label: string;
  estimated: number | null;
  spent: number;
  forecast_at_completion: number;
  remaining: number;
  price_factor: number;
}

export interface ForecastResult {
  state: 'FULL' | 'DEGRADED_SUCCESS' | 'NOT_COVERED';
  record_type: 'GENERATED';
  derived_from: string[];
  layout: LayoutResult | null;
  groups: ForecastGroup[];
  estimated_total: number;
  spent_total: number;
  forecast_total: number;
  per_sqft: number | null;
  reference: { area_sqft: number; date: string; source: string };
  confidence_score: number;
  is_stale: boolean;
  staleness_threshold_days: number;
  affiliation_disclosure: string | null;
  notes: string[];
}

function toLayoutResult(e: ProjectLayoutEntity): LayoutResult {
  return {
    id: e.id,
    project_ref: e.project_ref,
    floors: e.floors,
    total_area_sqft: e.floors.reduce((s, f) => s + Number(f.area_sqft), 0),
    finish_level: e.finish_level as FinishLevel,
    price_factors: e.price_factors ?? {},
    status: e.status as 'UNTRUSTED_DATA' | 'CONFIRMED',
    source_note: e.source_note,
    confirmed_at: e.confirmed_at ? e.confirmed_at.toISOString() : null,
  };
}

@Injectable()
export class ProjectForecastService {
  constructor(
    @InjectRepository(ProjectLayoutEntity)
    private readonly layoutRepo: Repository<ProjectLayoutEntity>,
    private readonly cpSvc: ConstructionProjectService,
  ) {}

  async getLayout(projectId: string): Promise<LayoutResult | null> {
    const e = await this.layoutRepo.findOneBy({ project_ref: projectId });
    return e ? toLayoutResult(e) : null;
  }

  // Saving always resets to UNTRUSTED_DATA: any change to areas, finish level
  // or factors needs a fresh human confirmation.
  async saveLayout(
    projectId: string,
    input: {
      floors: LayoutFloor[];
      finish_level: FinishLevel;
      price_factors?: Record<string, number> | null;
      source_note?: string | null;
    },
  ): Promise<LayoutResult> {
    if (input.floors.length === 0) throw new BadRequestException('At least one floor is required');
    let e = await this.layoutRepo.findOneBy({ project_ref: projectId });
    if (!e) e = this.layoutRepo.create({ project_ref: projectId });
    e.floors = input.floors.map((f) => ({ name: f.name, area_sqft: Number(f.area_sqft) }));
    e.finish_level = input.finish_level;
    e.price_factors = input.price_factors ?? null;
    e.source_note = input.source_note ?? null;
    e.status = 'UNTRUSTED_DATA';
    e.confirmed_at = null;
    return toLayoutResult(await this.layoutRepo.save(e));
  }

  async confirmLayout(projectId: string): Promise<LayoutResult> {
    const e = await this.layoutRepo.findOneBy({ project_ref: projectId });
    if (!e) throw new BadRequestException('No layout saved for this project');
    e.status = 'CONFIRMED';
    e.confirmed_at = new Date();
    return toLayoutResult(await this.layoutRepo.save(e));
  }

  async forecast(projectId: string, now: Date = new Date()): Promise<ForecastResult> {
    const layoutEntity = await this.layoutRepo.findOneBy({ project_ref: projectId });
    const layout = layoutEntity ? toLayoutResult(layoutEntity) : null;

    const spent: Partial<Record<SectionGroup, number>> = {};
    const full = await this.cpSvc.getProjectWithSectionsAndExpenses(projectId);
    for (const s of full?.sections ?? []) {
      const g = sectionGroupOf(s.category as SectionCategory);
      spent[g] = (spent[g] ?? 0) + s.subtotal;
    }

    const ageDays = (now.getTime() - new Date(REFERENCE_DATE).getTime()) / 86_400_000;
    const base = {
      record_type: 'GENERATED' as const,
      reference: {
        area_sqft: REFERENCE_AREA_SQFT,
        date: REFERENCE_DATE,
        source: 'A completed 25 x 50 house, Islamabad (actual costs paid)',
      },
      is_stale: ageDays > STALENESS_THRESHOLD_DAYS,
      staleness_threshold_days: STALENESS_THRESHOLD_DAYS,
      affiliation_disclosure: null,
    };

    const order: SectionGroup[] = ['LAND', 'STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'];
    const area = layout?.total_area_sqft ?? 0;
    const groups: ForecastGroup[] = order.map((g) => {
      const refCost = REFERENCE_GROUP_COST[g];
      const factor = layout?.price_factors[g] ?? 1;
      const mult = layout ? (FINISH_MULTIPLIER[layout.finish_level][g] ?? 1) : 1;
      const estimated =
        layout && refCost !== undefined ? Math.round((refCost / REFERENCE_AREA_SQFT) * area * mult * factor) : null;
      const sp = spent[g] ?? 0;
      const fac = Math.max(estimated ?? 0, sp);
      return {
        group: g,
        label: SECTION_GROUP_LABELS[g],
        estimated,
        spent: sp,
        forecast_at_completion: fac,
        remaining: Math.max(fac - sp, 0),
        price_factor: factor,
      };
    });

    const spentTotal = groups.reduce((s, g) => s + g.spent, 0);
    const estimatedTotal = groups.reduce((s, g) => s + (g.estimated ?? 0), 0);
    const forecastTotal = groups.reduce((s, g) => s + g.forecast_at_completion, 0);

    if (!layout) {
      return {
        ...base,
        state: 'NOT_COVERED',
        derived_from: [],
        layout: null,
        groups,
        estimated_total: 0,
        spent_total: spentTotal,
        forecast_total: spentTotal,
        per_sqft: null,
        confidence_score: 0,
        notes: ['No layout saved yet. Enter the covered area per floor to get a forecast.'],
      };
    }

    const confirmed = layout.status === 'CONFIRMED';
    const notes = [
      'Based on one reference house; rates move with the finish level and price factors you set.',
    ];
    if (!confirmed) notes.push('Floor areas are not confirmed yet, so this forecast is provisional.');
    if (base.is_stale) notes.push('Reference prices are older than the freshness threshold.');

    return {
      ...base,
      state: confirmed ? 'FULL' : 'DEGRADED_SUCCESS',
      derived_from: [layout.id],
      layout,
      groups,
      estimated_total: estimatedTotal,
      spent_total: spentTotal,
      forecast_total: forecastTotal,
      per_sqft: area > 0 ? Math.round(forecastTotal / area) : null,
      confidence_score: confirmed ? 0.55 : 0.25,
      notes,
    };
  }
}
