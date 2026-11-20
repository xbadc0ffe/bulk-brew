import { useEffect, useState, type ReactNode } from 'react';
import {
  CONFIG,
  useAppearance,
  useBestDecks,
  useBuildFlow,
  useCardDetail,
  useCommanderList,
  useDeckOptions,
  useDecks,
  usePack,
  usePool,
  usePoolScans,
  useSettings,
  type KeyValueStore,
} from '@bulk-brew/ui';
import { AppContext, type AppState } from './app-context.ts';
import { isNative, setNativeAppearance } from './native.ts';
import {
  BUNDLED_PACK,
  dropDownloadedPacks,
  startPackUpdates,
  type PackSource,
} from './packUpdates.ts';

export function AppStateProvider({
  kv,
  packSource,
  children,
}: {
  kv: KeyValueStore;
  /** The web app always loads the pack it was deployed with; the iOS app may pick a download. */
  packSource: PackSource;
  children: ReactNode;
}) {
  const appearance = useAppearance();
  const mode = appearance.appearance.mode;
  useEffect(() => setNativeAppearance(mode), [mode]);
  // A downloaded pack that does not load whole, cards and learned data of its own
  // version, gives way to the bundled one and is deleted.
  const [fellBack, setFellBack] = useState(false);
  const source = fellBack ? BUNDLED_PACK : packSource;
  const pack = usePack(source.cards, source.learned);
  const downloadFailed =
    source.downloaded !== undefined &&
    (pack.status === 'error' ||
      (pack.status === 'ready' &&
        (!pack.index.learned || pack.index.version !== source.downloaded)));
  if (downloadFailed) setFellBack(true);
  useEffect(() => {
    if (!fellBack) return;
    console.warn('card data: the downloaded pack did not load; using the bundled one');
    void dropDownloadedPacks();
  }, [fellBack]);
  const index = pack.status === 'ready' && !downloadFailed ? pack.index : undefined;
  useEffect(() => {
    if (isNative && index) startPackUpdates(index.version);
  }, [index]);
  const pool = usePool(kv);
  const settings = useSettings(kv);
  const decks = useDecks(kv);
  const scans = usePoolScans(index, pool.pool, CONFIG, settings.settings);
  const build = useBuildFlow({
    index,
    config: CONFIG,
    pool,
    settings: settings.settings,
    decks,
    scans,
  });
  // Options build only while the Build screen shows and no deck is open.
  const [buildVisible, setBuildVisible] = useState(false);
  const options = useDeckOptions({
    enabled: true,
    index,
    config: CONFIG,
    pool: pool.pool,
    settings: build.buildSettings,
    size: build.size,
    colors: build.colors,
    primary: build.style,
    secondary: build.secondary,
    commander: build.commander,
    paused: !buildVisible || build.result !== undefined,
  });
  // Commanders are checked against the picked style only while their list shows.
  const commanders = useCommanderList({
    enabled: buildVisible && build.size === 100,
    index,
    config: CONFIG,
    pool: pool.pool,
    settings: build.buildSettings,
    colors: build.colors,
    style: build.style,
    paused: !buildVisible || build.result !== undefined || build.commander !== undefined,
  });
  // The best-deck search runs only while the Analyze pane shows.
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const bestDecks = useBestDecks({
    index,
    config: CONFIG,
    pool: pool.pool,
    settings: settings.settings,
    active: analysisVisible && pool.loaded && settings.loaded,
  });
  const detail = useCardDetail();
  const value: AppState = {
    kv,
    appearance,
    pack,
    index,
    config: CONFIG,
    pool,
    settings,
    decks,
    scans,
    build,
    options,
    commanders,
    setBuildVisible,
    bestDecks,
    setAnalysisVisible,
    detail,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
