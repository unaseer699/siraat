// Decides whether a headline is about property or development, and which
// curated projects it mentions. Plain rules on purpose: no guessing, easy to test.

const RULES: Array<{ topic: string; re: RegExp }> = [
  { topic: 'ROADS', re: /\b(motorway|expressway|ring road|interchange|underpass|bypass|karakoram highway|kkh|m-\d{1,2}|n-\d{1,2}|e-\d{1,2} expressway)\b/i },
  { topic: 'TRANSIT', re: /\b(ml-1|circular railway|orange line|metro ?bus|brt|green line|high-speed rail|new (international )?airport|airport (project|expansion|construction))\b/i },
  { topic: 'HOUSING', re: /\b(real estate|property (withholding tax|tax|market|sector|prices?|buyers|sellers|dealers)|stamp duty|housing (scheme|society|societies|project|projects|programme|program|finance|authority|units)|affordable housing|apni chh?at|apna ghar|mera ghar|new city|township|plot (prices?|auction|allotment))\b/i },
  { topic: 'POLICY', re: /\b(withholding tax|capital gains tax|housing finance|mortgage|reit)\b/i },
];

// An authority's name alone is not enough ("CDA issues notices at a politician's
// house" is not development news). It counts only next to a development term.
const AUTHORITY = /\b(cda|rda|lda|kda|sbca|phata|ruda|nha|ecnec)\b/i;
const DEVELOPMENT_TERM =
  /\b(project|projects|scheme|schemes|master ?plan|approves?|approved|approval|tender|tenders|launch(es|ed)?|inaugurat\w*|construction|housing|society|societies|plots?|noc|layout|road|bridge|metro|allotment|sector|auction|development)\b/i;

// Crime, accident and weather stories mention roads and plots but are not development news.
const EXCLUDE = /\b(accident|killed|dead|died|injured|crash|robbery|robbers|arrested|murder|snow|fog|rain|flood|traffic jam|toll plaza attack)\b/i;

export function classify(title: string): string[] {
  if (EXCLUDE.test(title)) return [];
  const topics = RULES.filter((r) => r.re.test(title)).map((r) => r.topic);
  if (AUTHORITY.test(title) && DEVELOPMENT_TERM.test(title)) topics.push('AUTHORITY');
  return topics;
}

export function matchProjects(title: string, projects: Array<{ id: string; keywords: string[] }>): string[] {
  const t = title.toLowerCase();
  return projects.filter((p) => p.keywords.some((k) => k && t.includes(k.toLowerCase()))).map((p) => p.id);
}
