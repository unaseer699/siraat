// Items accepted in the daily market-rate message. `ref_cost` is what the
// founder's finished 25 x 50 house (2,700 sq ft) paid for that item, and is
// the weight the forecast uses to reprice its group. `ref_rate` is the unit
// rate paid there where known; items without one take their first quote as the
// baseline (editable on the Daily Rates page).
export type RateUnit = 'bag' | 'pc' | 'cft' | 'kg' | 'sqft' | 'rft' | 'roll' | 'set' | 'lot';
export type RateGroup = 'STRUCTURE' | 'SERVICES' | 'FINISHING' | 'SITE_OTHER';

export interface MarketRateItem {
  key: string;
  label: string;
  group: RateGroup;
  unit: RateUnit;
  aliases: string[];
  ref_cost: number;
  ref_rate: number | null;
  // Optional typo guard for items with a known range.
  min?: number;
  max?: number;
}

export const MARKET_RATE_ITEMS: MarketRateItem[] = [
  // STRUCTURE
  { key: 'CEMENT', label: 'Cement', group: 'STRUCTURE', unit: 'bag', aliases: ['cement'], ref_cost: 857_450, ref_rate: 1299, min: 500, max: 5000 },
  { key: 'BRICKS', label: 'Bricks', group: 'STRUCTURE', unit: 'pc', aliases: ['brick', 'bricks', 'eent', 'int'], ref_cost: 1_014_800, ref_rate: 21.27, min: 5, max: 100 },
  { key: 'SAND', label: 'Sand', group: 'STRUCTURE', unit: 'cft', aliases: ['sand', 'ravi sand', 'chenab sand', 'reti', 'raiti'], ref_cost: 337_000, ref_rate: 74.1, min: 20, max: 300 },
  { key: 'CRUSH', label: 'Crush', group: 'STRUCTURE', unit: 'cft', aliases: ['crush', 'crushed', 'bajri', 'crush stone'], ref_cost: 223_500, ref_rate: 93.1, min: 30, max: 400 },
  { key: 'STEEL', label: 'Steel', group: 'STRUCTURE', unit: 'kg', aliases: ['steel', 'sariya', 'saria', 'sia', 'rebar', 'sootar', 'grade 60 steel', 'grade 40 steel'], ref_cost: 1_016_575, ref_rate: 216.3, min: 100, max: 600 },
  { key: 'MASON_LABOUR', label: 'Mason labour', group: 'STRUCTURE', unit: 'sqft', aliases: ['mason labour', 'mason labor', 'mistri labour', 'mason', 'structure labour', 'labour structure', 'labour mason'], ref_cost: 971_300, ref_rate: null },
  { key: 'PARAPET_LABOUR', label: 'Boundary / parapet labour', group: 'STRUCTURE', unit: 'rft', aliases: ['parapet', 'parapet labour', 'boundary parapet', 'boundary wall parapet roof boundary', 'roof boundary', 'boundary parapet roof boundary', 'parapet roof boundary'], ref_cost: 48_300, ref_rate: null },
  { key: 'FRONT_DESIGN', label: 'Front design plaster', group: 'STRUCTURE', unit: 'lot', aliases: ['front design', 'front design plaster', 'front elevation design', 'plaster design', 'front design elevation'], ref_cost: 30_000, ref_rate: 30_000 },
  // SERVICES
  { key: 'ELECTRIC_LABOUR', label: 'Electrician labour', group: 'SERVICES', unit: 'sqft', aliases: ['electric labour', 'electrician labour', 'electrical labour', 'wiring labour', 'electric labor', 'labour wiring', 'labour electric'], ref_cost: 80_000, ref_rate: null },
  { key: 'WIRE_7_29', label: 'Wire 7/29', group: 'SERVICES', unit: 'roll', aliases: ['wire 7 29', 'wire 7/29', 'wiring 7 29', 'cable 7 29', 'wire 7 29 roll'], ref_cost: 97_972, ref_rate: null },
  { key: 'WIRE_3_29', label: 'Wire 3/29', group: 'SERVICES', unit: 'roll', aliases: ['wire 3 29', 'wire 3/29', 'wiring 3 29', 'cable 3 29', 'wire 3 29 roll'], ref_cost: 97_972, ref_rate: null },
  { key: 'PLUMBING_LABOUR', label: 'Plumber labour', group: 'SERVICES', unit: 'sqft', aliases: ['plumbing labour', 'plumber labour', 'plumbing labor', 'labour plumbing', 'labour plumber'], ref_cost: 110_000, ref_rate: null },
  { key: 'PLUMBING_PIPES', label: 'Plumbing pipes & fittings', group: 'SERVICES', unit: 'rft', aliases: ['plumbing pipes', 'pipes', 'pipe', 'plumbing material', 'plumbing pipes fittings', 'pipes fittings'], ref_cost: 216_000, ref_rate: null },
  { key: 'SANITARY', label: 'Sanitary ware', group: 'SERVICES', unit: 'set', aliases: ['sanitary', 'sanitary ware', 'sanitary set', 'bathroom fittings', 'commode set'], ref_cost: 589_500, ref_rate: null },
  // Priced per sq ft of covered area for the public BOQ estimate only (ref_cost 0: the forecast already prices these works through the items above).
  { key: 'ELECTRICAL_ROUGH_IN', label: 'Electrical rough-in', group: 'SERVICES', unit: 'sqft', aliases: ['electrical rough in', 'electric rough in', 'electrical roughin', 'electrical rough'], ref_cost: 0, ref_rate: 166.89 },
  { key: 'PLUMBING_ROUGH_IN', label: 'Plumbing rough-in', group: 'SERVICES', unit: 'sqft', aliases: ['plumbing rough in', 'plumbing roughin', 'plumbing rough'], ref_cost: 0, ref_rate: 143.42 },
  { key: 'FALSE_CEILING', label: 'False ceiling', group: 'SERVICES', unit: 'sqft', aliases: ['false ceiling', 'ceiling', 'gypsum ceiling'], ref_cost: 245_000, ref_rate: null },
  // FINISHING
  { key: 'TILES', label: 'Tiles', group: 'FINISHING', unit: 'sqft', aliases: ['tiles', 'tile', 'floor tiles', 'tiles material'], ref_cost: 694_750, ref_rate: null },
  { key: 'CHIPS', label: 'Chips / mosaic', group: 'FINISHING', unit: 'sqft', aliases: ['chips', 'chip', 'mosaic', 'chips flooring'], ref_cost: 106_815, ref_rate: null },
  { key: 'TILE_LABOUR', label: 'Tile labour', group: 'FINISHING', unit: 'sqft', aliases: ['tile labour', 'tiles labour', 'tile labor', 'tiling labour', 'labour tiles', 'labour tile'], ref_cost: 252_000, ref_rate: null },
  { key: 'MARBLE', label: 'Marble / granite', group: 'FINISHING', unit: 'sqft', aliases: ['marble', 'granite', 'marble granite'], ref_cost: 192_000, ref_rate: null },
  { key: 'WOOD', label: 'Wood', group: 'FINISHING', unit: 'cft', aliases: ['wood', 'timber', 'kikar', 'deodar', 'lakri'], ref_cost: 546_200, ref_rate: null },
  { key: 'DOORS', label: 'Doors', group: 'FINISHING', unit: 'pc', aliases: ['door', 'doors'], ref_cost: 245_000, ref_rate: 15_000 },
  { key: 'CARPENTER_LABOUR', label: 'Carpenter labour', group: 'FINISHING', unit: 'sqft', aliases: ['carpenter labour', 'carpenter labor', 'wood labour', 'labour carpenter'], ref_cost: 130_000, ref_rate: null },
  { key: 'ALUMINIUM_WINDOWS', label: 'Aluminium windows', group: 'FINISHING', unit: 'sqft', aliases: ['aluminium windows', 'aluminum windows', 'aluminium', 'aluminum', 'windows', 'window'], ref_cost: 462_000, ref_rate: 1_000 },
  { key: 'GATE', label: 'Gate', group: 'FINISHING', unit: 'lot', aliases: ['gate', 'main gate', 'iron gate', 'steel gate'], ref_cost: 97_250, ref_rate: 97_250 },
  { key: 'STAIR_RAILING', label: 'Stair railing', group: 'FINISHING', unit: 'lot', aliases: ['stair railing', 'stair grill', 'stairs railing', 'stair rail', 'stairs grill'], ref_cost: 60_000, ref_rate: 60_000 },
  { key: 'WINDOW_GRILLS', label: 'Window iron grills (5 windows)', group: 'FINISHING', unit: 'lot', aliases: ['window grills', 'window grill', 'windows iron grill', 'iron grill', 'grill windows', '5 windows iron grill', 'window iron grills', 'window iron grills 5 windows'], ref_cost: 90_000, ref_rate: 90_000 },
  { key: 'STEEL_WORK', label: 'Steel work, other (chokhats, back grill)', group: 'FINISHING', unit: 'kg', aliases: ['steel work', 'iron work', 'welding', 'chokhat', 'chokhats', 'steel work other'], ref_cost: 157_152, ref_rate: null },
  { key: 'PAINT_LABOUR', label: 'Paint labour', group: 'FINISHING', unit: 'sqft', aliases: ['paint labour', 'painter labour', 'paint labor', 'labour paint', 'labour painter'], ref_cost: 150_000, ref_rate: null },
  { key: 'PAINT_MATERIAL', label: 'Paint material', group: 'FINISHING', unit: 'sqft', aliases: ['paint material', 'paint', 'paints', 'emulsion', 'paint materials'], ref_cost: 138_000, ref_rate: 51.11 },
  // SITE
  { key: 'BOUNDARY_WALL', label: 'Boundary wall', group: 'SITE_OTHER', unit: 'rft', aliases: ['boundary wall', 'boundary', 'boundary wall rate'], ref_cost: 0, ref_rate: null },
];

