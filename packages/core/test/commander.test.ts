import { describe, expect, it } from 'vitest';
import { BuildError, buildDeck } from '../src/builder.ts';
import { commanderCandidates } from '../src/commander.ts';
import { deckToDecklist } from '../src/export.ts';
import { canBeCommander, commanderCopies } from '../src/matchers.ts';
import { CardIndex } from '../src/pack.ts';
import type { CardRecord, DataPack, Pool } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { SETTINGS } from './builder-fixtures.ts';

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{W}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

describe('canBeCommander and commanderCopies', () => {
  it('follows the deck-building rules for commanders', () => {
    expect(canBeCommander(card({ id: 'a', name: 'A', typeLine: 'Legendary Creature — Elf' }))).toBe(
      true,
    );
    expect(canBeCommander(card({ id: 'b', name: 'B', typeLine: 'Creature — Elf' }))).toBe(false);
    expect(
      canBeCommander(
        card({ id: 'v', name: 'V', typeLine: 'Legendary Artifact — Vehicle', types: ['artifact'] }),
      ),
    ).toBe(true);
    expect(
      canBeCommander(
        card({
          id: 'p',
          name: 'P',
          typeLine: 'Legendary Planeswalker — Teyo',
          types: ['planeswalker'],
          text: 'Teyo can be your commander.',
        }),
      ),
    ).toBe(true);
    expect(
      canBeCommander(
        card({
          id: 'x',
          name: 'X',
          typeLine: 'Legendary Creature — Elf',
          commanderLegality: 'banned',
        }),
      ),
    ).toBe(false);
  });

  it('accepts a card that is a creature everywhere but the battlefield', () => {
    expect(
      canBeCommander(
        card({
          id: 'g',
          name: 'G',
          typeLine: 'Legendary Planeswalker — Grist',
          types: ['planeswalker'],
          text: "As long as G isn't on the battlefield, it's a 1/1 Insect creature in addition to its other types.",
        }),
      ),
    ).toBe(true);
  });

  it('allows extra copies only where the card says so', () => {
    expect(commanderCopies(card({ id: 'a', name: 'A' }))).toBe(1);
    expect(
      commanderCopies(
        card({ id: 'r', name: 'R', text: 'A deck can have any number of cards named R.' }),
      ),
    ).toBe(Infinity);
    expect(
      commanderCopies(
        card({ id: 's', name: 'S', text: 'A deck can have up to seven cards named S.' }),
      ),
    ).toBe(7);
  });
});

describe('Commander builds', () => {
  const cards: CardRecord[] = [];
  for (let i = 0; i < 90; i++) {
    const mv = (i % 6) + 1;
    cards.push(
      card({
        id: `w-${i}`,
        name: `White ${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        power: String(mv),
        toughness: String(mv),
        tags:
          i % 9 === 0
            ? ['removal-creature', 'removal']
            : i % 9 === 1
              ? ['draw-engine']
              : i % 9 === 2
                ? ['mana-rock']
                : [],
        types: i % 9 === 2 ? ['artifact'] : ['creature'],
        typeLine: i % 9 === 2 ? 'Artifact' : 'Creature — Human',
      }),
    );
  }
  const lead = card({
    id: 'lead',
    name: 'Lead, the Bright',
    typeLine: 'Legendary Creature — Human',
    mv: 3,
    manaCost: '{2}{W}',
  });
  const blue = card({
    id: 'blue',
    name: 'Blue One',
    colors: ['U'],
    identity: ['U'],
    manaCost: '{1}{U}',
  });
  const plains = card({
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    identity: ['W'],
    produces: ['W'],
  });
  const banned = card({
    id: 'banned',
    name: 'Banned One',
    commanderLegality: 'banned',
    tags: ['removal-creature', 'removal'],
  });
  const all = [...cards, lead, blue, plains, banned];
  const pack: DataPack = {
    schema: 2,
    version: 't',
    builtAt: 't',
    cardCount: all.length,
    cards: all,
  };
  const index = new CardIndex(pack);
  const pool: Pool = {
    entries: Object.fromEntries(
      [...cards, lead, blue, banned].map((c) => [c.id, { cardId: c.id, qty: 3 }]),
    ),
    updatedAt: 't',
  };
  const request = { size: 100 as const, colors: [], settings: SETTINGS, id: 't', createdAt: 't' };

  it('lists the commanders in the pool', () => {
    const list = commanderCandidates(pool, index, CONFIG, SETTINGS);
    expect(list.map((c) => c.id)).toEqual(['lead']);
    expect(list[0]!.colors).toEqual(['W']);
  });

  it('builds 100 cards, one copy each, in the commander colors, commander first', () => {
    const r = buildDeck({ ...request, commander: 'lead' }, pool, index, CONFIG);
    const total =
      r.deck.cards.reduce((n, c) => n + c.qty, 0) +
      Object.values(r.deck.basics).reduce((n, q) => n + (q ?? 0), 0);
    expect(total).toBe(100);
    expect(r.deck.commander).toBe('lead');
    expect(r.deck.cards[0]).toMatchObject({ cardId: 'lead', qty: 1, why: 'Commander' });
    expect(r.deck.cards.every((c) => c.qty === 1)).toBe(true);
    expect(r.deck.cards.some((c) => c.cardId === 'blue')).toBe(false);
    expect(r.deck.cards.some((c) => c.cardId === 'banned')).toBe(false);
    expect(r.deck.name.startsWith('Lead ')).toBe(true);
    expect(deckToDecklist(r.deck, index, CONFIG)).toMatch(
      /\/\/ Commander \(1\)\n1 Lead, the Bright/,
    );
  });

  it('leaves out commanders of an unchecked rarity', () => {
    const mythicLead = { ...lead, rarity: 'mythic' as const };
    const idx = new CardIndex({ ...pack, cards: [...cards, mythicLead, blue, plains, banned] });
    const commons = { ...SETTINGS, rarities: ['common' as const, 'uncommon' as const] };
    expect(commanderCandidates(pool, idx, CONFIG, commons)).toEqual([]);
    expect(() =>
      buildDeck({ ...request, commander: 'lead', settings: commons }, pool, idx, CONFIG),
    ).toThrow(/rarity left out/);
  });

  it('explains what is missing in plain words', () => {
    expect(() => buildDeck(request, pool, index, CONFIG)).toThrow(BuildError);
    expect(() => buildDeck({ ...request, commander: 'w-3' }, pool, index, CONFIG)).toThrow(
      /cannot be a commander/,
    );
  });
});
