import { describe, expect, it } from 'vitest';
import { listCandidates, maxCopiesFor } from '../src/candidates.ts';
import { templateFor } from '../src/config.ts';
import { BuildError, buildDeck, compareCandidates, curveTargets } from '../src/builder.ts';
import { commitDeck, newDeckId, returnDeck } from '../src/decks.ts';
import { deckToDecklist, pairPackets } from '../src/export.ts';
import { planLandCount } from '../src/lands.ts';
import { CardIndex } from '../src/pack.ts';
import { poolSize } from '../src/pool.ts';
import { scanPool } from '../src/scan.ts';
import type { Deck, DeckSize } from '../src/types.ts';
import {
  bigPool,
  CONFIG_BUNDLE as CONFIG,
  creaturePool,
  PACK,
  SETTINGS,
  thinPool,
} from './builder-fixtures.ts';

const index = new CardIndex(PACK);

describe('listCandidates', () => {
  it('keeps only cards whose identity fits, skips Un-sets, and caps copies', () => {
    const cands = listCandidates(bigPool(6), index, CONFIG, SETTINGS, 'W', 60);
    const ids = cands.map((c) => c.facts.card.id);
    expect(ids).not.toContain('u-creature');
    expect(ids).not.toContain('wu-creature');
    expect(ids).not.toContain('w-unset');
    expect(ids).toContain('c-artifact');
    expect(ids).not.toContain('plains');
    expect(cands.every((c) => c.available <= 4)).toBe(true);
    expect(ids).toEqual([...ids].sort());
  });

  it('includes Un-sets and tracked basics when the settings say so', () => {
    const cands = listCandidates(
      bigPool(),
      index,
      CONFIG,
      { ...SETTINGS, includeUnsets: true, unlimitedBasics: false },
      'W',
      60,
    );
    const ids = cands.map((c) => c.facts.card.id);
    expect(ids).toContain('w-unset');
    expect(cands.find((c) => c.facts.card.id === 'plains')?.available).toBe(30);
  });

  it('uses the template copy limit when the setting is absent', () => {
    expect(maxCopiesFor({ ...SETTINGS, maxCopies: {} as never }, CONFIG, 20)).toBe(2);
    expect(maxCopiesFor(SETTINGS, CONFIG, 20)).toBe(2);
  });
});

describe('scanPool', () => {
  it('reports viability and near-miss notes', () => {
    const big = scanPool(bigPool(), index, CONFIG, SETTINGS, 60, 'W');
    expect(big.possible).toBe(true);
    const tokens = big.archetypes.find((a) => a.archetype === 'tokens')!;
    expect(tokens.viable).toBe(true);
    expect(tokens.enablers.have).toBeGreaterThanOrEqual(tokens.enablers.want);

    const thin = scanPool(thinPool(), index, CONFIG, SETTINGS, 60, 'W');
    expect(thin.possible).toBe(false);
    expect(thin.notes[0]).toMatch(/more spells/);
    expect(thin.archetypes.every((a) => !a.viable)).toBe(true);
    const lifegain = big.archetypes.find((a) => a.archetype === 'lifegain')!;
    expect(lifegain.viable).toBe(false);
    expect(lifegain.notes.join(' ')).toMatch(/needs \d+ more playable Lifegain/);
  });

  it('is empty for a color the pool lacks', () => {
    const blue = scanPool(bigPool(), index, CONFIG, SETTINGS, 40, 'U');
    // Four blue creatures plus four colorless rocks.
    expect(blue.candidates).toBe(8);
    expect(blue.possible).toBe(false);
  });
});

describe('planLandCount', () => {
  it('applies base, slope, credits, rounding, and clamping', () => {
    const t = templateFor(CONFIG, 60);
    const facts = (id: string) =>
      listCandidates(bigPool(), index, CONFIG, SETTINGS, 'W', 60).find(
        (c) => c.facts.card.id === id,
      )!.facts;
    // Reference average with no sources gives the base count.
    const flat = planLandCount(t, [
      { facts: facts('w-creature-3-0'), qty: 18 },
      { facts: facts('w-creature-3-1'), qty: 18 },
    ]);
    expect(flat.averageMv).toBe(3);
    expect(flat.count).toBe(
      Math.round(t.baseLands + t.landFormula.slopePerMv * (3 - t.landFormula.referenceMv)),
    );
    // Cheap dorks earn credit.
    const dorky = planLandCount(t, [
      { facts: facts('w-creature-3-0'), qty: 30 },
      { facts: facts('w-dork-0'), qty: 4 },
    ]);
    expect(dorky.cheapManaSources).toBe(4);
    expect(dorky.credits).toBeCloseTo(4 * t.landFormula.credits.dorkCheap, 5);
    expect(dorky.count).toBeLessThanOrEqual(flat.count);
    // Clamp.
    const heavy = planLandCount(t, [{ facts: facts('w-creature-6-0'), qty: 36 }]);
    expect(heavy.count).toBe(t.landFormula.max);
  });
});

