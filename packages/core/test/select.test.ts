import { describe, expect, it } from 'vitest';
import {
  addLearned,
  comboGain,
  emptyLearnedTally,
  pairGain,
  type Selection,
} from '../src/select.ts';

// Keys: 0 t:sac, 1 t:fodder, 2 c:a, 3 c:b, 4 c:c. Links are symmetric, as the learned pairs are.
const link = (pairs: [number, number][]) => ({
  at: Int32Array.from(pairs.map(([k]) => k)),
  w: Float64Array.from(pairs.map(([, v]) => v)),
});
const SEL: Selection = {
  fit: new Map([['a', 0.5]]),
  links: new Map([
    [
      'a',
      link([
        [0, 1],
        [3, 0.5],
      ]),
    ],
    [
      'b',
      link([
        [1, 1],
        [2, 0.5],
      ]),
    ],
  ]),
  keys: new Map([
    ['a', Int32Array.from([1, 2])],
    ['b', Int32Array.from([0, 3])],
    ['c', Int32Array.from([4])],
  ]),
  keyCount: 5,
  combos: [{ pieces: 2, points: 4 }],
  comboOf: new Map([
    ['a', [{ at: 0 }]],
    ['c', [{ at: 0 }]],
  ]),
  given: new Map(),
  pairWeight: 1,
  ruleWeight: 0.25,
};

describe('learned selection tally', () => {
  it('counts pairs between cards already chosen and a new one', () => {
    const t = emptyLearnedTally(SEL);
    addLearned(SEL, t, 'a', 1);
    // b pairs with a's tag (fodder) and with a itself.
    expect(pairGain(SEL, t, 'b')).toBe(1.5);
    addLearned(SEL, t, 'b', 2);
    expect(t.syn).toBe(3);
    expect(t.fit).toBe(0.5);
  });

  it('returns to zero when the copies come out again, in any order', () => {
    const t = emptyLearnedTally(SEL);
    addLearned(SEL, t, 'a', 2);
    addLearned(SEL, t, 'b', 1);
    addLearned(SEL, t, 'c', 1);
    addLearned(SEL, t, 'a', -2);
    addLearned(SEL, t, 'c', -1);
    addLearned(SEL, t, 'b', -1);
    expect(t.syn).toBeCloseTo(0);
    expect(t.fit).toBeCloseTo(0);
    expect(t.combo).toBeCloseTo(0);
  });

  it('scores a combo by its pieces in the deck, a card once whatever its copies', () => {
    const t = emptyLearnedTally(SEL);
    expect(comboGain(SEL, t, 'a')).toBe(1);
    addLearned(SEL, t, 'a', 3);
    expect(t.combo).toBe(1);
    expect(comboGain(SEL, t, 'a')).toBe(0);
    expect(comboGain(SEL, t, 'c')).toBe(3);
    addLearned(SEL, t, 'c', 1);
    expect(t.combo).toBe(4);
  });
});
