import { useMemo, useState, type ComponentType } from 'react';
import { CardDetail, ErrorBoundary, openKv } from '@bulk-brew/ui';
import { AppStateProvider } from './app-state.tsx';
import { useAppState } from './app-context.ts';
import { ImportScreen, PoolScreen } from './screens.tsx';
import { BuildScreen } from './screens/BuildScreen.tsx';
import { DecksScreen } from './screens/DecksScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';

export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings';

const SCREENS: { id: ScreenId; label: string; component: ComponentType }[] = [
  { id: 'import', label: 'Import', component: ImportScreen },
  { id: 'pool', label: 'Pool', component: PoolScreen },
  { id: 'build', label: 'Build', component: BuildScreen },
  { id: 'decks', label: 'Decks', component: DecksScreen },
  { id: 'settings', label: 'Settings', component: SettingsScreen },
];

export function App() {
  const kv = useMemo(() => openKv(), []);
  return (
    <ErrorBoundary kv={kv}>
      <AppStateProvider kv={kv}>
        <Shell />
      </AppStateProvider>
    </ErrorBoundary>
  );
}

/** The card detail panel on the right, when a card is open. */
function DetailPanel() {
  const { detail, index, config, settings, pool } = useAppState();
  const open = detail.current;
  if (!open || !index) return null;
  const card = index.get(open.cardId);
  if (!card) return null;
  const entry = pool.pool.entries[card.id];
  return (
    <aside
      className="sticky top-0 max-h-screen w-80 shrink-0 overflow-y-auto border-l border-zinc-200 p-4 dark:border-zinc-800"
      aria-label="Card detail"
    >
      <CardDetail
        card={card}
        printing={open.printing ?? entry?.printing}
        qty={entry?.qty}
        index={index}
        config={config}
        showArt={settings.settings.showArt}
        onClose={detail.close}
      />
    </aside>
  );
}

/**
 * Desktop-first shell: a left navigation rail, a main pane, and a detail panel
 * on the right when a card is open. Placeholder layout; the design pass replaces it.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('import');
  const { pack, decks } = useAppState();
  const current = SCREENS.find((s) => s.id === screen) ?? SCREENS[0]!;
  const Screen = current.component;

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-4 text-lg font-semibold">Bulk Brew</div>
        {SCREENS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScreen(s.id)}
            aria-current={s.id === screen ? 'page' : undefined}
            className={`rounded px-3 py-2 text-left text-sm ${
              s.id === screen
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {s.label}
            {s.id === 'decks' && decks.decks.length > 0 && (
              <span className="ml-2 text-xs text-zinc-500">{decks.decks.length}</span>
            )}
          </button>
        ))}
        <div className="mt-auto text-xs text-zinc-500">
          {pack.status === 'ready' && `Card data ${pack.index.version}`}
          {pack.status === 'loading' && 'Loading card data'}
          {pack.status === 'error' && `Card data failed: ${pack.error}`}
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-8">
        <h1 className="mb-4 text-2xl font-semibold">{current.label}</h1>
        <Screen />
      </main>
      <DetailPanel />
    </div>
  );
}
