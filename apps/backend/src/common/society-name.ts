// Several spellings of one society ("B 17", "B-17", "B17", "Faisal hills")
// are one society. The key ignores case, spaces and punctuation.
export function compactSocietyName(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Display form of a raw society header: sector codes read "B-17", plain words
// are Title Cased.
export function tidySocietyName(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ');
  const sector = t.match(/^([a-z])\s*-?\s*(\d{1,3})$/i);
  if (sector) return `${sector[1].toUpperCase()}-${sector[2]}`;
  return t.replace(/(^|\s)([a-z])/g, (_m, sp: string, c: string) => sp + c.toUpperCase());
}
