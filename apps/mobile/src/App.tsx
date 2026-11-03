import { useMemo, useState } from 'react';
import { CardDetail, ErrorBoundary, openKv } from '@bulk-brew/ui';
import { AppStateProvider } from './app-state.tsx';
import { useAppState } from './app-context.ts';
import { NavContext, type Nav, type PoolView, type ScreenId } from './nav.ts';
import { TabIcon, type TabIconName } from './parts.tsx';
import { ImportScreen, PoolScreen } from './screens.tsx';
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

const TABS: { id: TabIconName; label: string; screen: ScreenId }[] = [
  { id: 'pool', label: 'Pool', screen: 'pool' },
  { id: 'build', label: 'Build', screen: 'build' },
  { id: 'decks', label: 'Decks', screen: 'decks' },
  { id: 'settings', label: 'Settings', screen: 'settings' },
];

/** Card detail as a full-screen sheet; on tablets it sits beside the content. */
function DetailSheet() {
  const { detail, index, config, settings, pool, decks } = useAppState();
  const open = detail.current;
  const card = open && index ? index.get(open.cardId) : undefined;
  if (!card || !index) return null;
  const entry = pool.pool.entries[card.id];
  const inDecks = decks.decks.filter((d) => d.cards.some((c) => c.cardId === card.id));
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-surface px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-y-0 md:right-0 md:left-auto md:w-80 md:border-l md:border-line"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} detail`}
    >
      <CardDetail
        card={card}
        printing={open?.printing ?? entry?.printing}
        qty={entry?.qty ?? 0}
        index={index}
        config={config}
        showArt={settings.settings.showArt}
        inDecks={inDecks.map((d) => d.name)}
        onClose={detail.close}
        onQtyChange={entry ? (q) => pool.actions.setQty(card.id, q) : undefined}
        onRemove={
          entry
            ? () => {
                detail.close();
                pool.actions.remove(card.id);
              }
            : undefined
        }
        variant="phone"
      />
    </div>
  );
}

/**
 * Phone shell: the current tab's screen above a bottom tab bar. Pushed
 * screens cover the tab bar. From 768px the tabs become a side rail.
 */
function Shell() {
  const [screen, setScreen] = useState<ScreenId>('pool');
  const [poolView, setPoolView] = useState<PoolView>('cards');
  const [visit, setVisit] = useState(0);
  const { detail, pack } = useAppState();
  const nav: Nav = useMemo(
    () => ({
      screen,
      poolView,
      go(next, view) {
        // Choosing the current screen again resets its sub-view; Import keeps its text.
        if (next === screen && next !== 'import') setVisit((v) => v + 1);
        setScreen(next);
        if (view) setPoolView(view);
      },
      setPoolView,
    }),
    [screen, poolView],
  );
  // Import is pushed from Pool, so the Pool tab stays lit.
  const tab = screen === 'import' ? 'pool' : screen;
  const Screen =
    screen === 'import'
      ? ImportScreen
      : screen === 'pool'
        ? PoolScreen
        : screen === 'build'
          ? BuildScreen
          : screen === 'decks'
            ? DecksScreen
            : SettingsScreen;

  const select = (s: ScreenId) => {
    detail.close();
    nav.go(s);
  };

  return (
    <NavContext.Provider value={nav}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-canvas text-ink md:flex-row">
        <nav
          aria-label="Main"
          className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-line bg-surface-2 px-3 pt-[max(1.125rem,env(safe-area-inset-top))] pb-4 md:flex"
        >
          <div className="px-2.5 pt-1 pb-4 text-[0.9375rem] font-semibold">Bulk Brew</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.screen ? 'page' : undefined}
              onClick={() => select(t.screen)}
              className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-left text-[0.875rem] ${
                tab === t.screen ? 'bg-ink text-on-ink' : 'text-fg-1'
              }`}
            >
              <TabIcon name={t.id} filled={tab === t.screen} />
              {t.label}
            </button>
          ))}
          <div className="mt-auto px-2.5 text-[0.6875rem] leading-normal text-fg-2">
            {pack.status === 'ready' && `Card data ${pack.index.version}`}
            {pack.status === 'loading' && 'Loading card data'}
            {pack.status === 'error' && 'Card data failed'}
          </div>
        </nav>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
          <Screen key={visit} />
        </main>
        <nav
          aria-label="Main"
          className="grid shrink-0 grid-cols-4 border-t border-line bg-surface-2 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {TABS.map((t) => {
            const on = tab === t.screen;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => select(t.screen)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-[0.65625rem] ${
                  on ? 'font-semibold text-ink' : 'text-fg-2'
                }`}
              >
                <TabIcon name={t.id} filled={on} />
                {t.label}
              </button>
            );
          })}
        </nav>
        <DetailSheet />
      </div>
    </NavContext.Provider>
  );
}
