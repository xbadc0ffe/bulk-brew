import { createContext, useContext } from 'react';
import type { CardIndex } from '@bulk-brew/core';
import type { PackState, PoolState } from '@bulk-brew/ui';

export interface AppState {
  pack: PackState;
  /** Convenience: the index when the pack is ready. */
  index: CardIndex | undefined;
  pool: PoolState;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
