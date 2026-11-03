import { createContext, useContext } from 'react';
import type { PoolFilters, PoolSort } from '@bulk-brew/ui';

/** The five screen ids are the information architecture; Analysis is a view of Pool. */
export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings';
export type PoolView = 'cards' | 'analysis';

export interface Nav {
  screen: ScreenId;
  poolView: PoolView;
  go(screen: ScreenId, poolView?: PoolView): void;
  /** Pool search, filters, and sort, kept here so they survive leaving the Pool. */
  poolFilters: PoolFilters;
  setPoolFilters(f: PoolFilters | ((f: PoolFilters) => PoolFilters)): void;
  poolSort: PoolSort;
  setPoolSort(s: PoolSort): void;
  /** Switch Cards and Analysis in place, keeping the screen's state. */
  setPoolView(view: PoolView): void;
}

export const NavContext = createContext<Nav | undefined>(undefined);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside the shell');
  return nav;
}
