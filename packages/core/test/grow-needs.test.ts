import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/builder.ts';
import { listCandidates, factsFor } from '../src/candidates.ts';
import {
  cardSupport,
  creditEarned,
  deckSupply,
  effectiveManaValue,
  themeCredit,
  themeOwnResources,
  type DeckSupply,
} from '../src/card-needs.ts';
import { supplyOfDeck, unsupportedCards } from '../src/deck-credits.ts';
import { growContext, growViability } from '../src/grow.ts';
import { scanPool } from '../src/scan.ts';
import { cardStrength } from '../src/strength.ts';
import { landColors, landEntry, scoreNonbasic } from '../src/lands.ts';
import { CardIndex } from '../src/pack.ts';
import type { BuildRequest, CardRecord, Color, Deck, DeckSize, Pool } from '../src/types.ts';
import { SETTINGS } from './builder-fixtures.ts';
import { CONFIG } from './config.test.ts';
import { land } from './land-cards.ts';
import { needsCard } from './needs-cards.ts';

// The grow builder against the card needs reader (docs/builder-phase2.md, step
// 2), on pack records copied verbatim: a mono-black pool with no Elves,
// Dragons, Nobles, Lessons, counters plan, or lifegain plan, plus the cards
// the brief's table names.

const BLACK = [
  'Walking Corpse',
  'Typhoid Rats',
  'Vampire Interloper',
  'Okiba-Gang Shinobi',
  'Ravenous Chupacabra',
  'Murder',
  'Cast Down',
  'Mind Rot',
  'Duress',
  'Gravedigger',
  'Feed the Swarm',
];
const TABLE = [
  'Lo and Li, Twin Tutors',
  'Yathan Tombguard',
  'Dawnhand Eulogist',
  'Tragedy Feaster',
  'Starlit Soothsayer',
  'Shilgengar, Sire of Famine',
  'Caustic Exhale',
];

function poolOf(names: readonly string[], lands: readonly string[] = [], qty = 4) {
  const cards: CardRecord[] = [
    ...names.map(needsCard),
    ...lands.map((n) => (n === 'Great Arashin City' ? needsCard(n) : land(n))),
  ];
  const index = new CardIndex({
    schema: 2,
    version: 'test',
    builtAt: 'test',
    cardCount: cards.length,
    cards,
  });
  const pool: Pool = { entries: {}, updatedAt: 'test' };
  for (const c of cards) pool.entries[c.id] = { cardId: c.id, qty };
  return { index, pool };
}

const BLACK_POOL = poolOf([...BLACK, ...TABLE], ['Great Arashin City', 'Swamp']);

function request(style: string, colors: Color[] = ['B'], size: DeckSize = 60): BuildRequest {
  return { size, colors, settings: SETTINGS, id: 't', createdAt: 't', style, requireStyle: true };
}

function build(f: { index: CardIndex; pool: Pool }, style: string, colors: Color[] = ['B']) {
  return buildDeck(request(style, colors), f.pool, f.index, CONFIG).deck;
}

const copies = (deck: Deck, name: string) =>
  deck.cards.find((c) => c.cardId === needsCard(name).id)?.qty ?? 0;
const why = (deck: Deck, name: string) =>
  deck.cards.find((c) => c.cardId === needsCard(name).id)?.why;

