import { TRADE_CATEGORIES, tradeCategoryLabel, type TradeCategory } from '@siraat/shared-types';

// CONTRACTOR DIRECTORY — TRADE_CATEGORIES (shared-types) is the source of
// truth; this just adds a human-readable label for each value (via
// tradeCategoryLabel, also shared-types — reused by the WhatsApp draft
// summary text on the backend, so both stay in sync). Shared between the
// admin onboarding form (admin/constants.ts) and the public contractor
// directory so both display trades identically.
export const TRADE_CATEGORY_OPTIONS: { value: TradeCategory; label: string }[] =
  TRADE_CATEGORIES.map((value) => ({
    value,
    label: tradeCategoryLabel(value),
  }));
