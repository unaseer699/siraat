// Decides whether a headline is about property or development, and which
// curated projects it mentions. Plain rules on purpose: no guessing, easy to test.

const RULES: Array<{ topic: string; re: RegExp }> = [
  { topic: 'ROADS', re: /\b(motorway|expressway|ring road|interchange|underpass|bypass|karakoram highway|kkh|m-\d{1,2}|n-\d{1,2}|e-\d{1,2} expressway)\b/i },
  { topic: 'TRANSIT', re: /\b(ml-1|circular railway|orange line|metro ?bus|brt|green line|high-speed rail|new (international )?airport|airport (project|expansion|construction))\b/i },
  { topic: 'HOUSING', re: /\b(real estate|property (withholding tax|tax|market|sector|prices?|buyers|sellers|dealers)|stamp duty|housing (scheme|society|societies|project|projects|programme|program|finance|authority|units)|affordable housing|apni chh?at|apna ghar|mera ghar|new city|township|plot (prices?|auction|allotment))\b/i },
  { topic: 'POLICY', re: /\b(withholding tax|capital gains tax|housing finance|mortgage|reit)\b/i },
  { topic: 'AUTHORITY', re: /\b(cda|rda|lda|kda|sbca|phata|ruda|nha|ecnec)\b/i },
];

// Crime, accident and weather stories mention roads and plots but are not development news.
const EXCLUDE = /\b(accident|killed|dead|died|injured|crash|robbery|robbers|arrested|murder|snow|fog|rain|flood|traffic jam|toll plaza attack)\b/i;

export function classify(title: string): string[] {
  if (EXCLUDE.test(title)) return [];
  return RULES.filter((r) => r.re.test(title)).map((r) => r.topic);
}

export function matchProjects(title: string, projects: Array<{ id: string; keywords: string[] }>): string[] {
  const t = title.toLowerCase();
  return projects.filter((p) => p.keywords.some((k) => k && t.includes(k.toLowerCase()))).map((p) => p.id);
}
