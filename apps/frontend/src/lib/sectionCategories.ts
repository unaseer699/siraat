import {
  SECTION_CATEGORIES,
  SECTION_GROUP_LABELS,
  sectionCategoryLabel,
  sectionGroupOf,
  type SectionCategory,
  type SectionGroup,
} from '@siraat/shared-types';

export const SECTION_CATEGORY_OPTIONS: { value: SectionCategory; label: string; group: SectionGroup }[] =
  SECTION_CATEGORIES.map((value) => ({
    value,
    label: sectionCategoryLabel(value),
    group: sectionGroupOf(value),
  }));

export const SECTION_GROUP_ORDER: SectionGroup[] = ['LAND', 'STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'];

export function sectionLabel(value: string): string {
  return SECTION_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export { SECTION_GROUP_LABELS };
