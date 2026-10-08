// The build in site order, with one colour per step. The step numbers and keys
// match the whole-house estimate returned by the backend.
export interface PhaseStyle {
  key: string;
  step: number;
  title: string;
  color: string; // strong colour: bar, number badge, border
  tint: string; // pale background
  ink: string; // dark text on the tint
}

export const PHASE_STYLES: PhaseStyle[] = [
  { key: 'PLOT', step: 1, title: 'Plot buying & transfer', color: '#2563eb', tint: '#eff6ff', ink: '#1e3a8a' },
  { key: 'MAP', step: 2, title: 'Map, design & approvals', color: '#4f46e5', tint: '#eef2ff', ink: '#312e81' },
  { key: 'SOIL', step: 3, title: 'Soil testing, boring & demarcation', color: '#a16207', tint: '#fefce8', ink: '#713f12' },
  { key: 'SITE_SETUP', step: 4, title: 'Site setup, utilities & site staff', color: '#059669', tint: '#ecfdf5', ink: '#064e3b' },
  { key: 'EXCAVATION', step: 5, title: 'Excavation', color: '#b45309', tint: '#fffbeb', ink: '#78350f' },
  { key: 'GREY', step: 6, title: 'Grey structure', color: '#475569', tint: '#f1f5f9', ink: '#1e293b' },
  { key: 'ROOF', step: 7, title: 'Roof waterproofing & insulation', color: '#1e40af', tint: '#eff6ff', ink: '#1e3a8a' },
  { key: 'ROUGH_IN', step: 8, title: 'Electrical & plumbing rough-in', color: '#7c3aed', tint: '#f5f3ff', ink: '#4c1d95' },
  { key: 'CEILING', step: 9, title: 'False ceiling', color: '#0d9488', tint: '#f0fdfa', ink: '#134e4a' },
  { key: 'TILES', step: 10, title: 'Tile & marble work', color: '#0891b2', tint: '#ecfeff', ink: '#164e63' },
  { key: 'WOOD', step: 11, title: 'Wood & carpentry', color: '#c2410c', tint: '#fff7ed', ink: '#7c2d12' },
  { key: 'STEEL', step: 12, title: 'Gate, grills & railings', color: '#52525b', tint: '#fafafa', ink: '#27272a' },
  { key: 'WINDOWS', step: 13, title: 'Windows installation', color: '#0284c7', tint: '#f0f9ff', ink: '#0c4a6e' },
  { key: 'PAINT', step: 14, title: 'Paint', color: '#db2777', tint: '#fdf2f8', ink: '#831843' },
  { key: 'FIXTURES', step: 15, title: 'Fixtures & fittings', color: '#ca8a04', tint: '#fefce8', ink: '#713f12' },
  { key: 'OUTSIDE', step: 16, title: 'Outside works', color: '#65a30d', tint: '#f7fee7', ink: '#365314' },
  { key: 'SNAGGING', step: 17, title: 'Snagging, cleaning & handover', color: '#16a34a', tint: '#f0fdf4', ink: '#14532d' },
  { key: 'CONTINGENCY', step: 18, title: 'Contingency allowance', color: '#be123c', tint: '#fff1f2', ink: '#881337' },
];

export const PHASE_BY_KEY: Record<string, PhaseStyle> = Object.fromEntries(PHASE_STYLES.map((p) => [p.key, p]));

// Which build step each BOQ line belongs to.
export const BOQ_ITEM_PHASE: Record<string, string> = {
  BORING: 'SOIL',
  EXCAVATION: 'EXCAVATION',
  CEMENT: 'GREY',
  STEEL: 'GREY',
  BRICKS: 'GREY',
  SAND: 'GREY',
  CRUSH: 'GREY',
  PLUMBING_ROUGH_IN: 'ROUGH_IN',
  ELECTRICAL_ROUGH_IN: 'ROUGH_IN',
  MARBLE_STAIRS: 'TILES',
  DOORS: 'WOOD',
  KITCHEN_WOODWORK: 'WOOD',
  HARDWARE: 'WOOD',
  WINDOWS: 'WINDOWS',
  PAINT: 'PAINT',
};
