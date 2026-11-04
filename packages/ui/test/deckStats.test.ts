import { describe, expect, it } from 'vitest';
import { buildDeck, CardIndex, pipDemand } from '@bulk-brew/core';
import { deckColorShares, deckTypeCounts } from '../src/data/deckStats.ts';
import { deckGroups } from '../src/data/deckGroups.ts';
import {
  bigPool,
  CONFIG_BUNDLE as CONFIG,
  PACK,
  SETTINGS,
} from '../../core/test/builder-fixtures.ts';

const index = new CardIndex(PACK);
const { deck } = buildDeck(
  { size: 40, colors: ['W'], settings: SETTINGS },
  bigPool(),
  index,
  CONFIG,
);

describe('deck stats', () => {
  it('counts every copy once under its type, basics as lands', () => {
    const types = deckTypeCounts(deck, index);
    expect(types.reduce((n, t) => n + t.count, 0)).toBe(deck.size);
    // The list on the deck page shows the same groups with the same counts.
    expect(deckGroups(deck, index, CONFIG).map((g) => [g.label, g.count])).toEqual(
      types.map((t) => [t.label, t.count]),
    );
  });

  it('puts a commander in a group of its own, first', () => {
    const lead = deck.cards.find((c) => index.get(c.cardId)!.types.includes('creature'))!;
    const groups = deckGroups({ ...deck, commander: lead.cardId }, index, CONFIG);
    expect(groups[0]).toMatchObject({ label: 'Commander', count: lead.qty });
    expect(groups[0]!.rows.map((r) => r.key)).toEqual([lead.cardId]);
    const creatures = (g: typeof groups) => g.find((x) => x.label === 'Creatures')?.count ?? 0;
    expect(creatures(groups)).toBe(creatures(deckGroups(deck, index, CONFIG)) - lead.qty);
  });

  it('shares the colored symbols of the spells, adding up to one', () => {
    const shares = deckColorShares(deck, index);
    let pips = 0;
    for (const dc of deck.cards) {
      const card = index.get(dc.cardId)!;
      if (card.types.includes('land')) continue;
      pips += (pipDemand(card, ['W']).W ?? 0) * dc.qty;
    }
    expect(shares).toEqual([{ color: 'W', pips, share: 1 }]);
  });
});
