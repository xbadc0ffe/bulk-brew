import { describe, expect, it } from 'vitest';
import { buildDeck, landNote } from '../src/builder.ts';
import { computeFacts, type Candidate } from '../src/candidates.ts';
import { configVersion, validateConfig } from '../src/config.ts';
import { commitDeck } from '../src/decks.ts';
import {
  chooseManaBase,
  landColors,
  landEntry,
  lifePerTap,
  type ColorPlan,
  type LandDeck,
} from '../src/lands.ts';
import { CardIndex } from '../src/pack.ts';
import { replaceCard, replacementOptions } from '../src/replace.ts';
import type { CardRecord, Color, Deck, DeckSize, Pool, Settings } from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';
import { LAND, land } from './land-cards.ts';

const index = new CardIndex({
  schema: 2,
  version: 't',
  builtAt: 't',
  cardCount: Object.keys(LAND).length,
  cards: Object.values(LAND),
});

const cand = (card: CardRecord, n = 4): Candidate => ({
  facts: computeFacts(card, CONFIG),
  available: n,
  preferred: n,
});

const plan = (...colors: Color[]): ColorPlan => ({
  colors,
  main: colors[0]!,
  role: Object.fromEntries(colors.map((c, i) => [c, i === 0 ? 'main' : 'secondary'])),
});

const entry = (name: string, colors: Color[], size: DeckSize = 60, styles?: string[]) =>
  landEntry(land(name), { colors, size, styles } satisfies LandDeck, CONFIG);

const picked = (mana: ReturnType<typeof chooseManaBase>) =>
  Object.fromEntries(mana.nonbasics.map((p) => [p.candidate.facts.card.name, p.qty]));

const TRACKED: Settings = { ...SETTINGS, unlimitedBasics: false };
const e = CONFIG.landRules.entering;
const played = e.landsPlayed['60'];

describe('landEntry', () => {
  it('reads "unless you control" a basic land type against the deck colors', () => {
    expect(entry('Great Arashin City', ['B']).tapped).toBe(1);
    expect(entry('Great Arashin City', ['B', 'G']).tapped).toBe(e.basicInPlay);
    expect(entry('Drowned Catacomb', ['U', 'B']).tapped).toBe(e.basicInPlay);
    expect(entry('Drowned Catacomb', ['W', 'R']).tapped).toBe(1);
    expect(entry('Castle Locthwain', ['B']).tapped).toBe(e.basicInPlay);
    expect(e.basicInPlay).toBeLessThanOrEqual(e.readsUntapped);
  });

  it('reads a basic land, land counts, and Commander conditions', () => {
    expect(entry('Realm of Koh', ['B']).tapped).toBe(e.basicInPlay);
    // Two or more other lands: tapped as the first or second land drop.
    expect(entry('Deserted Beach', ['W', 'U']).tapped).toBeCloseTo(2 / played);
    // Two or fewer other lands: tapped from the fourth land drop on.
    expect(entry('Blooming Marsh', ['B', 'G']).tapped).toBeCloseTo((played - 3) / played);
    // "If you control two or more other lands, this land enters tapped."
    expect(entry('Hive of the Eye Tyrant', ['B']).tapped).toBeCloseTo((played - 2) / played);
    expect(entry('Canopy Vista', ['G', 'W']).tapped).toBeCloseTo(2 / played);
    expect(entry("Witch's Cottage", ['B']).tapped).toBeCloseTo(3 / played);
    expect(entry("Witch's Cottage", ['W']).tapped).toBe(1);
    expect(entry('Luxury Suite', ['B', 'R'], 100).tapped).toBe(0);
    expect(entry('Luxury Suite', ['B', 'R'], 60).tapped).toBe(1);
  });

  it('reads life payments, reveals, plain tapped lands, and unknown conditions', () => {
    expect(entry('Blood Crypt', ['B', 'R'])).toEqual({ tapped: 0, life: 2 });
    expect(entry('Necroblossom Snarl', ['B', 'G']).tapped).toBe(e.revealFromHand);
    expect(entry('Necroblossom Snarl', ['U', 'R']).tapped).toBe(1);
    expect(entry('Uncharted Haven', ['B']).tapped).toBe(1);
    expect(entry('Dakmor Salvage', ['B'], 60, ['graveyard']).tapped).toBe(1);
    expect(entry('Dedicated Commons', ['R', 'W']).tapped).toBe(1);
    expect(entry('Swamp', ['B'])).toEqual({ tapped: 0, life: 0 });
  });
});

