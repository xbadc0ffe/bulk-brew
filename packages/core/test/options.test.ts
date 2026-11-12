import { describe, expect, it } from 'vitest';
import { BuildError } from '../src/builder.ts';
import {
  addOption,
  buildOption,
  colorSubsets,
  deckOptionSearch,
  planOptions,
  type DeckOption,
  type DeckOptionSearch,
  type OptionsRequest,
} from '../src/options.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import type { ScanReport } from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';

const index = new CardIndex(PACK);

describe('colorSubsets', () => {
  it('lists every non-empty subset, larger first', () => {
    expect(colorSubsets(['U', 'W'])).toEqual([['W', 'U'], ['W'], ['U']]);
    expect(colorSubsets(['W', 'U', 'B'])).toHaveLength(7);
  });
});

describe('planOptions', () => {
  it('plans one build per viable style and honors a picked primary style', () => {
    const req = { size: 60 as const, colors: ['W' as const], settings: SETTINGS };
    const all = planOptions(req, bigPool(), index, CONFIG);
    expect(all.plans.length).toBeGreaterThan(1);
    expect(all.primaryUnavailable).toBe(false);
    expect(new Set(all.plans.map((p) => p.key)).size).toBe(all.plans.length);

    const tokens = planOptions({ ...req, primary: 'tokens' }, bigPool(), index, CONFIG);
    expect(tokens.plans.every((p) => p.style === 'tokens')).toBe(true);

    // A style the pool cannot support is still planned: each build answers with the nearest deck.
    const thin = planOptions({ ...req, primary: 'lifegain' }, bigPool(), index, CONFIG);
    expect(thin.plans.length).toBeGreaterThan(0);
    expect(thin.primaryUnavailable).toBe(false);
    const built = buildOption(
      thin.plans[0]!,
      { ...req, primary: 'lifegain' },
      bigPool(),
      index,
      CONFIG,
    );
    expect(built.explanation.nearest?.requested).toBe('lifegain');
    // With a secondary style the classic builder runs, and the old scan decides.
    const classic = { ...req, primary: 'lifegain', secondary: 'flyers' };
    const none = planOptions(classic, bigPool(), index, CONFIG);
    expect(none.plans).toHaveLength(0);
    expect(none.primaryUnavailable).toBe(true);
  });
});

describe('planOptions with a primary the theme rules find short', () => {
  // The fixture pack's white token engines, all but `keep` of them left out of the pool.
  const makers = PACK.cards
    .filter((c) => c.tags.includes('repeatable-creature-tokens'))
    .map((c) => c.id);
  function fewMakers(keep: number) {
    const pool = bigPool();
    makers.slice(keep).forEach((id) => delete pool.entries[id]);
    return pool;
  }
  const req: OptionsRequest = {
    size: 60,
    colors: ['W', 'U'],
    primary: 'tokens',
    settings: SETTINGS,
  };
  const tokens = (pool: ReturnType<typeof bigPool>) =>
    planOptions(req, pool, index, CONFIG)
      .plans.map((p) => p.key)
      .filter((k) => k.endsWith(':tokens'));

  it('plans a short primary, and each build comes back as the nearest deck with a note', () => {
    const pool = fewMakers(2);
    const rules = scanPool(pool, index, CONFIG, SETTINGS, 60, ['W']).archetypes.find(
      (a) => a.archetype === 'tokens',
    )!.rules!;
    expect(rules.viable).toBe(false);
    expect(rules.margin).toBeGreaterThanOrEqual(CONFIG.builderWeights.grow.nearMargin);

    const plan = planOptions(req, pool, index, CONFIG);
    expect(plan.primaryUnavailable).toBe(false);
    expect(tokens(pool)).toEqual(['WU:tokens', 'W:tokens']);
    const result = buildOption(plan.plans[0]!, req, pool, index, CONFIG);
    expect(result.deck.archetype).not.toBe('tokens');
    expect(result.explanation.nearest).toEqual({ requested: 'tokens', lacks: rules.lacks });
  });

  it('plans a primary below short too, and the build answers with the nearest deck', () => {
    const pool = fewMakers(1);
    const rules = scanPool(pool, index, CONFIG, SETTINGS, 60, ['W']).archetypes.find(
      (a) => a.archetype === 'tokens',
    )!.rules!;
    expect(rules.margin).toBeLessThan(CONFIG.builderWeights.grow.nearMargin);
    const plan = planOptions(req, pool, index, CONFIG);
    expect(tokens(pool)).toEqual(['WU:tokens', 'W:tokens']);
    expect(plan.primaryUnavailable).toBe(false);
    const result = buildOption(plan.plans[0]!, req, pool, index, CONFIG);
    expect(result.deck.archetype).not.toBe('tokens');
    expect(result.explanation.nearest).toEqual({ requested: 'tokens', lacks: rules.lacks });
  });

  it('plans by the old scan where the classic builder takes the request', () => {
    // A secondary style keeps today's builder, and its matchers still find Tokens here.
    const pool = fewMakers(2);
    const withSecondary = { ...req, secondary: 'flyers' };
    const plan = planOptions(withSecondary, pool, index, CONFIG);
    expect(plan.plans.length).toBeGreaterThan(0);
    const result = buildOption(plan.plans[0]!, withSecondary, pool, index, CONFIG);
    expect(result.explanation.builder).toBe('classic');
    expect(result.deck.archetype).toBe('tokens');
  });
});