describe('grow builder: credits hold only where the deck supplies their needs', () => {
  const decks = ['aggro', 'midrange', 'control'].map((s) => build(BLACK_POOL, s));

  it('builds with the grow builder and leaves no unsupported card', () => {
    for (const deck of decks) {
      expect(deck.explanation!.builder).toBe('grow');
      expect(unsupportedCards(deck, BLACK_POOL.index, CONFIG)).toEqual([]);
    }
  });

  it('counts Card advantage only on cards whose draw works here, by their text', () => {
    // Of this pool, Shilgengar's Blood tokens and Yathan Tombguard's draw carry the role; by
    // their text the Blood needs only another creature, the draw a creature with a counter.
    for (const deck of decks)
      expect(deck.explanation!.roles['cardAdvantage']!.have).toBe(
        copies(deck, 'Shilgengar, Sire of Famine'),
      );
  });

  it('leaves out Lo and Li, whose every ability needs Nobles or Lessons', () => {
    for (const deck of decks) expect(copies(deck, 'Lo and Li, Twin Tutors')).toBe(0);
  });

  it('leaves out Tragedy Feaster, whose drawback the deck cannot meet without lifegain', () => {
    for (const deck of decks) expect(copies(deck, 'Tragedy Feaster')).toBe(0);
  });

  it('holds Tragedy Feaster to its drawback: unsupported here, supported with lifegain', () => {
    const feaster = needsCard('Tragedy Feaster');
    for (const deck of decks)
      expect(cardSupport(feaster, supplyOfDeck(deck, BLACK_POOL.index, CONFIG), CONFIG)?.kind).toBe(
        'drawback',
      );
    // Vampire Nighthawk and Child of Night have lifelink.
    const lifelink = deckSupply(
      {
        cards: [
          { card: needsCard('Vampire Nighthawk'), qty: 4 },
          { card: needsCard('Child of Night'), qty: 4 },
          { card: feaster, qty: 1 },
        ],
        colors: ['B'],
        size: 60,
      },
      CONFIG,
    );
    expect(cardSupport(feaster, lifelink, CONFIG)).toBeUndefined();
  });

  it('never plays Yathan Tombguard for Card advantage without counters', () => {
    const tombguard = needsCard('Yathan Tombguard');
    for (const deck of decks) {
      expect(why(deck, 'Yathan Tombguard')).not.toBe('Card advantage');
      const supply = supplyOfDeck(deck, BLACK_POOL.index, CONFIG);
      expect(creditEarned(tombguard, 'cardAdvantage', supply, CONFIG)).toBe(false);
      // Its body still earns what a body earns.
      expect(creditEarned(tombguard, 'evasiveThreat', supply, CONFIG)).toBe(true);
    }
  });

  it('keeps Dawnhand Eulogist a body without its drain, and Great Arashin City out', () => {
    const eulogist = needsCard('Dawnhand Eulogist');
    for (const deck of decks) {
      const supply = supplyOfDeck(deck, BLACK_POOL.index, CONFIG);
      expect(creditEarned(eulogist, themeCredit('lifegain', 'setup'), supply, CONFIG)).toBe(false);
      expect(why(deck, 'Dawnhand Eulogist') ?? '').not.toMatch(/^(?:Setup|Payoff): /);
      expect(copies(deck, 'Great Arashin City')).toBe(0);
    }
  });

  it('prices Caustic Exhale at two mana without a Dragon, and its curve slot follows', () => {
    const exhale = needsCard('Caustic Exhale');
    for (const deck of decks) {
      const supply = supplyOfDeck(deck, BLACK_POOL.index, CONFIG);
      expect(effectiveManaValue(exhale, supply, CONFIG)).toBe(2);
      const w = why(deck, 'Caustic Exhale');
      if (w?.startsWith('Curve: ')) expect(w).toBe('Curve: 2-drop');
    }
  });

  it('is deterministic', () => {
    const again = ['aggro', 'midrange', 'control'].map((s) => build(BLACK_POOL, s));
    expect(again).toEqual(decks);
  });
});

describe('grow builder: the reverse cases', () => {
  // A small black pool with creatures that bring their own +1/+1 counters, so most of it plays.
  const COUNTERS = poolOf(
    [
      'Walking Corpse',
      'Typhoid Rats',
      'Murder',
      'Cast Down',
      'Duress',
      'Mind Rot',
      'Yathan Tombguard',
      'Festercreep',
      'Disowned Ancestor',
      'Ambitious Aetherborn',
    ],
    ['Swamp'],
  );

  it('counts Yathan Tombguard for Card advantage in a deck that supplies counters', () => {
    const deck = build(COUNTERS, 'midrange');
    // By their text Festercreep enters with a +1/+1 counter, Disowned Ancestor's outlast
    // and Ambitious Aetherborn's fabricate put one: five or more copies supply counters.
    const makers =
      copies(deck, 'Festercreep') +
      copies(deck, 'Disowned Ancestor') +
      copies(deck, 'Ambitious Aetherborn');
    expect(makers).toBeGreaterThanOrEqual(5);
    // Of this pool only Tombguard draws, so the role count is its copies.
    expect(copies(deck, 'Yathan Tombguard')).toBeGreaterThan(0);
    expect(deck.explanation!.roles['cardAdvantage']!.have).toBe(copies(deck, 'Yathan Tombguard'));
  });

  it('keeps Dawnhand Eulogist its drain in a deck with Elves', () => {
    const elves = ['Llanowar Elves', 'Elvish Mystic', 'Elvish Visionary', 'Elvish Archdruid'];
    const supply: DeckSupply = deckSupply(
      {
        cards: [
          ...elves.map((n) => ({ card: needsCard(n), qty: 4 })),
          { card: needsCard('Dawnhand Eulogist'), qty: 1 },
        ],
        colors: ['B', 'G'],
        size: 60,
      },
      CONFIG,
    );
    expect(
      creditEarned(
        needsCard('Dawnhand Eulogist'),
        themeCredit('lifegain', 'setup'),
        supply,
        CONFIG,
      ),
    ).toBe(true);
  });
});

