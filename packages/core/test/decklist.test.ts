import { describe, expect, it } from 'vitest';
import { parseDecklist } from '../src/decklist.ts';

describe('parseDecklist', () => {
  it('reads plain quantity and name', () => {
    const r = parseDecklist('4 Lightning Bolt\n1 Shivan Dragon');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ qty: 4, name: 'Lightning Bolt', section: 'deck' });
    expect(r.lines[1]).toMatchObject({ qty: 1, name: 'Shivan Dragon' });
    expect(r.skipped).toHaveLength(0);
  });

  it('keeps set code and collector number as an art hint', () => {
    const r = parseDecklist('4 Lightning Bolt (M10) 146');
    expect(r.lines[0]).toMatchObject({
      qty: 4,
      name: 'Lightning Bolt',
      set: 'm10',
      collectorNumber: '146',
    });
  });

  it('accepts 4x prefix, x4 suffix, and no quantity', () => {
    const r = parseDecklist('4x Giant Growth\nLlanowar Elves x2\nForest');
    expect(r.lines.map((l) => [l.qty, l.name])).toEqual([
      [4, 'Giant Growth'],
      [2, 'Llanowar Elves'],
      [1, 'Forest'],
    ]);
  });

  it('strips foil markers and set-only printings', () => {
    const r = parseDecklist('1 Sol Ring (C21) 263 *F*\n2 Counterspell [MH2]');
    expect(r.lines[0]).toMatchObject({ name: 'Sol Ring', set: 'c21', collectorNumber: '263' });
    expect(r.lines[1]).toMatchObject({ name: 'Counterspell', set: 'mh2' });
    expect(r.lines[1]?.collectorNumber).toBeUndefined();
  });

  it('tracks sections and skips comments and blanks', () => {
    const text = ['// my list', 'Deck', '4 Opt', '', 'Sideboard (2)', '2 Negate', '# done'].join(
      '\n',
    );
    const r = parseDecklist(text);
    expect(r.lines.map((l) => [l.name, l.section])).toEqual([
      ['Opt', 'deck'],
      ['Negate', 'sideboard'],
    ]);
  });

  it('keeps double-faced names intact', () => {
    const r = parseDecklist('2 Fable of the Mirror-Breaker // Reflection of Kiki-Jiki (NEO) 141');
    expect(r.lines[0]?.name).toBe('Fable of the Mirror-Breaker // Reflection of Kiki-Jiki');
    expect(r.lines[0]?.set).toBe('neo');
  });

  it('does not treat ordinary names as set codes', () => {
    const r = parseDecklist('1 Borrowing 100,000 Arrows\n1 Who // What // When // Where // Why');
    expect(r.lines[0]?.name).toBe('Borrowing 100,000 Arrows');
    expect(r.lines[1]?.name).toBe('Who // What // When // Where // Why');
  });

  it('reports unreadable lines', () => {
    const r = parseDecklist('0 Nothing\n   \n3 ');
    expect(r.lines).toHaveLength(0);
    expect(r.skipped.map((s) => s.line)).toEqual([1, 3]);
  });
});
