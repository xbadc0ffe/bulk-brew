import { describe, expect, it } from 'vitest';
import { buildDeck, styleCounts } from '../src/builder.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool, secondaryChoices, tribesOf } from '../src/scan.ts';
import { listCandidates } from '../src/candidates.ts';
import type { CardRecord, Pool } from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';

const base = PACK.cards.find((c) => c.id === 'w-creature-2-0')!;
const birds: CardRecord[] = Array.from({ length: 5 }, (_, i) => ({
  ...base,
  id: `bird-${i}`,
  name: `Bird ${i}`,
  typeLine: 'Creature — Bird Soldier',
  mv: (i % 3) + 1,
  keywords: ['Flying'],
}));
const lord: CardRecord = {
  ...base,
  id: 'bird-lord',
  name: 'Bird Lord',
  typeLine: 'Creature — Bird',
  tags: ['typal-bird', 'anthem'],
};
const shifter: CardRecord = {
  ...base,
  id: 'shifter',
  name: 'Shifter',
  typeLine: 'Creature — Shapeshifter',
  keywords: ['Changeling'],
};
const pack = {
  ...PACK,
  cards: [...PACK.cards, ...birds, lord, shifter],
  cardCount: PACK.cardCount + 7,
};
const index = new CardIndex(pack);

function poolWithBirds(): Pool {
  const pool = bigPool();
  for (const c of [...birds, lord, shifter]) pool.entries[c.id] = { cardId: c.id, qty: 4 };
  return pool;
}

describe('tribes', () => {
  it('counts members, changelings in every tribe, and type payoffs', () => {
    const cands = listCandidates(poolWithBirds(), index, CONFIG, SETTINGS, 'W', 60);
    const bird = tribesOf(cands).find((t) => t.type === 'Bird');
    // 5 birds and the lord at 4 copies each, plus 4 changelings.
    expect(bird).toEqual({ type: 'Bird', members: 28, payoffs: 4 });
  });

  it('offers the tribe and other styles as secondary choices, but not a second shape under a shape', () => {
    const scan = scanPool(poolWithBirds(), index, CONFIG, SETTINGS, 60, ['W']);
    const underTokens = secondaryChoices(scan, CONFIG, 'tokens');
    expect(underTokens.some((c) => c.id === 'tribal:Bird' && c.state === 'viable')).toBe(true);
    expect(underTokens.some((c) => c.id === 'aggro')).toBe(true);
    expect(underTokens.some((c) => c.id === 'tokens')).toBe(false);
    const underAggro = secondaryChoices(scan, CONFIG, 'aggro');
    expect(underAggro.some((c) => c.kind === 'composition')).toBe(false);
  });
});

describe('secondary styles', () => {
  const request = {
    size: 60 as const,
    colors: ['W' as const],
    settings: SETTINGS,
    id: 't',
    createdAt: 't',
  };

  it('builds a primary theme with a tribe and says whether the tribe was met', () => {
    const r = buildDeck(
      { ...request, style: 'tokens', secondary: 'tribal:Bird' },
      poolWithBirds(),
      index,
      CONFIG,
    );
    expect(r.deck.name).toContain('with Bird tribe');
    expect(r.deck.secondary).toBe('tribal:Bird');
    expect(r.explanation.secondary).toMatchObject({ id: 'tribal:Bird', met: true });
    const members = r.deck.cards
      .filter((c) => c.cardId.startsWith('bird') || c.cardId === 'shifter')
      .reduce((n, c) => n + c.qty, 0);
    expect(members).toBeGreaterThanOrEqual(CONFIG.builderWeights.secondary.tribal['60'].enablers);
    const counts = styleCounts(r.deck, index, CONFIG);
    expect(counts.map((s) => [s.id, s.tribal])).toEqual([
      ['tokens', false],
      ['tribal:Bird', true],
    ]);
    expect(counts[1]!.enablers).toEqual({
      have: members,
      want: CONFIG.builderWeights.secondary.tribal['60'].enablers,
    });
  });

  it('lets a shape lead the curve under a themed primary', () => {
    const r = buildDeck(
      { ...request, style: 'tokens', secondary: 'aggro' },
      bigPool(),
      index,
      CONFIG,
    );
    expect(r.deck.name).toContain('Tokens with Aggro');
    expect(r.explanation.secondary?.met).toBe(true);
  });

  it('notes a shape under a shape, and a secondary without a primary', () => {
    const shapes = buildDeck(
      { ...request, style: 'aggro', secondary: 'control' },
      bigPool(),
      index,
      CONFIG,
    );
    expect(shapes.explanation.notes.join(' ')).toMatch(/cannot be a secondary archetype/);
    expect(shapes.explanation.secondary).toBeUndefined();
    const alone = buildDeck({ ...request, secondary: 'tokens' }, bigPool(), index, CONFIG);
    expect(alone.explanation.notes.join(' ')).toMatch(/needs a primary archetype/);
  });
});
