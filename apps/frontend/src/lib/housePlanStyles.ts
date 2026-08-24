import { HOUSE_PLAN_STYLES, type HousePlanStyle } from '@siraat/shared-types';

// HOUSE PLANS DIRECTORY — HOUSE_PLAN_STYLES (shared-types) is the source of
// truth; this just adds a human-readable label for each value. Same pattern
// as materialCategories.ts/tradeCategories.ts.
export const HOUSE_PLAN_STYLE_OPTIONS: { value: HousePlanStyle; label: string }[] =
  HOUSE_PLAN_STYLES.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  }));
