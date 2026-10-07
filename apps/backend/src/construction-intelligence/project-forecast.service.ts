import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sectionGroupOf, SECTION_GROUP_LABELS, SectionCategory, SectionGroup } from '@siraat/shared-types';
import { ProjectLayoutEntity, LayoutFloor, LayoutExtras } from './entities/project-layout.entity';
import { ConstructionProjectService } from './construction-project.service';
import { MarketRateService, CurrentMarketRate } from './market-rate.service';
import { MARKET_RATE_ITEMS } from './market-rate-catalog';

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
  progress: Record<string, number>;
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
  progress_pct: number | null;
  projected_from_progress: number | null;
  items: ForecastItem[];
  other_not_repriced: number | null;
}

export interface ForecastItem {
  key: string;
  label: string;
  unit: string;
  estimated: number;
  ratio: number;
  priced_from: 'MARKET' | 'PURCHASES' | 'MANUAL' | null;
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

export interface MarketRateUsed {
  key: string;
  label: string;
  unit: string;
  rate: number;
  reference_rate: number;
  ratio: number;
  rate_date: string;
  carried_forward: boolean;
  age_days: number;
}

export const MARKET_STALENESS_DAYS = 7;

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
  structure_index_source: 'MARKET' | 'PURCHASES' | null;
  market_rates: MarketRateUsed[];
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
    progress: e.progress ?? {},
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
    @Optional() private readonly marketRates?: MarketRateService,
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

