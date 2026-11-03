import { describe, expect, it } from 'vitest';
import { normalizeName, splitFaces } from '../src/names.ts';

describe('normalizeName', () => {
  it('lower-cases and trims', () => {
    expect(normalizeName('  Lightning Bolt ')).toBe('lightning bolt');
  });

  it('removes accents and unifies quotes', () => {
    // "Lim-Dûl’s Vault" written with a curly apostrophe and a circumflex
    expect(normalizeName('Lim-Dûl’s Vault')).toBe("lim-dul's vault");
    // "Æther Vial"
    expect(normalizeName('Æther Vial')).toBe('aether vial');
  });

  it('normalizes face separators', () => {
    expect(normalizeName('Fire//Ice')).toBe('fire // ice');
    expect(normalizeName('Fire / Ice')).toBe('fire // ice');
    expect(splitFaces(normalizeName('Fire // Ice'))).toEqual(['fire', 'ice']);
  });
});
