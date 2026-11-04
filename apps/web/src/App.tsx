import { useMemo, useState, type ReactNode } from 'react';
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
import { FanIcon, GearIcon, InfoIcon, StackIcon, StacksIcon } from './icons.tsx';
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

const NAV: { screen: ScreenId; label: string; Icon: (p: { size?: number }) => ReactNode }[] = [
  { screen: 'pool', label: 'Bulk List', Icon: StacksIcon },
  { screen: 'build', label: 'Build', Icon: FanIcon },
  { screen: 'decks', label: 'Decks', Icon: StackIcon },
  { screen: 'settings', label: 'Settings', Icon: GearIcon },
  { screen: 'about', label: 'About', Icon: InfoIcon },
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
  // Two colors by default: the deck score can favor decks of more colors than build well.
  const [analysisColors, setAnalysisColors] = useState(2);
  const { detail, pool, index, decks, build } = useAppState();
  const closeDetail = detail.close;
  const nav: Nav = useMemo(
    () => ({
      screen,
      go(next) {
        // Import keeps its text when chosen again.
        if (next === screen && next !== 'import') setVisit((v) => v + 1);
        // An open card belongs to the screen it was opened on.
        else if (next !== screen) closeDetail();
        setScreen(next);
      },
      poolFilters,
      setPoolFilters,
      poolSort,
      setPoolSort,
      analyze,
      setAnalyze,
      analysisColors,
      setAnalysisColors,
    }),
    [screen, poolFilters, poolSort, analyze, analysisColors, closeDetail],
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

  const choose = (next: ScreenId) => {
    detail.close();
    // Build while a deck is open goes back to the options, like the Back button.
    if (next === 'build' && screen === 'build' && build.result) build.reject();
    nav.go(next);
  };

  /** Sidebar tile: icon over label, with the count in the corner. */
  const tile = (n: (typeof NAV)[number]) => {
    const on = n.screen === active;
    const count = counts[n.screen];
    return (
      <button
        key={n.screen}
        type="button"
        onClick={() => choose(n.screen)}
        aria-current={on ? 'page' : undefined}
        className={`relative flex h-[84px] w-full flex-col items-center justify-center gap-1.5 rounded-lg border ${
          on
            ? 'border-ink bg-ink text-on-ink [--icon-fill:var(--ink)]'
            : 'border-line bg-surface text-fg-1 [--icon-fill:var(--surface)] hover:border-line-strong hover:text-ink'
        }`}
      >
        <n.Icon size={30} />
        <span className="text-[12.5px] leading-none font-semibold">{n.label}</span>
        {count !== undefined && (
          <span
            className={`absolute top-1 right-1.5 text-[10.5px] leading-none tabular-nums ${on ? 'text-on-ink' : 'text-fg-2'}`}
          >
            {count.toLocaleString('en-US')}
          </span>
        )}
      </button>
    );
  };

  /** Top bar item on narrow windows. */
  const pill = (n: (typeof NAV)[number]) => {
    const on = n.screen === active;
    const count = counts[n.screen];
    return (
      <button
        key={n.screen}
        type="button"
        onClick={() => choose(n.screen)}
        aria-current={on ? 'page' : undefined}
        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] whitespace-nowrap ${
          on
            ? 'border-ink bg-ink font-semibold text-on-ink'
            : 'border-line bg-surface text-fg-1 hover:border-line-strong hover:text-ink'
        }`}
      >
        <span>{n.label}</span>
        {count !== undefined && (
          <span className={`tabular-nums ${on ? 'text-on-ink' : 'text-fg-2'}`}>
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
          className="hidden w-[104px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line bg-rail px-2.5 py-3 md:flex"
        >
          {NAV.map(tile)}
          <div className="mt-auto flex flex-col items-center gap-1 pt-4 text-center">
            <span className="text-[13px] leading-tight font-semibold">Bulk Brew</span>
            <span className="text-[11px] leading-tight text-fg-2">Version {version}</span>
            {/* The icon follows light and dark mode. */}
            <img
              src={`${import.meta.env.BASE_URL}icon-light.svg`}
              alt=""
              className="mt-1 size-[84px] shrink-0 rounded-xl dark:hidden"
            />
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt=""
              className="mt-1 hidden size-[84px] shrink-0 rounded-xl dark:block"
            />
          </div>
        </nav>
        <nav
          aria-label="Main"
          className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-rail px-3 py-2 md:hidden"
        >
          {NAV.map(pill)}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Screen key={visit} />
        </main>
        {screen !== 'pool' && <DetailOverlay />}
      </div>
    </NavContext.Provider>
  );
}
