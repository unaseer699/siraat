import type { BoqItemKey, BoqFloors, FinishLevel } from '@siraat/shared-types';

// MATERIAL + WORKS BOQ ESTIMATOR v1 — replaces the old grey-structure-only
// estimate (material-catalog.ts, retired). Every ratio/formula below is the
// exact one reviewed and approved in the Step 0 proposal (Sep 2026) — do not
// change a number here without the same review, per the brief: "A wrong
// quantity ratio here is real-world harm... not a cosmetic bug."

export const BOQ_ITEM_KEYS: readonly BoqItemKey[] = [
  // Core Materials
  'CEMENT',
  'STEEL',
  'BRICKS',
  'SAND',
  'CRUSH',
  'PAINT',
  // Additional Works & Items
  'EXCAVATION',
  'BORING',
  'PLUMBING_ROUGH_IN',
  'ELECTRICAL_ROUGH_IN',
  'MARBLE_STAIRS',
  'WINDOWS',
  'DOORS',
  'KITCHEN_WOODWORK',
  'HARDWARE',
] as const;

// Step 0's definition of "major" for the grand-total rule: exactly the 6 Core
// Materials — the brief's own two-bucket split, used as the natural line.
export const BOQ_MAJOR_ITEM_KEYS: readonly BoqItemKey[] = [
  'CEMENT',
  'STEEL',
  'BRICKS',
  'SAND',
  'CRUSH',
  'PAINT',
] as const;

// Step 0 Tier A/A-minus/B — items with an actual computable quantity.
// Everything else in BOQ_ITEM_KEYS is Tier C (no ratio exists anywhere).
const BOQ_AVAILABLE_ITEM_KEYS: ReadonlySet<BoqItemKey> = new Set([
  'CEMENT',
  'STEEL',
  'BRICKS',
  'SAND',
  'CRUSH',
  'PAINT',
  'EXCAVATION',
] satisfies BoqItemKey[]);

export function isBoqItemAvailable(key: BoqItemKey): boolean {
  return BOQ_AVAILABLE_ITEM_KEYS.has(key);
}

export const BOQ_ITEM_LABELS: Record<BoqItemKey, string> = {
  CEMENT: 'Cement',
  STEEL: 'Steel (rebar)',
  BRICKS: 'Bricks',
  SAND: 'Sand',
  CRUSH: 'Aggregate/Crush',
  PAINT: 'Paint',
  EXCAVATION: 'Excavation',
  BORING: 'Boring (water)',
  PLUMBING_ROUGH_IN: 'Plumbing (rough-in)',
  ELECTRICAL_ROUGH_IN: 'Electrical (rough-in)',
  MARBLE_STAIRS: 'Marble (for stairs)',
  WINDOWS: 'Windows',
  DOORS: 'Doors',
  KITCHEN_WOODWORK: 'Kitchen woodwork',
  HARDWARE: 'Hardware',
};

export const BOQ_ITEM_UNITS: Record<BoqItemKey, string> = {
  CEMENT: 'bags (50kg)',
  STEEL: 'kg',
  BRICKS: 'bricks',
  SAND: 'cft',
  CRUSH: 'cft',
  PAINT: 'Ltr',
  EXCAVATION: 'cft',
  BORING: 'ft (depth)',
  PLUMBING_ROUGH_IN: 'points',
  ELECTRICAL_ROUGH_IN: 'points',
  MARBLE_STAIRS: 'sqft',
  WINDOWS: 'pcs',
  DOORS: 'pcs',
  KITCHEN_WOODWORK: 'RFT',
  HARDWARE: 'lot',
};

// Rate units are free text entered by the admin (material-rates page), so a
// rate is only priced against a BOQ quantity when its unit is the BOQ unit
// or appears in this hand-written table. Every entry is a fixed equivalence
// reviewed by hand. There is no parsing and no inferred conversion. Units are
// compared after trim + lowercase only. `factor` = how many BOQ units one rate
// unit holds, so price per BOQ unit = rate price / factor.
// Deliberately NOT listed: paint "gallon" (Pakistani paint gallons vary by
// brand, so there is no fixed litre equivalent).
export const RATE_UNIT_CONVERSIONS: ReadonlyArray<{ item: BoqItemKey; from: string; factor: number }> = [
  // Metric ton = 1,000 kg (steel is sold per ton in Pakistan).
  { item: 'STEEL', from: 'ton', factor: 1000 },
  { item: 'STEEL', from: '1 ton', factor: 1000 },
  { item: 'STEEL', from: 'tonne', factor: 1000 },
  // A cement bag in Pakistan is the standard 50 kg bag the BOQ unit names.
  { item: 'CEMENT', from: 'bag', factor: 1 },
  { item: 'CEMENT', from: '1 bag', factor: 1 },
  { item: 'CEMENT', from: 'per bag', factor: 1 },
  // Bricks are commonly quoted per thousand.
  { item: 'BRICKS', from: '1000 bricks', factor: 1000 },
  // Spelling variants of the same unit.
  { item: 'PAINT', from: 'liter', factor: 1 },
  { item: 'PAINT', from: 'litre', factor: 1 },
];

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

