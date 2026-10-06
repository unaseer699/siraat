// Plot-size helpers shared by WhatsApp ingestion and property intelligence.
// Pure functions only — no module state, no schema access.

// Founder-confirmed universal rule: 1 Marla = 225 sq ft, so a plot of
// W x H feet is W*H/225 Marla (25x50 = 5.56, 75x120 = 40 = 2 Kanal).
const SQFT_PER_MARLA = 225;

// "25 * 50", "25*50", "25 X 50", "25×50" -> "25x50"; "5 marla" -> "5 Marla";
// "1 kanal" -> "1 Kanal". Returns null for blank/unrecognisable input so a
// junk string never becomes a filter option.
export function normalizeSizeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const dim = text.match(/(\d{1,3}(?:\.\d+)?)\s*[x*×]\s*(\d{1,3}(?:\.\d+)?)/i);
  if (dim) return `${Number(dim[1])}x${Number(dim[2])}`;

  const unit = text.match(/(\d{1,3}(?:\.\d+)?)\s*(marla|marlas|kanal|kanals)\b/i);
  if (unit) {
    const n = Number(unit[1]);
    return `${n} ${/kanal/i.test(unit[2]) ? 'Kanal' : 'Marla'}`;
  }
  return null;
}

// Label -> Marla (null when unknown).
export function sizeLabelToMarla(label: string | null): number | null {
  if (!label) return null;
  const dim = label.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (dim) return Math.round(((Number(dim[1]) * Number(dim[2])) / SQFT_PER_MARLA) * 100) / 100;
  const unit = label.match(/^(\d+(?:\.\d+)?) (Marla|Kanal)$/);
  if (unit) return Number(unit[1]) * (unit[2] === 'Kanal' ? 20 : 1);
  return null;
}

// Sort key for filter dropdowns: smallest plot first. Dimensions by area,
// "N Marla"/"N Kanal" by marla-equivalent area (225 sq ft per marla).
export function sizeLabelArea(label: string): number {
  const dim = label.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (dim) return Number(dim[1]) * Number(dim[2]);
  const m = sizeLabelToMarla(label);
  return m !== null ? m * SQFT_PER_MARLA : Number.MAX_SAFE_INTEGER;
}
