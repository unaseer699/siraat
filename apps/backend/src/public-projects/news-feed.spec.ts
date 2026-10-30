import { parseFeed, decodeText } from './news-feed';
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