describe('land mana', () => {
  it('counts conditional mana only when the deck meets the condition', () => {
    expect(landColors(land('Gloomlake Verge'), ['U', 'B'], 60, CONFIG)).toEqual(['U', 'B']);
    expect(landColors(land('Gloomlake Verge'), ['B'], 60, CONFIG)).toEqual(['B']);
    expect(landColors(land('Tainted Field'), ['W'], 60, CONFIG)).toEqual([]);
    expect(landColors(land('Tainted Field'), ['W', 'B'], 60, CONFIG)).toEqual(['W', 'B']);
    // Any color only on the turn it entered is no steady source.
    expect(landColors(land('Mirrex'), ['B'], 60, CONFIG)).toEqual([]);
  });

  it('finds the life a land costs each time it taps for a deck color', () => {
    expect(lifePerTap(land('Eumidian Hatchery'), ['B'], CONFIG)).toBe(1);
    expect(lifePerTap(land('Castle Locthwain'), ['B'], CONFIG)).toBe(0);
    expect(lifePerTap(land('Blood Crypt'), ['B'], CONFIG)).toBe(0);
  });
});

describe('mono-color mana bases', () => {
  const owner = [
    'Great Arashin City',
    'Realm of Koh',
    'Uncharted Haven',
    'Command Bridge',
    'Dakmor Salvage',
    'Eumidian Hatchery',
    'Paliano, the High City',
    'Castle Locthwain',
    "Witch's Cottage",
  ].map((n) => cand(land(n)));
  const bad = [
    'Great Arashin City',
    'Uncharted Haven',
    'Command Bridge',
    'Dakmor Salvage',
    'Eumidian Hatchery',
    'Paliano, the High City',
    // A utility land, but tapped half the time here: utility counts only on a land that costs nothing.
    "Witch's Cottage",
  ];

  it('plays no land worse than a Swamp in mono-black 60', () => {
    const mana = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index);
    const names = picked(mana);
    for (const n of bad) expect(names[n]).toBeUndefined();
    expect(names['Castle Locthwain']).toBe(4);
    const nonbasic = mana.nonbasics.reduce((n, p) => n + p.qty, 0);
    expect(mana.basics.B).toBe(24 - nonbasic);
  });

  it('takes Dakmor Salvage only for a Graveyard plan', () => {
    // planUtility 2 outweighs entering tapped (1.5); nothing else changes.
    const m = CONFIG.landRules.mono;
    expect(m.planUtility + CONFIG.landRules.nonbasic.entersTapped).toBeGreaterThanOrEqual(
      m.minScore,
    );
    const mana = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index, [
      'graveyard',
    ]);
    const names = picked(mana);
    expect(names['Dakmor Salvage']).toBe(4);
    for (const n of bad.filter((x) => x !== 'Dakmor Salvage')) expect(names[n]).toBeUndefined();
  });

  it('gives no plan credit to off-color abilities or a one-time surveil on entering', () => {
    // All carry mill-self; only Dakmor Salvage's dredge works in mono-black every turn.
    const graveyard = [
      'Forum of Amity',
      'Restless Reef',
      "Titan's Grave",
      'Undercity Sewers',
      'The Unicomplex',
      'Dakmor Salvage',
    ].map((n) => cand(land(n)));
    const mana = chooseManaBase(24, graveyard, plan('B'), [], CONFIG, SETTINGS, 60, index, [
      'graveyard',
    ]);
    expect(picked(mana)).toEqual({ 'Dakmor Salvage': 4 });
    // Nor in mono-red, where the surveil lands make the deck color.
    const red = ['Elegant Parlor', 'Fields of Strife'].map((n) => cand(land(n)));
    const r = chooseManaBase(24, red, plan('R'), [], CONFIG, SETTINGS, 60, index, ['graveyard']);
    expect(picked(r)).toEqual({});
  });

  it('is deterministic', () => {
    const a = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index);
    const b = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index);
    expect(a).toEqual(b);
  });
});

