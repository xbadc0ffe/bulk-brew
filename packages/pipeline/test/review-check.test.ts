import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CardIndex, type CardRecord, type Color, type Settings } from '@bulk-brew/core';
import { loadConfigDir } from '../src/check-config.ts';
import { ROOT } from '../src/review/card-facts.ts';
import {
  checkDeck,
  checkLegality,
  flagsFor,
  globToRegExp,
  median,
  type CheckContext,
  type FlagInputs,
} from '../src/review/check.ts';
import {
  compileThemeRules,
  countTheme,
  EXAMPLE_THEME_RULES,
  matchCard,
  type ThemeFloor,
  type ThemeRulesFile,
} from '../src/review/theme-rules.ts';
import type { ReviewDeck, ReviewSize } from '../src/review/version.ts';

const CONFIG = loadConfigDir(path.join(ROOT, 'config'));
const SETTINGS = JSON.parse(
  readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
) as Settings;

let n = 0;
function card(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Zombie',
    text: '',
    colors: ['B'],
    identity: ['B'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{B}',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

describe('theme rules', () => {
  const rules = compileThemeRules(EXAMPLE_THEME_RULES);
  const gy = rules.styles.get('graveyard')!;

  it('counts a card meeting setup and payoff once, by the higher best weight', () => {
    // Loot (weight 2) beats "counts the graveyard" (1.5): setup.
    const looter = card({
      name: 'Looter',
      tags: ['loot'],
      text: '{T}: Draw a card, then discard a card.\nThis gets +1/+1 for each card in your graveyard.',
    });
    expect(matchCard(looter, gy)).toMatchObject({ as: 'setup', weight: 2, dual: true });
    // Self-mill (1) loses to "counts the graveyard" (1.5): payoff.
    const grower = card({
      name: 'Grower',
      tags: ['mill-self'],
      text: 'When this enters, mill two cards.\nThis gets +1/+1 for each card in your graveyard.',
    });
    expect(matchCard(grower, gy)).toMatchObject({ as: 'payoff', weight: 1.5, dual: true });
  });

  it('gives a tie between setup and payoff to payoff', () => {
    const style = compileThemeRules({
      version: 't',
      styles: {
        x: {
          resource: 'r',
          setup: [{ job: 's', weight: 1, anyTags: ['a'] }],
          payoff: [{ job: 'p', weight: 1, anyTags: ['a'] }],
        },
      },
    } satisfies ThemeRulesFile).styles.get('x')!;
    expect(matchCard(card({ name: 'Tie', tags: ['a'] }), style)?.as).toBe('payoff');
  });

  it('reads text as a case-insensitive regular expression without reminder text', () => {
    const counter = card({ name: 'Counter', text: 'Draw a card For Each Card in your graveyard.' });
    expect(matchCard(counter, gy)?.as).toBe('payoff');
    const reminder = card({ name: 'Reminder', text: 'Flying (for each card in your graveyard)' });
    expect(matchCard(reminder, gy)).toBeUndefined();
    // A loot tag without a tap ability misses the text condition of the loot job.
    const oneShot = card({
      name: 'One shot',
      tags: ['loot'],
      text: 'Draw two cards, then discard a card.',
    });
    expect(matchCard(oneShot, gy)).toBeUndefined();
  });

  it('excludes false friends from both jobs and counts them', () => {
    const rider = card({
      name: 'Rider',
      tags: ['mill-self'],
      // As the pack writes it: reminder text removed leaves a trailing space, which is trimmed.
      text: 'Destroy target creature.\nSurveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
    });
    expect(matchCard(rider, gy)).toEqual({ as: 'excluded', job: 'one-off surveil rider' });
    const miller = card({
      name: 'Miller',
      tags: ['mill-self'],
      text: 'Surveil 2. (Look at the top two cards of your library.)',
    });
    expect(matchCard(miller, gy)?.as).toBe('setup');
    const count = countTheme(
      [
        { card: rider, qty: 3 },
        { card: miller, qty: 2 },
      ],
      gy,
    );
    expect(count.excludedCopies).toBe(3);
    expect(count.setupCopies).toBe(2);
  });

  it('weighs copies, marks repeatable setup, and gives setup per payoff copy', () => {
    const looter = card({
      name: 'Tap looter',
      tags: ['loot'],
      text: '{T}: Draw a card, then discard a card.',
    });
    const miller = card({ name: 'Self miller', tags: ['mill-self'], text: 'Mill three cards.' });
    const reanimator = card({
      name: 'Raise',
      tags: ['reanimate'],
      text: 'Return target creature card.',
    });
    const count = countTheme(
      [
        { card: looter, qty: 2 },
        { card: miller, qty: 3 },
        { card: reanimator, qty: 2 },
        { card: card({ name: 'Bear' }), qty: 4 },
      ],
      gy,
    );
    expect(count).toMatchObject({
      setupCopies: 5,
      setupWeighted: 7,
      repeatableSetupCopies: 2,
      payoffCopies: 2,
      payoffWeighted: 2,
      dualResolved: 0,
      ratio: 3.5,
    });
    expect(countTheme([{ card: miller, qty: 1 }], gy).ratio).toBeNull();
  });

  it('rejects a malformed file with every problem named', () => {
    expect(() =>
      compileThemeRules({
        version: '1',
        notes: 'x',
        styles: {
          x: {
            resource: 'r',
            setup: [{ job: 's', anyTags: ['a'] }],
            payoff: [
              { job: 'p', weight: 1, notText: 'x' },
              { job: 'q', weight: 1, text: '(' },
            ],
            exclude: [{ job: 'e', anytags: ['a'] }],
          },
        },
      }),
    ).toThrow(
      /unknown top-level key "notes".*setup\[0\]: "weight".*payoff\[0\]: give at least one.*payoff\[1\] text: bad regular.*exclude\[0\]: unknown key "anytags"/,
    );
  });
});

const SWAMP = card({
  name: 'Swamp',
  typeLine: 'Basic Land — Swamp',
  types: ['land'],
  manaCost: '',
  mv: 0,
  colors: [],
  identity: ['B'],
  text: '({T}: Add {B}.)',
  produces: ['B'],
});
const ZOMBIE = card({ name: 'Zombie' });
const GOBLIN = card({ name: 'Goblin', colors: ['R'], identity: ['R'], manaCost: '{1}{R}' });
const HYBRID = card({
  name: 'Hybrid',
  colors: ['B', 'R'],
  identity: ['B', 'R'],
  manaCost: '{B/R}{B/R}',
});
const RATS = card({ name: 'Rats', text: 'A deck can have any number of cards named Rats.' });
const SILLY = card({ name: 'Silly', unset: true });
const BANNED = card({ name: 'Banned', commanderLegality: 'banned' });
const LEADER = card({
  name: 'Leader',
  typeLine: 'Legendary Creature — Elf',
  colors: ['B', 'G'],
  identity: ['B', 'G'],
  manaCost: '{B}{G}',
});
const ELF = card({ name: 'Elf', colors: ['G'], identity: ['G'], manaCost: '{G}' });
function dual(name: string, identity: Color[]): CardRecord {
  return card({
    name,
    typeLine: 'Land',
    types: ['land'],
    manaCost: '',
    mv: 0,
    colors: [],
    identity,
    text: `{T}, Pay 1 life: Add {${identity[0]}} or {${identity[1]}}.`,
    produces: identity,
  });
}
const PEATLAND = dual('Peatland', ['B', 'G']);
const TUNDRA = dual('Tundra', ['W', 'U']);

const INDEX = new CardIndex({
  schema: 2,
  version: 'test',
  builtAt: 'test',
  cardCount: 11,
  cards: [SWAMP, ZOMBIE, GOBLIN, HYBRID, RATS, SILLY, BANNED, LEADER, ELF, PEATLAND, TUNDRA],
});
const CTX: CheckContext = {
  index: INDEX,
  config: CONFIG,
  settings: SETTINGS,
  medianStrength: 4,
  themes: null,
};

function deck(
  size: ReviewSize,
  colors: Color[],
  cards: [CardRecord, number][],
  basics: Partial<Record<Color, number>>,
  commander?: CardRecord,
): ReviewDeck {
  return {
    version: 'test',
    pool: { id: 'p', source: 'p.txt', hash: '00000000', cards: 0 },
    request: { size, colors, seed: 1, ...(commander ? { commander: commander.id } : {}) },
    deck: {
      name: 'd',
      archetype: 'midrange',
      ...(commander ? { commander: commander.id } : {}),
      cards: cards.map(([c, qty]) => ({ id: c.id, name: c.name, qty })),
      basics,
    },
    buildMs: 10,
    builtAt: 't',
    dataVersion: 'test.s2',
  };
}

describe('legality', () => {
  it('passes a legal 60-card deck, with hybrid cards castable and card text allowing more copies', () => {
    const d = deck(
      60,
      ['B'],
      [
        [ZOMBIE, 4],
        [HYBRID, 4],
        [RATS, 12],
      ],
      { B: 40 },
    );
    const l = checkLegality(d, CTX);
    expect(l).toMatchObject({ total: 60, sizeOk: true, copyLimit: 4, overLimit: [], offColor: [] });
    expect(l.identityOutside).toEqual(['Hybrid']);
    expect(l.illegal).toEqual([]);
    expect(checkDeck(d, CTX, { file: 'f', stamp: 's', determinism: null }).flags).not.toContain(
      'colors',
    );
  });

  it('finds the wrong size, extra copies, off-color cards and basics, and Un-sets', () => {
    const d = deck(
      60,
      ['B'],
      [
        [ZOMBIE, 5],
        [GOBLIN, 1],
        [SILLY, 1],
      ],
      { B: 50, R: 2 },
    );
    const l = checkLegality(d, CTX);
    expect(l.total).toBe(59);
    expect(l.sizeOk).toBe(false);
    expect(l.overLimit).toEqual([{ name: 'Zombie', qty: 5, limit: 4 }]);
    expect(l.offColor).toEqual(['Goblin', '2 Mountain']);
    expect(l.illegal).toEqual([{ name: 'Silly', why: 'Un-set card' }]);
    const flags = checkDeck(d, CTX, { file: 'f', stamp: 's', determinism: null }).flags;
    expect(flags).toEqual(expect.arrayContaining(['size', 'copies', 'colors', 'illegal-card']));
  });

  it("checks colors against the deck's own, and the request's in files without them", () => {
    // A best fit asked for BR that built mono-black: a red card is off its colors.
    const d = deck(
      60,
      ['B', 'R'],
      [
        [ZOMBIE, 4],
        [GOBLIN, 1],
      ],
      { B: 55 },
    );
    expect(checkLegality(d, CTX).offColor).toEqual([]);
    d.deck.colors = ['B'];
    expect(checkLegality(d, CTX).offColor).toEqual(['Goblin']);
  });

  it('allows lands of any requested color in a deck that dropped one, and no others', () => {
    // A BG request built as mono-black keeps a B/G dual land: legal. A W/U one is not.
    const d = deck(
      60,
      ['B', 'G'],
      [
        [ZOMBIE, 4],
        [PEATLAND, 4],
      ],
      { B: 52 },
    );
    d.deck.colors = ['B'];
    const l = checkLegality(d, CTX);
    expect(l).toMatchObject({ allowed: ['B'], allowedLands: ['B', 'G'], offColor: [] });
    expect(l.identityOutside).toEqual([]);
    expect(checkDeck(d, CTX, { file: 'f', stamp: 's', determinism: null }).flags).not.toContain(
      'colors',
    );
    d.deck.cards.push({ id: TUNDRA.id, name: TUNDRA.name, qty: 1 });
    d.deck.basics = { B: 51 };
    expect(checkLegality(d, CTX).offColor).toEqual(['Tundra']);
    expect(checkDeck(d, CTX, { file: 'f', stamp: 's', determinism: null }).flags).toContain(
      'colors',
    );
  });

  it('holds a Commander deck to singleton, the commander identity, and Commander legality', () => {
    const d = deck(
      100,
      ['B', 'G'],
      [
        [LEADER, 1],
        [ELF, 2],
        [HYBRID, 1],
        [BANNED, 1],
        [RATS, 30],
      ],
      { B: 35, G: 30 },
      LEADER,
    );
    const l = checkLegality(d, CTX);
    expect(l.colorRule).toBe('identity');
    expect(l.total).toBe(100);
    expect(l.overLimit).toEqual([{ name: 'Elf', qty: 2, limit: 1 }]);
    expect(l.offColor).toEqual(['Hybrid']);
    expect(l.illegal).toEqual([{ name: 'Banned', why: 'banned in Commander' }]);
    expect(l.commander).toMatchObject({ name: 'Leader', canLead: true, inDeck: true });
  });

  it('flags a commander that cannot lead or is missing from the cards', () => {
    const d = deck(100, ['B'], [[ZOMBIE, 1]], { B: 99 }, ZOMBIE);
    expect(checkLegality(d, CTX).illegal).toEqual([
      { name: 'Zombie', why: 'cannot be a commander' },
    ]);
    const away = deck(100, ['B', 'G'], [[ELF, 1]], { B: 99 }, LEADER);
    expect(checkLegality(away, CTX).illegal).toEqual([
      { name: 'Leader', why: 'the commander is not among the cards' },
    ]);
  });
});

describe('flags', () => {
  const ok: FlagInputs = {
    size: 60,
    sizeOk: true,
    copiesOk: true,
    colorsOk: true,
    illegalCards: 0,
    landDiff: 0,
    castability: 1,
    spells: 36,
    shareLow: 0.7,
    shareHigh: 0.1,
    averageMv: 3,
    interaction: 5,
    threats: 4,
    theme: { setupWeighted: 10, payoffCopies: 6, ratio: 1.67 },
    identical: null,
    buildMs: 100,
  };
  const at = (x: Partial<FlagInputs>) => flagsFor({ ...ok, ...x });

  it('raises nothing on a sound deck', () => {
    expect(at({})).toEqual([]);
  });

  it('allows the land slack and flags beyond it', () => {
    expect(at({ landDiff: 2 })).toEqual([]);
    expect(at({ landDiff: 3 })).toEqual(['lands-high']);
    expect(at({ landDiff: -2, size: 40 })).toEqual(['lands-low']);
  });

  it('flags short sources by castability', () => {
    expect(at({ castability: 0.6 })).toEqual([]);
    expect(at({ castability: 0.59 })).toEqual(['sources-short']);
    expect(at({ castability: null })).toEqual([]);
  });

  it('reads the curve thresholds per size', () => {
    expect(at({ shareHigh: 0.36 })).toEqual(['curve-top-heavy']);
    expect(at({ shareHigh: 0.36, size: 100 })).toEqual([]);
    expect(at({ averageMv: 4.1 })).toEqual(['curve-top-heavy']);
    expect(at({ shareLow: 0.44 })).toEqual(['curve-flat']);
    expect(at({ shareLow: 0.44, size: 100 })).toEqual([]);
    expect(at({ shareLow: 0, spells: 0 })).toEqual([]);
  });

  it('flags missing interaction and threats per size', () => {
    expect(at({ interaction: 1 })).toEqual(['no-removal']);
    expect(at({ interaction: 1, size: 20 })).toEqual([]);
    expect(at({ threats: 0 })).toEqual(['no-threat']);
    expect(at({ threats: 1, size: 100 })).toEqual(['no-threat']);
  });

  it('flags a thin or lopsided theme only when the rules cover it', () => {
    expect(at({ theme: { setupWeighted: 2.9, payoffCopies: 6, ratio: 0.48 } })).toEqual([
      'theme-no-setup',
    ]);
    expect(at({ theme: { setupWeighted: 10, payoffCopies: 1, ratio: 10 } })).toEqual([
      'theme-no-payoff',
    ]);
    expect(at({ theme: { setupWeighted: 10, payoffCopies: 2, ratio: 5 } })).toEqual([
      'theme-unbalanced',
    ]);
    expect(at({ theme: { setupWeighted: 3, payoffCopies: 6, ratio: 0.5 } })).toEqual([
      'theme-unbalanced',
    ]);
    expect(at({ theme: null })).toEqual([]);
  });

  it("reads the style's minimums instead of the placeholders when the rules give them", () => {
    const base = { setupWeighted: 1, payoffCopies: 1, ratio: 1, setupUnits: 10, payoffUnits: 6 };
    const short = (...floors: [keyof ThemeFloor, number, number][]) => ({
      ...base,
      minimums: {
        size: 60 as const,
        met: false,
        short: floors.map(([floor, have, need]) => ({ floor, have, need })),
      },
    });
    // Met floors pass even below the placeholders.
    expect(at({ theme: { ...base, minimums: { size: 60, met: true, short: [] } } })).toEqual([]);
    expect(at({ theme: short(['setupWeight', 3, 8], ['repeatable', 0, 2]) })).toEqual([
      'theme-no-setup',
    ]);
    expect(at({ theme: short(['payoffWeight', 3.5, 6]) })).toEqual(['theme-no-payoff']);
    expect(at({ theme: short(['repeatableOrPayoff', 2, 4]) })).toEqual(['theme-no-payoff']);
    expect(at({ theme: short(['setup', 4, 9], ['payoff', 2, 6]) })).toEqual([
      'theme-no-setup',
      'theme-no-payoff',
    ]);
    // Floors met, but setup under half the payoffs.
    const lopsided = { ...base, setupUnits: 8, payoffUnits: 17 };
    expect(at({ theme: { ...lopsided, minimums: { size: 60, met: true, short: [] } } })).toEqual([
      'theme-unbalanced',
    ]);
  });

  it('flags a different rebuild and a slow build', () => {
    expect(at({ identical: false })).toEqual(['nondeterministic']);
    expect(at({ identical: true })).toEqual([]);
    expect(at({ buildMs: 301 })).toEqual(['slow']);
    expect(at({ buildMs: 999, size: 100 })).toEqual([]);
  });
});

describe('helpers', () => {
  it('matches globs by folder', () => {
    expect(globToRegExp('*/bulk-*.json').test('head/bulk-black-B-60-bestfit-s1.json')).toBe(true);
    expect(globToRegExp('*.json').test('head/x.json')).toBe(false);
    expect(globToRegExp('**/x.json').test('x.json')).toBe(true);
    expect(globToRegExp('**/x.json').test('a/b/x.json')).toBe(true);
  });

  it('takes the middle value, or the mean of the two middle ones', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