describe('compareCandidates', () => {
  const cands = listCandidates(bigPool(), index, CONFIG, SETTINGS, 'W', 60);
  const by = (id: string) => cands.find((c) => c.facts.card.id === id)!;
  it('follows the configured tiebreak order', () => {
    const cheap = by('w-creature-1-1');
    const beefy = by('w-creature-5-1');
    expect(compareCandidates(cheap, beefy, ['lowerMv', 'name'], () => 0)).toBeGreaterThan(0);
    expect(compareCandidates(beefy, cheap, ['statsPerMana', 'lowerMv'], () => 0)).toBeLessThan(0);
    expect(
      compareCandidates(beefy, cheap, ['themeTagHits', 'lowerMv'], (c) => (c === beefy ? 1 : 0)),
    ).toBeGreaterThan(0);
    // Ids break the final tie both ways, so sorting is total.
    expect(compareCandidates(cheap, beefy, [], () => 0)).toBe(
      -compareCandidates(beefy, cheap, [], () => 0),
    );
  });
});

describe('curveTargets', () => {
  it('rounds to exactly the slot count', () => {
    const shape = [0.2, 0.33, 0.25, 0.14, 0.06, 0.02, 0];
    for (const slots of [36, 23, 12, 1]) {
      const targets = curveTargets(shape, slots);
      expect(targets).toHaveLength(8);
      expect(targets[0]).toBe(0);
      expect(targets.reduce((a, b) => a + b, 0)).toBe(slots);
    }
  });
});

function build(size: DeckSize, style?: string) {
  const base = { size, color: 'W' as const, settings: SETTINGS, id: 'test', createdAt: 't' };
  return buildDeck(style ? { ...base, style } : base, bigPool(), index, CONFIG);
}

function total(deck: Deck): number {
  return (
    deck.cards.reduce((n, c) => n + c.qty, 0) +
    Object.values(deck.basics).reduce((a, b) => a + (b ?? 0), 0)
  );
}

describe('buildDeck', () => {
  it('builds exact-size, legal, deterministic decks for every size', () => {
    for (const size of [60, 40, 20] as const) {
      const a = build(size);
      const b = build(size);
      expect(total(a.deck)).toBe(size);
      expect(a).toEqual(b);
      const t = templateFor(CONFIG, size);
      expect(a.explanation.lands.count).toBeGreaterThanOrEqual(t.landFormula.min);
      expect(a.explanation.lands.count).toBeLessThanOrEqual(t.landFormula.max);
      const limit = maxCopiesFor(SETTINGS, CONFIG, size);
      for (const dc of a.deck.cards) {
        const card = index.get(dc.cardId)!;
        expect(card.identity.every((c) => c === 'W')).toBe(true);
        expect(card.unset).toBeUndefined();
        expect(dc.qty).toBeLessThanOrEqual(limit);
        expect(dc.why).toBeTruthy();
      }
      expect(a.deck.basics.W).toBeGreaterThan(0);
      expect(a.explanation.curve).toHaveLength(8);
    }
  });

  it('meets role minimums when the pool allows and honors a viable style', () => {
    const r = build(60, 'tokens');
    expect(r.deck.archetype).toBe('tokens');
    for (const [role, count] of Object.entries(r.explanation.roles)) {
      const min = templateFor(CONFIG, 60).roles[role]?.min ?? 0;
      expect(count.have, role).toBeGreaterThanOrEqual(min);
    }
    expect(r.deck.cards.some((c) => c.why?.includes('Tokens'))).toBe(true);
  });

  it('falls back with a note when the style is not viable', () => {
    const r = build(60, 'lifegain');
    expect(r.deck.archetype).not.toBe('lifegain');
    expect(r.explanation.notes.join(' ')).toMatch(/not viable/);
  });

  it('throws a plain-language error on a thin pool', () => {
    expect(() =>
      buildDeck({ size: 60, color: 'W', settings: SETTINGS }, thinPool(), index, CONFIG),
    ).toThrow(BuildError);
    expect(() =>
      buildDeck({ size: 60, color: 'U', settings: SETTINGS }, bigPool(), index, CONFIG),
    ).toThrow(/Blue/);
  });

  it('builds creature-only pools at every size by relaxing type caps in the last pass', () => {
    for (const size of [60, 40, 20] as const) {
      const r = buildDeck(
        { size, color: 'W', settings: SETTINGS, id: 't', createdAt: 't' },
        creaturePool(),
        index,
        CONFIG,
      );
      expect(total(r.deck)).toBe(size);
      expect(r.deck.cards.every((c) => index.get(c.cardId)!.types.includes('creature'))).toBe(true);
      const scan = scanPool(creaturePool(), index, CONFIG, SETTINGS, size, 'W');
      expect(scan.possible).toBe(true);
    }
  });

  it('uses good nonbasic lands and skips bad ones', () => {
    const r = build(60);
    const ids = r.deck.cards.map((c) => c.cardId);
    expect(ids).toContain('w-good-land');
    expect(r.explanation.lands.nonbasics).toBeGreaterThan(0);
    const landNotes = r.deck.cards.filter((c) => c.why?.startsWith('Land:'));
    expect(landNotes.length).toBeGreaterThan(0);
  });
});

