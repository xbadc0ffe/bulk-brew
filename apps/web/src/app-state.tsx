import { useState, type ReactNode } from 'react';
import {
  CONFIG,
  useAppearance,
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

export function AppStateProvider({ kv, children }: { kv: KeyValueStore; children: ReactNode }) {
  const appearance = useAppearance();
  const pack = usePack(PACK_URL);
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
  const commanders = useCommanderList({
    enabled: buildVisible && build.size === 100,
    index,
    config: CONFIG,
    pool: pool.pool,
    settings: build.buildSettings,
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
    detail,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
