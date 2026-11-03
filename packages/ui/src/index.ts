// Shared pieces for both apps: presentational components, data hooks, and
// the key-value store they persist to. No app-specific layout lives here.

export { ManaCost } from './ManaCost.tsx';
export { COLOR_NAMES, COLOR_ORDER } from './colors.ts';
export { openKv, type KeyValueStore } from './storage/kv.ts';
export { CONFIG, CONFIG_PROBLEMS, DEFAULT_SETTINGS } from './data/config.ts';
export { usePack, type PackState } from './data/usePack.ts';
export { usePool, type PoolActions, type PoolState } from './data/usePool.ts';
export { useImport, type ImportState } from './data/useImport.ts';
export { useSettings, type SettingsState } from './data/useSettings.ts';
export { useDecks, type DecksState } from './data/useDecks.ts';
export { useBuildFlow, type BuildFlow, type BuildFlowInput } from './data/useBuildFlow.ts';
export {
  poolRows,
  poolSummary,
  type ColorFilter,
  type PoolRow,
  type PoolSummary,
} from './data/poolView.ts';
export { DeckView, type DeckViewProps } from './components/DeckView.tsx';
export { CurveBars } from './components/CurveBars.tsx';
