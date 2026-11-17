// The scan and the grow builder agree at 20 cards: a theme the scan calls
// viable can be built. A packet has few copies to give up when a theme card's
// needs must be fed, and the pool's supply counts only cards a deck can hold.

import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/builder.ts';
import { listCandidates } from '../src/candidates.ts';
import { growViability } from '../src/grow.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import type { Color, Pool } from '../src/types.ts';
import { CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';
import { PACKET_CARDS } from './packet-cards.ts';

const index = new CardIndex({ ...PACK, cardCount: PACKET_CARDS.length, cards: PACKET_CARDS });
const id = (name: string) => PACKET_CARDS.find((c) => c.name === name)!.id;
const poolOf = (cards: [string, number][]): Pool => ({
  entries: Object.fromEntries(cards.map(([name, qty]) => [id(name), { cardId: id(name), qty }])),
  updatedAt: 't',
});

describe('a theme the scan calls viable at 20 is built', () => {
  it('feeds a payoff from a role card when nothing else can go', () => {
    // Honored Dreyleader pays off artifacts only beside three Squirrels or Food; the pool's
    // three payoffs meet the floor exactly, so the packet must feed it from its 12 spells.
    const pool = poolOf([
      ['Masked Vandal', 5],
      ['Mirror of Life Trapping', 1],
      ['Honored Dreyleader', 1],
      ['Chief of the Foundry', 1],
      ['Tender Wildguide', 1],
      ['Howling Golem', 1],
      ['Scrap Compactor', 2],
      ['Stinging Shot', 2],
      ['Lifesmith', 1],
      ['Hulking Raptor', 1],
      ['Kapow!', 1],
      ['Necropede', 2],
      ["Geth's Grimoire", 1],
      ['Squirrel Sovereign', 2],
      ['Mirrorworks', 1],
    ]);
    const colors: Color[] = ['G'];
    const scan = scanPool(pool, index, CONFIG, SETTINGS, 20, colors);
    expect(scan.archetypes.find((a) => a.archetype === 'artifacts')!.rules).toMatchObject({
      viable: true,
      margin: 1,
    });
    const r = buildDeck(
      { size: 20, colors, settings: SETTINGS, style: 'artifacts', id: 't', createdAt: 't' },
      pool,
      index,
      CONFIG,
    );
    expect(r.deck.archetype).toBe('artifacts');
    expect(r.deck.cards.some((c) => c.cardId === id('Honored Dreyleader'))).toBe(true);
    expect(r.explanation.theme?.floors.find((f) => f.floor === 'payoff')).toMatchObject({
      have: 3,
      need: 3,
    });
  });

  it('counts no supply from a card no deck of the request can always hold', () => {
    // Ichormoon Gauntlet's proliferate is a +1/+1 counters payoff only beside two planeswalkers.
    // Kiora, Behemoth Beckoner earns its one credit only with big creatures, so a counters
    // packet may not hold it: the pool pays for the Gauntlet only with two of Ugin.
    const counters = (cards: [string, number][]) => {
      const cands = listCandidates(poolOf(cards), index, CONFIG, SETTINGS, ['U'], 20);
      const payoff = growViability(cands, CONFIG, 20, undefined, ['U']).counters!.floors.find(
        (f) => f.floor === 'payoff',
      );
      return payoff?.have;
    };
    const gauntlet: [string, number] = ['Ichormoon Gauntlet', 1];
    expect(counters([gauntlet, ['Ugin, the Ineffable', 1], ['Kiora, Behemoth Beckoner', 2]])).toBe(
      0,
    );
    expect(counters([gauntlet, ['Ugin, the Ineffable', 2]])).toBe(1);
  });
});
