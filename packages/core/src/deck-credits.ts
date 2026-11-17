// What a card earns in one deck: each credit the config gives it (a role or a
// theme side) held against what the deck supplies, by the card needs reader.
// Deck views use it so they never show a credit the deck cannot pay for, such
// as Card advantage on a card whose draw needs counters in a deck with none.
// Outside a deck (the Bulk List) every credit shows.

import { addSupply, creditEarned, deckSupply, themeCredit, type DeckSupply } from './card-needs.ts';
import type { BulkBrewConfig } from './config.ts';
import type { CardIndex } from './pack.ts';
import { COLORS, type CardRecord, type Color, type Deck } from './types.ts';

/** A deck's supply, with each credit checked against it once. */
export interface DeckCredits {
  readonly supply: DeckSupply;
  /** Whether the card earns a credit (a role id or a `themeCredit`) here. */
  earned(card: CardRecord, credit: string): boolean;
}

/** The deck's colors as the supply reads them: its own and those of its basics. */
function supplyColors(deck: Deck): Color[] {
  const set = new Set<Color>(deck.colors ?? [deck.color]);
  for (const c of COLORS) if ((deck.basics[c] ?? 0) > 0) set.add(c);
  return [...set];
}

/** What a deck supplies: its cards and copies (the commander among them), colors, and size. */
export function supplyOfDeck(deck: Deck, index: CardIndex, config: BulkBrewConfig): DeckSupply {
  const cards: { card: CardRecord; qty: number }[] = [];
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (card) cards.push({ card, qty: dc.qty });
  }
  const commander = deck.commander ? index.get(deck.commander) : undefined;
  return deckSupply(
    { cards, ...(commander ? { commander } : {}), colors: supplyColors(deck), size: deck.size },
    config,
  );
}

/** Credits checked against a supply, each card and credit once. The supply must not change after. */
export function creditsFor(supply: DeckSupply, config: BulkBrewConfig): DeckCredits {
  const memo = new Map<string, boolean>();
  return {
    supply,
    earned(card, credit) {
      const key = `${card.id}|${credit}`;
      let v = memo.get(key);
      if (v === undefined) memo.set(key, (v = creditEarned(card, credit, supply, config)));
      return v;
    },
  };
}

const cache = new WeakMap<Deck, WeakMap<CardIndex, WeakMap<BulkBrewConfig, DeckCredits>>>();

/**
 * A deck's credits, computed once per deck object, index, and config, so a
 * view can ask on every render. Decks are treated as immutable: a changed
 * deck is a new object.
 */
export function deckCredits(deck: Deck, index: CardIndex, config: BulkBrewConfig): DeckCredits {
  let byIndex = cache.get(deck);
  if (!byIndex) cache.set(deck, (byIndex = new WeakMap()));
  let byConfig = byIndex.get(index);
  if (!byConfig) byIndex.set(index, (byConfig = new WeakMap()));
  let out = byConfig.get(config);
  if (!out) byConfig.set(config, (out = creditsFor(supplyOfDeck(deck, index, config), config)));
  return out;
}

/** A copy of a supply with `outQty` copies of one card taken out and `inQty` of another put in. */
export function swapSupply(
  supply: DeckSupply,
  out: CardRecord,
  outQty: number,
  into: CardRecord,
  inQty: number,
  config: BulkBrewConfig,
): DeckSupply {
  const next: DeckSupply = {
    ...supply,
    colors: [...supply.colors],
    counts: new Map(supply.counts),
    devotion: new Map(supply.devotion),
  };
  addSupply(next, out, -outQty, config);
  addSupply(next, into, inQty, config);
  return next;
}

/** Whether the card earns a theme side: `setup` for an enabler, `payoff` for a payoff. */
export function earnedTheme(
  card: CardRecord,
  style: string,
  side: 'setup' | 'payoff',
  credits: DeckCredits,
): boolean {
  return credits.earned(card, themeCredit(style, side));
}
