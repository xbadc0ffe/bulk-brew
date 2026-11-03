import { useMemo } from 'react';
import {
  commitDeck,
  returnDeck,
  type BulkBrewConfig,
  type CardIndex,
  type Deck,
  type Settings,
} from '@bulk-brew/core';
import { poolShortfall, shortfallMessage } from './poolCheck.ts';
import type { DecksState } from './useDecks.ts';
import type { PoolState } from './usePool.ts';

export interface DeckActions {
  /** Return the cards if they left the pool, then delete the deck. */
  disassemble(deck: Deck): void;
  /** Delete the deck and leave the pool as it is. */
  deleteOnly(deck: Deck): void;
  /**
   * Take a saved deck's cards out of the pool. Returns a message instead when
   * the pool no longer holds them all; no-op when already removed.
   */
  removeFromPool(deck: Deck): string | undefined;
}

/** Saved-deck actions shared by both apps. Confirmation is the caller's job. */
export function useDeckActions(input: {
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  decks: DecksState;
  settings: Settings;
}): DeckActions {
  const { index, config, pool, decks, settings } = input;
  return useMemo(
    () => ({
      disassemble(deck) {
        if (!index) return;
        if (deck.committed) {
          const now = new Date().toISOString();
          pool.actions.transform((p) => returnDeck(p, deck, index, config, now));
        }
        decks.remove(deck.id);
      },
      deleteOnly(deck) {
        decks.remove(deck.id);
      },
      removeFromPool(deck) {
        if (!index || deck.committed) return undefined;
        const short = poolShortfall(pool.pool, deck, settings, index, config);
        if (short > 0) return shortfallMessage(short);
        const now = new Date().toISOString();
        const { deck: committed } = commitDeck(pool.pool, deck, settings, index, config, now);
        pool.actions.transform((p) => commitDeck(p, deck, settings, index, config, now).pool);
        decks.update(committed);
        return undefined;
      },
    }),
    [index, config, pool.pool, pool.actions, decks, settings],
  );
}

/** The confirmation text for Disassemble, which deletes an uncommitted deck outright. */
export function disassembleQuestion(deck: Deck): string {
  return deck.committed
    ? `Disassemble "${deck.name}"? Its cards go back to the pool and the deck is deleted.`
    : `Delete "${deck.name}"? Its cards never left the pool.`;
}
