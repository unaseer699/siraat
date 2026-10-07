// Items accepted in the daily market-rate message. The key and unit are what
// the forecast uses; `min`/`max` reject obvious typos (a missing digit, an
// extra zero) before they can reach the forecast.
export interface MarketRateItem {
  key: string;
  label: string;
  unit: 'bag' | 'pc' | 'cft' | 'kg';
  aliases: string[];
  min: number;
  max: number;
}

export const MARKET_RATE_ITEMS: MarketRateItem[] = [
  { key: 'CEMENT', label: 'Cement', unit: 'bag', aliases: ['cement'], min: 500, max: 5000 },
  { key: 'BRICKS', label: 'Bricks', unit: 'pc', aliases: ['brick', 'bricks', 'eent', 'int'], min: 5, max: 100 },
  { key: 'SAND', label: 'Sand', unit: 'cft', aliases: ['sand', 'ravi sand', 'chenab sand', 'reti', 'raiti'], min: 20, max: 300 },
  { key: 'CRUSH', label: 'Crush', unit: 'cft', aliases: ['crush', 'crushed', 'bajri', 'crush stone'], min: 30, max: 400 },
  { key: 'STEEL', label: 'Steel', unit: 'kg', aliases: ['steel', 'sariya', 'saria', 'sia', 'rebar', 'sootar', 'grade 60 steel', 'grade 40 steel'], min: 100, max: 600 },
];

export function findMarketRateItem(name: string): MarketRateItem | null {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  return (
    MARKET_RATE_ITEMS.find((i) => i.aliases.includes(n)) ??
    MARKET_RATE_ITEMS.find((i) => i.aliases.some((a) => n === a || n.startsWith(`${a} `) || n.endsWith(` ${a}`))) ??
    null
  );
}

export const MARKET_RATE_TEMPLATE = `Market Rates
Date: DD-MM-YYYY
Cement: 1300 /bag
Bricks: 21 /pc
Sand: 75 /cft
Crush: 93 /cft
Steel: 216 /kg`;
