// Pure matching helpers for the "CDA lists this scheme as unapproved" check.
// A false warning about a legitimate society is harmful, so SIMILAR is only
// ever a "check this name" hint, never a claim that two names are the same.

export function schemeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Words that appear in most scheme names and say nothing about which one it is.
const GENERIC = new Set([
  'housing', 'scheme', 'society', 'town', 'city', 'enclave', 'garden', 'gardens', 'farm', 'farms',
  'agro', 'villas', 'villa', 'residencia', 'colony', 'phase', 'islamabad', 'road', 'near', 'the',
  'co', 'operative', 'cooperative', 'al', 'new', 'view', 'valley', 'homes', 'hill', 'hills', 'green',
]);

function collapse(w: string): string {
  return w.replace(/(.)\1+/g, '$1');
}

export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => collapse(w.replace(/s$/, '')))
    .filter((w) => w.length > 1 && !GENERIC.has(w));
}

// The scheme's own name: CDA text before the first comma / "near" / "(".
export function coreName(listed: string): string {
  return listed.split(/,| near |\(|\//i)[0].trim();
}

export type SchemeMatchKind = 'EXACT' | 'SIMILAR' | 'NONE';

export function matchScheme(query: string, listed: string): SchemeMatchKind {
  const qk = schemeKey(query);
  if (qk.length < 3) return 'NONE';
  if (qk === schemeKey(listed) || qk === schemeKey(coreName(listed))) return 'EXACT';

  const qt = new Set(nameTokens(query));
  const lt = new Set(nameTokens(coreName(listed)));
  if (qt.size === 0 || lt.size === 0) return 'NONE';
  const inter = [...qt].filter((t) => lt.has(t)).length;
  if (inter === 0) return 'NONE';
  const jaccard = inter / new Set([...qt, ...lt]).size;
  // A single leftover word (e.g. "park") is too weak to call similar unless the
  // names are otherwise the same.
  return (qt.size >= 2 && inter === qt.size) || jaccard >= 0.6 ? 'SIMILAR' : 'NONE';
}
