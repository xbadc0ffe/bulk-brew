import { useMemo, useState, type ReactNode } from 'react';
import {
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
import { isNative } from './native.ts';
import { ImportScreen, PoolScreen } from './screens.tsx';
import { AboutScreen } from './screens/AboutScreen.tsx';
import { BuildScreen } from './screens/BuildScreen.tsx';
import { DiscardSwapsDialog } from './screens/DeckLayout.tsx';
import { DecksScreen } from './screens/DecksScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';

export type { ScreenId } from './nav.ts';

export function App() {
  const kv = useMemo(() => openKv(), []);
  return (
    <ErrorBoundary kv={kv} app={isNative}>
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

/**
 * Desktop shell: a left sidebar and a main pane. Below 768px the sidebar
 * folds into a top bar. Screens show the card detail themselves.
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
  const [discard, setDiscard] = useState(false);
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
    // Build while a deck is open goes back to the options, like the Back button,
    // and asks first when cards of the deck were swapped.
    const back = next === 'build' && screen === 'build' && build.result !== undefined;
    if (back && build.edits > 0) {
      setDiscard(true);
      return;
    }
    detail.close();
    if (back) build.reject();
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
        className={`relative flex h-[max(84px,5.25rem)] w-full flex-col items-center justify-center gap-1.5 rounded-lg border ${
          on
            ? 'border-ink bg-ink text-on-ink [--icon-fill:var(--ink)]'
            : 'border-line bg-surface text-fg-1 [--icon-fill:var(--surface)] hover:border-line-strong hover:text-ink'
        }`}
      >
        <n.Icon size={30} />
        <span className="text-[0.78125rem] leading-none font-semibold">{n.label}</span>
        {count !== undefined && (
          <span
            className={`absolute top-1 right-1.5 text-[0.65625rem] leading-none tabular-nums ${on ? 'text-on-ink' : 'text-fg-2'}`}
          >
            {count.toLocaleString('en-US')}
          </span>
        )}
      </button>
    );
  };

  /**
   * Top bar item on narrow windows: a folder tab. The open one is the page's
   * color and covers the bar's bottom line, so it reads as part of the page; the line
   * runs under the other tabs and sets them apart from it.
   * Settings and About are icons, so five tabs fit a phone.
   */
  const tab = (n: (typeof NAV)[number]) => {
    const on = n.screen === active;
    const count = counts[n.screen];
    const icon = n.screen === 'settings' || n.screen === 'about';
    return (
      <button
        key={n.screen}
        type="button"
        onClick={() => choose(n.screen)}
        aria-current={on ? 'page' : undefined}
        aria-label={icon ? n.label : undefined}
        className={`flex h-10 items-center justify-center gap-1.5 rounded-t-[10px] border border-b-0 text-[0.8125rem] whitespace-nowrap ${
          icon ? 'w-11 shrink-0' : 'min-w-0 flex-auto px-2'
        } ${
          on
            ? '-mb-0.5 border-line-strong bg-canvas font-semibold text-ink [--icon-fill:var(--bg)]'
            : 'mt-1 h-9 border-line bg-surface-2 text-fg-1 [--icon-fill:var(--surface2)]'
        }`}
      >
        {icon ? <n.Icon size={22} /> : <span className="truncate">{n.label}</span>}
        {count !== undefined && (
          <span className={`text-[0.75rem] tabular-nums ${on ? 'text-fg-1' : 'text-fg-2'}`}>
            {count.toLocaleString('en-US')}
          </span>
        )}
      </button>
    );
  };

  return (
    <NavContext.Provider value={nav}>
      {/* The insets keep the app clear of a notch and the home bar. */}
      <div className="flex h-dvh flex-col bg-canvas pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-ink md:flex-row">
        <nav
          aria-label="Main"
          className="hidden w-[max(104px,6.5rem)] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line bg-rail px-2.5 py-3 md:flex"
        >
          {NAV.map(tile)}
          <div className="mt-auto flex flex-col items-center gap-1 pt-4 text-center">
            <span className="text-[0.8125rem] leading-tight font-semibold">Bulk Brew</span>
            <span className="text-[0.6875rem] leading-tight text-fg-2">Version {version}</span>
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
          className="flex shrink-0 items-end gap-1 border-b border-line-strong bg-rail px-2 pt-[max(0.375rem,env(safe-area-inset-top))] md:hidden"
        >
          {NAV.map(tab)}
        </nav>
        {/* Positioned so absolute children with no nearer positioned parent, such as
            sr-only labels deep in a scrolling pane, are clipped here and never grow the page. */}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <Screen key={visit} />
        </main>
      </div>
      <DiscardSwapsDialog
        open={discard}
        edits={build.edits}
        onDiscard={() => {
          setDiscard(false);
          detail.dismiss();
          build.reject();
          nav.go('build');
        }}
        onCancel={() => setDiscard(false)}
      />
    </NavContext.Provider>
  );
}
