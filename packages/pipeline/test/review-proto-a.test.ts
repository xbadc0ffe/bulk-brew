import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Candidate, CardRecord } from '@bulk-brew/core';
import { ROOT } from '../src/corpus.ts';
import { colorsOk } from '../src/review/algos/a/builder.ts';
import {
  addJob,
  emptyThemeTally,
  gateOpen,
  jobOf,
  lonePayoffs,
  loadRulesOrExample,
  planSpec,
  planTerm,
  progressOf,
  shortOf,
} from '../src/review/algos/a/theme.ts';
import {
  buildReviewDeck,
  createContext,
  planJob,
  type ReviewJob,
  type RunContext,
} from '../src/review/build.ts';
import {
  compileThemeRules,
  countTheme,
  EXAMPLE_THEME_RULES,
  type ThemeRulesFile,
} from '../src/review/theme-rules.ts';

let n = 0;
function card(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  n++;
  return {
    id: `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Human Wizard',
    text: '',
    colors: ['U'],
    identity: ['U'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{U}',
    power: '1',
    toughness: '1',
    ...partial,
  };
}

const example = compileThemeRules(EXAMPLE_THEME_RULES).styles.get('graveyard')!;

// The example rules with floors, so the plan has a ratio: 8 setup weight per 6 payoff weight.
const withFloors = compileThemeRules({
  ...EXAMPLE_THEME_RULES,
  styles: {
    graveyard: {
      ...EXAMPLE_THEME_RULES.styles.graveyard!,
      minimums: { '60': { setupWeight: 8, payoffWeight: 6 } },
    },
  },
} satisfies ThemeRulesFile).styles.get('graveyard')!;

const looter = card({
  name: 'Fake Looter',
  tags: ['loot'],
  text: '{T}: Draw a card, then discard a card.',
});
const miller = card({ name: 'Fake Miller', tags: ['mill-self'], text: 'Mill three cards.' });
const reanimator = card({ name: 'Fake Reanimator', tags: ['reanimate'] });
const counter = card({
  name: 'Fake Lhurgoyf',
  text: 'This creature gets +1/+1 for each card in your graveyard.',
});
// Meets a setup job (weight 2) and a payoff job (weight 1): setup wins, once.
const dual = card({
  name: 'Fake Looting Reanimator',
  tags: ['loot', 'reanimate'],
  text: '{T}: Draw a card, then discard a card.',
});
// Meets a setup job (weight 1) and a payoff job (weight 1.5): payoff wins, once.
const dualPayoff = card({
  name: 'Fake Milling Lhurgoyf',
  tags: ['mill-self'],
  text: 'Mill two cards.\nThis creature gets +1/+1 for each card in your graveyard.',
});
const rider = card({ name: 'Fake Removal', tags: ['mill-self'], text: 'Destroy it.\nSurveil 1.' });
const plain = card({ name: 'Fake Bear' });

describe("A' counts each card once", () => {
  it('gives each card one job by the rules, the higher weight winning', () => {
    expect(jobOf(looter, example, 60)).toMatchObject({ as: 'setup', weight: 2, repeatable: true });
    expect(jobOf(miller, example, 60)).toMatchObject({ as: 'setup', weight: 1 });
    expect(jobOf(reanimator, example, 60)).toMatchObject({ as: 'payoff', weight: 1 });
    expect(jobOf(counter, example, 60)).toMatchObject({ as: 'payoff', weight: 1.5 });
    expect(jobOf(dual, example, 60)).toMatchObject({ as: 'setup', weight: 2 });
    expect(jobOf(dualPayoff, example, 60)).toMatchObject({ as: 'payoff', weight: 1.5 });
    expect(jobOf(rider, example, 60)).toBeUndefined();
    expect(jobOf(plain, example, 60)).toBeUndefined();
  });

  it('tallies a dual card on one side only', () => {
    const t = emptyThemeTally();
    addJob(t, jobOf(dual, example, 60), 2);
    addJob(t, jobOf(dualPayoff, example, 60), 1);
    expect(t).toMatchObject({ sW: 4, sU: 2, rep: 2, pW: 1.5, pU: 1, pN: 1 });
    addJob(t, jobOf(dual, example, 60), -2);
    expect(t).toMatchObject({ sW: 0, sU: 0, rep: 0, pN: 1 });
  });
});

describe("A' color guard", () => {
  const of = (c: CardRecord) => ({ facts: { card: c } }) as unknown as Candidate;
  const green = of(card({ name: 'Fake Elf', colors: ['G'], identity: ['G'] }));
  const blue = of(looter);
  const gold = of(card({ name: 'Fake Frog', colors: ['U', 'G'], identity: ['U', 'G'] }));

  it('keeps a color at its minimum through a swap', () => {
    expect(colorsOk(['G'], green, blue)).toBe(false);
    expect(colorsOk(['G'], green, gold)).toBe(true);
    expect(colorsOk(['G'], blue, green)).toBe(true);
    expect(colorsOk([], green, blue)).toBe(true);
  });
});

describe("A' plan health and the payoff gate", () => {
  const spec = planSpec(withFloors, 60);

  it('reads the ratio from the floors, and 1 without them', () => {
    expect(spec.ratio).toBeCloseTo(8 / 6);
    expect(planSpec(example, 60).ratio).toBe(1);
  });

  it('lets a payoff in only when setup from other cards feeds it', () => {
    const t = emptyThemeTally();
    const payoff = jobOf(reanimator, withFloors, 60);
    // A card that resolves to payoff brings no supply, so it cannot open its own gate.
    addJob(t, jobOf(dualPayoff, withFloors, 60), 1);
    expect(t.sW).toBe(0);
    expect(gateOpen(t, spec, payoff)).toBe(false);
    addJob(t, jobOf(looter, withFloors, 60), 1);
    // 2 setup weight against (1.5 + 1) payoff weight at 4/3 needs 3.33.
    expect(gateOpen(t, spec, payoff)).toBe(false);
    addJob(t, jobOf(miller, withFloors, 60), 2);
    expect(gateOpen(t, spec, payoff)).toBe(true);
    // Setup and cards with no job are never held back.
    expect(gateOpen(t, spec, jobOf(looter, withFloors, 60))).toBe(true);
    expect(gateOpen(t, spec, undefined)).toBe(true);
  });

  it('counts payoffs with no setup behind them, cheapest fed first', () => {
    const t = emptyThemeTally();
    addJob(t, jobOf(reanimator, withFloors, 60), 2);
    addJob(t, jobOf(counter, withFloors, 60), 1);
    expect(lonePayoffs(t, spec)).toBe(3);
    addJob(t, jobOf(miller, withFloors, 60), 3);
    // 3 supply feeds two weight-1 payoffs at 4/3 each; the 1.5 one goes unfed.
    expect(lonePayoffs(t, spec)).toBe(1);
    expect(shortOf(t, spec)).toBeCloseTo((8 / 6) * 3.5 - 3);
  });

  it('stops paying for theme density once the floors are met', () => {
    const t = emptyThemeTally();
    addJob(t, jobOf(looter, withFloors, 60), 4);
    addJob(t, jobOf(reanimator, withFloors, 60), 6);
    expect(progressOf(t, spec).progress).toBe(1);
    const met = planTerm(t, spec);
    addJob(t, jobOf(looter, withFloors, 60), 4);
    expect(planTerm(t, spec)).toBe(met);
  });
});

const PACK = path.join(ROOT, 'data', 'packs', 'cards.json');

describe.skipIf(!existsSync(PACK))("A' on a public pool", () => {
  // In beforeAll, since a skipped suite's body still runs and the pack is missing in CI.
  let ctx: RunContext;
  beforeAll(() => {
    ctx = createContext({ force: true });
  });
  const job: ReviewJob = {
    version: 'a-objective',
    pool: 'data/review/pools/public/bulk-blue.json',
    colors: 'U',
    size: 60,
    style: 'graveyard',
  };

  for (const version of ['a-objective', 'a-search']) {
    it(`${version} builds Blue Graveyard 60 with its setup and no payoff unfed`, async () => {
      const { pool, request } = planJob({ ...job, version }, ctx);
      const r = await buildReviewDeck(version, pool, request, ctx);
      expect(r.error).toBeUndefined();
      expect(r.deck.archetype).toBe('graveyard');
      const { rules } = loadRulesOrExample();
      const style = rules.styles.get('graveyard')!;
      const spec = planSpec(style, 60);
      const cards = r.deck.cards.map((c) => ({ card: ctx.index.get(c.id)!, qty: c.qty }));
      const count = countTheme(cards, style, 60);
      expect(count.setupWeighted).toBeGreaterThanOrEqual(spec.setupNeed);
      // Every payoff copy has setup behind it at the rules' ratio.
      expect(count.setupWeighted + 1e-9).toBeGreaterThanOrEqual(spec.ratio * count.payoffWeighted);
      const t = emptyThemeTally();
      for (const { card: c, qty } of cards) addJob(t, jobOf(c, style, 60), qty);
      expect(lonePayoffs(t, spec)).toBe(0);
    }, 60_000);
  }

  it('declines a style the pool cannot make, never building another', async () => {
    const { pool, request } = planJob({ ...job, style: 'lifegain' }, ctx);
    const r = await buildReviewDeck('a-objective', pool, request, ctx);
    expect(r.error).toMatch(/Not enough cards to build Lifegain/);
    expect(r.deck.cards).toEqual([]);
  }, 60_000);
});
