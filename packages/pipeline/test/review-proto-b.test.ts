import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BuildError,
  CardIndex,
  COLOR_CLASSES,
  type CardRecord,
  type ColorClass,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import { loadConfigDir } from '../src/check-config.ts';
import { ROOT } from '../src/corpus.ts';
import { buildB, makeContext } from '../src/review/algos/b/builder.ts';
import { emptyTally, rulesDefs, type Tally, type ThemeDefs } from '../src/review/algos/b/defs.ts';
import { buildReviewDeck, createContext, planJob, type RunContext } from '../src/review/build.ts';
import {
  compileThemeRules,
  countTheme,
  EXAMPLE_THEME_RULES,
  loadThemeRules,
  type ThemeRulesFile,
} from '../src/review/theme-rules.ts';
import type { BuiltDeck, ReviewRequest } from '../src/review/version.ts';

const CONFIG = loadConfigDir(path.join(ROOT, 'config'));
const SETTINGS = JSON.parse(
  readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
) as Settings;

// The format's example rules with floors, so the fake pool can be planned at 60 cards.
const RULES: ThemeRulesFile = {
  ...EXAMPLE_THEME_RULES,
  styles: {
    graveyard: {
      ...EXAMPLE_THEME_RULES.styles.graveyard!,
      minimums: { '60': { setupWeight: 8, payoff: 4 } },
    },
  },
};

