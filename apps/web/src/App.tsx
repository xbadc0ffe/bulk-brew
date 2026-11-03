import { useMemo, useState } from 'react';
import {
  CardDetail,
  EMPTY_FILTERS,
  ErrorBoundary,
  openKv,
  poolSummary,
  type PoolFilters,
  type PoolSort,
} from '@bulk-brew/ui';
import { version } from '../package.json';
import { AppStateProvider } from './app-state.tsx';
import { useAppState } from './app-context.ts';
import { NavContext, type Nav, type ScreenId } from './nav.ts';
import { ImportScreen, PoolScreen } from './screens.tsx';
import { AboutScreen } from './screens/AboutScreen.tsx';
import { BuildScreen } from './screens/BuildScreen.tsx';
import { DecksScreen } from './screens/DecksScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';

export type { ScreenId } from './nav.ts';

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

const NAV: { screen: ScreenId; label: string }[] = [
  { screen: 'pool', label: 'Bulk List' },
  { screen: 'build', label: 'Build' },
  { screen: 'decks', label: 'Decks' },
  { screen: 'settings', label: 'Settings' },
  { screen: 'about', label: 'About' },
];

/** Card detail over the right edge, for cards opened outside the Bulk List. */
function DetailOverlay() {
  const { detail, index, config, settings, decks, pool } = useAppState();
  const open = detail.current;
  const card = open && index ? index.get(open.cardId) : undefined;
  if (!card || !index) return null;
  const inDecks = decks.decks.filter((d) => d.cards.some((c) => c.cardId === card.id));
  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-[320px] max-w-full overflow-y-auto border-l border-line bg-surface p-[22px]"
      aria-label="Card detail"
    >
      <CardDetail
        card={card}
        printing={open?.printing}
        index={index}
        config={config}
        showArt={settings.settings.showArt}
        qty={pool.pool.entries[card.id]?.qty ?? 0}
        inDecks={inDecks.map((d) => d.name)}
        onClose={detail.close}
      />
    </aside>
  );
}

/**
 * Desktop shell: a left sidebar, a main pane, and the card detail on the
 * right. Below 768px the sidebar folds into a top bar.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('pool');
  // Bumped when the current screen is chosen again, to reset its sub-view.
  const [visit, setVisit] = useState(0);
  const [poolFilters, setPoolFilters] = useState<PoolFilters>(EMPTY_FILTERS);
  const [poolSort, setPoolSort] = useState<PoolSort>(undefined);
  const [analyze, setAnalyze] = useState(false);
  const { detail, pool, index, decks } = useAppState();
  const nav: Nav = useMemo(
    () => ({
      screen,
      go(next) {
        // Import keeps its text when chosen again.
        if (next === screen && next !== 'import') setVisit((v) => v + 1);
        setScreen(next);
      },
      poolFilters,
      setPoolFilters,
      poolSort,
      setPoolSort,
      analyze,
      setAnalyze,
    }),
    [screen, poolFilters, poolSort, analyze],
  );
  const cards = useMemo(
    () => (index ? poolSummary(pool.pool, index).cards : undefined),
    [index, pool.pool],
  );
  const counts: Partial<Record<ScreenId, number | undefined>> = {
    pool: cards,
    decks: decks.loaded ? decks.decks.length : undefined,
  };
  // Import lives under the Bulk List, so the Bulk List item stays lit.
  const active = screen === 'import' ? 'pool' : screen;

  const Screen =
    screen === 'import'
      ? ImportScreen
      : screen === 'pool'
        ? PoolScreen
        : screen === 'build'
          ? BuildScreen
          : screen === 'decks'
            ? DecksScreen
            : screen === 'settings'
              ? SettingsScreen
              : AboutScreen;

  const item = (n: (typeof NAV)[number], compact: boolean) => {
    const on = n.screen === active;
    const count = counts[n.screen];
    return (
      <button
        key={n.screen}
        type="button"
        onClick={() => {
          detail.close();
          nav.go(n.screen);
        }}
        aria-current={on ? 'page' : undefined}
        className={`flex items-center justify-between gap-2 rounded-lg border text-left whitespace-nowrap ${
          compact ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2.5 text-[15px]'
        } ${
          on
            ? 'border-ink bg-ink font-medium text-on-ink'
            : 'border-line bg-surface text-fg-1 hover:border-line-strong hover:text-ink'
        }`}
      >
        <span>{n.label}</span>
        {count !== undefined && (
          <span
            className={`tabular-nums ${on ? 'text-on-ink' : 'text-fg-2'} ${compact ? '' : 'text-[13px]'}`}
          >
            {count.toLocaleString('en-US')}
          </span>
        )}
      </button>
    );
  };

  return (
    <NavContext.Provider value={nav}>
      <div className="flex h-dvh flex-col bg-canvas text-ink md:flex-row">
        <nav
          aria-label="Main"
          className="hidden w-[208px] shrink-0 flex-col gap-1.5 border-r border-line bg-surface-2 px-3 py-4 md:flex"
        >
          {NAV.map((n) => item(n, false))}
          <div className="mt-auto flex items-center gap-2.5 px-1.5 pt-4">
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt=""
              className="size-9 shrink-0 rounded-lg"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold">Bulk Brew</span>
              <span className="text-[11.5px] text-fg-2">Version {version}</span>
            </div>
          </div>
        </nav>
        <nav
          aria-label="Main"
          className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-surface-2 px-3 py-2 md:hidden"
        >
          {NAV.map((n) => item(n, true))}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Screen key={visit} />
        </main>
        {screen !== 'pool' && <DetailOverlay />}
      </div>
    </NavContext.Provider>
  );
}
