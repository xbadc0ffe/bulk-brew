import { useState, type ComponentType } from 'react';
import { BuildScreen, DecksScreen, ImportScreen, PoolScreen, SettingsScreen } from './screens.tsx';

export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings';

const SCREENS: { id: ScreenId; label: string; component: ComponentType }[] = [
  { id: 'import', label: 'Import', component: ImportScreen },
  { id: 'pool', label: 'Pool', component: PoolScreen },
  { id: 'build', label: 'Build', component: BuildScreen },
  { id: 'decks', label: 'Decks', component: DecksScreen },
  { id: 'settings', label: 'Settings', component: SettingsScreen },
];

/**
 * Phone-first shell: a title bar, a scrolling content area, and a bottom tab bar
 * that respects the home indicator safe area. Tablet layouts come with the
 * design pass.
 */
export function App() {
  const [screen, setScreen] = useState<ScreenId>('import');
  const current = SCREENS.find((s) => s.id === screen) ?? SCREENS[0]!;
  const Screen = current.component;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 px-4 pt-[env(safe-area-inset-top)] dark:border-zinc-800">
        <h1 className="py-3 text-lg font-semibold">{current.label}</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <Screen />
      </main>
      <nav className="flex border-t border-zinc-200 pb-[env(safe-area-inset-bottom)] dark:border-zinc-800">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScreen(s.id)}
            aria-current={s.id === screen ? 'page' : undefined}
            className={`flex-1 py-3 text-xs ${
              s.id === screen ? 'font-semibold' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
