import { useMemo, type ReactNode } from 'react';
import {
  CONFIG,
  openKv,
  useBuildFlow,
  useDecks,
  usePack,
  usePool,
  useSettings,
} from '@bulk-brew/ui';
import { AppContext, type AppState } from './app-context.ts';

// Relative so it works both from a dev server and from the Capacitor bundle.
const PACK_URL = 'data/cards.v1.json';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const kv = useMemo(() => openKv(), []);
  const pack = usePack(PACK_URL);
  const index = pack.status === 'ready' ? pack.index : undefined;
  const pool = usePool(kv);
  const settings = useSettings(kv);
  const decks = useDecks(kv);
  const build = useBuildFlow({ index, config: CONFIG, pool, settings: settings.settings, decks });
  const value: AppState = { pack, index, config: CONFIG, pool, settings, decks, build };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
