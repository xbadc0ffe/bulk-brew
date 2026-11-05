import { useEffect, useState } from 'react';
import { CardIndex, parseLearnedData, parsePack } from '@bulk-brew/core';

export type PackState =
  | { status: 'loading' }
  | { status: 'ready'; index: CardIndex }
  | { status: 'error'; error: string };

/**
 * The learned card data, or undefined when it is missing or unusable: the
 * builder then falls back to the tag-level learned config, so a failed fetch
 * never stops the app.
 */
async function loadLearned(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const { data, problems } = parseLearnedData(await res.text());
    if (problems.length) console.warn('learned data not used:', problems);
    return data;
  } catch {
    return undefined;
  }
}

/** Fetch the data pack and the learned card data once and build the card index. */
export function usePack(url: string, learnedUrl?: string): PackState {
  const [state, setState] = useState<PackState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const learned = learnedUrl ? loadLearned(learnedUrl) : Promise.resolve(undefined);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`card data request failed (${res.status})`);
        return parsePack(await res.text());
      })
      .then(async (pack) => {
        const index = new CardIndex(pack);
        const data = await learned;
        if (data) index.learned = data;
        if (!cancelled) setState({ status: 'ready', index });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [url, learnedUrl]);

  return state;
}
