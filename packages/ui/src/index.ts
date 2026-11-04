// Shared pieces for both apps: presentational components, data hooks, and
// the key-value store they persist to. No app-specific layout lives here.

export { ManaCost, Pip, SymbolText, type PipSize } from './ManaCost.tsx';
export { symbolName, symbolUrl } from './symbols.ts';
export { ui, phone } from './styles.ts';
export {
  Segmented,
  Toggle,
  Stepper,
  ViabilityDot,
  ViabilityMark,
  RoleBar,
  RoleBars,
  CurveChart,
  Dropdown,
  MenuItem,
  MenuCheck,
  RarityPicker,
  type Variant,
  type SegmentOption,
} from './components/controls.tsx';
export {
  analysisRows,
  archetypeViability,
  buildableSizes,
  curveBuckets,
  scanShortfall,
  viabilityDetail,
  viabilityLabel,
  DECK_SIZES,
  NEAR_MISS_SHORTFALL,
  type AnalysisRow,
  type ScannedSize,
  type ScansBySize,
  type Viability,
} from './data/analysis.ts';
export { useCommanderList, type CommanderList } from './data/useCommanderList.ts';
export { usePoolScans } from './data/usePoolScans.ts';
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
export { CONFIG, CONFIG_PROBLEMS, DEFAULT_SETTINGS, DISPLAY_TAGS } from './data/config.ts';
export { usePack, type PackState } from './data/usePack.ts';
export { usePool, type PoolActions, type PoolState } from './data/usePool.ts';
export {
  useImport,
  IMPORT_FORMAT_LABELS,
  type ImportFormat,
  type ImportPreview,
  type ImportState,
  type OpenLine,
} from './data/useImport.ts';
export { useSettings, type SettingsState } from './data/useSettings.ts';
export { useDecks, type DecksState } from './data/useDecks.ts';
export { useBuildFlow, type BuildFlow, type BuildFlowInput } from './data/useBuildFlow.ts';
export { useDeckOptions, type DeckOptions, type DeckOptionsInput } from './data/useDeckOptions.ts';
export { useCardDetail, type CardDetailState, type OpenCard } from './data/useCardDetail.ts';
export { useWindowedRows, type WindowedRows } from './data/useWindowedRows.ts';
export { useMediaQuery } from './data/useMediaQuery.ts';
export { useStatus } from './data/useStatus.ts';
export { poolShortfall, shortfallMessage } from './data/poolCheck.ts';
export { useDeckActions, disassembleQuestion, type DeckActions } from './data/useDeckActions.ts';
export { applyBackup } from './data/backup.ts';
export {
  poolRows,
  poolSummary,
  poolFacets,
  cardTags,
  colorKey,
  filterCount,
  majorTags,
  nextSort,
  subtypesOf,
  typeParts,
  COLOR_KEYS,
  EMPTY_FILTERS,
  MV_OPS,
  SORT_CHOICES,
  TYPE_KEYS,
  type CardTag,
  type ColorKey,
  type Facet,
  type MvOp,
  type PoolFacets,
  type PoolFilters,
  type PoolRow,
  type PoolSort,
  type PoolSummary,
  type SortKey,
  type TypeKey,
} from './data/poolView.ts';
export { DeckList, DeckExplanation, type DeckListProps } from './components/DeckParts.tsx';
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog.tsx';
export {
  archetypeInfo,
  deckColors,
  deckFilename,
  deckGroups,
  landCount,
  savedLabel,
  type DeckGroup,
  type DeckRow,
} from './data/deckGroups.ts';
export { CardImage, type CardImageProps } from './components/CardImage.tsx';
export { CardDetail, type CardDetailProps } from './components/CardDetail.tsx';
export { ErrorBoundary } from './components/ErrorBoundary.tsx';
export { STORAGE_KEYS } from './storage/keys.ts';
