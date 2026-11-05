import { describe, expect, it } from 'vitest';
import { CardIndex, parsePack } from '../src/pack.ts';
import { PACK } from './fixtures.ts';

const index = new CardIndex(PACK);

describe('CardIndex.find', () => {
  it('finds by exact and loosely formatted names', () => {
    expect(index.find('Lightning Bolt')?.id).toBe('bolt');
    expect(index.find('  lightning   bolt ')?.id).toBe('bolt');
  });

  it('finds multi-face cards by full name, front face, or back face', () => {
    expect(index.find('Fire // Ice')?.id).toBe('fireice');
    expect(index.find('Fire/Ice')?.id).toBe('fireice');
    expect(index.find('Fire')?.id).toBe('fireice');
    expect(index.find('Ice')?.id).toBe('fireice');
    expect(index.find('Delver of Secrets')?.id).toBe('delver');
    expect(index.find('Insectile Aberration')?.id).toBe('delver');
  });

  it('prefers the real card over an Un-set card with the same name', () => {
    expect(index.find('Twin Name')?.id).toBe('dup-real');
  });

  it('finds a card by a flavor name only when no card has that name', () => {
    const bolt = PACK.cards.find((c) => c.id === 'bolt')!;
    const withFlavor = new CardIndex({
      ...PACK,
      cards: [
        ...PACK.cards.filter((c) => c.id !== 'bolt'),
        { ...bolt, flavorNames: ['Thunder Strike', 'Ice'] },
      ],
    });
    expect(withFlavor.find('Thunder Strike')?.id).toBe('bolt');
    expect(withFlavor.find('thunder  strike')?.id).toBe('bolt');
    // A real card name wins over a flavor name.
    expect(withFlavor.find('Ice')?.id).toBe('fireice');
    expect(index.find('Thunder Strike')).toBeUndefined();
  });

  it('hides Un-set cards unless asked', () => {
    expect(index.find('Plot Armor')).toBeUndefined();
    expect(index.find('Plot Armor', { includeUnsets: true })?.id).toBe('silly');
  });

  it('returns undefined for unknown or empty names', () => {
    expect(index.find('Not A Card')).toBeUndefined();
    expect(index.find('')).toBeUndefined();
  });
});

describe('parsePack', () => {
  it('accepts schemas 1 and 2 and rejects others', () => {
    expect(parsePack(JSON.stringify(PACK)).cardCount).toBe(PACK.cardCount);
    expect(parsePack(JSON.stringify({ ...PACK, schema: 2 })).cardCount).toBe(PACK.cardCount);
    expect(() => parsePack(JSON.stringify({ ...PACK, schema: 99 }))).toThrow(/schema/);
  });
});
