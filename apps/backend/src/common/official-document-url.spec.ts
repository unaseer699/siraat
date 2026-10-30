import { officialDocumentUrl, looksLikeUrl } from './official-document-url';

describe('officialDocumentUrl', () => {
  it('accepts a CDA portal PDF link', () => {
    const url = 'https://www.cda.gov.pk/storage/housing_societies/MdonZBOBsjNroCT1017bvsC30jJNdTtQK0zH4RUD.pdf';
    expect(officialDocumentUrl(url)).toBe(url);
  });
  it('accepts an RDA portal link', () => {
    const url = 'https://www.rda.gop.pk/storage/notice.pdf';
    expect(officialDocumentUrl(url)).toBe(url);
  });
  it('accepts an LDA layout plan', () => {
    const url = 'https://lda.gop.pk/private_schemes/plu/img/schemes/464_Abdalian_Revised--2011-.jpg';
    expect(officialDocumentUrl(url)).toBe(url);
  });
  it('accepts a PDA list page', () => {
    const url = 'https://pda.kp.gov.pk/illegalsocieties';
    expect(officialDocumentUrl(url)).toBe(url);
  });
  it('accepts an RDA scheme map on its own storage host', () => {
    const url = 'https://pub-480f7399580a4e4496490b6a8bd298f6.r2.dev/societies_map/abc-Taj%20Residencia.jpg';
    expect(officialDocumentUrl(url)).toBe(url);
  });
  it('rejects other hosts, http, look-alikes and credentials', () => {
    expect(officialDocumentUrl('https://evil.com/a.pdf')).toBeNull();
    expect(officialDocumentUrl('http://www.cda.gov.pk/a.pdf')).toBeNull();
    expect(officialDocumentUrl('https://cda.gov.pk.evil.com/a.pdf')).toBeNull();
    expect(officialDocumentUrl('https://user:pw@www.cda.gov.pk/a.pdf')).toBeNull();
  });
  it('returns null for storage keys', () => {
    expect(officialDocumentUrl('trust/cda/noc.pdf')).toBeNull();
    expect(looksLikeUrl('trust/cda/noc.pdf')).toBe(false);
  });
});
