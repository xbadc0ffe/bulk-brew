// Evaluates config matchers against cards. The only place card facts are
// turned into "this card is removal" style judgments, so roles, archetypes,
// and synergy rules all read the same way.

import type { DerivedPredicate, Matcher, MatcherClause } from './config.ts';
import type { CardRecord } from './types.ts';

/** Keywords that let a creature get past blockers. Trample is deliberately not here. */
const EVASION_KEYWORDS = [
  'Flying',
  'Menace',
  'Skulk',
  'Shadow',
  'Fear',
  'Intimidate',
  'Horsemanship',
];

/** Numeric power for "big creature" checks. Stars and formulas count as zero. */
export function powerValue(card: CardRecord): number {
  const n = Number.parseInt(card.power ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

export function isCreature(card: CardRecord): boolean {
  return card.types.includes('creature');
}

export function isLand(card: CardRecord): boolean {
  return card.types.includes('land');
}

export function isBasicLand(card: CardRecord): boolean {
  return /^Basic (Snow )?Land\b/.test(card.typeLine);
}

/**
 * Evasion by keyword or the "unblockable" tag. The broader "evasion" tag also
 * covers landwalk and conditional cases, so it is not used here.
 */
export function isEvasiveCreature(card: CardRecord): boolean {
  if (!isCreature(card)) return false;
  return (
    card.tags.includes('unblockable') || card.keywords.some((k) => EVASION_KEYWORDS.includes(k))
  );
}

/**
 * A threat that ends games on its own: a big body, a big evasive body, or a
 * planeswalker costing four or more. Cheap walkers are value, not finishers.
 */
export function isFinisher(card: CardRecord): boolean {
  if (card.types.includes('planeswalker')) return card.mv >= 4;
  if (!isCreature(card)) return false;
  const p = powerValue(card);
  if (card.mv >= 4 && p >= 4) return true;
  return card.mv >= 4 && p >= 3 && isEvasiveCreature(card);
}

export type ManaSourceKind = 'rock' | 'dork' | 'landRamp';

/** Nonland mana source costing 3 or less, for the land formula. */
export function manaSourceKind(card: CardRecord): ManaSourceKind | undefined {
  if (isLand(card) || card.mv > 3) return undefined;
  // "donate-" tags mark effects that ramp the opponent, not you.
  if (card.tags.some((t) => t.startsWith('donate-'))) return undefined;
  if (card.tags.includes('mana-dork') && isCreature(card)) return 'dork';
  if (card.tags.includes('mana-rock')) return 'rock';
  // "land-ramp" also covers extra-land effects, which want more lands, not fewer.
  if (card.tags.includes('tutor-land-to-battlefield')) return 'landRamp';
  if (card.tags.includes('mana-producer')) return isCreature(card) ? 'dork' : 'rock';
  return undefined;
}

/** Every mana cost printed on the card: the card's own cost plus each face's. */
export function manaCostsOf(card: CardRecord): string[] {
  const costs: string[] = [];
  if (card.manaCost) costs.push(card.manaCost);
  for (const f of card.faces ?? []) if (f.manaCost) costs.push(f.manaCost);
  return costs;
}

/**
 * A {C} pip needs colorless mana specifically. Such cards have an empty color
 * identity, so they would fit every color, yet a deck of basics cannot pay them.
 */
export function hasColorlessPip(card: CardRecord): boolean {
  return manaCostsOf(card).some((cost) => /\{C\}/i.test(cost));
}

export function isMdfcLand(card: CardRecord): boolean {
  return card.layout === 'modal_dfc' && isLand(card) && !/^Land\b/.test(card.typeLine);
}

export function evaluateDerived(card: CardRecord, predicate: DerivedPredicate): boolean {
  switch (predicate) {
    case 'finisher':
      return isFinisher(card);
    case 'cheapManaSource':
      return manaSourceKind(card) !== undefined;
    case 'evasiveCreature':
      return isEvasiveCreature(card);
    case 'mdfcLand':
      return isMdfcLand(card);
    case 'basicLand':
      return isBasicLand(card);
    case 'nonbasicLand':
      return isLand(card) && !isBasicLand(card);
  }
}

export function clauseMatches(card: CardRecord, c: MatcherClause): boolean {
  if (c.anyTags && !c.anyTags.some((t) => card.tags.includes(t))) return false;
  if (c.allTags && !c.allTags.every((t) => card.tags.includes(t))) return false;
  if (c.excludeTags && c.excludeTags.some((t) => card.tags.includes(t))) return false;
  if (c.anyKeywords && !c.anyKeywords.some((k) => card.keywords.includes(k))) return false;
  if (c.types && !c.types.every((t) => card.types.includes(t))) return false;
  if (c.anyTypes && !c.anyTypes.some((t) => card.types.includes(t))) return false;
  if (c.excludeTypes && c.excludeTypes.some((t) => card.types.includes(t))) return false;
  if (c.typeLineAny && !c.typeLineAny.some((w) => card.typeLine.includes(w))) return false;
  if (c.minMv !== undefined && card.mv < c.minMv) return false;
  if (c.maxMv !== undefined && card.mv > c.maxMv) return false;
  if (c.derived !== undefined && !evaluateDerived(card, c.derived)) return false;
  return true;
}

/** True when any clause matches. */
export function cardMatches(card: CardRecord, matcher: Matcher): boolean {
  return matcher.some((clause) => clauseMatches(card, clause));
}
