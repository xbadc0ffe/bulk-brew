import { useState, type ReactNode } from 'react';
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

const PACK_URL = `${import.meta.env.BASE_URL}data/cards.json`;
const LEARNED_URL = `${import.meta.env.BASE_URL}data/learned.json`;

export function AppStateProvider({ kv, children }: { kv: KeyValueStore; children: ReactNode }) {
  const appearance = useAppearance();
  const pack = usePack(PACK_URL, LEARNED_URL);
  const index = pack.status === 'ready' ? pack.index : undefined;
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