export const RATE_GROUP_LABELS: Record<RateGroup, string> = {
  STRUCTURE: 'Structure',
  SERVICES: 'Services',
  FINISHING: 'Finishing',
  SITE_OTHER: 'Site & other',
};

export const UNIT_WORDS: Record<string, RateUnit | 'ton'> = {
  bag: 'bag', bags: 'bag',
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', each: 'pc', no: 'pc', nos: 'pc', door: 'pc',
  cft: 'cft', cuft: 'cft', cubicft: 'cft',
  kg: 'kg', kgs: 'kg',
  ton: 'ton', tons: 'ton', tonne: 'ton', mt: 'ton',
  sqft: 'sqft', sft: 'sqft', sf: 'sqft', sq: 'sqft', sqfeet: 'sqft', squarefoot: 'sqft', squarefeet: 'sqft',
  rft: 'rft', rf: 'rft', ft: 'rft', runningft: 'rft', runningfoot: 'rft', rfeet: 'rft',
  roll: 'roll', rolls: 'roll',
  set: 'set', sets: 'set',
  lot: 'lot', lumpsum: 'lot', lump: 'lot', ls: 'lot', lumpsump: 'lot',
};

export function normaliseUnit(raw: string): RateUnit | 'ton' | null {
  const k = raw.toLowerCase().replace(/[^a-z]/g, '');
  return UNIT_WORDS[k] ?? null;
}

export function findMarketRateItem(name: string): MarketRateItem | null {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  return (
    MARKET_RATE_ITEMS.find((i) => i.aliases.includes(n) || i.label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() === n) ??
    MARKET_RATE_ITEMS.find((i) => i.aliases.some((a) => n.startsWith(`${a} `) || n.endsWith(` ${a}`))) ??
    null
  );
}

const TEMPLATE_UNIT: Record<RateUnit, string> = { bag: 'bag', pc: 'pc', cft: 'cft', kg: 'kg', sqft: 'sqft', rft: 'rft', roll: 'roll', set: 'set', lot: 'lumpsum' };

export function buildTemplate(): string {
  const lines = ['Market Rates', 'Date: DD-MM-YYYY'];
  for (const g of ['STRUCTURE', 'SERVICES', 'FINISHING', 'SITE_OTHER'] as RateGroup[]) {
    lines.push('', `${RATE_GROUP_LABELS[g].toUpperCase()}`);
    for (const i of MARKET_RATE_ITEMS.filter((x) => x.group === g)) {
      lines.push(`${i.label}: ___ /${TEMPLATE_UNIT[i.unit]}`);
    }
  }
  return lines.join('\n');
}

export const MARKET_RATE_TEMPLATE = buildTemplate();
