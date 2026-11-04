import { describe, expect, it } from 'vitest';
import { preferredCopies } from '../src/candidates.ts';
import { cardStrength, coloredPips } from '../src/strength.ts';
import type { CardRecord } from '../src/types.ts';
import { CONFIG } from './config.test.ts';

const CFG = CONFIG.cardStrength;

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{W}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    ...partial,
  };
}

const vanilla = card({ id: 'v', name: 'Vanilla', power: '2', toughness: '2' });

describe('cardStrength', () => {
  it('rates an effect on a body above the same vanilla body', () => {
    const removalBody = card({
      ...vanilla,
      id: 'r',
      name: 'Removal Body',
      tags: ['removal-creature'],
    });
    expect(cardStrength(removalBody, CFG).score).toBeGreaterThan(cardStrength(vanilla, CFG).score);
  });

  it('rates better stats and useful keywords higher', () => {
    const big = card({ ...vanilla, id: 'b', name: 'Big', power: '3', toughness: '3' });
    const flyer = card({ ...vanilla, id: 'f', name: 'Flyer', keywords: ['Flying'] });
    const wall = card({ ...vanilla, id: 'w', name: 'Wall', keywords: ['Defender'] });
    const base = cardStrength(vanilla, CFG).score;
    expect(cardStrength(big, CFG).score).toBeGreaterThan(base);
    expect(cardStrength(flyer, CFG).score).toBeGreaterThan(base);
    expect(cardStrength(wall, CFG).score).toBeLessThan(base);
  });

  it('ranks unconditional removal above removal that only hits attackers or blockers', () => {
    const spell = { types: ['instant' as const], typeLine: 'Instant' };
    const exile = card({
      id: 'e',
      name: 'Exile',
      ...spell,
      tags: ['removal-creature', 'removal-exile'],
    });
    const narrow = card({
      id: 'n',
      name: 'Narrow',
      ...spell,
      tags: ['removal-creature', 'hate-attacker'],
    });
    expect(cardStrength(exile, CFG).score).toBeGreaterThan(cardStrength(narrow, CFG).score);
  });

  it('counts popularity when a rank is known and stays neutral when it is not', () => {
    const popular = card({ ...vanilla, id: 'p', name: 'Popular', rank: 10 });
    const obscure = card({ ...vanilla, id: 'o', name: 'Obscure', rank: 30000 });
    expect(cardStrength(popular, CFG).score).toBeGreaterThan(cardStrength(vanilla, CFG).score);
    expect(cardStrength(obscure, CFG).score).toBeLessThan(cardStrength(vanilla, CFG).score);
  });

  it('ignores star stats and stays inside the configured range', () => {
    const star = card({ ...vanilla, id: 's', name: 'Star', power: '*', toughness: '*' });
    const parts = cardStrength(star, CFG).parts.map((p) => p.label);
    expect(parts).not.toContain('stats for its cost');
    const loaded = card({
      ...vanilla,
      id: 'l',
      name: 'Loaded',
      rank: 1,
      power: '9',
      toughness: '9',
      keywords: ['Flying', 'Double strike', 'Indestructible'],
      tags: ['removal-creature', 'sweeper', 'draw-engine', 'anthem', 'counterspell'],
    });
    const s = cardStrength(loaded, CFG).score;
    expect(s).toBeLessThanOrEqual(CFG.max);
    expect(s).toBeGreaterThanOrEqual(CFG.min);
  });

  it('counts colored pips, hybrid and Phyrexian symbols once each', () => {
    expect(coloredPips(card({ id: 'a', name: 'A', manaCost: '{2}{W}{W}' }))).toBe(2);
    expect(coloredPips(card({ id: 'h', name: 'H', manaCost: '{W/U}{W/P}{1}' }))).toBe(2);
    expect(coloredPips(card({ id: 'g', name: 'G', manaCost: '{3}' }))).toBe(0);
  });
});

describe('preferredCopies', () => {
  const caps = { legendary: 2, expensiveMv: 6, expensive: 2 };
  it('caps legendary and expensive cards below the deck limit', () => {
    expect(preferredCopies(vanilla, 4, caps)).toBe(4);
    expect(
      preferredCopies(
        card({ ...vanilla, id: 'l', name: 'L', typeLine: 'Legendary Creature — Human' }),
        4,
        caps,
      ),
    ).toBe(2);
    expect(preferredCopies(card({ ...vanilla, id: 'x', name: 'X', mv: 6 }), 4, caps)).toBe(2);
    expect(preferredCopies(card({ ...vanilla, id: 'y', name: 'Y', mv: 7 }), 1, caps)).toBe(1);
  });
});
