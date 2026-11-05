import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BEST_DECK_SIZES,
  COLORS,
  configVersion,
  poolPack,
  trimLearned,
  type BulkBrewConfig,
  type CardIndex,
  type DeckOption,
  type DeckSize,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import type { FromWorker, ToWorker } from './bestDecksProtocol.ts';

/** How many decks the Analyze pane lists per size. */
export const BEST_DECKS_SHOWN = 5;

export interface BestDecksSize {
  /** Builds planned; undefined while the pool is still being scanned. */
  planned: number | undefined;
  built: number;
  done: boolean;
  /** Commanders with enough cards for the 99, at 100 once listed. */
  commanders?: number;
  /**
   * The strongest decks so far, best first, for each most colors a deck may
   * have: index 0 holds mono-color decks, index 4 decks of any colors.
   */
  options: DeckOption[][];
  error?: string;
}

export interface BestDecks {
  sizes: Record<DeckSize, BestDecksSize>;
  built: number;
  working: boolean;
  /** The worker could not start or stopped. */
  error: string | undefined;
}

interface Found {
  key: string;
  job: number;
  sizes: Record<DeckSize, BestDecksSize>;
  error?: string;
}

const emptySizes = (): Record<DeckSize, BestDecksSize> =>
  Object.fromEntries(
    BEST_DECK_SIZES.map((s) => [
      s,
      { planned: undefined, built: 0, done: false, options: COLORS.map(() => []) },
    ]),
  ) as unknown as Record<DeckSize, BestDecksSize>;

function merge(found: Found, msg: FromWorker): Found {
  const sizes = { ...found.sizes };
  for (const size of BEST_DECK_SIZES) {
    const u = msg.sizes[size];
    if (!u) continue;
    const { options, ...rest } = u;
    sizes[size] = { ...sizes[size], ...rest, options: options ?? sizes[size].options };
  }
  return { ...found, sizes };
}

/**
 * The strongest decks the pool can build at each size, for the Analyze pane.
 * A worker searches every color set and style (and every commander) while
 * `active`, sending the best few as they improve. Results are kept while
 * paused; a change to the pool or the build settings starts over.
 */
export function useBestDecks(input: {
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: Pool;
  settings: Settings;
  active: boolean;
}): BestDecks {
  const { index, config, pool, settings, active } = input;
  const key = useMemo(
    () =>
      JSON.stringify([
        settings.maxCopies,
        settings.rarities ?? [],
        settings.unlimitedBasics,
        settings.includeUnsets,
        pool.updatedAt,
        index?.dataVersion ?? '',
        index?.learnedVersion ?? '',
        configVersion(config),
      ]),
    [settings, pool.updatedAt, index, config],
  );
  const worker = useRef<Worker>(undefined);
  const job = useRef({ id: 0, key: '' });
  const [found, setFound] = useState<Found>();

  useEffect(() => {
    const post = (msg: ToWorker) => worker.current?.postMessage(msg);
    if (!active || !index) {
      post({ type: 'pause' });
      return;
    }
    const fail = (message: string) => {
      worker.current?.terminate();
      worker.current = undefined;
      // The next activation starts a fresh worker and job.
      const current = job.current;
      job.current = { ...current, key: '' };
      setFound((f) => ({
        ...(f?.job === current.id ? f : { key: current.key, job: current.id, sizes: emptySizes() }),
        error: message,
      }));
    };
    if (!worker.current) {
      let w: Worker;
      try {
        w = new Worker(new URL('./bestDecks.worker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        fail(String(err));
        return;
      }
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        const current = job.current;
        if (msg.job !== current.id) return;
        setFound((f) =>
          merge(
            f?.job === msg.job ? f : { key: current.key, job: msg.job, sizes: emptySizes() },
            msg,
          ),
        );
      };
      w.onerror = (e) => fail(e.message || 'The deck search stopped.');
      worker.current = w;
    }
    if (job.current.key !== key) {
      job.current = { id: job.current.id + 1, key };
      const pack = poolPack(pool, index, config);
      // The worker builds from the pool alone, so it gets only the learned data the pool can use.
      const learned = index.learned
        ? trimLearned(index.learned.file, new Set(pack.cards.map((c) => c.id)))
        : undefined;
      post({
        type: 'start',
        job: {
          id: job.current.id,
          pack,
          ...(learned ? { learned } : {}),
          pool,
          settings,
          config,
          shown: BEST_DECKS_SHOWN,
        },
      });
    } else {
      post({ type: 'resume' });
    }
    // The key covers the pool and settings; the objects behind it are read when a job starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, index]);

  // A fresh worker on remount, so a stopped one is never reused.
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = undefined;
      job.current = { ...job.current, key: '' };
    },
    [],
  );

  return useMemo(() => {
    const current = found?.key === key ? found : undefined;
    const sizes = current?.sizes ?? emptySizes();
    let built = 0;
    for (const s of BEST_DECK_SIZES) built += sizes[s].built;
    const error = current?.error;
    return {
      sizes,
      built,
      working: !error && BEST_DECK_SIZES.some((s) => !sizes[s].done),
      error,
    };
  }, [found, key]);
}
