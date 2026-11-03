import { useEffect, useState } from 'react';
import { CardIndex, parsePack } from '@bulk-brew/core';

export type PackState =
  | { status: 'loading' }
  | { status: 'ready'; index: CardIndex }
  | { status: 'error'; error: string };

/** Fetch the data pack once and build the card index. */
export function usePack(url: string): PackState {
  const [state, setState] = useState<PackState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`card data request failed (${res.status})`);
        return parsePack(await res.text());
      })
      .then((pack) => {
        if (!cancelled) setState({ status: 'ready', index: new CardIndex(pack) });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
