import type { ReactNode } from 'react';
import {
  CONFIG,
  useAppearance,
  useBuildFlow,
  useCardDetail,
  useDecks,
  usePack,
  usePool,
  usePoolScans,
  useSettings,
  type KeyValueStore,
} from '@bulk-brew/ui';
import { AppContext, type AppState } from './app-context.ts';

// Relative so it works both from a dev server and from the Capacitor bundle.
const PACK_URL = 'data/cards.json';

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
    detail,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