let n = 0;
/** A blue card; `noStats` leaves out power and toughness for noncreatures. */
function card(
  partial: Partial<CardRecord> & Pick<CardRecord, 'name'> & { noStats?: boolean },
): CardRecord {
  n++;
  const { noStats, ...rest } = partial;
  const out: CardRecord = {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{U}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['U'],
    identity: ['U'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...rest,
  };
  if (noStats) {
    delete out.power;
    delete out.toughness;
  }
  return out;
}

const sorcery = (name: string, mv: number, tags: string[], text: string, rank?: number) =>
  card({
    name,
    mv,
    manaCost: `{${mv - 1}}{U}`,
    typeLine: 'Sorcery',
    types: ['sorcery'],
    noStats: true,
    tags,
    text,
    ...(rank ? { rank } : {}),
  });

/** A blue pool: real setup, payoffs, a rider, a dual card, removal, draw, and plain creatures. */
function fakePool(opts: { payoffs?: number; setup?: boolean } = {}) {
  const cards: CardRecord[] = [];
  const looters: CardRecord[] = [];
  if (opts.setup !== false) {
    for (let i = 0; i < 2; i++)
      looters.push(
        card({
          name: `Looter ${i}`,
          tags: ['loot'],
          text: '{T}: Draw a card, then discard a card.',
        }),
      );
    for (let i = 0; i < 3; i++)
      cards.push(sorcery(`Mill Spell ${i}`, 2, ['mill-self'], 'Mill three cards.'));
  }
  const payoffs: CardRecord[] = [];
  for (let i = 0; i < (opts.payoffs ?? 4); i++)
    payoffs.push(
      sorcery(
        `Reanimate ${i}`,
        3,
        ['reanimate'],
        'Return target creature card from your graveyard to the battlefield.',
        // Popular cards are strong: the first payoff is the best.
        100 + i * 2000,
      ),
    );
  const rider = card({
    name: 'Surveil Removal',
    typeLine: 'Instant',
    types: ['instant'],
    tags: ['mill-self', 'removal-creature', 'removal'],
    text: 'Destroy target creature.\nSurveil 1.',
    noStats: true,
  });
  // Meets "mills itself" (1) and "returns a creature card" (1): a tie counts as payoff.
  const dual = sorcery(
    'Dual Spell',
    4,
    ['mill-self', 'reanimate'],
    'Mill two cards, then return target creature card from your graveyard to the battlefield.',
  );
  for (let i = 0; i < 6; i++)
    cards.push(
      card({
        name: `Removal ${i}`,
        mv: 2,
        typeLine: 'Instant',
        types: ['instant'],
        tags: ['removal-creature', 'removal', 'spot-removal'],
        text: 'Destroy target creature.',
        noStats: true,
      }),
      sorcery(`Draw ${i}`, 3, ['pure-draw', 'draw'], 'Draw two cards.'),
    );
  for (let mv = 1; mv <= 6; mv++)
    for (let i = 0; i < 5; i++)
      cards.push(
        card({
          name: `Creature ${mv}-${i}`,
          mv,
          manaCost: `{${mv - 1}}{U}`,
          power: String(mv),
          toughness: String(mv),
        }),
      );
  const island = card({
    name: 'Island',
    mv: 0,
    manaCost: '',
    typeLine: 'Basic Land — Island',
    types: ['land'],
    colors: [],
    noStats: true,
    text: '({T}: Add {U}.)',
  });
  const all = [...looters, ...payoffs, rider, dual, ...cards, island];
  const index = new CardIndex({
    schema: 2,
    version: 'test',
    builtAt: 'test',
    cardCount: all.length,
    cards: all,
  });
  const pool: Pool = { entries: {}, updatedAt: 'test' };
  for (const c of all) pool.entries[c.id] = { cardId: c.id, qty: 4 };
  return { index, pool, looters, payoffs, rider, dual };
}

function defsFor(bulkShare?: number): ThemeDefs {
  const defs = rulesDefs(compileThemeRules(RULES), CONFIG, 'test rules');
  if (bulkShare === undefined) return defs;
  // A hand-made baseline: plain bulk holds this much graveyard setup and payoff per card.
  const per = {} as Record<ColorClass, Tally>;
  for (const k of COLOR_CLASSES)
    per[k] = {
      setupUnits: bulkShare,
      setupWeight: bulkShare,
      repeatable: bulkShare,
      payoffUnits: bulkShare,
      payoffWeight: bulkShare,
    };
  return { ...defs, bulk: new Map([['graveyard', per]]) };
}

function build(
  f: ReturnType<typeof fakePool>,
  request: Partial<ReviewRequest> = {},
  defs = defsFor(),
): BuiltDeck {
  const req: ReviewRequest = { size: 60, colors: ['U'], seed: 1, ...request };
  return buildB(makeContext(f.pool, req, f.index, CONFIG, SETTINGS, defs));
}

function copiesOf(deck: BuiltDeck, id: string): number {
  return deck.cards.find((c) => c.id === id)?.qty ?? 0;
}

function total(deck: BuiltDeck): number {
  let k = 0;
  for (const c of deck.cards) k += c.qty;
  for (const v of Object.values(deck.basics)) k += v ?? 0;
  return k;
}

function themeCount(deck: BuiltDeck, index: CardIndex) {
  const style = compileThemeRules(RULES).styles.get('graveyard')!;
  return countTheme(
    deck.cards.map((c) => ({ card: index.get(c.id)!, qty: c.qty })),
    style,
    60,
  );
}

describe('b-grow on a fake pool with the example rules', () => {
  it('builds a requested theme to its floors, every payoff covered, legal and repeatable', () => {
    const f = fakePool();
    const deck = build(f, { style: 'graveyard' });
    expect(deck.archetype).toBe('graveyard');
    expect(total(deck)).toBe(60);
    for (const c of deck.cards) expect(c.qty).toBeLessThanOrEqual(4);
    const t = themeCount(deck, f.index);
    expect(t.setupWeighted).toBeGreaterThanOrEqual(8);
    expect(t.payoffUnits).toBeGreaterThanOrEqual(4);
    // Setup per payoff at least what the floors imply (8 setup weight for 4 payoffs).
    expect(t.setupWeighted).toBeGreaterThanOrEqual(2 * t.payoffUnits);
    expect(build(f, { style: 'graveyard' })).toEqual(deck);
  });

  it('seeds the payoffs the pool supports best, by quality', () => {
    const f = fakePool({ payoffs: 4 });
    const deck = build(f, { style: 'graveyard' });
    const why = deck.cards.find((c) => c.id === f.payoffs[0]!.id)?.why;
    expect(why).toMatch(/^Payoff/);
    expect(copiesOf(deck, f.payoffs[0]!.id)).toBe(4);
    // The four best copies meet the floor, so the weakest payoff is not seeded.
    expect(deck.cards.find((c) => c.id === f.payoffs[3]!.id)?.why ?? '').not.toMatch(/^Payoff/);
  });

  it('counts a card meeting both jobs once, as a payoff, and never a rider as setup', () => {
    const f = fakePool();
    const deck = build(f, { style: 'graveyard' });
    const t = themeCount(deck, f.index);
    expect(t.setup.some((l) => l.name === 'Dual Spell')).toBe(false);
    expect(t.setup.some((l) => l.name === 'Surveil Removal')).toBe(false);
    const rider = deck.cards.find((c) => c.id === f.rider.id);
    if (rider) expect(rider.why).not.toMatch(/^Setup/);
  });

  it('gates payoffs: none enters the curve fill without setup to cover it', () => {
    // Eight payoffs, more than the setup grown for the seeds covers: later ones need setup first.
    const f = fakePool({ payoffs: 8 });
    const deck = build(f, { style: 'graveyard' });
    const t = themeCount(deck, f.index);
    expect(t.setupWeighted).toBeGreaterThanOrEqual(2 * t.payoffUnits);
    // A plain deck from a pool with no graveyard setup leaves strong reanimation out.
    const bare = fakePool({ payoffs: 8, setup: false });
    const plain = build(bare, { style: 'midrange' });
    for (const p of bare.payoffs) expect(copiesOf(plain, p.id)).toBe(0);
    // With setup in the pool, a plain deck may carry payoffs, but only as many as its setup covers.
    const t2 = themeCount(build(f, { style: 'midrange' }), f.index);
    expect(t2.setupWeighted).toBeGreaterThanOrEqual(2 * t2.payoffUnits);
  });

  it('declines a theme the pool cannot build, never substituting another', () => {
    const f = fakePool({ setup: false });
    expect(() => build(f, { style: 'graveyard' })).toThrow(BuildError);
    expect(() => build(f, { style: 'tokens' })).toThrow(/not described/);
  });

  it('fills role minimums and the curve by slot', () => {
    const f = fakePool();
    const deck = build(f, { style: 'midrange' });
    expect(total(deck)).toBe(60);
    const removal = deck.cards
      .filter((c) => f.index.get(c.id)!.tags.includes('removal-creature'))
      .reduce((k, c) => k + c.qty, 0);
    expect(removal).toBeGreaterThanOrEqual(
      CONFIG.deckTemplates.templates['60']!.roles.removal!.min,
    );
    const slots = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const c of deck.cards) {
      const card = f.index.get(c.id)!;
      if (!card.types.includes('land')) slots[Math.max(1, Math.min(7, card.mv))]! += c.qty;
    }
    // Two-drops are the midrange peak; six-drops are few.
    expect(slots[2]).toBeGreaterThan(slots[6]!);
    expect(slots[2]).toBeGreaterThanOrEqual(8);
  });

  it('picks a theme only when it stands out over plain bulk', () => {
    const f = fakePool({ payoffs: 6 });
    // Bulk full of graveyard cards: this pool does not stand out, and a plain shape wins.
    const plain = build(f, {}, defsFor(10));
    expect(['aggro', 'midrange', 'control']).toContain(plain.archetype);
    // Bulk with almost no graveyard cards: this pool stands out, and the theme wins.
    const themed = build(f, {}, defsFor(0.001));
    expect(themed.archetype).toBe('graveyard');
    const e = themed.explanation as { plan: { scores: { style: string; richness: number }[] } };
    expect(e.plan.scores.find((s) => s.style === 'graveyard')!.richness).toBe(2);
  });

  it('falls back to the next plan when the best fit cannot be filled', () => {
    // Graveyard stands out, but its gate lets only 8 payoffs join 8 looter copies: 16 spells
    // for about 35 slots. A plain shape may use every payoff once its gate relaxes.
    const looters = [0, 1].map((i) =>
      card({
        name: `Thin Looter ${i}`,
        tags: ['loot'],
        text: '{T}: Draw a card, then discard a card.',
      }),
    );
    const payoffs = Array.from({ length: 8 }, (_, i) =>
      sorcery(
        `Thin Reanimate ${i}`,
        3,
        ['reanimate'],
        'Return target creature card from your graveyard to the battlefield.',
      ),
    );
    const island = card({
      name: 'Island',
      mv: 0,
      manaCost: '',
      typeLine: 'Basic Land — Island',
      types: ['land'],
      colors: [],
      noStats: true,
      text: '({T}: Add {U}.)',
    });
    const thin = (cards: CardRecord[]) => {
      const index = new CardIndex({
        schema: 2,
        version: 'test',
        builtAt: 'test',
        cardCount: cards.length,
        cards,
      });
      const pool: Pool = { entries: {}, updatedAt: 'test' };
      for (const c of cards) pool.entries[c.id] = { cardId: c.id, qty: 4 };
      return { index, pool } as ReturnType<typeof fakePool>;
    };
    const deck = build(thin([...looters, ...payoffs, island]), {}, defsFor(0.001));
    expect(['aggro', 'midrange', 'control']).toContain(deck.archetype);
    expect(total(deck)).toBe(60);
    const e = deck.explanation as { plan: { tried?: { style: string }[] } };
    expect(e.plan.tried?.[0]?.style).toBe('graveyard');
    // Too thin for any plan: declines, naming every plan it tried.
    expect(() => build(thin([...looters, island]), {}, defsFor(0.001))).toThrow(/Tried .*Midrange/);
  });

  it('keeps an empty tally for a deck without theme cards', () => {
    expect(emptyTally()).toEqual({
      setupUnits: 0,
      setupWeight: 0,
      repeatable: 0,
      payoffUnits: 0,
      payoffWeight: 0,
    });
  });
});