describe('the scan and the commander: a theme card counts only where the pool can pay for it', () => {
  it('drops a payoff whose needs no deck from the pool could meet', () => {
    // Lo and Li is lifegain setup only for Nobles and Lessons: no pool here has them.
    const f = poolOf([...BLACK, 'Lo and Li, Twin Tutors']);
    const cands = listCandidates(f.pool, f.index, CONFIG, SETTINGS, ['B'], 60);
    const without = poolOf(BLACK);
    const plain = listCandidates(without.pool, without.index, CONFIG, SETTINGS, ['B'], 60);
    expect(growViability(cands, CONFIG, 60, undefined, ['B']).lifegain).toEqual(
      growViability(plain, CONFIG, 60, undefined, ['B']).lifegain,
    );
  });

  it("counts a commander's own job only when the pool meets its needs", () => {
    const f = poolOf(BLACK);
    const cands = listCandidates(f.pool, f.index, CONFIG, SETTINGS, ['B'], 100);
    const lead = poolOf(['Lo and Li, Twin Tutors']);
    const facts = factsFor(lead.index, CONFIG, needsCard('Lo and Li, Twin Tutors'));
    expect(growViability(cands, CONFIG, 100, facts, ['B']).lifegain).toEqual(
      growViability(cands, CONFIG, 100, undefined, ['B']).lifegain,
    );
  });
});

describe('land utility holds only when the deck earns the ability', () => {
  it('scores Trenzalore Clocktower like a basic without a Time Lord', () => {
    const tower = land('Trenzalore Clocktower');
    const plain = scoreNonbasic(tower, ['U'], CONFIG, 60, []);
    expect(plain.why).not.toMatch(/utility|helps the plan/);
    expect(plain.score).toBeLessThan(CONFIG.landRules.mono.minScore);
  });
});

describe("the brief's table, from the cards' text", () => {
  const mono = (more: [string, number][] = []) =>
    deckSupply(
      {
        cards: [
          ...BLACK.map((n) => ({ card: needsCard(n), qty: 3 })),
          ...more.map(([n, qty]) => ({ card: needsCard(n), qty })),
        ],
        colors: ['B'],
        size: 60,
      },
      CONFIG,
    );

  it('Starlit Soothsayer: an evasive attacker whose rider life loss meets as well', () => {
    const starlit = needsCard('Starlit Soothsayer');
    const rider = themeCredit('lifegain', 'payoff');
    // Flying earns it as a body in any deck.
    expect(creditEarned(starlit, 'evasiveThreat', mono(), CONFIG)).toBe(true);
    // "If you gained or lost life this turn": no lifegain or life loss here, then
    // Night's Whisper ("you draw two cards and lose 2 life") as the life loss.
    expect(creditEarned(starlit, rider, mono(), CONFIG)).toBe(false);
    expect(creditEarned(starlit, rider, mono([["Night's Whisper", 4]]), CONFIG)).toBe(true);
  });

  it('Shilgengar: an evasive threat whose Angel text is only a bonus', () => {
    const shilgengar = needsCard('Shilgengar, Sire of Famine');
    for (const credit of ['finisher', 'evasiveThreat', 'cardAdvantage'])
      expect(creditEarned(shilgengar, credit, mono(), CONFIG)).toBe(true);
  });
});

describe('grow builder: strength the pool pays for', () => {
  const tombguardValue = (f: { index: CardIndex; pool: Pool }) =>
    growContext(request('midrange'), f.pool, f.index, CONFIG).cards.find(
      (c) => c.id === needsCard('Yathan Tombguard').id,
    )!.value;

  it("drops Yathan Tombguard's card advantage where the pool has no counters, keeps it where it has", () => {
    const tombguard = needsCard('Yathan Tombguard');
    const full = cardStrength(tombguard, CONFIG.cardStrength).score;
    const without = cardStrength(
      tombguard,
      CONFIG.cardStrength,
      new Set(['repeatable card advantage']),
    ).score;
    expect(without).toBeLessThan(full);
    expect(tombguardValue(BLACK_POOL)).toBeCloseTo(without);
    const counters = poolOf([...BLACK, 'Yathan Tombguard', 'Festercreep', 'Disowned Ancestor']);
    expect(tombguardValue(counters)).toBeCloseTo(full);
  });

  it('prices an "or pay" card at its mana in mana for strength and the curve', () => {
    const ctx = growContext(request('midrange'), BLACK_POOL.pool, BLACK_POOL.index, CONFIG);
    const exhale = needsCard('Caustic Exhale');
    const c = ctx.cards.find((x) => x.id === exhale.id)!;
    expect(c.slot).toBe(2);
    expect(c.value).toBeCloseTo(cardStrength({ ...exhale, mv: 2 }, CONFIG.cardStrength).score);
    expect(c.value).toBeLessThan(cardStrength(exhale, CONFIG.cardStrength).score);
  });
});

