import { SECTION_GROUP_LABELS, type BuildPhase, type SectionGroup, type WholeHouseEstimate } from '@siraat/shared-types';
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
interface PhaseDef {
  key: string;
  title: string;
  stage: BuildPhase['stage'];
  // Cost group the phase draws from; null for fixed reference steps.
  group: SectionGroup | null;
  // What the completed house paid for the step (rupees).
  ref_cost: number | null;
  summary: string;
  includes: string[];
  note?: string;
}

// The build in the order it happens. The reference costs come from the
// completed 25 x 50 house; the phases of a group add up to that group's cost.
const PHASES: PhaseDef[] = [
  { key: 'PLOT', title: 'Plot buying & transfer', stage: 'BEFORE', group: null, ref_cost: null,
    summary: 'Buy the plot and transfer it into your name.',
    includes: ['Plot price', 'Dealer commission', 'Form AR-17 and 32-A tax', 'FBR tax', 'Processing, transfer and documentation fees'],
    note: 'The plot price is not estimated. On the reference house, dealer, tax, FBR and transfer costs were Rs 193,284 on a Rs 73 lakh plot (about 2.6%).' },
  { key: 'MAP', title: 'Map, design & approvals', stage: 'BEFORE', group: null, ref_cost: 149_500,
    summary: 'Draw the plan and get it approved before any digging.',
    includes: ['Architect fees', 'RDA approval fees', 'Map vetting fees', 'Structural and services design'],
    note: 'A separate structural engineer fee was not recorded on the reference house; ask for it in your design quote.' },
  { key: 'SOIL', title: 'Soil testing, boring & demarcation', stage: 'BEFORE', group: null, ref_cost: 200_000,
    summary: 'Test the soil, mark the plot boundary and arrange water and power.',
    includes: ['Soil testing', 'Water boring', 'Rain water boring', 'Electricity meter'],
    note: 'Plot demarcation was not recorded as a separate cost on the reference house; confirm it with your dealer or the authority.' },
  { key: 'SITE_SETUP', title: 'Site setup, utilities & site staff', stage: 'STRUCTURE', group: 'SITE_OTHER', ref_cost: 356_550,
    summary: 'Contractor agreement, site store, temporary water and power, and the supervisor who stays through the build.',
    includes: ['Site staff and supervision', 'Temporary water and power', 'Tea and refreshments for pours', 'Site running costs'],
    note: 'Gas, sewerage and water connection fees are not in the reference house; ask the authority for them.' },
  { key: 'EXCAVATION', title: 'Excavation', stage: 'BEFORE', group: null, ref_cost: 55_000,
    summary: 'Dig the foundation trenches to the depth the structural plan needs.',
    includes: ['Excavation'] },
  { key: 'GREY', title: 'Grey structure', stage: 'STRUCTURE', group: 'STRUCTURE', ref_cost: 4_524_925,
    summary: 'Foundation, columns, slabs, brickwork and plaster. The largest cost block.',
    includes: ['Cement', 'Steel', 'Bricks', 'Sand & crush', 'Mason labour', 'Compaction'] },
  { key: 'ROOF', title: 'Roof waterproofing & insulation', stage: 'STRUCTURE', group: null, ref_cost: null,
    summary: 'Waterproofing and heat insulation of the roof after the last slab is cured and before the finishing starts.',
    includes: ['Waterproofing membrane or coating', 'Heat insulation', 'Roof slope and drainage'],
    note: 'Not recorded on the reference house, so it is not estimated. Add a quote below.' },
  { key: 'ROUGH_IN', title: 'Electrical & plumbing rough-in', stage: 'SERVICES', group: 'SERVICES', ref_cost: 837_842,
    summary: 'Conduits, wiring, water and sewerage lines and the underground tank, before plaster and tiles.',
    includes: ['Electrician labour', 'Wire and cables', 'Pipes and fittings', 'Plumber labour', 'Sewerage, gas and water tank'] },
  { key: 'CEILING', title: 'False ceiling', stage: 'SERVICES', group: 'SERVICES', ref_cost: 245_000,
    summary: 'Ceiling work with material, after the rough-in is tested.',
    includes: ['False ceiling with material'] },
  { key: 'TILES', title: 'Tile & marble work', stage: 'FINISHING', group: 'FINISHING', ref_cost: 1_263_905,
    summary: 'Floor and wall tiles, chips, stairs, kitchen and washroom tops.',
    includes: ['Tiles', 'Tile labour', 'Chips', 'Marble for stairs and sills', 'Kitchen and washroom tops'] },
  { key: 'WOOD', title: 'Wood & carpentry', stage: 'FINISHING', group: 'FINISHING', ref_cost: 921_200,
    summary: 'Door frames, doors, wardrobes and kitchen woodwork.',
    includes: ['Wood', 'Doors', 'Carpenter labour'] },
  { key: 'STEEL', title: 'Gate, grills & railings', stage: 'FINISHING', group: 'FINISHING', ref_cost: 404_402,
    summary: 'Main gate, window grills, stair railing and door frames in steel.',
    includes: ['Gate', 'Window grills', 'Stair railing', 'Chokhats and back grill'] },
  { key: 'WINDOWS', title: 'Windows installation', stage: 'FINISHING', group: 'FINISHING', ref_cost: 462_000,
    summary: 'Aluminium windows with glass, and glass railing.',
    includes: ['Aluminium windows', 'Glass railing'] },
  { key: 'PAINT', title: 'Paint', stage: 'FINISHING', group: 'FINISHING', ref_cost: 288_000,
    summary: 'Putty, paint and polish, once all other finishing is done.',
    includes: ['Paint material', 'Paint labour', 'Door paint and polish'] },
  { key: 'FIXTURES', title: 'Fixtures & fittings', stage: 'SERVICES', group: 'SERVICES', ref_cost: 831_390,
    summary: 'Fitted after paint so they stay clean: sanitary ware, fans, lights, kitchen hoods, sinks and stoves.',
    includes: ['Commodes, showers and vanities', 'Kitchen sinks and stoves', 'Fans and exhaust fans', 'Lights and fancy lights', 'Kitchen hoods'] },
  { key: 'OUTSIDE', title: 'Outside works', stage: 'HANDOVER', group: 'SITE_OTHER', ref_cost: 15_000,
    summary: 'Lawn, porch, driveway and the boundary wall.',
    includes: ['Grass and plants', 'Porch and driveway', 'Boundary wall'],
    note: 'Only the lawn was recorded on the reference house. Price the boundary wall per running foot in your project forecast.' },
  { key: 'SNAGGING', title: 'Snagging, cleaning & handover', stage: 'HANDOVER', group: 'SITE_OTHER', ref_cost: 26_300,
    summary: 'Check every room, door, window and tap, get defects fixed, then clean and complete.',
    includes: ['Snag list and inspection', 'Deep cleaning', 'Completion fee', 'Maintenance handover'] },
  { key: 'CONTINGENCY', title: 'Contingency allowance', stage: 'HANDOVER', group: null, ref_cost: null,
    summary: 'A buffer for price changes and extras, as a percentage of the building cost. It is included in the whole-house figure at the top.',
    includes: ['Price changes', 'Extra work', 'Design changes'],
    note: 'Choose the percentage below. Most builders plan 5 to 10%.' },
];

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
  const phases: BuildPhase[] = [];
  const allocated: Partial<Record<SectionGroup, number>> = {};
  PHASES.forEach((d, i) => {
    let amount: number | null = null;
    let basis: BuildPhase['basis'] = 'NOT_ESTIMATED';
    if (d.group !== null && d.ref_cost !== null) {
      const g = groups.find((x) => x.group === d.group)!;
      const siblings = PHASES.filter((p) => p.group === d.group);
      const isLast = siblings[siblings.length - 1].key === d.key;
      amount = isLast ? g.amount - (allocated[d.group] ?? 0) : Math.round((g.amount * d.ref_cost) / (REFERENCE_GROUP_COST[d.group] ?? 1));
      allocated[d.group] = (allocated[d.group] ?? 0) + amount;
      basis = 'SCALED';
    } else if (d.ref_cost !== null) {
      amount = d.ref_cost;
      basis = 'REFERENCE';
    }
    phases.push({ key: d.key, step: i + 1, title: d.title, stage: d.stage, amount, basis, summary: d.summary, includes: d.includes, note: d.note ?? null });
  });
  const beforeTotal = phases.filter((p) => p.stage === 'BEFORE' && p.basis === 'REFERENCE').reduce((s, p) => s + (p.amount ?? 0), 0);
  const used = input.market.filter((m) => ratios.has(m.key));
  const stale = used.some((m) => m.age_days > MARKET_STALENESS_DAYS);
  const notes = [
    'Scaled from one completed 25 x 50 house (2,700 sq ft) in Islamabad, May 2026, with labour included. One house is a single sample.',
    'The building total excludes the plot, legal fees and the approval, soil and excavation steps (shown separately at reference amounts), and furniture.',
  ];
  if (used.length === 0) notes.push('No current market rates applied: priced at the reference house prices of May 2026.');
  else notes.push(`${used.length} item prices updated from today's market rates; the rest stay at reference prices.`);
  return {
    record_type: 'GENERATED',
    phases,
    before_building_total: beforeTotal,
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
