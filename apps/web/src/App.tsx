import { useMemo, useState } from 'react';
import { CardDetail, ErrorBoundary, openKv, poolSummary } from '@bulk-brew/ui';
import { AppStateProvider } from './app-state.tsx';
import { useAppState } from './app-context.ts';
import { NavContext, type Nav, type PoolView, type ScreenId } from './nav.ts';
import { ImportScreen, PoolScreen } from './screens.tsx';
import { AnalysisScreen } from './screens/AnalysisScreen.tsx';
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

interface NavItem {
  id: string;
  label: string;
  screen: ScreenId;
  poolView?: PoolView;
  indent?: boolean;
}

const NAV: NavItem[] = [
  { id: 'pool', label: 'Pool', screen: 'pool', poolView: 'cards' },
  { id: 'import', label: 'Import', screen: 'import', indent: true },
  { id: 'analysis', label: 'Analysis', screen: 'pool', poolView: 'analysis', indent: true },
  { id: 'build', label: 'Build', screen: 'build' },
  { id: 'decks', label: 'Decks', screen: 'decks' },
  { id: 'settings', label: 'Settings', screen: 'settings' },
];

function activeItem(screen: ScreenId, poolView: PoolView): string {
  if (screen === 'pool') return poolView === 'analysis' ? 'analysis' : 'pool';
  return screen;
}

/** Card detail over the right edge, for cards opened outside the Pool screen. */
function DetailOverlay() {
  const { detail, index, config, settings, decks } = useAppState();
  const open = detail.current;
  const card = open && index ? index.get(open.cardId) : undefined;
  if (!card || !index) return null;
  const inDecks = decks.decks.filter((d) => d.cards.some((c) => c.cardId === card.id));
  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-[300px] max-w-full overflow-y-auto border-l border-line bg-surface p-[22px]"
      aria-label="Card detail"
    >
      <CardDetail
        card={card}
        printing={open?.printing}
        index={index}
        config={config}
        showArt={settings.settings.showArt}
        inDecks={inDecks.map((d) => d.name)}
        onClose={detail.close}
      />
    </aside>
  );
}

function SidebarFooter() {
  const { pack, pool, index } = useAppState();
  const cards = useMemo(
    () => (index ? poolSummary(pool.pool, index).cards : 0),
    [index, pool.pool],
  );
  return (
    <div className="mt-auto px-2.5 text-[11px] leading-[1.5] text-fg-2">
      {pack.status === 'ready' && (
        <>
          <div>Card data {pack.index.version}</div>
          <div>{cards.toLocaleString('en-US')} cards in pool</div>
        </>
      )}
      {pack.status === 'loading' && <div>Loading card data</div>}
      {pack.status === 'error' && <div>Card data failed: {pack.error}</div>}
    </div>
  );
}

/**
 * Desktop shell: a left sidebar, a main pane, and the card detail on the
 * right. Below 768px the sidebar folds into a top bar.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('pool');
  const [poolView, setPoolView] = useState<PoolView>('cards');
  const { detail } = useAppState();
  const nav: Nav = useMemo(
    () => ({
      screen,
      poolView,
      go(next, view) {
        setScreen(next);
        if (view) setPoolView(view);
        else if (next === 'pool') setPoolView('cards');
      },
    }),
    [screen, poolView],
  );
  const active = activeItem(screen, poolView);
  const inPool = active === 'import' || active === 'analysis';

  const Screen =
    screen === 'import'
      ? ImportScreen
      : screen === 'pool'
        ? poolView === 'analysis'
          ? AnalysisScreen
          : PoolScreen
        : screen === 'build'
          ? BuildScreen
          : screen === 'decks'
            ? DecksScreen
            : SettingsScreen;

  const item = (n: NavItem, compact: boolean) => {
    const on = n.id === active;
    const parent = n.id === 'pool' && inPool;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => {
          detail.close();
          nav.go(n.screen, n.poolView);
        }}
        aria-current={on ? 'page' : undefined}
        className={`rounded-md text-left text-[13px] whitespace-nowrap ${
          compact ? 'px-2.5 py-1.5' : n.indent ? 'py-1.5 pr-2.5 pl-[22px]' : 'px-2.5 py-[7px]'
        } ${
          on
            ? 'bg-ink text-on-ink'
            : parent
              ? 'font-medium text-ink hover:bg-surface'
              : 'text-fg-1 hover:bg-surface hover:text-ink'
        }`}
      >
        {n.label}
      </button>
    );
  };

  return (
    <NavContext.Provider value={nav}>
      <div className="flex h-dvh flex-col bg-canvas text-ink md:flex-row">
        <nav
          aria-label="Main"
          className="hidden w-[200px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface-2 px-3 py-[18px] md:flex"
        >
          <div className="px-2.5 pt-1 pb-4 text-[15px] font-semibold">Bulk Brew</div>
          {NAV.map((n) => item(n, false))}
          <SidebarFooter />
        </nav>
        <nav
          aria-label="Main"
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface-2 px-3 py-2 md:hidden"
        >
          <span className="mr-2 text-[15px] font-semibold whitespace-nowrap">Bulk Brew</span>
          {NAV.map((n) => item(n, true))}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Screen />
        </main>
        {screen !== 'pool' && <DetailOverlay />}
      </div>
    </NavContext.Provider>
  );
}
