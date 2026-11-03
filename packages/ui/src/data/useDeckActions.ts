import { useMemo } from 'react';
import {
  commitDeck,
  newDeckId,
  pairPackets,
  returnDeck,
  type BulkBrewConfig,
  type CardIndex,
  type Deck,
  type Pool,
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
  /**
   * Replace two 20-card packets with one 40-card deck. A packet whose cards
   * are still in the pool is taken out of it first. Returns the new deck, or
   * a message when that cannot happen.
   */
  merge(a: Deck, b: Deck): { deck: Deck } | { error: string };
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
      merge(a, b) {
        if (!index) return { error: 'Card data is still loading.' };
        const pair = pairPackets(a, b, index, config);
        if (!pair.ok) return { error: pair.error };
        const now = new Date().toISOString();
        // Take out, in order, any packet whose cards are still in the pool.
        const commitAll = (start: Pool): { pool: Pool; decks: Deck[] } | string => {
          let p = start;
          const out: Deck[] = [];
          for (const d of [a, b]) {
            if (d.committed) {
              out.push(d);
              continue;
            }
            const short = poolShortfall(p, d, settings, index, config);
            if (short > 0) return shortfallMessage(short, 'merge');
            const r = commitDeck(p, d, settings, index, config, now);
            p = r.pool;
            out.push(r.deck);
          }
          return { pool: p, decks: out };
        };
        const check = commitAll(pool.pool);
        if (typeof check === 'string') return { error: check };
        if (!a.committed || !b.committed)
          pool.actions.transform((p) => {
            const r = commitAll(p);
            return typeof r === 'string' ? p : r.pool;
          });
        const [ca, cb] = check.decks as [Deck, Deck];
        // A merged deck either took all its basics or none. When only one
        // packet took its basics, give those back now, so a later
        // disassemble returns exactly what left the pool.
        const tookBasics = [ca, cb].filter((d) => d.basicsTaken);
        if (tookBasics.length === 1) {
          const only = { ...tookBasics[0]!, cards: [] };
          pool.actions.transform((p) => returnDeck(p, only, index, config, now));
        }
        const merged: Deck = {
          ...pair.deck,
          id: newDeckId(`${now}:${a.id}+${b.id}`),
          createdAt: now,
          committed: true,
        };
        if (tookBasics.length === 2) merged.basicsTaken = true;
        else delete merged.basicsTaken;
        decks.remove(a.id);
        decks.remove(b.id);
        decks.save(merged);
        return { deck: merged };
      },
    }),
    [index, config, pool.pool, pool.actions, decks, settings],
  );
}

/** What Disassemble will do, for its confirmation. */
export function disassembleQuestion(deck: Deck): string {
  const cards = deck.cards.reduce((n, c) => n + c.qty, 0);
  return deck.committed
    ? `This deletes "${deck.name}" and returns its ${cards} cards to your bulk list.`
    : `This deletes "${deck.name}". Its cards are still in your bulk list.`;
}
