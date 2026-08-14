import type { CoreMaterialKey, QualityTier } from '@siraat/shared-types';

export const CORE_MATERIAL_KEYS: readonly CoreMaterialKey[] = [
  'CEMENT',
  'STEEL',
  'BRICKS',
  'SAND',
  'CRUSH',
] as const;

export const CORE_MATERIAL_LABELS: Record<CoreMaterialKey, string> = {
  CEMENT: 'Cement',
  STEEL: 'Steel',
  BRICKS: 'Bricks',
  SAND: 'Sand',
  CRUSH: 'Crush',
};

// MaterialRate.material_name is free text entered by ops (Chunk 1) — e.g. "Cement
// - OPC 50kg bag". Rather than adding a canonical material_key column (a schema
// change with no other consumer yet), estimates classify by keyword match on the
// name. These five material words are standard, unambiguous terms on every
// Pakistani construction rate sheet, so a simple case-insensitive substring match
// is accurate without being a black box. Revisit with a dedicated column if a
// future chunk needs stricter guarantees than "the operator typed a recognizable
// word".
const MATERIAL_KEYWORDS: Record<CoreMaterialKey, string[]> = {
  CEMENT: ['cement'],
  STEEL: ['steel', 'sariya', 'rebar'],
  BRICKS: ['brick'],
  SAND: ['sand'],
  CRUSH: ['crush', 'bajri', 'gravel'],
};

export function matchCoreMaterialKey(materialName: string): CoreMaterialKey | null {
  const lower = materialName.toLowerCase();
  for (const key of CORE_MATERIAL_KEYS) {
    if (MATERIAL_KEYWORDS[key].some((kw) => lower.includes(kw))) {
      return key;
    }
  }
  return null;
}

// Published per-marla grey-structure material quantity ratios for a standard
// single-story RCC (reinforced cement concrete) residential structure, as
// commonly cited by Pakistani construction cost estimators (e.g. Zameen.com and
// Graana.com "grey structure cost per marla" guides). This is a publicly stated
// industry planning ratio, not a Siraat-proprietary formula.
export const GREY_STRUCTURE_RATIO_PER_MARLA: Record<CoreMaterialKey, { quantity: number; unit: string }> = {
  CEMENT: { quantity: 95, unit: 'bags (50kg)' },
  STEEL: { quantity: 750, unit: 'kg' },
  BRICKS: { quantity: 4500, unit: 'bricks' },
  SAND: { quantity: 100, unit: 'cft' },
  CRUSH: { quantity: 100, unit: 'cft' },
};

// Quality-tier multiplier layered on TOP of the cited industry ratio above. This
// part is a Siraat product judgment, not the standard itself — PREMIUM builds
// spec richer concrete mixes and heavier reinforcement than ECONOMY builds even
// within the same "grey structure" scope. Tunable business value, same convention
// as scoring.service.ts's STALENESS_CONFIDENCE_PENALTY / ADVERSE_CLAIM_PENALTY.
export const QUALITY_TIER_MULTIPLIER: Record<QualityTier, number> = {
  ECONOMY: 0.9,
  STANDARD: 1.0,
  PREMIUM: 1.15,
};

// Matches docs/08-database-schema.md's "Construction Cost Index | 7 days" TTL.
export const ESTIMATE_STALENESS_THRESHOLD_DAYS = 7;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
