import { createContext, useContext } from 'react';
import type { BulkBrewConfig, CardIndex } from '@bulk-brew/core';
import type {
  AppearanceState,
  BuildFlow,
  CardDetailState,
  DecksState,
  KeyValueStore,
  PackState,
  PoolState,
  SettingsState,
} from '@bulk-brew/ui';

export interface AppState {
  /** The store behind pool, decks, and settings; restore writes to it directly. */
  kv: KeyValueStore;
  /** Light, dark, or system mode and the theme color. Device-local, not in backups. */
  appearance: AppearanceState;
  pack: PackState;
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  settings: SettingsState;
  decks: DecksState;
  /** Build screen state, kept here so it survives tab changes. */
  build: BuildFlow;
  /** The card shown in the detail sheet, openable from any screen. */
  detail: CardDetailState;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
