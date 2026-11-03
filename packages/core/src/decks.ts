// Moving cards between a deck and the pool. Pure: timestamps and ids come
// from the caller.

import type { BulkBrewConfig } from './config.ts';
import type { CardIndex } from './pack.ts';
import { addToPool, removeFromPool } from './pool.ts';
import {
  COLORS,
  type Color,
  type Deck,
  type Pool,
  type PoolEntry,
  type Settings,
} from './types.ts';

/** Oracle id of the basic land for a color, per the land rules' names. */
export function basicCardId(
  index: CardIndex,
  config: BulkBrewConfig,
  color: Color,
): string | undefined {
  return index.find(config.landRules.basics.names[color])?.id;
}

/** Pool entries a deck consumes: its cards, plus basics when asked. */
export function deckEntries(
  deck: Deck,
  includeBasics: boolean,
  index: CardIndex,
  config: BulkBrewConfig,
): PoolEntry[] {
  const entries: PoolEntry[] = deck.cards.map((c) => {
    const e: PoolEntry = { cardId: c.cardId, qty: c.qty };
    if (c.printing) e.printing = c.printing;
    return e;
  });
  if (includeBasics) {
    for (const color of COLORS) {
      const qty = deck.basics[color] ?? 0;
      const id = qty > 0 ? basicCardId(index, config, color) : undefined;
      if (id) entries.push({ cardId: id, qty });
    }
  }
  return entries;
}

export interface CommitResult {
  pool: Pool;
  /** The deck marked committed, with basicsTaken set when basics left the pool. */
  deck: Deck;
}

/**
 * Remove the deck's cards from the pool. Basics leave the pool only when they
 * are tracked; the deck remembers that, so returning it later does not depend
 * on the setting at that time.
 */
export function commitDeck(
  pool: Pool,
  deck: Deck,
  settings: Settings,
  index: CardIndex,
  config: BulkBrewConfig,
  now: string,
): CommitResult {
  const takeBasics = !settings.unlimitedBasics;
  let next = pool;
  for (const e of deckEntries(deck, takeBasics, index, config)) {
    next = removeFromPool(next, e.cardId, e.qty, now);
  }
  const committed: Deck = { ...deck, committed: true };
  if (takeBasics) committed.basicsTaken = true;
  else delete committed.basicsTaken;
  return { pool: next, deck: committed };
}

/** Put the deck's cards back into the pool, basics included only if the commit took them. */
export function returnDeck(
  pool: Pool,
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
  now: string,
): Pool {
  return addToPool(pool, deckEntries(deck, deck.basicsTaken === true, index, config), now);
}

/** Short stable id from a seed string (FNV-1a), so callers can pass time plus content. */
export function newDeckId(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `d${h.toString(16).padStart(8, '0')}`;
}
