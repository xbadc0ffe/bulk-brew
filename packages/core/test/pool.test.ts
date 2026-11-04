import { describe, expect, it } from 'vitest';
import { CardIndex } from '../src/pack.ts';
import {
  addToPool,
  emptyPool,
  poolSize,
  poolToDecklist,
  removeFromPool,
  setPoolQty,
} from '../src/pool.ts';
import { parseDecklist } from '../src/decklist.ts';
import { collectionText } from '../src/export.ts';
import type { Deck } from '../src/types.ts';
import { PACK } from './fixtures.ts';

const index = new CardIndex(PACK);
const T = '2026-02-02T00:00:00Z';

describe('pool operations', () => {
  it('adds, merges, and keeps the first printing hint', () => {
    let pool = emptyPool(T);
    pool = addToPool(pool, [{ cardId: 'bolt', qty: 2, printing: { set: 'm10' } }], T);
    pool = addToPool(
      pool,
      [
        { cardId: 'bolt', qty: 1, printing: { set: '2xm' } },
        { cardId: 'forest', qty: 5 },
      ],
      T,
    );
    expect(pool.entries['bolt']).toEqual({ cardId: 'bolt', qty: 3, printing: { set: 'm10' } });
    expect(poolSize(pool)).toBe(8);
    expect(pool.updatedAt).toBe(T);
  });

  it('removes some or all copies and sets quantities', () => {
    let pool = addToPool(emptyPool(T), [{ cardId: 'bolt', qty: 4 }], T);
    pool = removeFromPool(pool, 'bolt', 1, T);
    expect(pool.entries['bolt']?.qty).toBe(3);
    pool = setPoolQty(pool, 'bolt', 7, T);
    expect(pool.entries['bolt']?.qty).toBe(7);
    pool = removeFromPool(pool, 'bolt', undefined, T);
    expect(pool.entries['bolt']).toBeUndefined();
    expect(removeFromPool(pool, 'missing')).toBe(pool);
  });

  it('does not mutate the input pool', () => {
    const before = addToPool(emptyPool(T), [{ cardId: 'bolt', qty: 1 }], T);
    const after = addToPool(before, [{ cardId: 'bolt', qty: 1 }], T);
    expect(before.entries['bolt']?.qty).toBe(1);
    expect(after.entries['bolt']?.qty).toBe(2);
  });

  it('exports plain decklist text sorted by name', () => {
    const pool = addToPool(
      emptyPool(T),
      [
        { cardId: 'forest', qty: 3 },
        { cardId: 'bolt', qty: 4, printing: { set: 'm10', collectorNumber: '146' } },
      ],
      T,
    );
    expect(poolToDecklist(pool, index)).toBe('3 Forest\n4 Lightning Bolt (M10) 146');
  });

  it('exports the bulk list and decks as text that reads back as a card list', () => {
    const pool = addToPool(emptyPool(T), [{ cardId: 'bolt', qty: 4 }], T);
    const deck: Deck = {
      id: 'd',
      name: 'Red Burn 20',
      size: 20,
      color: 'R',
      archetype: 'aggro',
      cards: [{ cardId: 'bolt', qty: 2 }],
      basics: { R: 8 },
      committed: false,
      createdAt: T,
      configVersion: 'x',
      dataVersion: 'x',
    };
    const text = collectionText({ pool, decks: [deck] }, index);
    expect(text.startsWith('// Bulk list (4 cards)\n4 Lightning Bolt\n\n// Red Burn 20')).toBe(
      true,
    );
    // Headings are comments, so every other line is a card.
    expect(parseDecklist(text).lines.map((l) => [l.qty, l.name])).toEqual([
      [4, 'Lightning Bolt'],
      [2, 'Lightning Bolt'],
      [8, 'Mountain'],
    ]);
    expect(collectionText({ decks: [] }, index)).toBe('\n');
  });
});