// CI has no data pack (npm run check runs without data:pull), so this runs only locally.
const PACK = path.join(ROOT, 'data', 'packs', 'cards.json');

describe.skipIf(!existsSync(PACK))('b-grow on public-bulk-blue', () => {
  let ctx: RunContext;
  beforeAll(() => {
    ctx = createContext({ outDir: 'data/review/scratch/proto-b/test', force: true });
  });

  it('builds U 60 Graveyard with setup at its floor and every payoff covered', async () => {
    const job = {
      version: 'b-grow',
      pool: 'data/review/pools/public/bulk-blue.json',
      colors: 'U',
      size: 60,
      style: 'graveyard',
    };
    const { pool, request } = planJob(job, ctx);
    const r = await buildReviewDeck('b-grow', pool, request, ctx);
    expect(r.error).toBeUndefined();
    expect(r.deck.archetype).toBe('graveyard');
    let count = 0;
    for (const c of r.deck.cards) {
      count += c.qty;
      expect(c.qty).toBeLessThanOrEqual(4);
    }
    for (const v of Object.values(r.deck.basics)) count += v ?? 0;
    expect(count).toBe(60);
    const rules = loadThemeRules() ?? compileThemeRules(RULES);
    const style = rules.styles.get('graveyard')!;
    const t = countTheme(
      r.deck.cards.map((c) => ({ card: ctx.index.get(c.id)!, qty: c.qty })),
      style,
      60,
    );
    const floor = style.minimums?.['60'];
    const f = (Array.isArray(floor) ? floor[0] : floor) ?? { setupWeight: 8, payoffWeight: 6 };
    expect(t.setupWeighted).toBeGreaterThanOrEqual(f.setupWeight ?? 0);
    expect(t.repeatableSetupCopies).toBeGreaterThanOrEqual(f.repeatable ?? 0);
    expect(t.payoffWeighted).toBeGreaterThanOrEqual(f.payoffWeight ?? 0);
    // Every payoff covered: setup weight per payoff weight at least the floors' ratio.
    const ratio = (f.setupWeight ?? 0) / (f.payoffWeight || 1);
    expect(t.setupWeighted + 1e-9).toBeGreaterThanOrEqual(ratio * t.payoffWeighted);
  }, 120_000);
});