describe('Paliano and draft-only lands', () => {
  const short = (colors: Color[]) => [
    ...colors.map((c) => cand(land(CONFIG.landRules.basics.names[c]), 6 / colors.length)),
    cand(land('Uncharted Haven'), 2),
    cand(land('Paliano, the High City'), 1),
  ];

  it('never enter a mana base, even when the fallback takes any land', () => {
    for (const colors of [['B'], ['W', 'B']] as Color[][]) {
      const mana = chooseManaBase(
        8,
        short(colors),
        plan(...colors),
        [],
        CONFIG,
        TRACKED,
        20,
        index,
      );
      expect(picked(mana)).toEqual({ 'Uncharted Haven': 2 });
      expect(Object.values(mana.basics).reduce((a, b) => a + (b ?? 0), 0)).toBe(6);
    }
  });
});

describe('two-color mana bases', () => {
  it('still take duals and rainbow lands, and read a check land of both colors as untapped', () => {
    const pool = [
      cand(land('Drowned Catacomb')),
      cand(land('Gloomlake Verge')),
      cand(land('Uncharted Haven'), 2),
      cand(land('Command Bridge'), 1),
    ];
    const mana = chooseManaBase(24, pool, plan('U', 'B'), [], CONFIG, SETTINGS, 60, index);
    expect(picked(mana)).toEqual({
      'Drowned Catacomb': 4,
      'Gloomlake Verge': 4,
      'Uncharted Haven': 2,
      'Command Bridge': 1,
    });
    const why = mana.nonbasics.find((p) => p.candidate.facts.card.name === 'Drowned Catacomb')!.why;
    expect(why).not.toMatch(/tapped/);
    const basics = (mana.basics.U ?? 0) + (mana.basics.B ?? 0);
    expect(mana.sources.U! + mana.sources.B!).toBe(2 * 11 + basics);
  });
});

