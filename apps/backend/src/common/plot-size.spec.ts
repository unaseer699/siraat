import { sizeCategory } from './plot-size';
import { compactSocietyName, tidySocietyName } from './society-name';

describe('sizeCategory', () => {
  it.each([
    ['25x50', '5 Marla'],
    ['25 * 50', '5 Marla'],
    ['5 Marla', '5 Marla'],
    ['30x50', '7 Marla'],
    ['7 Marla', '7 Marla'],
    ['30x60', '8 Marla'],
    ['35x70', '10 Marla'],
    ['10 Marla', '10 Marla'],
    ['40x80', '14 Marla'],
    ['50x90', '1 Kanal'],
    ['60x90', '1 Kanal'],
    ['1 Kanal', '1 Kanal'],
    ['70x120', '2 Kanal'],
  ])('%s -> %s', (raw, expected) => expect(sizeCategory(raw)).toBe(expected));

  it('returns null when unrecognisable', () => expect(sizeCategory('corner plot')).toBeNull());
});

describe('society names', () => {
  it('treats spelling variants as one society', () => {
    const keys = ['B 17', 'B-17', 'B17', 'b17'].map(compactSocietyName);
    expect(new Set(keys).size).toBe(1);
  });
  it('tidies display names', () => {
    expect(tidySocietyName('b17')).toBe('B-17');
    expect(tidySocietyName('B 17')).toBe('B-17');
    expect(tidySocietyName('Faisal hills')).toBe('Faisal Hills');
    expect(tidySocietyName('Gulberg Residencia')).toBe('Gulberg Residencia');
  });
});
