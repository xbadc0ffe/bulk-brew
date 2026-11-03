import { useMemo, type ReactNode } from 'react';
import { openKv, usePack, usePool } from '@bulk-brew/ui';
import { AppContext, type AppState } from './app-context.ts';

const PACK_URL = `${import.meta.env.BASE_URL}data/cards.v1.json`;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const kv = useMemo(() => openKv(), []);
  const pack = usePack(PACK_URL);
  const pool = usePool(kv);
  const value: AppState = {
    pack,
    index: pack.status === 'ready' ? pack.index : undefined,
    pool,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
