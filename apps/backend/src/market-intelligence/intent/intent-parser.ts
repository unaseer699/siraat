import type { ParsedIntent, PropertyType } from '@siraat/shared-types';

const CITY_ALIASES: Record<string, string> = {
  islamabad: 'Islamabad',
  isb: 'Islamabad',
  rawalpindi: 'Rawalpindi',
  pindi: 'Rawalpindi',
  lahore: 'Lahore',
  lhr: 'Lahore',
  karachi: 'Karachi',
  khi: 'Karachi',
  peshawar: 'Peshawar',
  quetta: 'Quetta',
};

const PROPERTY_TYPE_ALIASES: Record<string, PropertyType> = {
  plot: 'PLOT',
  plots: 'PLOT',
  residential: 'PLOT',
  house: 'HOUSE',
  houses: 'HOUSE',
  home: 'HOUSE',
  villa: 'HOUSE',
  apartment: 'APARTMENT',
  flat: 'APARTMENT',
  commercial: 'COMMERCIAL',
  farmhouse: 'FARMHOUSE',
};

/** Parse a PKR price string like "2.5 crore", "25 lakh", "25000000" into number (PKR). */
function parsePkrAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n)) return null;
  return n;
}

function extractPrice(text: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;

  // Patterns: "under X crore/lakh", "below X crore", "upto X crore"
  const upperMatch = text.match(/(?:under|below|upto|up to|max(?:imum)?)\s+([\d.]+)\s*(crore|lakh|cr|lac)/i);
  if (upperMatch) {
    const val = parseFloat(upperMatch[1]);
    const unit = upperMatch[2].toLowerCase();
    max = unit.startsWith('c') ? val * 1e7 : val * 1e5;
  }

  // Patterns: "above X crore", "minimum X lakh"
  const lowerMatch = text.match(/(?:above|over|min(?:imum)?|more than)\s+([\d.]+)\s*(crore|lakh|cr|lac)/i);
  if (lowerMatch) {
    const val = parseFloat(lowerMatch[1]);
    const unit = lowerMatch[2].toLowerCase();
    min = unit.startsWith('c') ? val * 1e7 : val * 1e5;
  }

  // Bare "X crore" without qualifier → treat as max
  if (!max) {
    const bareMatch = text.match(/\b([\d.]+)\s*(crore|lakh|cr|lac)\b/i);
    if (bareMatch) {
      const val = parseFloat(bareMatch[1]);
      const unit = bareMatch[2].toLowerCase();
      max = unit.startsWith('c') ? val * 1e7 : val * 1e5;
    }
  }

  // Bare number over 100,000 → treat as PKR directly
  if (!max && !min) {
    const numMatch = text.match(/\b(\d{6,})\b/);
    if (numMatch) max = parsePkrAmount(numMatch[1]);
  }

  return { min, max };
}

function extractAreaMarla(text: string): { min: number | null; max: number | null } {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*marla\b/i);
  if (!match) return { min: null, max: null };
  const val = parseFloat(match[1]);
  return { min: val, max: val };
}

export function parseIntent(queryText: string, filters?: Record<string, unknown>): ParsedIntent {
  const lower = queryText.toLowerCase();

  // City
  let city: string | null = (filters?.city as string | null) ?? null;
  if (!city) {
    for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
      if (lower.includes(alias)) {
        city = canonical;
        break;
      }
    }
  }

  // Property type
  let property_type: PropertyType | null = null;
  if (filters?.property_type) {
    property_type = PROPERTY_TYPE_ALIASES[String(filters.property_type).toLowerCase()] ?? null;
  }
  if (!property_type) {
    for (const [alias, type] of Object.entries(PROPERTY_TYPE_ALIASES)) {
      if (lower.includes(alias)) {
        property_type = type;
        break;
      }
    }
  }

  // Price
  const priceFromFilters = {
    min: (filters?.min_price as number | null) ?? null,
    max: (filters?.max_price as number | null) ?? null,
  };
  const priceFromText = extractPrice(queryText);
  const min_price = priceFromFilters.min ?? priceFromText.min;
  const max_price = priceFromFilters.max ?? priceFromText.max;

  // Area
  const areaFromFilters = {
    min: (filters?.min_area_marla as number | null) ?? null,
    max: (filters?.max_area_marla as number | null) ?? null,
  };
  const areaFromText = extractAreaMarla(queryText);
  const min_area_marla = areaFromFilters.min ?? areaFromText.min;
  const max_area_marla = areaFromFilters.max ?? areaFromText.max;

  // Remaining keywords (stripped of recognised tokens)
  const keywords = lower
    .replace(/\d+(\.\d+)?\s*(crore|lakh|cr|lac|marla)/gi, '')
    .replace(/\b(under|below|above|over|upto|minimum|maximum|max|min|more than)\b/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !Object.keys(CITY_ALIASES).includes(w))
    .slice(0, 10);

  return { city, property_type, min_price, max_price, min_area_marla, max_area_marla, keywords };
}
