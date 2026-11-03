import { createContext, useContext } from 'react';
import type { BulkBrewConfig, CardIndex } from '@bulk-brew/core';
import type { BuildFlow, DecksState, PackState, PoolState, SettingsState } from '@bulk-brew/ui';

export interface AppState {
  pack: PackState;
  /** Convenience: the index when the pack is ready. */
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  settings: SettingsState;
  decks: DecksState;
  /** Build screen state, kept here so it survives navigation. */
  build: BuildFlow;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
