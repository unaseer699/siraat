import { MATERIAL_CATEGORIES, type MaterialCategory } from '@siraat/shared-types';

// SUPPLIER DIRECTORY — MATERIAL_CATEGORIES (shared-types) is the source of
// truth; this just adds a human-readable label for each value. Same pattern
// as tradeCategories.ts's TRADE_CATEGORY_OPTIONS, shared between the admin
// onboarding form (admin/constants.ts) and the material-rates supplier tier.
export const MATERIAL_CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] =
  MATERIAL_CATEGORIES.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  }));
