import { describe, expect, it } from 'vitest';
import { buildDeck, CardIndex, commitDeck } from '@bulk-brew/core';
import { poolShortfall } from '../src/data/poolCheck.ts';
import {
  bigPool,
  CONFIG_BUNDLE as CONFIG,
  PACK,
  SETTINGS,
} from '../../core/test/builder-fixtures.ts';

const index = new CardIndex(PACK);

describe('poolShortfall', () => {
  it('is zero for a fresh build and counts what a commit already took', () => {
    const pool = bigPool();
    const { deck } = buildDeck(
      { size: 40, colors: ['W'], settings: SETTINGS },
      pool,
      index,
      CONFIG,
    );
    expect(poolShortfall(pool, deck, SETTINGS, index, CONFIG)).toBe(0);
    // A pool holding exactly the deck: one commit empties it, a second would be short every card.
    const exact = {
      entries: Object.fromEntries(
        deck.cards.map((c) => [c.cardId, { cardId: c.cardId, qty: c.qty }]),
      ),
      updatedAt: pool.updatedAt,
    };
    expect(poolShortfall(exact, deck, SETTINGS, index, CONFIG)).toBe(0);
    const after = commitDeck(exact, deck, SETTINGS, index, CONFIG, '2026-01-01T00:00:00Z').pool;
    const spells = deck.cards.reduce((n, c) => n + c.qty, 0);
    expect(poolShortfall(after, deck, SETTINGS, index, CONFIG)).toBe(spells);
  });

  it('counts basics only when basics are tracked', () => {
    const pool = bigPool();
    const tracked = { ...SETTINGS, unlimitedBasics: false };
    const { deck } = buildDeck({ size: 40, colors: ['W'], settings: tracked }, pool, index, CONFIG);
    const noPlains = { ...pool, entries: { ...pool.entries } };
    delete noPlains.entries['plains'];
    const basics = deck.basics.W ?? 0;
    expect(basics).toBeGreaterThan(0);
    expect(poolShortfall(noPlains, deck, tracked, index, CONFIG)).toBe(basics);
    expect(poolShortfall(noPlains, deck, SETTINGS, index, CONFIG)).toBe(0);
  });
});
