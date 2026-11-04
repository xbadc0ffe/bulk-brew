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

/**
 * A threat that ends a Commander game, where each opponent starts at 40: a
 * planeswalker costing five or more, a creature with seven or more power, an
 * evasive or trampling creature with five or more, or an evasive double
 * striker with three or more. Overruns and extra combats come from tags in
 * roles.json.
 */
export function isCommanderFinisher(card: CardRecord): boolean {
  if (card.types.includes('planeswalker')) return card.mv >= 5;
  if (!isCreature(card)) return false;
  const p = powerValue(card);
  if (p >= 7) return true;
  const evasive = isEvasiveCreature(card) || card.keywords.includes('Trample');
  if (evasive && p >= 5) return true;
  return evasive && p >= 3 && card.keywords.includes('Double strike');
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

/** Subtypes of other card types that can sit beside creature types on one type line. */
const NOT_CREATURE_TYPES = new Set([
  'Aura',
  'Background',
  'Case',
  'Class',
  'Clue',
  'Equipment',
  'Food',
  'Room',
  'Saga',
  'Shrine',
  'Treasure',
  'Vehicle',
]);

/** Creature types on the front face of a creature or kindred card. */
export function creatureTypes(card: CardRecord): string[] {
  if (!card.types.includes('creature') && !card.types.includes('kindred')) return [];
  const front = card.typeLine.split('//')[0] ?? '';
  const sub = front.split('—')[1];
  return sub
    ? sub
        .trim()
        .split(/\s+/)
        .filter((t) => !NOT_CREATURE_TYPES.has(t))
    : [];
}

/** A card counts toward a tribe when it has the type, or is a changeling (every type). */
export function inTribe(card: CardRecord, type: string): boolean {
  return card.keywords.includes('Changeling') || creatureTypes(card).includes(type);
}

/** Whether a card may be a commander (CR 903.3 and 903.3a) and is legal in the format. */
export function canBeCommander(card: CardRecord): boolean {
  if (card.commanderLegality) return false;
  if (card.unset) return false;
  if (/can be your commander/i.test(card.text)) return true;
  const front = card.typeLine.split('//')[0] ?? '';
  if (!/\bLegendary\b/.test(front)) return false;
  if (/\bCreature\b/.test(front)) return true;
  // A card that is a creature everywhere but the battlefield is a creature card in the deck.
  if (/isn't on the battlefield, it's an? [^.]*\bcreature\b/i.test(card.text)) return true;
  if (/\bVehicle\b/.test(front)) return true;
  return /\bSpacecraft\b/.test(front) && card.power !== undefined && card.toughness !== undefined;
}

/**
 * Copies of a card a Commander deck may hold: one, more for cards whose text
 * allows it ("any number of cards named", "up to seven cards named").
 */
export function commanderCopies(card: CardRecord): number {
  if (/a deck can have any number of cards named/i.test(card.text)) return Infinity;
  const m = /a deck can have up to (\w+) cards named/i.exec(card.text);
  if (m) {
    const words: Record<string, number> = {
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    return words[m[1]!.toLowerCase()] ?? (Number.parseInt(m[1]!, 10) || 1);
  }
  return 1;
}

/** Cards whose mana or effect depends on a commander do nothing outside Commander. */
export function needsCommander(card: CardRecord): boolean {
  let text = card.text.replace(/\([^)]*\)/g, '');
  // Cards name themselves in their text; "Benalish Commander" is not about a commander.
  for (const name of [card.name, ...(card.faces ?? []).map((f) => f.name)])
    text = text.split(name).join('');
  return /\bcommander\b/i.test(text);
}

export function isMdfcLand(card: CardRecord): boolean {
  return card.layout === 'modal_dfc' && isLand(card) && !/^Land\b/.test(card.typeLine);
}

export function evaluateDerived(card: CardRecord, predicate: DerivedPredicate): boolean {
  switch (predicate) {
    case 'finisher':
      return isFinisher(card);
    case 'commanderFinisher':
      return isCommanderFinisher(card);
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
  if (c.excludeTypeLine && c.excludeTypeLine.some((w) => card.typeLine.includes(w))) return false;
  if (c.minMv !== undefined && card.mv < c.minMv) return false;
  if (c.maxMv !== undefined && card.mv > c.maxMv) return false;
  if (c.derived !== undefined && !evaluateDerived(card, c.derived)) return false;
  return true;
}

/** True when any clause matches. */
export function cardMatches(card: CardRecord, matcher: Matcher): boolean {
  return matcher.some((clause) => clauseMatches(card, clause));
}
