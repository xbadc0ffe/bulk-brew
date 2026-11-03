import { createContext, useContext } from 'react';
import type { PoolFilters, PoolSort } from '@bulk-brew/ui';

/** Screens. Import is a subpage of the Bulk List (screen id `pool`) with no sidebar item. */
export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings' | 'about';

export interface Nav {
  screen: ScreenId;
  go(screen: ScreenId): void;
  /** Bulk List search, filters, and sort, kept here so they survive leaving the list. */
  poolFilters: PoolFilters;
  setPoolFilters(f: PoolFilters | ((f: PoolFilters) => PoolFilters)): void;
  poolSort: PoolSort;
  setPoolSort(s: PoolSort): void;
  /** Whether the analysis panel is open under the Bulk List. */
  analyze: boolean;
  setAnalyze(open: boolean): void;
}

export const NavContext = createContext<Nav | undefined>(undefined);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside the shell');
  return nav;
}
