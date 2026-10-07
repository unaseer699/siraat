import { findMarketRateItem, MarketRateItem } from './market-rate-catalog';

export interface ParsedRateLine {
  item: MarketRateItem;
  rate: number; // normalised to the catalog unit
  raw: string;
}

export interface ParsedRateMessage {
  rate_date: string | null; // YYYY-MM-DD, null = use today
  lines: ParsedRateLine[];
  rejected: { raw: string; reason: string }[];
}

const HEADING = /\b(market|daily|today'?s?|aaj\s*ka)?\s*rates?\b/i;

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

// A rate message announces itself in its first lines, e.g. "Market Rates".
export function isMarketRateMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const first = nonEmptyLines(text).slice(0, 2);
  return first.some((l) => /^[*_\s]*(market|daily|today'?s?)\s+rates?\b/i.test(l) || /^[*_\s]*rates?\s*(list|update)?\s*[:\-]?\s*$/i.test(l));
}

function parseDate(line: string): string | null {
  const m = line.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return validDate(Number(y), Number(mo), Number(d));
  }
  const iso = line.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function validDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseMarketRateMessage(text: string): ParsedMarketRate {
  const lines = nonEmptyLines(text);
  let rate_date: string | null = null;
  const parsed: ParsedRateLine[] = [];
  const rejected: { raw: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.replace(/[*_]/g, '').replace(/^[•\-–—•]+\s*/, '').trim();
    if (HEADING.test(line) && !/\d/.test(line)) continue;
    if (/^date\b/i.test(line) || /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})$/.test(line)) {
      const d = parseDate(line);
      if (d) rate_date = d;
      else rejected.push({ raw: rawLine, reason: 'Could not read the date (use DD-MM-YYYY)' });
      continue;
    }
    // "Cement: 1,320 /bag", "Cement 1320 per bag", "Steel - Rs 235000 per ton"
    const m = line.match(/^([A-Za-z][A-Za-z .()/]*?)\s*[:=\-–—]?\s*(?:rs\.?|pkr)?\s*([\d][\d,]*(?:\.\d+)?)\s*(?:\/|per\s+|pr\s+)?\s*([A-Za-z]+)?\s*$/i);
    if (!m) {
      rejected.push({ raw: rawLine, reason: 'Could not read this line (use "Item: rate /unit")' });
      continue;
    }
    const item = findMarketRateItem(m[1]);
    if (!item) {
      rejected.push({ raw: rawLine, reason: `"${m[1].trim()}" is not a tracked item` });
      continue;
    }
    let rate = Number(m[2].replace(/,/g, ''));
    const unit = (m[3] ?? '').toLowerCase();
    if (item.key === 'STEEL' && /^(ton|tons|tonne|mt)$/.test(unit)) rate = rate / 1000;
    if (!Number.isFinite(rate) || rate <= 0) {
      rejected.push({ raw: rawLine, reason: 'Rate is not a valid number' });
      continue;
    }
    if (rate < item.min || rate > item.max) {
      rejected.push({
        raw: rawLine,
        reason: `${item.label} ${Math.round(rate * 100) / 100}/${item.unit} looks wrong (expected ${item.min} to ${item.max})`,
      });
      continue;
    }
    if (seen.has(item.key)) {
      rejected.push({ raw: rawLine, reason: `${item.label} appears twice; the first value was used` });
      continue;
    }
    seen.add(item.key);
    parsed.push({ item, rate: Math.round(rate * 100) / 100, raw: rawLine });
  }
  return { rate_date, lines: parsed, rejected };
}

type ParsedMarketRate = ParsedRateMessage;
