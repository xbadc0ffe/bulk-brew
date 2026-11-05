import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/builder.ts';
import {
  colorsLabel,
  identityWithin,
  pipDemand,
  playableWith,
  sourcesNeeded,
} from '../src/colors.ts';
import { landColors } from '../src/lands.ts';
import { CardIndex } from '../src/pack.ts';
import type { CardRecord, Color, DataPack, Pool } from '../src/types.ts';
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

describe('playableWith', () => {
  it('lets a hybrid card into a deck of either color', () => {
    const hybrid = card({
      id: 'h',
      name: 'H',
      manaCost: '{W/U}{W/U}',
      colors: ['W', 'U'],
      identity: ['W', 'U'],
    });
    expect(playableWith(hybrid, ['W'])).toBe(true);
    expect(playableWith(hybrid, ['U'])).toBe(true);
    expect(playableWith(hybrid, ['B'])).toBe(false);
    expect(identityWithin(hybrid, ['W'])).toBe(false);
  });

  it('needs every mana symbol in the rules text, not reminder text', () => {
    const regen = card({
      id: 'r',
      name: 'R',
      text: '{G}: Regenerate this creature.',
      identity: ['W', 'G'],
    });
    expect(playableWith(regen, ['W'])).toBe(false);
    expect(playableWith(regen, ['W', 'G'])).toBe(true);
    const reminder = card({
      id: 'm',
      name: 'M',
      text: 'Ward {2} (Whenever this becomes the target, counter it unless {U} is paid.)',
    });
    expect(playableWith(reminder, ['W'])).toBe(true);
  });

  it('keeps out a card whose outside color comes from no symbol', () => {
    const indicator = card({ id: 'i', name: 'I', manaCost: '', colors: ['U'], identity: ['U'] });
    expect(playableWith(indicator, ['W'])).toBe(false);
  });

  it('pays Phyrexian pips with life and refuses {C}', () => {
    expect(
      playableWith(card({ id: 'p', name: 'P', manaCost: '{1}{U/P}', identity: ['U'] }), ['W']),
    ).toBe(true);
    expect(
      playableWith(card({ id: 'c', name: 'C', manaCost: '{2}{C}', identity: [] }), ['W']),
    ).toBe(false);
  });
});

describe('produced mana and names', () => {
  it('treats mana a card makes as output, not a cost', () => {
    const rock = card({
      id: 'ms',
      name: 'Rock',
      manaCost: '{2}',
      colors: [],
      identity: [],
      types: ['artifact'],
      typeLine: 'Artifact',
      text: '{T}: Add {C}.\n{1}, {T}, Sacrifice this artifact: Draw a card.',
    });
    const spawner = card({
      id: 'sp',
      name: 'Spawner',
      manaCost: '{1}{G}',
      colors: ['G'],
      identity: ['G'],
      text: 'When this creature enters, create a 0/1 colorless Eldrazi Spawn creature token with "Sacrifice this token: Add {C}."',
    });
    expect(playableWith(rock, ['W'])).toBe(true);
    expect(playableWith(spawner, ['G'])).toBe(true);
  });

  it('does not take a card named Commander for a Commander-only card', async () => {
    const { needsCommander } = await import('../src/matchers.ts');
    expect(
      needsCommander(
        card({ id: 'bc', name: 'Benalish Commander', text: 'Benalish Commander gets +1/+1.' }),
      ),
    ).toBe(false);
    expect(
      needsCommander(
        card({
          id: 'ct',
          name: 'Tower',
          text: "{T}: Add one mana of any color in your commander's color identity.",
        }),
      ),
    ).toBe(true);
  });
});

describe('pipDemand and labels', () => {
  it('counts colored pips and sends hybrid pips to the preferred color', () => {
    expect(pipDemand(card({ id: 'a', name: 'A', manaCost: '{1}{W}{W}{U}' }), ['W', 'U'])).toEqual({
      W: 2,
      U: 1,
    });
    expect(pipDemand(card({ id: 'b', name: 'B', manaCost: '{W/U}' }), ['U', 'W'])).toEqual({
      U: 1,
    });
    expect(pipDemand(card({ id: 'c', name: 'C', manaCost: '{2/W}{B/P}' }), ['W', 'B'])).toEqual({});
  });

  it('names color sets plainly', () => {
    expect(colorsLabel(['U', 'W'])).toBe('White-Blue');
    expect(colorsLabel(['W', 'U', 'B', 'R'])).toBe('Four-color');
    expect(colorsLabel(['G', 'R', 'B', 'U', 'W'])).toBe('Five-color');
  });
});

