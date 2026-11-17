import { describe, expect, it } from 'vitest';
import shippedTags from '../../../config/display-tags.json';
import { styleCounts } from '../src/builder.ts';
import { computeFacts } from '../src/candidates.ts';
import {
  deckCredits,
  deckRoleCounts,
  reasonEarned,
  supplyOfDeck,
  swapSupply,
} from '../src/deck-credits.ts';
import { displayTagsFor, type DisplayTagsConfig } from '../src/display-tags.ts';
import { CardIndex } from '../src/pack.ts';
import { replaceCard, replacementOptions } from '../src/replace.ts';
import type { BuildExplanation, Color, Deck, Pool, Settings } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { NEEDS_CARD, needsCard } from './needs-cards.ts';

const TAGS = shippedTags as unknown as DisplayTagsConfig;
const index = new CardIndex({
  schema: 2,
  version: '2026-11-03',
  builtAt: '2026-11-03T00:00:00Z',
  cardCount: Object.keys(NEEDS_CARD).length,
  cards: Object.values(NEEDS_CARD),
});
const SETTINGS: Settings = {
  maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
  unlimitedBasics: true,
  includeUnsets: false,
  showArt: false,
};

type Cards = [string, number][];

/** A plain mono-black 60: no Elves, Dragons, Nobles, Lessons, counters plan, or lifegain plan. */
const MONO_BLACK: Cards = [
  ['Walking Corpse', 4],
  ['Typhoid Rats', 4],
  ['Vampire Interloper', 4],
  ['Okiba-Gang Shinobi', 4],
  ['Ravenous Chupacabra', 2],
  ['Murder', 2],
  ['Cast Down', 2],
  ['Mind Rot', 2],
  ['Duress', 2],
];

/** Six copies that put counters on creatures: enough for a 60 (five) with one to spare. */
const COUNTERS: Cards = [
  ['Luminarch Aspirant', 4],
  ['Hunger of the Howlpack', 2],
];

const ROLES = { cardAdvantage: 'Card advantage', evasiveThreat: 'Evasive threat' };

function deckOf(cards: Cards, colors: Color[] = ['B'], archetype = 'midrange'): Deck {
  return {
    id: 'test',
    name: 'Test',
    size: 60,
    color: colors[0]!,
    ...(colors.length > 1 ? { colors } : {}),
    archetype,
    cards: cards.map(([name, qty]) => ({ cardId: needsCard(name).id, qty })),
    basics: { B: 24 },
    committed: false,
    createdAt: '',
    configVersion: '',
    dataVersion: '',
  };
}

const yathan = needsCard('Yathan Tombguard');
const noCounters = deckOf([...MONO_BLACK, ['Yathan Tombguard', 2]]);
const withCounters = deckOf([...MONO_BLACK, ...COUNTERS, ['Yathan Tombguard', 2]], ['B', 'W', 'G']);

const tagIds = (deck?: Deck) => {
  const credits = deck ? deckCredits(deck, index, CONFIG) : undefined;
  return displayTagsFor(
    yathan,
    computeFacts(yathan, CONFIG),
    TAGS,
    CONFIG,
    credits ? { earned: (c) => credits.earned(yathan, c), size: 60 } : undefined,
  ).map((t) => t.id);
};

