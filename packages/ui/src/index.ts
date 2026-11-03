// Shared pieces for both apps: presentational components, data hooks, and
// the key-value store they persist to. No app-specific layout lives here.

export { ManaCost } from './ManaCost.tsx';
export { COLOR_NAMES, COLOR_ORDER } from './colors.ts';
export * from './attribution.ts';
export { downloadText, readFileText, backupFilename } from './util/files.ts';
export { openKv, type KeyValueStore } from './storage/kv.ts';
export { CONFIG, CONFIG_PROBLEMS, DEFAULT_SETTINGS } from './data/config.ts';
export { usePack, type PackState } from './data/usePack.ts';
export { usePool, type PoolActions, type PoolState } from './data/usePool.ts';
export {
  useImport,
  IMPORT_FORMAT_LABELS,
  type ImportFormat,
  type ImportState,
} from './data/useImport.ts';
export { useSettings, type SettingsState } from './data/useSettings.ts';
export { useDecks, type DecksState } from './data/useDecks.ts';
export { useBuildFlow, type BuildFlow, type BuildFlowInput } from './data/useBuildFlow.ts';
export { useCardDetail, type CardDetailState, type OpenCard } from './data/useCardDetail.ts';
export { useWindowedRows, type WindowedRows } from './data/useWindowedRows.ts';
export { applyBackup } from './data/backup.ts';
export {
  poolRows,
  poolSummary,
  POOL_SORTS,
  type ColorFilter,
  type PoolRow,
  type PoolSort,
  type PoolSummary,
} from './data/poolView.ts';
export { DeckView, type DeckViewProps } from './components/DeckView.tsx';
export { CurveBars } from './components/CurveBars.tsx';
export { CardImage, type CardImageProps } from './components/CardImage.tsx';
export { CardDetail, type CardDetailProps } from './components/CardDetail.tsx';
export { ErrorBoundary } from './components/ErrorBoundary.tsx';
export { STORAGE_KEYS } from './storage/keys.ts';
