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

/** Card detail: a full-screen sheet on phones, a side panel on tablets. */
function DetailSheet() {
  const { detail, index, config, settings, pool } = useAppState();
  const open = detail.current;
  if (!open || !index) return null;
  const card = index.get(open.cardId);
  if (!card) return null;
  const entry = pool.pool.entries[card.id];
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-zinc-950 md:static md:inset-auto md:z-auto md:w-80 md:shrink-0 md:overflow-y-auto md:border-l md:border-zinc-200 md:dark:border-zinc-800"
      role="dialog"
      aria-modal="true"
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
    </div>
  );
}

/**
 * Phone-first shell: a title bar, a scrolling content area, and a bottom tab
 * bar that stays put while the content scrolls. From 768 px up the tabs become
 * a side rail and the card detail sits beside the content instead of covering it.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('import');
  const { pack, decks } = useAppState();
  const current = SCREENS.find((s) => s.id === screen) ?? SCREENS[0]!;
  const Screen = current.component;

  const tab = (s: (typeof SCREENS)[number], vertical: boolean) => (
    <button
      key={s.id}
      type="button"
      onClick={() => setScreen(s.id)}
      aria-current={s.id === screen ? 'page' : undefined}
      className={
        vertical
          ? `rounded px-3 py-2 text-left text-sm ${
              s.id === screen
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`
          : `min-w-0 flex-1 truncate px-1 py-3 text-xs ${
              s.id === screen ? 'font-semibold' : 'text-zinc-500 dark:text-zinc-400'
            }`
      }
    >
      {s.label}
      {s.id === 'decks' && decks.decks.length > 0 && (
        <span className="ml-1 text-xs text-zinc-500">{decks.decks.length}</span>
      )}
    </button>
  );

  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-zinc-50 text-zinc-900 md:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <nav className="hidden w-48 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800">
        <div className="mb-4 text-lg font-semibold">Bulk Brew</div>
        {SCREENS.map((s) => tab(s, true))}
        <div className="mt-auto text-xs text-zinc-500">
          {pack.status === 'ready' && `Card data ${pack.index.version}`}
          {pack.status === 'loading' && 'Loading card data'}
          {pack.status === 'error' && 'Card data failed'}
        </div>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-zinc-200 px-4 pt-[env(safe-area-inset-top)] dark:border-zinc-800">
          <h1 className="py-3 text-lg font-semibold">
            {current.label}
            {pack.status === 'loading' && (
              <span className="ml-2 text-xs font-normal text-zinc-500">loading card data</span>
            )}
          </h1>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <Screen />
        </main>
        <nav className="flex w-full shrink-0 border-t border-zinc-200 pb-[env(safe-area-inset-bottom)] md:hidden dark:border-zinc-800">
          {SCREENS.map((s) => tab(s, false))}
        </nav>
      </div>
      <DetailSheet />
    </div>
  );
}
