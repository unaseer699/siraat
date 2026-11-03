import { parseFeed, decodeText, parsePidPress, FEEDS } from './news-feed';
import { classify, matchProjects } from './relevance';

const XML = `<rss><channel>
<item><title><![CDATA[Margalla Road link to motorway: &amp; interchange ready]]></title><link>https://www.app.com.pk/a/</link><pubDate>Fri, 30 Oct 2026 07:30:11 +0000</pubDate></item>
<item><title>No link here</title></item>
<item><title>Bad date</title><link>https://arynews.tv/b</link><pubDate>nonsense</pubDate></item>
</channel></rss>`;

describe('news feed parsing', () => {
  it('reads title, link and date, unwraps CDATA and entities, skips items without a link', () => {
    const items = parseFeed(XML);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ title: 'Margalla Road link to motorway: & interchange ready', url: 'https://www.app.com.pk/a/', published_at: new Date('2026-10-30T07:30:11Z') });
    expect(items[1].published_at).toBeNull();
  });
  it('decodes numeric entities', () => {
    expect(decodeText('Rs&#8217;s &#x41;')).toBe('Rs’s A');
  });
});

describe('relevance', () => {
  it('keeps development and property headlines', () => {
    expect(classify('Rawalpindi Ring Road to open in weeks')).toContain('ROADS');
    expect(classify('Budget cuts property withholding tax')).toEqual(expect.arrayContaining(['HOUSING', 'POLICY']));
    expect(classify('ECNEC approves housing scheme for low-income families')).toEqual(expect.arrayContaining(['HOUSING', 'AUTHORITY']));
  });
  it('keeps enforcement news that affects buyers', () => {
    expect(classify("CDA issues notices over 'unauthorised structures' at a leader's residence")).toContain('ENFORCEMENT');
    expect(classify('LDA launches anti-encroachment drive in Lahore')).toContain('ENFORCEMENT');
    expect(classify('Illegal housing societies sealed in Rawalpindi')).toContain('ENFORCEMENT');
  });
  it('drops an authority name that appears with no development or enforcement term', () => {
    expect(classify('CDA chairman attends wedding')).toEqual([]);
    expect(classify('CDA approves master plan for new sector')).toContain('AUTHORITY');
  });
  it('drops accident and unrelated stories', () => {
    expect(classify('Three killed in motorway accident')).toEqual([]);
    expect(classify('Cricket team wins final')).toEqual([]);
  });
  it('does not treat FDA or PDA as development authorities', () => {
    expect(classify('FDA approves new drug')).toEqual([]);
  });
  it('links a headline to a project by keyword', () => {
    const projects = [
      { id: 'a', keywords: ['margalla road'] },
      { id: 'b', keywords: ['m-6', 'sukkur-hyderabad'] },
    ];
    expect(matchProjects('Margalla Road link nears completion', projects)).toEqual(['a']);
    expect(matchProjects('Cabinet talks', projects)).toEqual([]);
  });
});

describe('PID press list', () => {
  const HTML = `<a href="https://pid.gov.pk/site/press_detail/34635" class="x"><p>PR No. 22  Minister visits &amp; meets CDA chairman on housing project</p></a>
  <a href="https://pid.gov.pk/site/press_detail/34635" class="x">2026-11-02, 21:39:56</a>
  <a href="https://pid.gov.pk/site/press_detail/34635">Read More</a>`;
  it('reads title, link and Pakistan-time timestamp', () => {
    expect(parsePidPress(HTML)).toEqual([
      { title: 'PR No. 22 Minister visits & meets CDA chairman on housing project', url: 'https://pid.gov.pk/site/press_detail/34635', published_at: new Date('2026-11-02T16:39:56Z') },
    ]);
  });
});

describe('feed list', () => {
  it('uses short outlet codes and unique urls', () => {
    expect(new Set(FEEDS.map((f) => f.url)).size).toBe(FEEDS.length);
    expect(FEEDS.every((f) => f.outlet.length <= 10)).toBe(true);
  });
});
