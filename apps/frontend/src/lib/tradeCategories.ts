import { TRADE_CATEGORIES, type TradeCategory } from '@siraat/shared-types';

// CONTRACTOR DIRECTORY — TRADE_CATEGORIES (shared-types) is the source of
// truth; this just adds a human-readable label for each value. Shared between
// the admin onboarding form (admin/constants.ts) and the public contractor
// directory so both display trades identically.
export const TRADE_CATEGORY_OPTIONS: { value: TradeCategory; label: string }[] =
  TRADE_CATEGORIES.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  }));
