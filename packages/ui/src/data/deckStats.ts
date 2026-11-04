import {
  COLORS,
  isMdfcLand,
  pipDemand,
  primaryGroup,
  styleCounts,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type Deck,
} from '@bulk-brew/core';
import { TYPE_GROUPS } from './deckGroups.ts';

export interface ColorShare {
  color: Color;
  /** Colored mana symbols of this color across the spells, copies counted. */
  pips: number;
  /** Fraction of all colored symbols, 0 to 1. */
  share: number;
}

/**
 * Colored mana symbols in the spells' costs, by color: the same count the
 * mana base is built from. Spell//land cards count as spells, and hybrid
 * symbols go to the deck's main color.
 */
export function deckColorShares(deck: Deck, index: CardIndex): ColorShare[] {
  // Main color first, as the deck records it; not WUBRG order.
  const prefer = deck.colors ?? [deck.color];
  const pips: Partial<Record<Color, number>> = {};
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || (card.types.includes('land') && !isMdfcLand(card))) continue;
    for (const [c, n] of Object.entries(pipDemand(card, prefer)) as [Color, number][]) {
      pips[c] = (pips[c] ?? 0) + n * dc.qty;
    }
  }
  const total = COLORS.reduce((t, c) => t + (pips[c] ?? 0), 0);
  return COLORS.filter((c) => (pips[c] ?? 0) > 0).map((c) => ({
    color: c,
    pips: pips[c]!,
    share: pips[c]! / total,
  }));
}

export interface TypeCount {
  label: string;
  count: number;
}

/** Copies of each card type, basics included; a card counts once, under its main type. */
export function deckTypeCounts(deck: Deck, index: CardIndex): TypeCount[] {
  const counts = new Map<string, number>();
  const add = (label: string, n: number) => counts.set(label, (counts.get(label) ?? 0) + n);
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (card) add(primaryGroup(card), dc.qty);
  }
  for (const n of Object.values(deck.basics)) if ((n ?? 0) > 0) add('Lands', n!);
  return TYPE_GROUPS.filter((l) => counts.has(l)).map((label) => ({
    label,
    count: counts.get(label)!,
  }));
}

export interface StyleRow {
  key: string;
  label: string;
  have: number;
  want: number;
}

/**
 * Rows for the Roles bars: the deck's archetype cards against what the
 * archetype asks for, such as "Voltron enablers 13/13". Shapes like Aggro
 * have none; a tribe shows its creatures and the cards that reward them.
 */
export function deckStyleRows(deck: Deck, index: CardIndex, config: BulkBrewConfig): StyleRow[] {
  return styleCounts(deck, index, config).flatMap((s) => {
    const name = s.tribal ? s.id.slice('tribal:'.length) : s.label;
    return [
      {
        key: `${s.id}:enablers`,
        label: s.tribal ? `${name} creatures` : `${name} enablers`,
        ...s.enablers,
      },
      { key: `${s.id}:payoffs`, label: `${name} payoffs`, ...s.payoffs },
    ];
  });
}
