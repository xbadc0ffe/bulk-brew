import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck } from '@bulk-brew/core';
import type { KeyValueStore } from '../storage/kv.ts';

const DECKS_KEY = 'decks';

export interface DecksState {
  decks: Deck[];
  loaded: boolean;
  save(deck: Deck): void;
  update(deck: Deck): void;
  remove(id: string): void;
  /** Replace the whole list, for restoring a backup. */
  replaceAll(decks: Deck[]): void;
}

/** Saved decks, newest first, persisted in the key-value store. */
export function useDecks(kv: KeyValueStore): DecksState {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);
  /** Ids removed before the stored list arrived, so the load does not resurrect them. */
  const removed = useRef(new Set<string>());
  /** A restore before the load wins outright. */
  const replaced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    kv.get<Deck[]>(DECKS_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (Array.isArray(saved) && !replaced.current) {
          // Edits made before the load win: keep current decks, add stored ones they lack.
          setDecks((current) => {
            const have = new Set(current.map((d) => d.id));
            const extra = saved.filter((d) => !have.has(d.id) && !removed.current.has(d.id));
            return extra.length ? [...current, ...extra] : current.length ? current : saved;
          });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kv]);

  useEffect(() => {
    if (!loaded || !dirty.current) return;
    dirty.current = false;
    void kv.set(DECKS_KEY, decks);
  }, [kv, decks, loaded]);

  const change = useCallback((fn: (d: Deck[]) => Deck[]) => {
    dirty.current = true;
    setDecks(fn);
  }, []);

  return {
    decks,
    loaded,
    save: useCallback(
      (deck) => change((d) => [deck, ...d.filter((x) => x.id !== deck.id)]),
      [change],
    ),
    update: useCallback(
      (deck) => change((d) => d.map((x) => (x.id === deck.id ? deck : x))),
      [change],
    ),
    remove: useCallback(
      (id) => {
        removed.current.add(id);
        change((d) => d.filter((x) => x.id !== id));
      },
      [change],
    ),
    replaceAll: useCallback(
      (list) => {
        replaced.current = true;
        change(() => [...list]);
      },
      [change],
    ),
  };
}
