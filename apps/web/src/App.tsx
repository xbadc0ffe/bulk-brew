import { useState, type ComponentType } from 'react';
import { AppStateProvider } from './app-state.tsx';
import { useAppState } from './app-context.ts';
import { BuildScreen, DecksScreen, ImportScreen, PoolScreen, SettingsScreen } from './screens.tsx';

export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings';

const SCREENS: { id: ScreenId; label: string; component: ComponentType }[] = [
  { id: 'import', label: 'Import', component: ImportScreen },
  { id: 'pool', label: 'Pool', component: PoolScreen },
  { id: 'build', label: 'Build', component: BuildScreen },
  { id: 'decks', label: 'Decks', component: DecksScreen },
  { id: 'settings', label: 'Settings', component: SettingsScreen },
];

export function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}

/**
 * Desktop-first shell: a left navigation rail and a main pane.
 * Placeholder layout; the design pass replaces it.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('import');
  const { pack } = useAppState();
  const current = SCREENS.find((s) => s.id === screen) ?? SCREENS[0]!;
  const Screen = current.component;

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <nav className="flex w-56 flex-col gap-1 border-r border-zinc-200 p-4 dark:border-zinc-800">
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
          </button>
        ))}
        <div className="mt-auto text-xs text-zinc-500">
          {pack.status === 'ready' && `Card data ${pack.index.version}`}
          {pack.status === 'loading' && 'Loading card data'}
          {pack.status === 'error' && `Card data failed: ${pack.error}`}
        </div>
      </nav>
      <main className="flex-1 p-8">
        <h1 className="mb-4 text-2xl font-semibold">{current.label}</h1>
        <Screen />
      </main>
    </div>
  );
}