describe('deckCredits', () => {
  it('in a mono-black 60 with no counters, Yathan Tombguard earns no card advantage', () => {
    const credits = deckCredits(noCounters, index, CONFIG);
    expect(computeFacts(yathan, CONFIG).roles).toContain('cardAdvantage');
    expect(credits.earned(yathan, 'cardAdvantage')).toBe(false);
    expect(credits.earned(yathan, 'evasiveThreat')).toBe(true);
    // Its Draw tag comes from the role, so it goes; Evasion stays.
    expect(tagIds(noCounters)).not.toContain('draw');
    expect(tagIds(noCounters)).toContain('evasion');
    // Outside a deck every tag shows.
    expect(tagIds()).toContain('draw');
  });

  it('in a deck with counters it does', () => {
    expect(deckCredits(withCounters, index, CONFIG).earned(yathan, 'cardAdvantage')).toBe(true);
    expect(tagIds(withCounters)).toContain('draw');
  });

  it('is computed once per deck object', () => {
    const a = deckCredits(noCounters, index, CONFIG);
    expect(deckCredits(noCounters, index, CONFIG)).toBe(a);
    expect(deckCredits({ ...noCounters }, index, CONFIG)).not.toBe(a);
  });

  it('counts the colors of the basics a deck runs', () => {
    const deck = { ...noCounters, basics: { B: 20, G: 4 } };
    expect(supplyOfDeck(deck, index, CONFIG).colors.sort()).toEqual(['B', 'G']);
  });

  it('swaps copies on a copy of the supply', () => {
    const before = supplyOfDeck(withCounters, index, CONFIG);
    const counters = before.counts.get('counters:any');
    const hunger = needsCard('Hunger of the Howlpack');
    const after = swapSupply(before, hunger, 2, needsCard("Night's Whisper"), 2, CONFIG);
    expect(before.counts.get('counters:any')).toBe(counters);
    expect(after.counts.get('counters:any')).toBe(counters! - 2);
    expect(after.counts.get('lifeloss')).toBe((before.counts.get('lifeloss') ?? 0) + 2);
  });

  it('counts a theme payoff on the Roles bars only when the deck supplies it', () => {
    // Yathan Tombguard pays off counters on creatures.
    expect(computeFacts(yathan, CONFIG).payoffOf).toContain('counters');
    const payoffs = (cards: Cards, colors: Color[]) =>
      styleCounts(deckOf(cards, colors, 'counters'), index, CONFIG)[0]!.payoffs.have;
    expect(payoffs([...MONO_BLACK, ['Yathan Tombguard', 2]], ['B'])).toBe(0);
    expect(payoffs([...MONO_BLACK, ...COUNTERS, ['Yathan Tombguard', 2]], ['B', 'W', 'G'])).toBe(2);
  });
});

