// Reference Bill of Quantities for a 5 Marla class house (25 x 50 plot), taken
// from the founder's own completed project (Islamabad, finished May 2026).
// Indicative only: one project, prices as paid at the time. Quantities are the
// ones recorded in the sheet; rows without a recorded quantity show cost only.
export const BOQ_COVERED_AREA_SQFT = 2700;
export const BOQ_PROJECT_SPEC = [
  'Plot 25 × 50 ft (5 Marla class)',
  'About 2,700 sq ft covered',
  'Double storey + mumty room',
  '5 bedrooms · 2 kitchens · 4 washrooms',
];

export interface BoqRow {
  item: string;
  quantity?: string;
  cost: number;
  note?: string;
}

export interface BoqGroup {
  title: string;
  rows: BoqRow[];
}

export const BOQ_5_MARLA_SOURCE = 'a real 25 × 50 house, Islamabad, completed May 2026 (actual costs paid)';

export const BOQ_5_MARLA: BoqGroup[] = [
  {
    title: 'Structure',
    rows: [
      { item: 'Bricks', quantity: '47,710 pcs', cost: 1_014_800, note: '≈ Rs 21 per brick' },
      { item: 'Cement', quantity: '660 bags', cost: 857_450, note: '535 grey structure + 125 chips & tiles' },
      { item: 'Steel (sootar)', quantity: '≈ 4.7 ton', cost: 1_016_575, note: '4 sootar 4 ton, 3 sootar 725 kg' },
      { item: 'Sand', quantity: '4,550 cft', cost: 337_000, note: '≈ Rs 74 per cft' },
      { item: 'Crush', quantity: '2,400 cft', cost: 223_500, note: '≈ Rs 93 per cft' },
      { item: 'Gera & compaction', cost: 26_000 },
      { item: 'Mason & labour (3 lenters, plaster, boundary)', cost: 1_049_600 },
    ],
  },
  {
    title: 'Services',
    rows: [
      { item: 'Electrical', cost: 676_502, note: 'incl. Rs 80,000 labour, 9 fans, cables, lights' },
      { item: 'Plumbing & sanitary', cost: 992_730, note: 'incl. Rs 110,000 labour, 2 washrooms, kitchen' },
      { item: 'False ceiling', cost: 245_000 },
    ],
  },
  {
    title: 'Finishing',
    rows: [
      { item: 'Tiles & chips', cost: 1_071_905, note: 'incl. Rs 230,000 tile labour' },
      { item: 'Marble', cost: 192_000, note: 'stairs, kitchen & washroom tops' },
      { item: 'Wood & doors', cost: 921_200, note: 'incl. 245,000 doors, 130,000 labour' },
      { item: 'Aluminium windows & glass railing', cost: 462_000 },
      { item: 'Steel work (gate, grills, chokhat)', cost: 404_402 },
      { item: 'Paint & polish', cost: 288_000, note: 'incl. Rs 150,000 labour' },
    ],
  },
  {
    title: 'Site & handover',
    rows: [
      { item: 'Site staff', cost: 208_000 },
      { item: 'Refreshment', cost: 75_350 },
      { item: 'Lawn & cleaning', cost: 25_000 },
      { item: 'Miscellaneous (water, tools, repairs)', cost: 73_200 },
      { item: 'Completion & maintenance fees', cost: 16_300 },
    ],
  },
];

export const BOQ_5_MARLA_PRE_CONSTRUCTION: BoqRow[] = [
  { item: 'Soil test, water boring, excavation, architect, approvals, meter', cost: 404_500 },
];

export function boqGroupTotal(group: BoqGroup): number {
  return group.rows.reduce((s, r) => s + r.cost, 0);
}

export function boqConstructionTotal(): number {
  return BOQ_5_MARLA.reduce((s, g) => s + boqGroupTotal(g), 0);
}

export function perSqft(amount: number): number {
  return Math.round(amount / BOQ_COVERED_AREA_SQFT);
}

// Material quantities per sq ft of covered area, from the same project.
export const BOQ_RULES_OF_THUMB: { label: string; value: string }[] = [
  { label: 'Bricks', value: `${(47_710 / BOQ_COVERED_AREA_SQFT).toFixed(1)} pcs / sq ft` },
  { label: 'Cement', value: `${(660 / BOQ_COVERED_AREA_SQFT).toFixed(2)} bags / sq ft` },
  { label: 'Steel', value: `${((4.7 * 1000) / BOQ_COVERED_AREA_SQFT).toFixed(1)} kg / sq ft` },
  { label: 'Sand', value: `${(4_550 / BOQ_COVERED_AREA_SQFT).toFixed(1)} cft / sq ft` },
  { label: 'Crush', value: `${(2_400 / BOQ_COVERED_AREA_SQFT).toFixed(1)} cft / sq ft` },
];