describe('commit and return', () => {
  it('round-trips the pool, including basics only when tracked', () => {
    const pool = bigPool();
    const r = build(40);
    const { pool: after, deck: committed } = commitDeck(
      pool,
      r.deck,
      SETTINGS,
      index,
      CONFIG,
      'now',
    );
    expect(poolSize(after)).toBe(poolSize(pool) - r.deck.cards.reduce((n, c) => n + c.qty, 0));
    expect(after.entries['plains']?.qty).toBe(30);
    expect(committed.committed).toBe(true);
    expect(committed.basicsTaken).toBeUndefined();
    const back = returnDeck(after, committed, index, CONFIG, 'later');
    expect(poolSize(back)).toBe(poolSize(pool));

    // Tracked basics leave the pool and come back even if the setting flips later.
    const tracked = { ...SETTINGS, unlimitedBasics: false };
    const t = commitDeck(pool, r.deck, tracked, index, CONFIG, 'now');
    expect(t.pool.entries['plains']?.qty).toBe(30 - (r.deck.basics.W ?? 0));
    expect(t.deck.basicsTaken).toBe(true);
    const restored = returnDeck(t.pool, t.deck, index, CONFIG, 'later');
    expect(restored.entries['plains']?.qty).toBe(30);
  });

  it('makes stable ids from a seed', () => {
    expect(newDeckId('abc')).toBe(newDeckId('abc'));
    expect(newDeckId('abc')).not.toBe(newDeckId('abd'));
    expect(newDeckId('x')).toMatch(/^d[0-9a-f]{8}$/);
  });
});

describe('export', () => {
  it('groups by type with headers and basics last', () => {
    const r = build(40);
    const text = deckToDecklist(r.deck, index, CONFIG);
    expect(text.startsWith(`// ${r.deck.name}\n// 40 cards, White\n`)).toBe(true);
    expect(text).toMatch(/\/\/ Creatures \(\d+\)/);
    expect(text.trimEnd().split('\n').at(-1)).toMatch(/^\d+ Plains$/);
    const counted = text
      .split('\n')
      .filter((l) => /^\d+ /.test(l))
      .reduce((n, l) => n + Number(l.split(' ')[0]), 0);
    expect(counted).toBe(40);
  });

  it('pairs two packets of different colors and rejects the rest', () => {
    const w = build(20).deck;
    const other: Deck = { ...w, id: 'other', color: 'U', basics: { U: 8 } };
    const ok = pairPackets(w, other, index, CONFIG);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.deck.size).toBe(40);
      expect(ok.text).toContain('White and Blue');
      expect(ok.deck.basics).toEqual({ W: w.basics.W, U: 8 });
    }
    expect(pairPackets(w, w, index, CONFIG)).toMatchObject({ ok: false });
    const sixty = build(60).deck;
    expect(pairPackets(w, sixty, index, CONFIG)).toMatchObject({ ok: false });
  });
});

describe('best fit', () => {
  it('scores every deck and picks the highest score among the archetypes it tried', () => {
    const r = build(60);
    const score = r.explanation.score;
    expect(score).toBeDefined();
    expect(score!.total).toBeGreaterThan(0);
    expect(score!.total).toBeLessThanOrEqual(100);
    const note = r.explanation.notes.find((n) => n.startsWith('Compared '));
    expect(note).toBeDefined();
    const kept = Number(/\((\d+\.\d) of 100\)/.exec(note!)![1]);
    const others = [...note!.split('Others:')[1]!.matchAll(/ (\d+\.\d)(?=,|\.$)/g)].map((m) =>
      Number(m[1]),
    );
    expect(others.length).toBeGreaterThan(0);
    expect(kept).toBe(score!.total);
    for (const o of others) expect(kept).toBeGreaterThanOrEqual(o);
  });

  it('builds only the requested style when it is viable', () => {
    const r = build(60, 'tokens');
    expect(r.deck.archetype).toBe('tokens');
    expect(r.explanation.notes.some((n) => n.startsWith('Compared '))).toBe(false);
  });
});