describe('Replace with deck-aware jobs', () => {
  const pool: Pool = {
    entries: Object.fromEntries(
      Object.values(NEEDS_CARD).map((c) => [c.id, { cardId: c.id, qty: 4 }]),
    ),
    updatedAt: '2026-11-03T00:00:00Z',
  };
  const options = (deck: Deck, out: string) =>
    replacementOptions(deck, needsCard(out).id, pool, index, CONFIG, SETTINGS)!;
  const optionFor = (deck: Deck, out: string, name: string) =>
    options(deck, out).options.find((o) => o.card.name === name)!;
  const labels = (jobs: { label: string }[]) => jobs.map((j) => j.label);

  it('gives the card going out only the jobs it earns in the deck now', () => {
    expect(labels(options(noCounters, 'Yathan Tombguard').jobs)).toEqual([ROLES.evasiveThreat]);
    expect(labels(options(withCounters, 'Yathan Tombguard').jobs)).toEqual([
      ROLES.cardAdvantage,
      ROLES.evasiveThreat,
    ]);
  });

  it('gives an option only the jobs it earns in the deck after the swap', () => {
    const black = deckOf([...MONO_BLACK, ["Night's Whisper", 2]]);
    const yathanIn = optionFor(black, "Night's Whisper", 'Yathan Tombguard');
    expect(labels(yathanIn.shared)).toEqual([]);
    expect(labels(yathanIn.added)).toEqual([ROLES.evasiveThreat]);
    // A card that draws without a condition shares the job and ranks above it.
    const ranked = options(black, "Night's Whisper").options.map((o) => o.card.name);
    expect(labels(optionFor(black, "Night's Whisper", 'Gruesome Realization').shared)).toEqual([
      ROLES.cardAdvantage,
    ]);
    expect(ranked.indexOf('Gruesome Realization')).toBeLessThan(ranked.indexOf('Yathan Tombguard'));

    const counters = deckOf([...MONO_BLACK, ...COUNTERS, ["Night's Whisper", 2]], ['B', 'W', 'G']);
    expect(labels(optionFor(counters, "Night's Whisper", 'Yathan Tombguard').shared)).toEqual([
      ROLES.cardAdvantage,
    ]);
    // Taking out two of the six counters leaves four, short of the five a 60 needs.
    const short = optionFor(counters, 'Hunger of the Howlpack', 'Yathan Tombguard');
    expect([...labels(short.shared), ...labels(short.added)]).not.toContain(ROLES.cardAdvantage);
  });

  it("keeps the builder's role count in the explanation; the Roles bars count what is earned", () => {
    // The builder counts every copy with the role: Night's Whisper and Yathan Tombguard
    // for card advantage, Vampire Interloper and Yathan for evasive threats.
    const explanation: BuildExplanation = {
      archetype: 'midrange',
      curve: [0, 4, 8, 6, 2, 2, 0, 0],
      roles: {
        cardAdvantage: { have: 4, want: 4 },
        evasiveThreat: { have: 6, want: 4 },
      },
      lands: { count: 24, averageMv: 2.4, cheapManaSources: 0, nonbasics: 0 },
      synergies: [],
      notes: [],
    };
    const before = {
      ...deckOf([...MONO_BLACK, ["Night's Whisper", 2], ['Yathan Tombguard', 2]]),
      explanation,
    };
    expect(deckRoleCounts(before, index, CONFIG)).toEqual({
      cardAdvantage: { have: 2, want: 4 },
      evasiveThreat: { have: 6, want: 4 },
    });
    // Yathan goes out for Gruesome Realization: the plain role change, two out and two in.
    const after = replaceCard(
      before,
      yathan.id,
      needsCard('Gruesome Realization').id,
      2,
      index,
      CONFIG,
    );
    expect(after.explanation!.roles).toEqual({
      cardAdvantage: { have: 4, want: 4 },
      evasiveThreat: { have: 4, want: 4 },
    });
    expect(deckRoleCounts(after, index, CONFIG)).toEqual({
      cardAdvantage: { have: 4, want: 4 },
      evasiveThreat: { have: 4, want: 4 },
    });
    // With counters in the deck, Yathan draws and counts.
    const counters = {
      ...deckOf(
        [...MONO_BLACK, ...COUNTERS, ["Night's Whisper", 2], ['Yathan Tombguard', 2]],
        ['B', 'W', 'G'],
      ),
      explanation,
    };
    expect(deckRoleCounts(counters, index, CONFIG).cardAdvantage).toEqual({ have: 4, want: 4 });
    const { explanation: _dropped, ...unexplained } = before;
    expect(deckRoleCounts(unexplained, index, CONFIG)).toEqual({});
  });
});

describe('reasonEarned', () => {
  const holds = (why: string, deck: Deck) =>
    reasonEarned(why, yathan, deck, deckCredits(deck, index, CONFIG), CONFIG);
  const countersPlan = (cards: Cards, colors: Color[]) => deckOf(cards, colors, 'counters');

  it('drops a role or theme reason the deck does not earn', () => {
    const deck = countersPlan([...MONO_BLACK, ['Yathan Tombguard', 2]], ['B']);
    expect(holds('Card advantage', deck)).toBe(false);
    expect(holds('+1/+1 counters payoff', deck)).toBe(false);
    expect(holds('Payoff: counters on creatures', deck)).toBe(false);
    expect(holds('Evasive threat', deck)).toBe(true);
  });

  it('keeps it when the deck supplies the need', () => {
    const deck = countersPlan(
      [...MONO_BLACK, ...COUNTERS, ['Yathan Tombguard', 2]],
      ['B', 'W', 'G'],
    );
    expect(holds('Card advantage', deck)).toBe(true);
    expect(holds('+1/+1 counters payoff', deck)).toBe(true);
    expect(holds('Payoff: counters on creatures', deck)).toBe(true);
  });

  it('keeps every reason that names no credit', () => {
    const deck = countersPlan([...MONO_BLACK, ['Yathan Tombguard', 2]], ['B']);
    for (const why of ['Curve: 3-drop', 'Filler', 'Swapped in for Murder', 'Elf tribe payoff'])
      expect(holds(why, deck)).toBe(true);
  });
});
