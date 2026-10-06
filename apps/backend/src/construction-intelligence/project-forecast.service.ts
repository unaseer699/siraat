import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sectionGroupOf, SECTION_GROUP_LABELS, SectionCategory, SectionGroup } from '@siraat/shared-types';
import { ProjectLayoutEntity, LayoutFloor, LayoutExtras } from './entities/project-layout.entity';
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
// Assumptions for items the reference house did not have as separate lines.
// Covered extras are costed as a share of the main house's structure and
// finishing rate per sq ft (no services): shades/porches are open on the
// sides, balconies carry a slab and railing.
export const EXTRA_COVER_FACTOR: Record<string, number> = { FRONT_SHADE: 0.5, BACK_SHADE: 0.5, PORCH: 0.5, BALCONY: 0.7 };
export const DEFAULT_BOUNDARY_RATE_PER_FT = 5500;
// Unit rates paid on the reference house, for the materials that make up most
// of the structure cost. Real purchases on a project (quantity + unit +
// amount) are compared against these to measure how today's prices differ.
export interface RateReference {
  key: string;
  label: string;
  unit: string;
  units: string[];
  ref_rate: number;
  weight: number;
  match: (description: string) => boolean;
}
export const STRUCTURE_MATERIAL_REFERENCE: RateReference[] = [
  { key: 'BRICKS', label: 'Bricks', unit: 'pc', units: ['PCS'], ref_rate: 21.27, weight: 1_014_800,
    match: (d) => /brick/i.test(d) && !/design|kinghar/i.test(d) },
  { key: 'CEMENT', label: 'Cement', unit: 'bag', units: ['BAG'], ref_rate: 1299, weight: 857_450,
    match: (d) => /cement/i.test(d) },
  { key: 'SAND', label: 'Sand', unit: 'cft', units: ['CFT'], ref_rate: 74.1, weight: 337_000,
    match: (d) => /sand/i.test(d) },
  { key: 'CRUSH', label: 'Crush', unit: 'cft', units: ['CFT'], ref_rate: 93.1, weight: 223_500,
    match: (d) => /crush/i.test(d) },
  { key: 'STEEL', label: 'Steel', unit: 'kg', units: ['KG', 'TON'], ref_rate: 216.3, weight: 1_016_575,
    match: (d) => /steel|sootar|sariya|saria/i.test(d) },
];
const MATERIAL_SHARE_OF_STRUCTURE = 3_449_325 / 4_524_925;
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
  extras: LayoutExtras;
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

export interface RateObservation {
  key: string;
  label: string;
  unit: string;
  quantity: number;
  actual_rate: number;
  reference_rate: number;
  ratio: number;
}

export interface ForecastExtra {
  kind: string;
  name: string;
  quantity: number;
  unit: 'sq ft' | 'ft';
  cost: number;
  basis: string;
}

