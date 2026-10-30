// Daily news pickup from the RSS feeds that Pakistan's channels and the state
// news agency publish. Only headline, link and date are kept.

export interface FeedSource {
  outlet: 'ARY' | 'GEO' | 'APP';
  url: string;
}

// Samaa and PTV publish no RSS feed (checked 30 Oct 2026), so they are not here.
export const FEEDS: FeedSource[] = [
  { outlet: 'ARY', url: 'https://arynews.tv/feed/' },
  { outlet: 'ARY', url: 'https://arynews.tv/category/business/feed/' },
  { outlet: 'ARY', url: 'https://arynews.tv/category/pakistan/feed/' },
  { outlet: 'GEO', url: 'https://www.geo.tv/rss/1/0' },
  { outlet: 'GEO', url: 'https://www.geo.tv/rss/1/1' },
  { outlet: 'GEO', url: 'https://www.geo.tv/rss/1/53' },
  { outlet: 'APP', url: 'https://www.app.com.pk/feed/' },
  { outlet: 'APP', url: 'https://www.app.com.pk/category/national/feed/' },
];

export interface FeedItem {
  title: string;
  url: string;
  published_at: Date | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeText(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return unwrapped
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeText(m[1]) : null;
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = tag(m[1], 'title');
    const url = tag(m[1], 'link');
    if (!title || !url || !/^https?:\/\//.test(url)) continue;
    const pub = tag(m[1], 'pubDate');
    const d = pub ? new Date(pub) : null;
    items.push({ title, url, published_at: d && !Number.isNaN(d.getTime()) ? d : null });
  }
  return items;
}

export async function fetchFeed(src: FeedSource, timeoutMs = 15000): Promise<FeedItem[]> {
  const res = await fetch(src.url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'SiraatBot/1.0 (daily headline check)', Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (!res.ok) throw new Error(`${src.url} answered ${res.status}`);
  const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
  const buf = await res.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder(charset).decode(buf);
  } catch {
    text = new TextDecoder('utf-8').decode(buf);
  }
  return parseFeed(text);
}
