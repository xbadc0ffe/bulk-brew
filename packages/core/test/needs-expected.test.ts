import { describe, expect, it } from 'vitest';
import expected from './needs-expected.json';
import { CONFIG } from './config.test.ts';
import { compareExpectations, type ExpectedCard } from './needs-compare.ts';

/**
 * Known disagreements, `card | item` to why. Each is a reading the reader cannot
 * make from templates, or an expectation that left out what the reader lists on
 * purpose. Keep this short; a new disagreement fails the test.
 */
const ALLOWED: Record<string, string> = {
  "Cleric of Life's Bond | self":
    'its lifegain comes from another Cleric entering; the reader lists it and needMet checks the Cleric (selfVia)',
  'Ravenous Robots | self':
    'its tokens come from casting an artifact spell; the reader lists them and needMet checks the artifacts (selfVia)',
  'Harness the Storm | ability "Whenever you cast an instant or sorcery spell from your hand"':
    '"a card with the same name as that spell" is an instant or sorcery only through the trigger',
  'Gleaming Overseer | ability "Zombie tokens you control have hexproof and menace"':
    'the deck supply counts Zombies and tokens, not Zombie tokens, so the reader reads Zombies',
  'Gleaming Overseer | self': 'follows from reading "Zombie tokens" as Zombies',
  'Jared Carthalion | self':
    'its +1 makes a token that is all colors, which the reader counts toward its -3; the expectation did not',
};

const cards = (expected as unknown as { cards: ExpectedCard[] }).cards;

describe('the card needs reader against independent expectations', () => {
  const result = compareExpectations(CONFIG, cards);
  const keys = result.disagreements.map((d) => `${d.card} | ${d.item}`);

  it('reads the expected cards', () => {
    expect(cards.length).toBe(317);
    expect(result.abilities).toBeGreaterThan(600);
  });

  it('disagrees only where the allowlist says why', () => {
    const unexpected = result.disagreements
      .filter((d) => !(`${d.card} | ${d.item}` in ALLOWED))
      .map((d) => `${d.card} | ${d.item} | ${d.detail}`);
    expect(unexpected).toEqual([]);
  });

  it('has no stale allowlist entries', () => {
    expect(Object.keys(ALLOWED).filter((k) => !keys.includes(k))).toEqual([]);
    expect(Object.keys(ALLOWED).length).toBeLessThan(20);
  });
});