describe('addOption', () => {
  it('keeps options ranked and drops a weaker near copy', () => {
    const req = { size: 60 as const, colors: ['W' as const], settings: SETTINGS };
    const { plans } = planOptions(req, bigPool(), index, CONFIG);
    let list: ReturnType<typeof addOption> = [];
    for (const plan of plans) {
      list = addOption(
        list,
        plan.key,
        buildOption(plan, req, bigPool(), index, CONFIG),
        req,
        index,
        CONFIG,
      );
    }
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++)
      expect(list[i - 1]!.rank).toBeGreaterThanOrEqual(list[i]!.rank);
    // Adding the top option again under another key is a near copy and changes nothing.
    const top = list[0]!;
    expect(addOption(list, 'copy', top.result, req, index, CONFIG)).toEqual(list);
  });
});

function runAll(search: DeckOptionSearch) {
  const steps = [];
  for (let step = search.step(); step; step = search.step()) steps.push(step);
  return { steps, state: search.state() };
}

describe('deckOptionSearch', () => {
  const req: OptionsRequest = { size: 60, colors: ['W', 'U'], settings: SETTINGS };

  it('gives the options that planning and building every plan gives', () => {
    const pool = bigPool();
    const { plans } = planOptions(req, pool, index, CONFIG);
    let list: DeckOption[] = [];
    for (const plan of plans) {
      try {
        const result = buildOption(plan, req, pool, index, CONFIG);
        list = addOption(list, plan.key, result, req, index, CONFIG);
      } catch (err) {
        if (!(err instanceof BuildError)) throw err;
      }
    }
    const { steps, state } = runAll(deckOptionSearch(req, pool, index, CONFIG));
    expect(steps.filter((s) => s.kind === 'scan')).toHaveLength(3);
    expect([...state.scans!.keys()]).toEqual(['WU', 'W', 'U']);
    expect(state.planned).toBe(plans.length);
    expect(state.built).toBe(plans.length);
    expect(state.done).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(state.options.map((o) => o.key)).toEqual(list.map((o) => o.key));
  });

  it('reuses cached scans across styles and colors', () => {
    const pool = bigPool();
    const cache = new Map<string, ScanReport>();
    runAll(deckOptionSearch(req, pool, index, CONFIG, cache));
    expect([...cache.keys()].sort()).toEqual(['U', 'W', 'WU']);
    const styled = runAll(
      deckOptionSearch({ ...req, primary: 'tokens' }, pool, index, CONFIG, cache),
    );
    expect(styled.steps.some((s) => s.kind === 'scan')).toBe(false);
    expect(styled.state.options.length).toBeGreaterThan(0);
    for (const o of styled.state.options) expect(o.result.deck.archetype).toBe('tokens');
    const mono = runAll(deckOptionSearch({ ...req, colors: ['W'] }, pool, index, CONFIG, cache));
    expect(mono.steps.some((s) => s.kind === 'scan')).toBe(false);
    expect([...mono.state.scans!.keys()]).toEqual(['W']);
  });

  it('says when no subset can build the picked primary style', () => {
    // A secondary keeps the classic builder, where an unviable primary plans nothing.
    const { state } = runAll(
      deckOptionSearch(
        { ...req, primary: 'lifegain', secondary: 'flyers' },
        bigPool(),
        index,
        CONFIG,
      ),
    );
    expect(state.primaryUnavailable).toBe(true);
    expect(state.planned).toBe(0);
    expect(state.options).toEqual([]);
  });
});
