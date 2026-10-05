import { HOUSE_PLAN_IMAGE_TYPES, type HousePlanImageType } from '@siraat/shared-types';

// HOUSE PLAN GALLERY — same pattern as housePlanStyles.ts: HOUSE_PLAN_IMAGE_TYPES
// (shared-types) is the source of truth, this just adds a human-readable label.
const LABEL_OVERRIDES: Partial<Record<HousePlanImageType, string>> = {
  RENDER_3D: '3D Render',
};

export const HOUSE_PLAN_IMAGE_TYPE_OPTIONS: { value: HousePlanImageType; label: string }[] =
  HOUSE_PLAN_IMAGE_TYPES.map((value) => ({
    value,
    label:
      LABEL_OVERRIDES[value] ??
      value
        .toLowerCase()
        .split('_')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' '),
  }));