// How many BOQ units one rate unit holds for this item: 1 when the units
// already match, the table's factor when a listed conversion applies, and
// null when neither does. A null result means the rate must NOT be used.
export function rateUnitFactor(key: BoqItemKey, rateUnit: string): number | null {
  const from = normalizeUnit(rateUnit);
  if (from === normalizeUnit(BOQ_ITEM_UNITS[key])) return 1;
  const entry = RATE_UNIT_CONVERSIONS.find((c) => c.item === key && c.from === from);
  return entry ? entry.factor : null;
}

// Step 0 Tier C — founder-approved handling (Sep 2026): show the row, mark it
// unavailable, explain why, never fabricate a quantity. Each note reflects
// what the Step 0 research actually found for that item (or didn't).
export const BOQ_UNAVAILABLE_ITEM_NOTES: Partial<Record<BoqItemKey, string>> = {
  BORING:
    "Depth is driven by the site's water table, not house size — priced per foot of depth on site. No standard planning-stage quantity ratio exists.",
  PLUMBING_ROUGH_IN:
    'No standard points-per-area ratio found in Pakistani residential construction sources; fixture-point count depends on the floor plan.',
  ELECTRICAL_ROUGH_IN:
    'No standard points-per-area ratio found in Pakistani residential construction sources; point count depends on the floor plan.',
  MARBLE_STAIRS:
    'No standard ratio found — staircase marble area depends on the stair design, not covered area.',
  WINDOWS:
    'No standard count-by-size-category ratio found for Pakistani residential construction; depends on the floor plan and elevation design.',
  DOORS:
    'No standard count-per-area ratio found; door count depends on the floor plan (room count), not covered area.',
  KITCHEN_WOODWORK:
    'No standard per-area ratio found; kitchen size depends on the floor plan, not covered area alone.',
  HARDWARE:
    'No standard quantity or percentage-allowance convention found in Pakistani residential construction sources.',
};

// Step 0 Tier A — reused unchanged from the original grey-structure estimate
// (material-catalog.ts's GREY_STRUCTURE_RATIO_PER_MARLA, now retired):
// commonly cited by Pakistani construction cost estimators (e.g. Zameen.com
// and Graana.com "grey structure cost per marla" guides) for a standard
// single-story RCC residential structure — a publicly stated industry
// planning ratio, not a single named published standard.
const CORE_RATIO_PER_MARLA: Record<'CEMENT' | 'STEEL' | 'BRICKS' | 'SAND' | 'CRUSH', number> = {
  CEMENT: 95,
  STEEL: 750,
  BRICKS: 4500,
  SAND: 100,
  CRUSH: 100,
};

// Layered on top of the cited ratio above — a Siraat product judgment (PREMIUM
// specs richer mixes/heavier reinforcement than ECONOMY), not part of the
// industry ratio itself. Same values as the retired QUALITY_TIER_MULTIPLIER.
export const FINISH_LEVEL_MULTIPLIER: Record<FinishLevel, number> = {
  ECONOMY: 0.9,
  STANDARD: 1.0,
  PREMIUM: 1.15,
};

export const SQFT_PER_MARLA = 225;

export function toSqft(area: number, unit: 'SQFT' | 'MARLA'): number {
  return unit === 'MARLA' ? area * SQFT_PER_MARLA : area;
}

function toMarla(areaSqft: number): number {
  return areaSqft / SQFT_PER_MARLA;
}

// Step 0 Tier A-minus — EXCAVATION is a geometric approximation, not a flat
// per-marla ratio (no such ratio exists in any source found). "Total covered
// area" is the sum across all floors (Step 0, founder-confirmed), so the
// per-floor footprint below assumes floors are roughly equal size. A square
// footprint (side = sqrt(footprint)) is assumed since actual plot dimensions
// aren't collected — this is a standard simplifying assumption for
// preliminary estimation, not the real plot shape. Footing depth by floor
// count is a generic, non-Pakistan-specific engineering planning figure —
// always verify against a real structural/soil assessment; that caveat is
// shown next to the Excavation row on every result.
//
// With a basement, the dig has two parts: (1) the full-footprint pit down to
// the basement floor, and (2) the perimeter footing trench, which starts at
// the basement floor rather than at ground level. The footing is therefore
// counted at basement depth. Its trench volume is the same as a ground-level
// footing, because the trench is measured from the level it is dug from.
// KNOWN v1 LIMITATION: not modelled here are (a) the working-space over-dig
// outside the basement walls (for shuttering and waterproofing) and (b) wider
// retaining-wall footings. No sourced figure was found for either, so both
// are left out rather than invented. This makes basement excavation an
// UNDER-estimate, and the results page says so next to the Excavation row.
const FOOTING_DEPTH_FT_BY_FLOORS: Record<BoqFloors, number> = { 1: 3, 2: 4, 3: 5 };
const TRENCH_WIDTH_FT = 2;
const BASEMENT_DEPTH_FT = 9;

