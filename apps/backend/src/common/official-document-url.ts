// Evidence can point straight at a document hosted on an official regulator
// portal instead of a file in our own bucket. Only allow-listed hosts are
// accepted so a typo or a bad link can never send users to an arbitrary site.
// pub-480f...r2.dev is the storage bucket behind rda.gop.pk's approved-scheme maps
// (the page links to it directly); it is RDA's own document store.
const OFFICIAL_DOCUMENT_HOSTS = [
  'cda.gov.pk',
  'www.cda.gov.pk',
  'rda.gop.pk',
  'www.rda.gop.pk',
  'lda.gop.pk',
  'www.lda.gop.pk',
  'pub-480f7399580a4e4496490b6a8bd298f6.r2.dev',
];

export function looksLikeUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref.trim());
}

// Returns the cleaned URL when `ref` is an https link on an allow-listed
// official host, otherwise null.
export function officialDocumentUrl(ref: string): string | null {
  if (!looksLikeUrl(ref)) return null;
  try {
    const u = new URL(ref.trim());
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (!OFFICIAL_DOCUMENT_HOSTS.includes(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch {
    return null;
  }
}
