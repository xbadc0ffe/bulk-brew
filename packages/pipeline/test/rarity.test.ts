import { describe, expect, it } from 'vitest';
import type { Rarity } from '@bulk-brew/core';
import { foldLowest } from '../src/rarity.ts';
import type { ScryfallCard } from '../src/scryfall.ts';

const printing = (rarity: string, games = ['paper'], extra: Partial<ScryfallCard> = {}) =>
  ({
    id: `p-${rarity}-${games.join()}`,
    oracle_id: 'o1',
    name: 'Card',
    layout: 'normal',
    color_identity: [],
    set: 'tst',
    rarity,
    games,
    ...extra,
  }) as ScryfallCard;

describe('foldLowest', () => {
  it('keeps the lowest paper rarity across printings', () => {
    const m = new Map<string, Rarity>();
    for (const p of [printing('mythic'), printing('uncommon'), printing('rare')]) foldLowest(m, p);
    expect(m.get('o1')).toBe('uncommon');
  });

  it('ignores digital-only and oversized printings', () => {
    const m = new Map<string, Rarity>();
    foldLowest(m, printing('rare'));
    foldLowest(m, printing('common', ['mtgo']));
    foldLowest(m, printing('common', ['paper'], { oversized: true }));
    expect(m.get('o1')).toBe('rare');
  });
});
