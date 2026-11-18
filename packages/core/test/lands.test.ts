import { describe, expect, it } from 'vitest';
import { buildDeck, landNote } from '../src/builder.ts';
import { landHasUse } from '../src/card-needs.ts';
import { computeFacts, type Candidate } from '../src/candidates.ts';
import { sourcesNeeded } from '../src/colors.ts';
import { configVersion, validateConfig } from '../src/config.ts';
import { commitDeck } from '../src/decks.ts';
import {
  chooseManaBase,
  colorWants,
  landColors,
  landEntry,
  lifePerTap,
  scoreNonbasic,
  type ColorPlan,
  type LandDeck,
} from '../src/lands.ts';
import { CardIndex } from '../src/pack.ts';
import { replaceCard, replacementOptions } from '../src/replace.ts';
import type { CardRecord, Color, Deck, DeckSize, Pool, Settings } from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';
import { LAND, land } from './land-cards.ts';
import { needsCard } from './needs-cards.ts';

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
    'Eumidian Hatchery',
    'Paliano, the High City',
    // Tapped half the time here, and its rider needs a creature card in a graveyard this deck lacks.
    "Witch's Cottage",
  ];

  it('plays no land worse than a Swamp in mono-black 60', () => {
    const mana = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index);
    const names = picked(mana);
    for (const n of bad) expect(names[n]).toBeUndefined();
    // Each does something; on a tie the one that enters untapped more often goes first, and
    // the cap of 9 nonbasics (40% of 24) leaves one place for Dakmor Salvage.
    expect(names).toEqual({ 'Castle Locthwain': 4, 'Realm of Koh': 4, 'Dakmor Salvage': 1 });
    const nonbasic = mana.nonbasics.reduce((n, p) => n + p.qty, 0);
    expect(mana.basics.B).toBe(24 - nonbasic);
  });

  it('takes an always-tapped land for what it does, but not one that only picks a color', () => {
    // Entering tapped costs nothing in one color: Bojuka Bog is in on its graveyard exile.
    expect(CONFIG.landRules.nonbasic.entersTapped).toBe(0);
    const bog = chooseManaBase(
      24,
      [cand(land('Bojuka Bog'))],
      plan('B'),
      [],
      CONFIG,
      SETTINGS,
      60,
      index,
    );
    expect(picked(bog)).toEqual({ 'Bojuka Bog': 4 });
    expect(bog.nonbasics[0]!.why).toMatch(/enters tapped, utility/);
    // A Gate's second color, a chosen color, Tarnation Vista's one color, and a storage
    // land's counters are only mana: no better than a Swamp.
    const mana = ['Black Dragon Gate', 'Shimmerdrift Vale', 'Tarnation Vista', 'Bottomless Vault'];
    for (const n of mana) expect(landHasUse(land(n), CONFIG), n).toBe(false);
    const pool = mana.map((n) => cand(land(n)));
    expect(picked(chooseManaBase(24, pool, plan('B'), [], CONFIG, SETTINGS, 60, index))).toEqual(
      {},
    );
  });

  it('takes Realm of Koh: sometimes tapped, but its Spirit tokens beat a Swamp', () => {
    // On its own utility, in any deck: the Evasion rules count no token makers (docs/todo.md).
    const koh = [cand(land('Realm of Koh'))];
    for (const styles of [[], ['flyers']]) {
      const mana = chooseManaBase(24, koh, plan('B'), [], CONFIG, SETTINGS, 60, index, styles);
      expect(picked(mana)).toEqual({ 'Realm of Koh': 4 });
      expect(mana.nonbasics[0]!.why).toMatch(/utility/);
    }
  });

  it('puts Dakmor Salvage first for a Graveyard plan', () => {
    const mana = chooseManaBase(24, owner, plan('B'), [], CONFIG, SETTINGS, 60, index, [
      'graveyard',
    ]);
    const names = picked(mana);
    // Its dredge helps the plan (2.0) and beats the other lands' utility (1.0).
    expect(names).toEqual({ 'Dakmor Salvage': 4, 'Castle Locthwain': 4, 'Realm of Koh': 1 });
    const why = mana.nonbasics.find((p) => p.candidate.facts.card.name === 'Dakmor Salvage')!.why;
    expect(why).toMatch(/helps the plan/);
  });

  it('takes a few colorless lands, only for the plan, and no fetch land', () => {
    const lands = [
      "Rogue's Passage",
      'Access Tunnel',
      'Mystifying Maze',
      'Evolving Wilds',
      'Jund Panorama',
      'Ash Barrens',
    ].map((n) => cand(land(n)));
    const at = (size: DeckSize, count: number) =>
      picked(
        chooseManaBase(count, lands, plan('B'), [], CONFIG, SETTINGS, size, index, ['flyers']),
      );
    // Both unblockable lands help Evasion; Rogue's Passage is the more played.
    expect(at(60, 24)).toEqual({ "Rogue's Passage": 2 });
    expect(at(40, 17)).toEqual({ "Rogue's Passage": 1 });
    expect(at(20, 8)).toEqual({});
    // Commander holds one of each; Mystifying Maze does nothing for Evasion's plan.
    const singles = lands.map((c) => cand(c.facts.card, 1));
    const commander = chooseManaBase(37, singles, plan('B'), [], CONFIG, SETTINGS, 100, index, [
      'flyers',
    ]);
    expect(picked(commander)).toEqual({ "Rogue's Passage": 1, 'Access Tunnel': 1 });
    // Without a plan a colorless land costs a source of the deck color for nothing.
    const none = chooseManaBase(24, lands, plan('B'), [], CONFIG, SETTINGS, 60, index);
    expect(picked(none)).toEqual({});
    // A creature land is part of a Midrange plan.
    const factory = chooseManaBase(
      24,
      [cand(land('Mutavault'))],
      plan('B'),
      [],
      CONFIG,
      SETTINGS,
      60,
      index,
      ['midrange'],
    );
    expect(picked(factory)).toEqual({ Mutavault: 2 });
  });

  it('reads no ability in text that only makes mana, keeps the land safe, or costs it', () => {
    const none = [
      // Charge counters for colored mana, Indestructible, lands that bounce themselves.
      "Mirrodin's Core",
      'Darksteel Citadel',
      'Undiscovered Paradise',
      'Oboro, Palace in the Clouds',
      // Rainbow lands whose extra text is their own mana, or a cost.
      'Gemstone Mine',
      'Aether Hub',
      'Rainbow Vale',
      'Tendo Ice Bridge',
      'Meteor Crater',
      'Rhystic Cave',
      'Gemstone Caverns',
      // No maximum hand size matters in Commander, not in 60 cards.
      'Reliquary Tower',
      // Fetching a land is making mana.
      'Evolving Wilds',
      'Jund Panorama',
      'Ash Barrens',
      'Fabled Passage',
      // Fetching a Plains when it dies, making every land a Swamp, charging a Planet whose
      // station ability is mana.
      'Flagstones of Trokair',
      'Urborg, Tomb of Yawgmoth',
      'Uthros, Titanic Godcore',
    ];
    for (const n of none) expect(landHasUse(land(n), CONFIG), n).toBe(false);
    const some = [
      'Realm of Koh',
      'Castle Locthwain',
      'Dakmor Salvage',
      "Rogue's Passage",
      'Mystifying Maze',
      'Mutavault',
      'Treetop Village',
    ];
    for (const n of some) expect(landHasUse(land(n), CONFIG), n).toBe(true);
    // Scored in its own color, Oboro is no better than an Island.
    expect(scoreNonbasic(land('Oboro, Palace in the Clouds'), ['U'], CONFIG, 60).score).toBe(0);
  });

  it('takes a creature land for a creature plan, colored ones too', () => {
    // A 3/3 trampler is Aggro's plan; in any deck it is still a utility land.
    const village = [cand(land('Treetop Village'))];
    const aggro = chooseManaBase(24, village, plan('G'), [], CONFIG, SETTINGS, 60, index, [
      'aggro',
    ]);
    expect(picked(aggro)).toEqual({ 'Treetop Village': 4 });
    expect(aggro.nonbasics[0]!.why).toMatch(/helps the plan/);
    const none = chooseManaBase(24, village, plan('G'), [], CONFIG, SETTINGS, 60, index);
    expect(none.nonbasics[0]!.why).toMatch(/utility/);
  });

  it('takes an artifact land for an Artifacts plan by its type alone', () => {
    const lands = [cand(land('Vault of Whispers')), cand(land('Darksteel Citadel'))];
    const artifacts = chooseManaBase(24, lands, plan('B'), [], CONFIG, SETTINGS, 60, index, [
      'artifacts',
    ]);
    // Darksteel Citadel is colorless, so the cap of 2 holds it.
    expect(picked(artifacts)).toEqual({ 'Vault of Whispers': 4, 'Darksteel Citadel': 2 });
    expect(picked(chooseManaBase(24, lands, plan('B'), [], CONFIG, SETTINGS, 60, index))).toEqual(
      {},
    );
  });

  it('gives no plan credit to off-color abilities or a one-time surveil on entering', () => {
    // All carry mill-self; only Dakmor Salvage's dredge works in mono-black every turn. The
    // Unicomplex is in on its own utility: untapped from the third land, with a surveil rider.
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
    expect(picked(mana)).toEqual({ 'Dakmor Salvage': 4, 'The Unicomplex': 4 });
    const why = (n: string) => mana.nonbasics.find((p) => p.candidate.facts.card.name === n)!.why;
    expect(why('Dakmor Salvage')).toMatch(/helps the plan/);
    expect(why('The Unicomplex')).not.toMatch(/helps the plan/);
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

describe('colorWants', () => {
  // Pack spells: Typhoid Rats {B}, Cast Down and Walking Corpse {1}{B}, Murder {1}{B}{B},
  // Swords to Plowshares {W}, Glorious Anthem {1}{W}{W}.
  const copies = (name: string, qty: number) => ({
    facts: computeFacts(needsCard(name), CONFIG),
    qty,
  });
  const black = [
    copies('Typhoid Rats', 4),
    copies('Cast Down', 4),
    copies('Walking Corpse', 4),
    copies('Murder', 2),
  ];
  const white = [copies('Swords to Plowshares', 1), copies('Glorious Anthem', 1)];
  const cover = (n: number) => {
    const c = JSON.parse(JSON.stringify(CONFIG)) as typeof CONFIG;
    c.landRules.colors.sourceCover['60'] = n;
    return c;
  };

  it('covers the size share of a color copies, so a few demanding spells do not set the want', () => {
    expect(CONFIG.landRules.colors.sourceCover['60']).toBe(0.8);
    const want = colorWants([...black, ...white], plan('B', 'W'), 60, 24, CONFIG);
    // 12 of the 14 black copies ask one pip by turn 2 or 1 and cover 80%; the two Murders,
    // two pips on turn 3, may wait a turn. At 90% and 24 of 60: 15 for one pip on turn 1, 17 for Murder.
    expect(want.B).toBe(sourcesNeeded(60, 24, 1, 1, 0.9));
    expect(want.B).toBe(15);
    expect(colorWants(black, plan('B', 'W'), 60, 24, cover(1)).B).toBe(17);
  });

  it('keeps the most demanding card of a light color, and every land in one color', () => {
    // Two white copies: covering 80% of them covers both, so Glorious Anthem sets the want.
    const want = colorWants([...black, ...white], plan('B', 'W'), 60, 24, CONFIG);
    expect(want.W).toBe(sourcesNeeded(60, 24, 2, 3, 0.85));
    expect(want.W).toBeGreaterThan(sourcesNeeded(60, 24, 1, 1, 0.85));
    expect(colorWants(black, plan('B'), 60, 24, CONFIG)).toEqual({ B: 24 });
  });

  it('gives basics to the want first, so a deck that can meet every want is not stretched', () => {
    // Black: 8 one-pip two-drops and 2 Murders want 13 (17 with Murder); white: 4 Pacifism want 11.
    const spells = [
      copies('Cast Down', 4),
      copies('Walking Corpse', 4),
      copies('Murder', 2),
      copies('Pacifism', 4),
    ];
    const mana = chooseManaBase(24, [], plan('B', 'W'), spells, CONFIG, SETTINGS, 60, index);
    expect(mana.wanted).toEqual({ B: 13, W: 11 });
    expect(mana.basics).toEqual({ B: 13, W: 11 });
    expect(mana.notes.some((n) => n.includes('stretched'))).toBe(false);
    const strict = chooseManaBase(24, [], plan('B', 'W'), spells, cover(1), SETTINGS, 60, index);
    expect(strict.wanted).toEqual({ B: 17, W: 11 });
    expect(strict.notes.some((n) => n.includes('stretched'))).toBe(true);
  });

  it('gives basics past the want to what every copy needs, before colored pips', () => {
    // Black: 4 Cast Down and one Murder; white: 12 one-pip two-drops, so white has twice
    // black's pips. At 26 lands the wants are 13 and 11, and Murder asks 18 sources: the two
    // basics left go to black (by pips alone they would go to white, 13 and 13).
    const spells = [
      copies('Cast Down', 4),
      copies('Murder', 1),
      copies('Pacifism', 4),
      copies('Luminarch Aspirant', 4),
      copies('Ainok Bond-Kin', 4),
    ];
    const mana = chooseManaBase(26, [], plan('B', 'W'), spells, CONFIG, SETTINGS, 60, index);
    expect(mana.wanted).toEqual({ B: 13, W: 11 });
    expect(colorWants(spells, plan('B', 'W'), 60, 26, CONFIG, 1)).toEqual({ B: 18, W: 11 });
    expect(mana.basics).toEqual({ B: 15, W: 11 });
  });

  it('lists basics in the order the split gave before the want was fitted', () => {
    // Two Forum of Amity make both colors. Against the wants (13 and 11) black is furthest
    // short first; against every copy (13, and 16 for Glorious Anthem) white is.
    const spells = [
      copies('Cast Down', 4),
      copies('Walking Corpse', 4),
      copies('Pacifism', 4),
      copies('Glorious Anthem', 1),
    ];
    const lands = [cand(land('Forum of Amity'), 2)];
    const mana = chooseManaBase(24, lands, plan('B', 'W'), spells, CONFIG, SETTINGS, 60, index);
    const strict = chooseManaBase(24, lands, plan('B', 'W'), spells, cover(1), SETTINGS, 60, index);
    expect(picked(mana)).toEqual({ 'Forum of Amity': 2 });
    expect(mana.wanted).toEqual({ B: 13, W: 11 });
    expect(strict.wanted).toEqual({ B: 13, W: 16 });
    expect(Object.keys(strict.basics)).toEqual(['W', 'B']);
    expect(Object.keys(mana.basics)).toEqual(['W', 'B']);
    expect(mana.basics).toEqual({ W: 11, B: 11 });
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
    broken.landRules.colors.sourceCover['40'] = 0;
    const problems = validateConfig(broken);
    expect(problems).toContain('landRules.colors.sourceCover.40: must be above 0 and at most 1');
    expect(problems).toContain('landRules.mono.minScore: must be above 0');
    expect(problems).toContain('landRules.mono.planTags: unknown style "nope"');
    expect(problems).toContain('landRules.entering.basicInPlay: must be a chance between 0 and 1');
    expect(validateConfig(CONFIG)).toEqual([]);
  });
});
