import { createContext, useContext } from 'react';
import type { BulkBrewConfig, CardIndex } from '@bulk-brew/core';
import type {
  AppearanceState,
  BuildFlow,
  CardDetailState,
  DeckOptions,
  DecksState,
  KeyValueStore,
  PackState,
  PoolState,
  ScansBySize,
  SettingsState,
} from '@bulk-brew/ui';

export interface AppState {
  /** The store behind pool, decks, and settings; restore writes to it directly. */
  kv: KeyValueStore;
  /** Light, dark, or system mode and the theme color. Device-local, not in backups. */
  appearance: AppearanceState;
  pack: PackState;
  /** Convenience: the index when the pack is ready. */
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  settings: SettingsState;
  decks: DecksState;
  /** Archetype scans for every color and size, shared by Analysis and Build. */
  scans: ScansBySize | undefined;
  /** Build screen state, kept here so it survives navigation. */
  build: BuildFlow;
  /** Deck options for the Build page, built in the background and kept across screens. */
  options: DeckOptions;
  /** The Build screen reports when it shows, so options only build while it does. */
  setBuildVisible(visible: boolean): void;
  /** The card shown in the detail panel, openable from any screen. */
  detail: CardDetailState;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
