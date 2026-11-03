import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept live. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}
