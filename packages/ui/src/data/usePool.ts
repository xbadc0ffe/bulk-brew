import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addToPool,
  emptyPool,
  removeFromPool,
  setPoolQty,
  type Pool,
  type PoolEntry,
} from '@bulk-brew/core';
import type { KeyValueStore } from '../storage/kv.ts';

const POOL_KEY = 'pool';

export interface PoolActions {
  add(entries: PoolEntry[]): void;
  remove(cardId: string, qty?: number): void;
  setQty(cardId: string, qty: number): void;
  clear(): void;
}

export interface PoolState {
  pool: Pool;
  /** False until the saved pool has been read from storage. */
  loaded: boolean;
  actions: PoolActions;
}

/** The active pool, loaded from and saved to the key-value store. */
export function usePool(kv: KeyValueStore): PoolState {
  const [pool, setPool] = useState<Pool>(() => emptyPool());
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    kv.get<Pool>(POOL_KEY)
      .then((saved) => {
        if (cancelled) return;
        // Never clobber edits made while the saved pool was still loading.
        if (saved && saved.entries && !dirty.current) setPool(saved);
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
    void kv.set(POOL_KEY, pool);
  }, [kv, pool, loaded]);

  const update = useCallback((fn: (p: Pool) => Pool) => {
    dirty.current = true;
    setPool(fn);
  }, []);

  const actions: PoolActions = {
    add: useCallback((entries) => update((p) => addToPool(p, entries)), [update]),
    remove: useCallback((cardId, qty) => update((p) => removeFromPool(p, cardId, qty)), [update]),
    setQty: useCallback((cardId, qty) => update((p) => setPoolQty(p, cardId, qty)), [update]),
    clear: useCallback(() => update(() => emptyPool()), [update]),
  };

  return { pool, loaded, actions };
}
