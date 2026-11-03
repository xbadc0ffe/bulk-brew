import { createContext, useContext } from 'react';

/** The five screen ids are the information architecture; Analysis is a view of Pool. */
export type ScreenId = 'import' | 'pool' | 'build' | 'decks' | 'settings';
export type PoolView = 'cards' | 'analysis';

export interface Nav {
  screen: ScreenId;
  poolView: PoolView;
  go(screen: ScreenId, poolView?: PoolView): void;
}

export const NavContext = createContext<Nav | undefined>(undefined);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside the shell');
  return nav;
}