  // Progress changes only the per-group percent complete; the confirmed
  // layout stays confirmed.
  async saveProgress(projectId: string, progress: Record<string, number>): Promise<void> {
    const existing = await this.layoutRepo.findOneBy({ project_ref: projectId });
    if (!existing) throw new BadRequestException('Save the layout before recording progress');
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(progress)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100) clean[k] = n;
    }
    await this.layoutRepo.query(
      `UPDATE construction_intelligence.project_layouts SET progress = $2::jsonb, updated_at = now() WHERE project_ref = $1`,
      [projectId, JSON.stringify(clean)],
    );
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
    const clamp = (r: number) => Math.min(Math.max(r, 0.5), 2);
    const weightedIndex = (pairs: { key: string; ratio: number }[]): number | null => {
      const ps = pairs.filter((o) => STRUCTURE_MATERIAL_REFERENCE.some((r) => r.key === o.key));
      if (ps.length === 0) return null;
      let w = 0;
      let wr = 0;
      for (const o of ps) {
        const weight = STRUCTURE_MATERIAL_REFERENCE.find((r) => r.key === o.key)!.weight;
        w += weight;
        wr += weight * o.ratio;
      }
      return clamp(wr / w);
    };

    // Today's market rates (the latest quote, carried forward on days with no
    // new one) price the work still to be done, so they take priority over the
    // project's own past purchases. Each is compared with its baseline: the
    // reference-house rate, or for the other items the first quote / admin figure.
    let market: CurrentMarketRate[] = [];
    let baselines: Record<string, { rate: number | null }> = {};
    try {
      market = (await this.marketRates?.currentRates()) ?? [];
      baselines = (await this.marketRates?.baselines()) ?? {};
    } catch {
      market = [];
      baselines = {};
    }
    const market_rates: MarketRateUsed[] = [];
    const itemPrice = new Map<string, { ratio: number; source: 'MARKET' | 'PURCHASES' }>();
    for (const m of market) {
      const base0 = baselines[m.key]?.rate ?? null;
      if (!base0) continue;
      const item = MARKET_RATE_ITEMS.find((i) => i.key === m.key);
      const ratio = m.rate / base0;
      market_rates.push({
        key: m.key,
        label: m.label,
        unit: m.unit,
        rate: m.rate,
        reference_rate: base0,
        ratio: Math.round(ratio * 1000) / 1000,
        rate_date: m.rate_date,
        carried_forward: m.carried_forward,
        age_days: m.age_days,
      });
      if (item && item.ref_cost > 0) itemPrice.set(m.key, { ratio: clamp(ratio), source: 'MARKET' });
    }
    for (const o of rate_observations) {
      if (!itemPrice.has(o.key)) itemPrice.set(o.key, { ratio: clamp(o.ratio), source: 'PURCHASES' });
    }
    const marketIndex = weightedIndex(market_rates.filter((m) => itemPrice.get(m.key)?.source === 'MARKET'));
    const purchaseIndex = weightedIndex(rate_observations);
    const structureIndex: number | null = marketIndex ?? purchaseIndex;
    const structure_index_source: 'MARKET' | 'PURCHASES' | null =
      marketIndex !== null ? 'MARKET' : purchaseIndex !== null ? 'PURCHASES' : null;

    const ageDays = (now.getTime() - new Date(REFERENCE_DATE).getTime()) / 86_400_000;
    const base = {
      record_type: 'GENERATED' as const,
      reference: {
        area_sqft: REFERENCE_AREA_SQFT,
        date: REFERENCE_DATE,
        source: 'A completed 25 x 50 house, Islamabad (actual costs paid)',
      },
      is_stale: market_rates.length > 0 ? market_rates.some((m) => m.age_days > MARKET_STALENESS_DAYS) : ageDays > STALENESS_THRESHOLD_DAYS,
      staleness_threshold_days: market_rates.length > 0 ? MARKET_STALENESS_DAYS : STALENESS_THRESHOLD_DAYS,
      affiliation_disclosure: null,
    };

    const order: SectionGroup[] = ['LAND', 'STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'];
    const area = layout?.total_area_sqft ?? 0;
    // Each group is repriced item by item: factor = 1 + sum(share x (ratio - 1))
    // over the items that have a rate, so items without one stay at reference.
    // A manual factor set by the owner replaces this for its group.
    const autoFactor = (g: SectionGroup): { factor: number; repriced: number } => {
      const refCost = REFERENCE_GROUP_COST[g];
      if (!refCost) return { factor: 1, repriced: 0 };
      let f = 1;
      let n = 0;
      for (const it of MARKET_RATE_ITEMS.filter((i) => i.group === g && i.ref_cost > 0)) {
        const p = itemPrice.get(it.key);
        if (!p) continue;
        f += (it.ref_cost / refCost) * (p.ratio - 1);
        n += 1;
      }
      return { factor: f, repriced: n };
    };
    const manual = layout?.price_factors ?? {};
    const factorOf = (g: SectionGroup): number => manual[g] ?? autoFactor(g).factor;
    const indexApplied = layout !== null && manual.STRUCTURE === undefined && autoFactor('STRUCTURE').repriced > 0;
    const extras: ForecastExtra[] = [];
    const extraByGroup: Partial<Record<SectionGroup, number>> = {};
    if (layout) {
      const rate = (g: SectionGroup) =>
        ((REFERENCE_GROUP_COST[g] ?? 0) / REFERENCE_AREA_SQFT) * (FINISH_MULTIPLIER[layout.finish_level][g] ?? 1) * factorOf(g);
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
        const marketBw = market_rates.find((m) => m.key === 'BOUNDARY_WALL');
        const useMarket = marketBw !== undefined && bw.rate_per_ft === DEFAULT_BOUNDARY_RATE_PER_FT;
        const perFt = useMarket ? marketBw!.rate : bw.rate_per_ft;
        const cost = Math.round(bw.length_ft * perFt * (manual.SITE_OTHER ?? 1));
        extraByGroup.SITE_OTHER = (extraByGroup.SITE_OTHER ?? 0) + cost;
        extras.push({
          kind: 'BOUNDARY_WALL',
          name: 'Boundary wall',
          quantity: bw.length_ft,
          unit: 'ft',
          cost,
          basis: useMarket ? `Rs ${perFt.toLocaleString()} per running ft (today's market rate)` : `Rs ${perFt.toLocaleString()} per running ft`,
        });
      }
    }
    const groups: ForecastGroup[] = order.map((g) => {
      const refCost = REFERENCE_GROUP_COST[g];
      const factor = factorOf(g);
      const mult = layout ? (FINISH_MULTIPLIER[layout.finish_level][g] ?? 1) : 1;
      const perSqft = refCost !== undefined ? (refCost / REFERENCE_AREA_SQFT) * area * mult : 0;
      const estimated =
        layout && refCost !== undefined ? Math.round((refCost / REFERENCE_AREA_SQFT) * area * mult * factor) + (extraByGroup[g] ?? 0) : null;
      const catalogue = MARKET_RATE_ITEMS.filter((i) => i.group === g && i.ref_cost > 0);
      let detail: ForecastItem[] = [];
      let other: number | null = null;
      if (layout && refCost !== undefined && catalogue.length > 0) {
        detail = catalogue.map((i) => {
          const p = itemPrice.get(i.key);
          const r = manual[g] !== undefined ? manual[g] : p?.ratio ?? 1;
          return {
            key: i.key,
            label: i.label,
            unit: i.unit,
            estimated: Math.round((i.ref_cost / REFERENCE_GROUP_COST[g]!) * perSqft * r),
            ratio: Math.round((p?.ratio ?? 1) * 1000) / 1000,
            priced_from: manual[g] !== undefined ? 'MANUAL' : p?.source ?? null,
          };
        });
        const refOther = refCost - catalogue.reduce((s2, i) => s2 + i.ref_cost, 0);
        other = Math.round((refOther / refCost) * perSqft * (manual[g] ?? 1));
      }
      const sp = spent[g] ?? 0;
      // Earned-value style projection: if the group is p% done and sp has been
      // spent, the final cost is about sp / p. It is blended with the area
      // estimate, trusting the projection more as progress grows.
      const pct = layout?.progress[g];
      let projected: number | null = null;
      let blended = estimated ?? 0;
      if (pct !== undefined && pct > 0 && sp > 0) {
        projected = Math.round(sp / (pct / 100));
        const w = pct >= 100 ? 1 : Math.min(pct / 100, 0.9);
        blended = estimated === null ? projected : Math.round((1 - w) * estimated + w * projected);
      }
      const fac = Math.max(blended, sp);
      return {
        group: g,
        label: SECTION_GROUP_LABELS[g],
        estimated,
        spent: sp,
        forecast_at_completion: fac,
        remaining: Math.max(fac - sp, 0),
        price_factor: factor,
        progress_pct: pct ?? null,
        projected_from_progress: projected,
        items: detail,
        other_not_repriced: other,
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
        structure_index_source,
        market_rates,
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
    if (groups.some((g) => g.projected_from_progress !== null)) {
      notes.push('Groups with a recorded percent complete are projected from what has been spent so far, blended with the area estimate.');
    }
    const sources = [...itemPrice.values()];
    const nMarket = sources.filter((x) => x.source === 'MARKET').length;
    const nPurch = sources.filter((x) => x.source === 'PURCHASES').length;
    if (nMarket > 0) {
      notes.push(
        `${nMarket} item${nMarket === 1 ? '' : 's'} priced at today's market rates (${market_rates.filter((m) => itemPrice.get(m.key)?.source === 'MARKET').map((m) => m.label).join(', ')}).${market_rates.some((m) => m.carried_forward) ? ' Some rates are carried forward from earlier days.' : ''}`,
      );
      const firstQuote = MARKET_RATE_ITEMS.filter((i) => i.ref_rate === null && baselines[i.key]?.rate && market_rates.some((m) => m.key === i.key)).map((i) => i.label);
      if (firstQuote.length > 0) {
        notes.push(`Items without a reference-house rate (${firstQuote.join(', ')}) are compared with their first quote, so they only show price movement from that date.`);
      }
    }
    if (nPurch > 0) {
      notes.push(`${nPurch} structure item${nPurch === 1 ? '' : 's'} repriced from this project's real purchases.`);
    }
    if (nMarket + nPurch > 0) {
      notes.push('Items with no rate stay at the reference house price; the "other" line in each group is never repriced.');
    }
    if (extras.length > 0) {
      notes.push('Shades, balconies and the boundary wall are priced from assumed rates (editable); confirm them with a quote.');
    }
    if (!confirmed) notes.push('Floor areas are not confirmed yet, so this forecast is provisional.');
    if (base.is_stale) notes.push(market_rates.length > 0 ? 'Some market rates are more than 7 days old; send fresh rates.' : 'Reference prices are older than the freshness threshold.');

    return {
      ...base,
      state: confirmed ? 'FULL' : 'DEGRADED_SUCCESS',
      extras,
      rate_observations,
      structure_material_index: structureIndex,
      structure_index_applied: indexApplied,
      structure_index_source,
      market_rates,
      derived_from: [layout.id],
      layout,
      groups,
      estimated_total: estimatedTotal,
      spent_total: spentTotal,
      forecast_total: forecastTotal,
      per_sqft: area > 0 ? Math.round(forecastTotal / area) : null,
      confidence_score: Math.min(
        (confirmed ? 0.55 : 0.25) +
          (groups.some((g) => g.projected_from_progress !== null) ? 0.1 : 0) +
          (market_rates.length > 0 && !base.is_stale ? 0.1 : 0),
        1,
      ),
      notes,
    };
  }
}