describe("theme resources: what a theme's floors guarantee", () => {
  it('takes only resources the setup floors supply as met', () => {
    expect([...themeOwnResources(CONFIG, 'lifegain')]).toContain('lifegain');
    expect([...themeOwnResources(CONFIG, 'tokens')]).toContain('tokens');
    // Evasion's setup is any evasive attacker and Voltron's any Aura or Equipment: neither guarantees a flyer or an Equipment.
    expect([...themeOwnResources(CONFIG, 'flyers')]).toEqual([]);
    expect([...themeOwnResources(CONFIG, 'auras')]).toEqual([]);
    expect([...themeOwnResources(CONFIG, 'enchantments')]).not.toContain('subtype:Aura');
  });
});

describe('the finished-deck check holds the floors to what the deck earns', () => {
  // White Auras and Equipment payoffs, but no Equipment: by their text Puresteel Paladin
  // and Armament Master pay off only Equipment, Kor Spiritdancer Auras.
  const AURAS = poolOf(
    [
      'Puresteel Paladin',
      'Armament Master',
      'Kor Spiritdancer',
      'Ethereal Armor',
      'Spectra Ward',
      "Sentinel's Eyes",
      'Cartouche of Solidarity',
      "Gryff's Boon",
      'Hyena Umbra',
      'Feather of Flight',
      'Thraben Inspector',
      'Savannah Lions',
      'Elite Vanguard',
      'Pacifism',
      'Swords to Plowshares',
      'Glorious Anthem',
    ],
    ['Plains'],
  );

  it('calls Voltron short in the scan and in the build, never "minimums met"', () => {
    const scan = scanPool(AURAS.pool, AURAS.index, CONFIG, SETTINGS, 60, ['W']);
    expect(scan.archetypes.find((a) => a.archetype === 'auras')!.rules!.viable).toBe(false);
    const deck = build(AURAS, 'auras', ['W']);
    expect(deck.explanation!.nearest?.requested).toBe('auras');
    expect(deck.archetype).not.toBe('auras');
    expect(deck.explanation!.notes.some((n) => /Voltron minimums met/.test(n))).toBe(false);
    expect(why(deck, 'Puresteel Paladin') ?? '').not.toMatch(/^Payoff: /);
    expect(why(deck, 'Armament Master') ?? '').not.toMatch(/^Payoff: /);
  });

  it('keeps every grow deck at its size with no unsupported card', () => {
    for (const style of ['aggro', 'midrange', 'control']) {
      const deck = build(AURAS, style, ['W']);
      const total =
        deck.cards.reduce((n, c) => n + c.qty, 0) +
        Object.values(deck.basics).reduce((n, q) => n + (q ?? 0), 0);
      expect(total).toBe(60);
      expect(unsupportedCards(deck, AURAS.index, CONFIG)).toEqual([]);
    }
  });
});

describe('lands read by the card needs reader', () => {
  it('counts a basic-land dual for its colors: every deck plays a basic land', () => {
    expect(landColors(land('Hidden Lair'), ['U', 'B'], 60, CONFIG)).toEqual(['U', 'B']);
    expect(landColors(land('Hidden Lair'), ['B'], 60, CONFIG)).toEqual(['B']);
  });

  it('never lets a land meet its own entry condition', () => {
    // Argoth is a legendary land, not the legendary green creature it asks for.
    expect(
      landEntry(land('Argoth, Sanctum of Nature'), { colors: ['G'], size: 60 }, CONFIG),
    ).toEqual({ tapped: 1, life: 0 });
  });

  it("finds Arena of Glory's utility inside its mana ability, in one color and in two", () => {
    const arena = land('Arena of Glory');
    expect(scoreNonbasic(arena, ['R'], CONFIG, 60, []).why).toMatch(/utility/);
    expect(scoreNonbasic(arena, ['R', 'W'], CONFIG, 60, []).why).toMatch(/utility/);
  });
});