describe('basics in Replace', () => {
  // The white fixture pool plus a pack land the mono-white builder takes, and a Swamp.
  const castle = land('Castle Ardenvale');
  const idx = new CardIndex({ ...PACK, cards: [...PACK.cards, castle, land('Swamp')] });
  const pool = (): Pool => {
    const p = bigPool();
    p.entries[castle.id] = { cardId: castle.id, qty: 2 };
    return p;
  };
  const build = (settings: Settings) =>
    buildDeck({ size: 60, colors: ['W'], settings }, pool(), idx, CONFIG).deck;
  const total = (d: Deck) =>
    d.cards.reduce((n, c) => n + c.qty, 0) +
    Object.values(d.basics).reduce((n, q) => n + (q ?? 0), 0);

  it('lists the basic first for a nonbasic land worse than or equal to it', () => {
    const deck = build(SETTINGS);
    expect(deck.cards.find((c) => c.cardId === castle.id)?.qty).toBe(2);
    const r = replacementOptions(deck, castle.id, pool(), idx, CONFIG, SETTINGS)!;
    expect(r.options[0]!.card.name).toBe('Plains');
    expect(r.options[0]!.qty).toBe(2);
  });

  it('swaps in the basic, keeping the size and land count', () => {
    const deck = build(SETTINGS);
    const e = deck.explanation!;
    const next = replaceCard(deck, castle.id, 'plains', 2, idx, CONFIG);
    expect(total(next)).toBe(60);
    expect(next.cards.some((c) => c.cardId === castle.id)).toBe(false);
    expect(next.basics.W).toBe(deck.basics.W! + 2);
    const ne = next.explanation!;
    expect(ne.lands.count).toBe(e.lands.count);
    expect(ne.lands.nonbasics).toBe(e.lands.nonbasics - 2);
    const { count, averageMv, cheapManaSources, nonbasics } = ne.lands;
    expect(ne.notes).toContain(landNote(count, averageMv, cheapManaSources, nonbasics));
    expect(ne.notes).toContain('2 Plains swapped in for Castle Ardenvale.');
    // A basic of a color the deck does not play cannot go in.
    expect(() => replaceCard(deck, castle.id, land('Swamp').id, 1, idx, CONFIG)).toThrow(
      'Swamp cannot be swapped in',
    );
  });

  it('offers only the spare basics when basics are tracked, and commits them', () => {
    const deck = build(TRACKED);
    const p = pool();
    p.entries.plains!.qty = deck.basics.W! + 1;
    const r = replacementOptions(deck, castle.id, p, idx, CONFIG, TRACKED)!;
    const basic = r.options.find((o) => o.card.id === 'plains')!;
    expect(basic.qty).toBe(1);
    p.entries.plains!.qty = deck.basics.W!;
    expect(
      replacementOptions(deck, castle.id, p, idx, CONFIG, TRACKED)!.options.map((o) => o.card.id),
    ).not.toContain('plains');
    p.entries.plains!.qty = deck.basics.W! + 1;
    const next = replaceCard(deck, castle.id, 'plains', basic.qty, idx, CONFIG);
    const after = commitDeck(p, next, TRACKED, idx, CONFIG, 't').pool;
    expect(after.entries.plains).toBeUndefined();
    expect(after.entries[castle.id]?.qty).toBe(1);
  });

  it('moves colored sources in a two-color deck', () => {
    const catacomb = land('Drowned Catacomb');
    const swamp = land('Swamp');
    const deck: Deck = {
      id: 'd',
      name: 'Blue-Black Control 60',
      size: 60,
      color: 'U',
      colors: ['U', 'B'],
      archetype: 'control',
      cards: [{ cardId: catacomb.id, qty: 4, why: 'Land: produces UB' }],
      basics: { U: 10, B: 10 },
      committed: false,
      createdAt: 't',
      configVersion: 'x',
      dataVersion: 't',
      explanation: {
        archetype: 'control',
        curve: [0, 0, 0, 0, 0, 0, 0, 0],
        roles: {},
        lands: {
          count: 24,
          averageMv: 3,
          cheapManaSources: 0,
          nonbasics: 4,
          sources: { U: 14, B: 14 },
        },
        synergies: [],
        notes: [landNote(24, 3, 0, 4), 'Colored sources: Blue 14, Black 14.'],
      },
    };
    const lands: Pool = {
      entries: { [catacomb.id]: { cardId: catacomb.id, qty: 4 } },
      updatedAt: 't',
    };
    const r = replacementOptions(deck, catacomb.id, lands, index, CONFIG, SETTINGS)!;
    expect(r.options.map((o) => o.card.name)).toEqual(['Island', 'Swamp']);
    const next = replaceCard(deck, catacomb.id, swamp.id, 4, index, CONFIG);
    expect(next.basics).toEqual({ U: 10, B: 14 });
    expect(next.cards).toEqual([]);
    expect(next.explanation!.lands.sources).toEqual({ U: 10, B: 14 });
    expect(next.explanation!.notes).toEqual([
      landNote(24, 3, 0, 0),
      'Colored sources: Blue 10, Black 14.',
      '4 Swamp swapped in for Drowned Catacomb.',
    ]);
  });
});

describe('land rules config', () => {
  it('records its version in the deck config version and checks the new keys', () => {
    expect(configVersion(CONFIG)).toContain(`.l${CONFIG.landRules.version}.`);
    const broken = JSON.parse(JSON.stringify(CONFIG)) as typeof CONFIG;
    broken.landRules.mono.minScore = 0;
    broken.landRules.mono.planTags = { nope: ['mill-self'] };
    broken.landRules.entering.basicInPlay = 2;
    const problems = validateConfig(broken);
    expect(problems).toContain('landRules.mono.minScore: must be above 0');
    expect(problems).toContain('landRules.mono.planTags: unknown style "nope"');
    expect(problems).toContain('landRules.entering.basicInPlay: must be a chance between 0 and 1');
    expect(validateConfig(CONFIG)).toEqual([]);
  });
});
