// Shared pieces for both apps: presentational components, data hooks, and
// the key-value store they persist to. No app-specific layout lives here.

export { ManaCost, Pip, type PipSize } from './ManaCost.tsx';
export { ui, phone } from './styles.ts';
export {
  Segmented,
  Toggle,
  Stepper,
  ViabilityDot,
  ViabilityMark,
  RoleBar,
  CurveChart,
  Dropdown,
  MenuItem,
  MenuCheck,
  type Variant,
  type SegmentOption,
} from './components/controls.tsx';
export { viabilityLabel, curveBuckets, type Viability } from './data/analysis.ts';
export {
  useAppearance,
  readAppearance,
  APPEARANCE_KEY,
  APPEARANCE_MODES,
  THEME_COLORS,
  type Appearance,
  type AppearanceMode,
  type AppearanceState,
  type ThemeColor,
} from './data/useAppearance.ts';
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