export interface ForecastResult {
  extras: ForecastExtra[];
  rate_observations: RateObservation[];
  structure_material_index: number | null;
  structure_index_applied: boolean;
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
    extras: e.extras ?? {},
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
      extras?: LayoutExtras | null;
    },
  ): Promise<LayoutResult> {
    if (input.floors.length === 0) throw new BadRequestException('At least one floor is required');
    const floors = input.floors.map((f) => ({
      name: f.name,
      area_sqft: Number(f.area_sqft),
      drawing_area_sqft: f.drawing_area_sqft != null ? Number(f.drawing_area_sqft) : null,
      allowed_area_sqft: f.allowed_area_sqft != null ? Number(f.allowed_area_sqft) : null,
    }));
    await this.layoutRepo.query(
      `INSERT INTO construction_intelligence.project_layouts
         (project_ref, floors, finish_level, price_factors, source_note, extras, status, confirmed_at)
       VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6::jsonb, 'UNTRUSTED_DATA', NULL)
       ON CONFLICT (project_ref) DO UPDATE SET
         floors = EXCLUDED.floors,
         finish_level = EXCLUDED.finish_level,
         price_factors = EXCLUDED.price_factors,
         source_note = EXCLUDED.source_note,
         extras = EXCLUDED.extras,
         status = 'UNTRUSTED_DATA',
         confirmed_at = NULL,
         updated_at = now()`,
      [
        projectId,
        JSON.stringify(floors),
        input.finish_level,
        input.price_factors ? JSON.stringify(input.price_factors) : null,
        input.source_note ?? null,
        input.extras ? JSON.stringify(input.extras) : null,
      ],
    );
    const saved = await this.layoutRepo.findOneByOrFail({ project_ref: projectId });
    return toLayoutResult(saved);
  }

  async confirmLayout(projectId: string): Promise<LayoutResult> {
    const existing = await this.layoutRepo.findOneBy({ project_ref: projectId });
    if (!existing) throw new BadRequestException('No layout saved for this project');
    await this.layoutRepo.query(
      `UPDATE construction_intelligence.project_layouts
         SET status = 'CONFIRMED', confirmed_at = now(), updated_at = now()
       WHERE project_ref = $1`,
      [projectId],
    );
    const saved = await this.layoutRepo.findOneByOrFail({ project_ref: projectId });
    return toLayoutResult(saved);
  }

  async forecast(projectId: string, now: Date = new Date()): Promise<ForecastResult> {
    const layoutEntity = await this.layoutRepo.findOneBy({ project_ref: projectId });
    const layout = layoutEntity ? toLayoutResult(layoutEntity) : null;

    const spent: Partial<Record<SectionGroup, number>> = {};
    const full = await this.cpSvc.getProjectWithSectionsAndExpenses(projectId);
    const acc = new Map<string, { amount: number; qty: number }>();
    for (const s of full?.sections ?? []) {
      const g = sectionGroupOf(s.category as SectionCategory);
      spent[g] = (spent[g] ?? 0) + s.subtotal;
      for (const e of s.expenses ?? []) {
        if (e.status !== 'ACTIVE' || !e.quantity || !e.unit || !(e.amount > 0)) continue;
        const ref = STRUCTURE_MATERIAL_REFERENCE.find((r) => r.units.includes(e.unit as string) && r.match(e.description));
        if (!ref) continue;
        const qty = ref.key === 'STEEL' && e.unit === 'TON' ? e.quantity * 1000 : e.quantity;
        const cur = acc.get(ref.key) ?? { amount: 0, qty: 0 };
        cur.amount += e.amount;
        cur.qty += qty;
        acc.set(ref.key, cur);
      }
    }
    const rate_observations: RateObservation[] = [];
    for (const ref of STRUCTURE_MATERIAL_REFERENCE) {
      const a = acc.get(ref.key);
      if (!a || a.qty <= 0) continue;
      const actual = a.amount / a.qty;
      rate_observations.push({
        key: ref.key,
        label: ref.label,
        unit: ref.unit,
        quantity: Math.round(a.qty),
        actual_rate: Math.round(actual * 100) / 100,
        reference_rate: ref.ref_rate,
        ratio: Math.round((actual / ref.ref_rate) * 1000) / 1000,
      });
    }
    let structureIndex: number | null = null;
    if (rate_observations.length > 0) {
      let w = 0;
      let wr = 0;
      for (const o of rate_observations) {
        const weight = STRUCTURE_MATERIAL_REFERENCE.find((r) => r.key === o.key)!.weight;
        w += weight;
        wr += weight * o.ratio;
      }
      structureIndex = Math.min(Math.max(wr / w, 0.5), 2);
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
    // Live rates: only when the owner has not set a manual Structure factor,
    // and only on the material share of the structure cost (labour is not
    // repriced from material purchases).
    const manualStructure = layout?.price_factors.STRUCTURE;
    const indexApplied = layout !== null && structureIndex !== null && manualStructure === undefined;
    const autoStructure = indexApplied
      ? MATERIAL_SHARE_OF_STRUCTURE * (structureIndex as number) + (1 - MATERIAL_SHARE_OF_STRUCTURE)
      : 1;
    const extras: ForecastExtra[] = [];
    const extraByGroup: Partial<Record<SectionGroup, number>> = {};
    if (layout) {
      const rate = (g: SectionGroup) =>
        ((REFERENCE_GROUP_COST[g] ?? 0) / REFERENCE_AREA_SQFT) *
        (FINISH_MULTIPLIER[layout.finish_level][g] ?? 1) *
        (layout.price_factors[g] ?? (g === 'STRUCTURE' ? autoStructure : 1));
      for (const it of layout.extras.items ?? []) {
        const cf = EXTRA_COVER_FACTOR[it.kind] ?? 0.5;
        const st = Math.round(rate('STRUCTURE') * it.area_sqft * cf);
        const fi = Math.round(rate('FINISHING') * it.area_sqft * cf);
        extraByGroup.STRUCTURE = (extraByGroup.STRUCTURE ?? 0) + st;
        extraByGroup.FINISHING = (extraByGroup.FINISHING ?? 0) + fi;
        extras.push({
          kind: it.kind,
          name: it.name,
          quantity: it.area_sqft,
          unit: 'sq ft',
          cost: st + fi,
          basis: `${Math.round(cf * 100)}% of the main structure and finishing rate`,
        });
      }
      const bw = layout.extras.boundary_wall;
      if (bw && bw.length_ft > 0) {
        const cost = Math.round(bw.length_ft * bw.rate_per_ft * (layout.price_factors.SITE_OTHER ?? 1));
        extraByGroup.SITE_OTHER = (extraByGroup.SITE_OTHER ?? 0) + cost;
        extras.push({
          kind: 'BOUNDARY_WALL',
          name: 'Boundary wall',
          quantity: bw.length_ft,
          unit: 'ft',
          cost,
          basis: `Rs ${bw.rate_per_ft.toLocaleString()} per running ft`,
        });
      }
    }
    const groups: ForecastGroup[] = order.map((g) => {
      const refCost = REFERENCE_GROUP_COST[g];
      const factor = layout?.price_factors[g] ?? (g === 'STRUCTURE' ? autoStructure : 1);
      const mult = layout ? (FINISH_MULTIPLIER[layout.finish_level][g] ?? 1) : 1;
      const estimated =
        layout && refCost !== undefined
          ? Math.round((refCost / REFERENCE_AREA_SQFT) * area * mult * factor) + (extraByGroup[g] ?? 0)
          : null;
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
        extras: [],
        rate_observations,
        structure_material_index: structureIndex,
        structure_index_applied: false,
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
    for (const f of layout.floors) {
      const d = f.drawing_area_sqft;
      if (d != null && Number(d) !== Number(f.area_sqft)) {
        const diff = Number(f.area_sqft) - Number(d);
        notes.push(
          `${f.name}: forecast uses ${f.area_sqft} sq ft, drawing shows ${d} sq ft (${diff > 0 ? '+' : ''}${diff}).`,
        );
      }
      const a = f.allowed_area_sqft;
      if (a != null && Number(f.area_sqft) > Number(a)) {
        notes.push(`${f.name}: ${f.area_sqft} sq ft is above the allowable ${a} sq ft.`);
      }
    }
    if (indexApplied && structureIndex !== null) {
      notes.push(
        `Structure materials are repriced from your real purchases (${rate_observations.map((o) => o.label).join(', ')}): ${structureIndex >= 1 ? '+' : ''}${Math.round((structureIndex - 1) * 100)}% against the reference house.`,
      );
    }
    if (extras.length > 0) {
      notes.push('Shades, balconies and the boundary wall are priced from assumed rates (editable); confirm them with a quote.');
    }
    if (!confirmed) notes.push('Floor areas are not confirmed yet, so this forecast is provisional.');
    if (base.is_stale) notes.push('Reference prices are older than the freshness threshold.');

    return {
      ...base,
      state: confirmed ? 'FULL' : 'DEGRADED_SUCCESS',
      extras,
      rate_observations,
      structure_material_index: structureIndex,
      structure_index_applied: indexApplied,
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
