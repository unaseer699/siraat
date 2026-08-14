import type { MaterialRateSourceTier } from './entities/material-rate.entity';

// Tier 1 — supplier-direct rates, checked less often but more reliable when checked
export const SUPPLIER_RATE_STALENESS_DAYS = 14;
// Tier 2 — market reference rates, matches the source's own stated weekly update cadence
export const MARKET_REFERENCE_STALENESS_DAYS = 7;

export function stalenessThresholdDaysFor(tier: MaterialRateSourceTier): number {
  return tier === 'SUPPLIER_VERIFIED' ? SUPPLIER_RATE_STALENESS_DAYS : MARKET_REFERENCE_STALENESS_DAYS;
}

// Whole calendar days between two dates, compared at UTC-midnight resolution so local
// timezone offset doesn't shift a same-day rate into a false "1 day old" reading.
function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

// recorded_date is a 'YYYY-MM-DD' string (Postgres `date` column) — never auto-generated at
// insert time, since the operator may log a rate a day or two after actually receiving it.
export function computeMaterialRateIsStale(
  recordedDate: string,
  sourceTier: MaterialRateSourceTier,
  now: Date = new Date(),
): boolean {
  const recorded = new Date(recordedDate);
  const ageDays = daysBetween(recorded, now);
  return ageDays > stalenessThresholdDaysFor(sourceTier);
}
