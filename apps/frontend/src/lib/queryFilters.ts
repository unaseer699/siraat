// Reads the filters a person typed in the home search ("10 Marla plot in
// Islamabad under 2.5 Crore") so live plot listings can be shown when no
// verified society matches. Deliberately small and conservative: it only
// returns what was clearly stated, and null when nothing usable was found.
export interface PlotQueryFilters {
  city?: string;
  size?: string; // category label used by the plots page: "10 Marla", "1 Kanal"
  max_price_lac?: number;
}

const CITIES: Record<string, string> = {
  islamabad: 'Islamabad',
  isb: 'Islamabad',
  rawalpindi: 'Rawalpindi',
  pindi: 'Rawalpindi',
};

// Listings are plots only, so a search for another property type gets no fallback.
const NON_PLOT = /\b(house|houses|home|villa|apartment|flat|commercial|farmhouse)\b/i;

export function parsePlotQuery(query: string): PlotQueryFilters | null {
  if (NON_PLOT.test(query) && !/\bplots?\b/i.test(query)) return null;
  const lower = query.toLowerCase();
  const out: PlotQueryFilters = {};

  for (const [alias, city] of Object.entries(CITIES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) {
      out.city = city;
      break;
    }
  }

  const size = /\b(\d+(?:\.\d+)?)\s*(marla|marlas|kanal|kanals)\b/i.exec(query);
  if (size) {
    const n = Number(size[1]);
    out.size = `${Number.isInteger(n) ? n : size[1]} ${size[2].toLowerCase().startsWith('k') ? 'Kanal' : 'Marla'}`;
  }

  const price =
    /(?:under|below|upto|up to|max(?:imum)?)\s+([\d.]+)\s*(crore|cr|lakh|lac)\b/i.exec(query) ??
    /\b([\d.]+)\s*(crore|cr|lakh|lac)\b/i.exec(query);
  if (price) {
    const v = parseFloat(price[1]);
    if (v > 0) out.max_price_lac = price[2].toLowerCase().startsWith('c') ? v * 100 : v;
  }

  return out.city || out.size || out.max_price_lac ? out : null;
}

export function plotsPageHref(f: PlotQueryFilters): string {
  const p = new URLSearchParams();
  if (f.city) p.set('city', f.city);
  if (f.size) p.set('size', f.size);
  if (f.max_price_lac != null) p.set('max_price_lac', String(f.max_price_lac));
  return `/plots?${p}`;
}