describe('sourcesNeeded', () => {
  it('matches the probability table for 60-card and 40-card decks', () => {
    expect(sourcesNeeded(60, 24, 1, 2, 0.9)).toBe(13);
    expect(sourcesNeeded(60, 24, 2, 2, 0.9)).toBe(20);
    expect(sourcesNeeded(40, 17, 1, 2, 0.9)).toBe(9);
    expect(sourcesNeeded(40, 17, 2, 2, 0.9)).toBe(14);
  });

  it('never asks for more sources than lands', () => {
    expect(sourcesNeeded(40, 17, 3, 1, 0.99)).toBeLessThanOrEqual(17);
  });
});

describe('landColors', () => {
  const land = (partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>) =>
    card({
      manaCost: '',
      mv: 0,
      typeLine: 'Land',
      types: ['land'],
      colors: [],
      identity: [],
      ...partial,
    });

  it('reads basic land types, direct mana, and leaves out filter and restricted mana', () => {
    const shock = land({
      id: 's',
      name: 'S',
      typeLine: 'Land — Plains Island',
      text: '({T}: Add {W} or {U}.)',
      produces: ['W', 'U'],
    });
    const gain = land({
      id: 'g',
      name: 'G',
      text: 'This land enters tapped.\n{T}: Add {W} or {B}.',
      produces: ['W', 'B'],
    });
    const filter = land({
      id: 'f',
      name: 'F',
      text: '{T}: Add {C}.\n{1}, {T}: Add one mana of any color.',
      produces: ['C', 'W', 'U', 'B', 'R', 'G'],
    });
    const dragon = land({
      id: 'd',
      name: 'D',
      text: '{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Dragon spell.',
      produces: ['C', 'W', 'U', 'B', 'R', 'G'],
    });
    const deck: Color[] = ['W', 'U', 'B'];
    expect(landColors(shock, deck, 60)).toEqual(['W', 'U']);
    expect(landColors(gain, deck, 60)).toEqual(['W', 'B']);
    expect(landColors(filter, deck, 60)).toEqual([]);
    expect(landColors(dragon, deck, 60)).toEqual([]);
    const pairedFilter = land({
      id: 'pf',
      name: 'PF',
      text: '{T}: Add {C}.\n{1}, {T}: Add {G}{W}.',
      produces: ['C', 'G', 'W'],
    });
    expect(landColors(pairedFilter, ['G', 'W'], 60)).toEqual([]);
    const lotus = land({
      id: 'lf',
      name: 'LF',
      text: 'This land enters tapped.\n{T}: Add three mana of any one color.',
      produces: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(landColors(lotus, ['W'], 60)).toEqual(['W']);
  });

  it('counts fetch lands for the basics they find, and only in multi-color decks', () => {
    const wilds = land({
      id: 'w',
      name: 'W',
      text: '{T}, Sacrifice this land: Search your library for a basic land card.',
      tags: ['fetchland', 'tutor-land-basic'],
    });
    const courtyard = land({
      id: 'c',
      name: 'C',
      tags: ['tutor-land-basic', 'tutor-land-basic-plains', 'tutor-land-basic-forest'],
    });
    expect(landColors(wilds, ['W', 'U'], 60)).toEqual(['W', 'U']);
    expect(landColors(wilds, ['W'], 60)).toEqual([]);
    expect(landColors(courtyard, ['W', 'U'], 60)).toEqual(['W']);
  });

  it('gives Command Tower style lands nothing outside Commander', () => {
    const tower = land({
      id: 't',
      name: 'T',
      text: "{T}: Add one mana of any color in your commander's color identity.",
      produces: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(landColors(tower, ['W', 'U'], 60)).toEqual([]);
  });
});

describe('two-color builds', () => {
  const cards: CardRecord[] = [];
  for (const color of ['W', 'U'] as const) {
    for (let mv = 1; mv <= 5; mv++) {
      for (let i = 0; i < 4; i++) {
        cards.push(
          card({
            id: `${color}-${mv}-${i}`,
            name: `${color} Creature ${mv}-${i}`,
            mv,
            manaCost: `{${mv - 1}}{${color}}`,
            colors: [color],
            identity: [color],
            tags: i === 0 ? ['removal-creature', 'removal'] : i === 1 ? ['draw-engine'] : [],
          }),
        );
      }
    }
  }
  cards.push(
    card({
      id: 'plains',
      name: 'Plains',
      manaCost: '',
      mv: 0,
      typeLine: 'Basic Land — Plains',
      types: ['land'],
      colors: [],
      identity: ['W'],
      produces: ['W'],
    }),
    card({
      id: 'island',
      name: 'Island',
      manaCost: '',
      mv: 0,
      typeLine: 'Basic Land — Island',
      types: ['land'],
      colors: [],
      identity: ['U'],
      produces: ['U'],
    }),
    card({
      id: 'dual',
      name: 'Dual',
      manaCost: '',
      mv: 0,
      typeLine: 'Land',
      text: '{T}: Add {W} or {U}.',
      types: ['land'],
      colors: [],
      identity: ['W', 'U'],
      produces: ['W', 'U'],
    }),
  );
  const pack: DataPack = { schema: 2, version: 't', builtAt: 't', cardCount: cards.length, cards };
  const index = new CardIndex(pack);
  const pool: Pool = {
    entries: Object.fromEntries(
      cards
        .filter((c) => !c.typeLine.startsWith('Basic'))
        .map((c) => [c.id, { cardId: c.id, qty: 2 }]),
    ),
    updatedAt: 't',
  };

  it('uses both colors, splits basics between them, and stays deterministic', () => {
    const request = {
      size: 40 as const,
      colors: ['U', 'W'] as Color[],
      settings: SETTINGS,
      id: 't',
      createdAt: 't',
    };
    const a = buildDeck(request, pool, index, CONFIG);
    const b = buildDeck(request, pool, index, CONFIG);
    expect(a).toEqual(b);
    expect(a.deck.colors).toHaveLength(2);
    expect(a.deck.name.startsWith('White-Blue')).toBe(true);
    expect(a.deck.basics.W ?? 0).toBeGreaterThan(0);
    expect(a.deck.basics.U ?? 0).toBeGreaterThan(0);
    const colorsUsed = new Set(a.deck.cards.flatMap((c) => index.get(c.cardId)!.colors));
    expect(colorsUsed.has('W') && colorsUsed.has('U')).toBe(true);
    expect(a.explanation.notes.some((n) => n.startsWith('Colored sources'))).toBe(true);
    expect(a.explanation.lands.sources?.W).toBeGreaterThan(0);
  });

  it('takes a light color on merit and names the deck for the colors it uses', () => {
    const splash = card({
      id: 'splash',
      name: 'Splash Bolt',
      mv: 3,
      manaCost: '{2}{B}',
      colors: ['B'],
      identity: ['B'],
      types: ['instant'],
      typeLine: 'Instant',
      tags: ['removal-creature', 'removal'],
    });
    const swamp = card({
      id: 'swamp',
      name: 'Swamp',
      manaCost: '',
      mv: 0,
      typeLine: 'Basic Land — Swamp',
      types: ['land'],
      colors: [],
      identity: ['B'],
      produces: ['B'],
    });
    const extra = [...cards, splash, swamp];
    const withSplash = new CardIndex({ ...pack, cards: extra, cardCount: extra.length });
    const splashPool: Pool = {
      ...pool,
      entries: { ...pool.entries, splash: { cardId: 'splash', qty: 1 } },
    };
    const request = {
      size: 40 as const,
      colors: ['W', 'U', 'B'] as Color[],
      settings: SETTINGS,
      id: 't',
      createdAt: 't',
    };
    // One black card is below the per-color minimum, yet the three-color deck builds.
    const built = buildDeck(request, splashPool, withSplash, CONFIG);
    const used = new Set(built.deck.cards.flatMap((c) => withSplash.get(c.cardId)!.colors));
    expect(new Set(built.deck.colors)).toEqual(used);
    expect(built.deck.name.startsWith(used.has('B') ? 'White-Blue-Black' : 'White-Blue ')).toBe(
      true,
    );
    if (!used.has('B')) expect(built.deck.basics.B ?? 0).toBe(0);
    // In a pool with just enough spells, the splash card plays and the deck is named for it.
    const thin: Pool = {
      entries: Object.fromEntries(
        Object.keys(splashPool.entries)
          .filter((id) => id === 'splash' || id.endsWith('-0'))
          .map((id) => [id, { cardId: id, qty: 1 }]),
      ),
      updatedAt: 't',
    };
    expect(buildDeck({ ...request, size: 20 }, thin, withSplash, CONFIG).deck.colors).toContain(
      'B',
    );
    // A color with no cards at all still cannot join.
    expect(() =>
      buildDeck({ ...request, colors: ['W', 'U', 'R'] }, splashPool, withSplash, CONFIG),
    ).toThrow(/needs 1 more Red card/);
  });
});
