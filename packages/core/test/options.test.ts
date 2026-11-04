import { describe, expect, it } from 'vitest';
import { addOption, buildOption, colorSubsets, planOptions } from '../src/options.ts';
import { CardIndex } from '../src/pack.ts';
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
