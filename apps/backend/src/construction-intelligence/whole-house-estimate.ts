import { SECTION_GROUP_LABELS, type SectionGroup, type WholeHouseEstimate } from '@siraat/shared-types';
import {
  FINISH_MULTIPLIER,
  MARKET_STALENESS_DAYS,
  REFERENCE_AREA_SQFT,
  REFERENCE_GROUP_COST,
  groupPriceFactor,
  type FinishLevel as ForecastFinishLevel,
} from './project-forecast.service';
import { MARKET_RATE_ITEMS } from './market-rate-catalog';
import type { CurrentMarketRate } from './market-rate.service';

const GROUPS: SectionGroup[] = ['STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'];
const clamp = (r: number) => Math.min(Math.max(r, 0.5), 2);

// Whole-house cost for a covered area: the completed reference house's cost
// per sq ft in each group (labour included), scaled by the finish level and,
// when today's market rates are supplied, repriced item by item exactly like
// the project forecast. Excludes land, legal and pre-construction costs.
export function computeWholeHouse(input: {
  areaSqft: number;
  finishLevel: 'ECONOMY' | 'STANDARD' | 'PREMIUM';
  market: CurrentMarketRate[];
  baselines: Record<string, { rate: number | null }>;
  now?: Date;
}): WholeHouseEstimate {
  const level: ForecastFinishLevel = input.finishLevel === 'ECONOMY' ? 'BASIC' : input.finishLevel;
  const ratios = new Map<string, number>();
  const quotes: string[] = [];
  for (const m of input.market) {
    const item = MARKET_RATE_ITEMS.find((i) => i.key === m.key);
    const base = input.baselines[m.key]?.rate;
    if (!item || item.ref_cost <= 0 || !base) continue;
    ratios.set(m.key, clamp(m.rate / base));
    quotes.push(m.quote_id);
  }
  const groups = GROUPS.map((g) => {
    const perSqft = (REFERENCE_GROUP_COST[g] ?? 0) / REFERENCE_AREA_SQFT;
    const factor = groupPriceFactor(g, ratios).factor;
    const amount = Math.round(perSqft * input.areaSqft * (FINISH_MULTIPLIER[level][g] ?? 1) * factor);
    return { group: g, label: SECTION_GROUP_LABELS[g], amount };
  });
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const used = input.market.filter((m) => ratios.has(m.key));
  const stale = used.some((m) => m.age_days > MARKET_STALENESS_DAYS);
  const notes = [
    'Scaled from one completed 25 x 50 house (2,700 sq ft) in Islamabad, May 2026, with labour included. One house is a single sample.',
    'Excludes land, legal fees, pre-construction costs, furniture and appliances.',
  ];
  if (used.length === 0) notes.push('No current market rates applied: priced at the reference house prices of May 2026.');
  else notes.push(`${used.length} item prices updated from today's market rates; the rest stay at reference prices.`);
  return {
    record_type: 'GENERATED',
    derived_from: quotes,
    total,
    per_sqft: input.areaSqft > 0 ? Math.round(total / input.areaSqft) : 0,
    area_sqft: input.areaSqft,
    groups,
    basis: 'Completed 25 x 50 house, Islamabad (actual costs paid)',
    priced_items: used.length,
    confidence_score: Math.min(0.4 + (used.length > 0 && !stale ? 0.1 : 0), 1),
    is_stale: used.length > 0 ? stale : true,
    staleness_threshold_days: used.length > 0 ? MARKET_STALENESS_DAYS : 90,
    affiliation_disclosure: null,
    notes,
  };
}