function computeExcavationCft(areaSqftTotal: number, floors: BoqFloors, basement: boolean): number {
  const footprintPerFloor = areaSqftTotal / floors;
  const side = Math.sqrt(footprintPerFloor);
  const perimeter = 4 * side;
  // Pit down to the basement floor (none without a basement).
  const basementPitVolume = basement ? footprintPerFloor * BASEMENT_DEPTH_FT : 0;
  // Footing trench, measured from its starting level: ground level, or the
  // basement floor when there is a basement.
  const footingTrenchVolume = perimeter * TRENCH_WIDTH_FT * FOOTING_DEPTH_FT_BY_FLOORS[floors];
  return basementPitVolume + footingTrenchVolume;
}

// Step 0 Tier B — PAINT is a geometric approximation, not a flat per-marla
// ratio (no source converts covered floor area to paintable wall area for
// Pakistani residential construction). The 3.2x wall-to-floor-area multiplier
// (~10ft ceilings including partition walls) and the 15% door/window opening
// deduction are generic architectural approximations, NOT verified against a
// Pakistan-specific source — flagged as such in the results page's
// assumptions block. 110 sqft/liter is the midpoint of the general (also not
// Pakistan-specific) 100-130 sqft/liter paint coverage range found.
const WALL_TO_FLOOR_AREA_MULTIPLIER = 3.2;
const OPENING_DEDUCTION_FACTOR = 0.85;
const PAINT_COVERAGE_SQFT_PER_LITER = 110;

function computePaintLiters(areaSqftTotal: number, floors: BoqFloors): number {
  const perFloorArea = areaSqftTotal / floors;
  const wallAreaPerFloor = perFloorArea * WALL_TO_FLOOR_AREA_MULTIPLIER * OPENING_DEDUCTION_FACTOR;
  const totalWallArea = wallAreaPerFloor * floors;
  return totalWallArea / PAINT_COVERAGE_SQFT_PER_LITER;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Single computation entry point for quantity — rate lookup happens in
// BoqEstimatorService (needs the MaterialRate repository). Returns null for
// every Tier C item (available=false) — by design, never a fabricated number.
export function computeBoqQuantity(
  key: BoqItemKey,
  areaSqftTotal: number,
  floors: BoqFloors,
  basement: boolean,
  finishLevel: FinishLevel,
): number | null {
  const tierMultiplier = FINISH_LEVEL_MULTIPLIER[finishLevel];

  switch (key) {
    case 'CEMENT':
    case 'STEEL':
    case 'BRICKS':
    case 'SAND':
    case 'CRUSH':
      return round2(CORE_RATIO_PER_MARLA[key] * toMarla(areaSqftTotal) * tierMultiplier);
    case 'PAINT':
      return round2(computePaintLiters(areaSqftTotal, floors) * tierMultiplier);
    case 'EXCAVATION':
      // Deliberately NOT scaled by finish level — digging depth isn't a finish choice.
      return round2(computeExcavationCft(areaSqftTotal, floors, basement));
    default:
      return null;
  }
}

// Keyword classifier extending the original 5-material matcher (material-
// catalog.ts's matchCoreMaterialKey, now retired) to the 7 items that
// actually have a computable quantity. Tier C items are never matched against
// a rate row — there's no quantity to price even if an admin entered one
// under that name (see BoqEstimatorService).
const ITEM_KEYWORDS: Partial<Record<BoqItemKey, string[]>> = {
  CEMENT: ['cement'],
  STEEL: ['steel', 'sariya', 'rebar'],
  BRICKS: ['brick'],
  SAND: ['sand'],
  CRUSH: ['crush', 'bajri', 'gravel'],
  PAINT: ['paint', 'emulsion', 'distemper'],
  EXCAVATION: ['excavation', 'digging', 'khudai'],
};

export function matchBoqItemKey(materialName: string): BoqItemKey | null {
  const lower = materialName.toLowerCase();
  for (const key of BOQ_ITEM_KEYS) {
    const keywords = ITEM_KEYWORDS[key];
    if (keywords?.some((kw) => lower.includes(kw))) return key;
  }
  return null;
}

// Matches docs/08-database-schema.md's "Construction Cost Index | 7 days" TTL
// — unchanged from the retired estimate's ESTIMATE_STALENESS_THRESHOLD_DAYS.
export const ESTIMATE_STALENESS_THRESHOLD_DAYS = 7;
