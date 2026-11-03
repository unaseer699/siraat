// Daily news pickup from the RSS feeds that Pakistan's channels and the state
// news agency publish. Only headline, link and date are kept.

export type Outlet = 'ARY' | 'GEO' | 'APP' | 'DAWN' | 'TRIBUNE' | 'THENEWS' | 'BR' | 'PROPAK' | 'ZAMEEN' | 'AAJ' | 'PID';

export interface FeedSource {
  outlet: Outlet;
  url: string;
  format?: 'RSS' | 'PID_HTML';
}

const rss = (outlet: Outlet, ...urls: string[]): FeedSource[] => urls.map((url) => ({ outlet, url }));

// Public RSS feeds, each checked on 3 Nov 2026 (robots.txt allows them, they answer 200).
// Samaa and PTV publish no feed. PID (the government's press information
// department) has no feed either, so its public press-release list page is read.
// Tribune's bare /feed/ answers 403 and is deliberately not used.
export const FEEDS: FeedSource[] = [
  ...rss('ARY', 'https://arynews.tv/feed/', 'https://arynews.tv/category/business/feed/', 'https://arynews.tv/category/pakistan/feed/'),
  ...rss('GEO', 'https://www.geo.tv/rss/1/0', 'https://www.geo.tv/rss/1/1', 'https://www.geo.tv/rss/1/53'),
  ...rss('APP', 'https://www.app.com.pk/feed/', 'https://www.app.com.pk/category/national/feed/'),
  ...rss('DAWN', 'https://www.dawn.com/feeds/latest-news', 'https://www.dawn.com/feeds/business', 'https://www.dawn.com/feeds/pakistan'),
  ...rss('TRIBUNE', 'https://tribune.com.pk/feed/home', 'https://tribune.com.pk/feed/business', 'https://tribune.com.pk/feed/pakistan'),
  ...rss('THENEWS', 'https://www.thenews.com.pk/rss/1/1', 'https://www.thenews.com.pk/rss/1/0', 'https://www.thenews.com.pk/rss/1/2'),
  ...rss('BR', 'https://www.brecorder.com/feeds/latest-news', 'https://www.brecorder.com/feeds/pakistan'),
  ...rss('PROPAK', 'https://propakistani.pk/feed/', 'https://propakistani.pk/proproperty/feed/', 'https://propakistani.pk/category/news/feed/'),
  ...rss('ZAMEEN', 'https://www.zameen.com/news/feed/'),
  ...rss('AAJ', 'https://english.aaj.tv/feeds/latest-news', 'https://english.aaj.tv/feeds/pakistan'),
  { outlet: 'PID', url: 'https://pid.gov.pk/press', format: 'PID_HTML' },
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

// PID's press list page: each release is a link whose text is the (shortened)
// title, followed by a link carrying its timestamp, e.g. "2026-11-02, 21:39:56".
export function parsePidPress(html: string): FeedItem[] {
  const items: FeedItem[] = [];
  const re = /<a href="(https?:\/\/[^"]*press_detail\/\d+)"[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/a>\s*<a[^>]*>\s*(\d{4}-\d{2}-\d{2}),\s*(\d{2}:\d{2}:\d{2})\s*<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const title = decodeText(m[2]);
    if (!title) continue;
    const d = new Date(`${m[3]}T${m[4]}+05:00`);
    items.push({ title, url: m[1], published_at: Number.isNaN(d.getTime()) ? null : d });
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
  return src.format === 'PID_HTML' ? parsePidPress(text) : parseFeed(text);
}
