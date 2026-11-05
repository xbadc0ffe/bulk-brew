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

    const none = planOptions({ ...req, primary: 'lifegain' }, bigPool(), index, CONFIG);
    expect(none.plans).toHaveLength(0);
    expect(none.primaryUnavailable).toBe(true);
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
    const { state } = runAll(
      deckOptionSearch({ ...req, primary: 'lifegain' }, bigPool(), index, CONFIG),
    );
    expect(state.primaryUnavailable).toBe(true);
    expect(state.planned).toBe(0);
    expect(state.options).toEqual([]);
  });
});
