import { matchScheme, schemeKey, coreName, nameTokens } from './illegal-scheme-match';

describe('illegal scheme matching', () => {
  it('ignores case, spaces and punctuation in keys', () => {
    expect(schemeKey('Ghouri  Town, Phase-1')).toBe('ghouritownphase1');
  });
  it('takes the core name before location text', () => {
    expect(coreName('Usama Town, Hunro Thanda Pani')).toBe('Usama Town');
    expect(coreName('Ideal Residencia near Park Enclave')).toBe('Ideal Residencia');
  });
  it('exact on core name or full text', () => {
    expect(matchScheme('usama town', 'Usama Town, Hunro Thanda Pani')).toBe('EXACT');
    expect(matchScheme('Usama Town, Hunro Thanda Pani', 'Usama Town, Hunro Thanda Pani')).toBe('EXACT');
  });
  it('similar for spelling variants', () => {
    expect(matchScheme('Ghakar Town', 'Ghakkar Town, Lehtrar Road')).toBe('SIMILAR');
    expect(matchScheme('Ghakar Town Phase 2', 'Ghakkar Town, Lehtrar Road')).toBe('SIMILAR');
  });
  it('does not match unrelated or generic-only names', () => {
    expect(matchScheme('Park View City', 'Park Lane Valley, Park Road')).toBe('NONE');
    expect(matchScheme('Bahria Town', 'Madina Town, Islamabad Highway')).toBe('NONE');
    expect(matchScheme('Housing Scheme', 'Star Villas Housing Scheme Simly Dam Road')).toBe('NONE');
  });
  it('flags a shared distinctive word as SIMILAR only (a hint to check, not a claim)', () => {
    expect(matchScheme('Al-Makkah City', 'Makkah Town, Hurno Thanda Pani Nilore Islamabad')).toBe('SIMILAR');
  });
  it('ignores very short queries', () => {
    expect(matchScheme('ab', 'Ali Town')).toBe('NONE');
  });
  it('drops generic words from tokens', () => {
    expect(nameTokens('Royal City Housing Scheme')).toEqual(['royal']);
  });
});
