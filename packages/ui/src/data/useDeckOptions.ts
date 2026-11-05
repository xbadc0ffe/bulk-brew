import { useEffect, useMemo, useRef, useState } from 'react';
import {
  configVersion,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type DeckOption,
  type DeckSize,
  type OptionsRequest,
  type Pool,
  type ScanReport,
  type Settings,
} from '@bulk-brew/core';
import type { FromWorker, ToWorker } from './deckOptionsProtocol.ts';
import { workerCards } from './workerCards.ts';

export interface DeckOptionsInput {
  /** Off where nothing shows options, so nothing builds in the background. */
  enabled: boolean;
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: Pool;
  settings: Settings;
  size: DeckSize;
  colors: Color[];
  primary: string | undefined;
  secondary: string | undefined;
  /** Commander card id for 100-card decks. */
  commander: string | undefined;
  /** True while a deck is open or the Build screen is not showing; work waits until it is false. */
  paused: boolean;
}

export interface DeckOptions {
  options: DeckOption[];
  /** Builds finished and planned for the current settings. */
  built: number;
  planned: number;
  /** Still planning or building. */
  working: boolean;
  /** A primary style was picked and none of the picked colors can build it. */
  primaryUnavailable: boolean;
  /** Scans of every subset of the picked colors, keyed by color letters such as "WU". */
  scans: ReadonlyMap<string, ScanReport>;
  /** Something unexpected stopped the work. */
  error: string | undefined;
  /** Why the first planned build could not make a deck, shown when none could. */
  failure: string | undefined;
}

/** What the worker has sent for one job. */
interface Found {
  job: number;
  /** The settings these options belong to. */
  key: string;
  /** The settings the scans belong to (styles left out). */
  scansKey: string;
  scans: ReadonlyMap<string, ScanReport>;
  /** Undefined until the worker has planned. */
  planned: number | undefined;
  built: number;
  options: DeckOption[];
  primaryUnavailable: boolean;
  failure: string | undefined;
  error: string | undefined;
}

const NO_SCANS: ReadonlyMap<string, ScanReport> = new Map();

const EMPTY: DeckOptions = {
  options: [],
  built: 0,
  planned: 0,
  working: false,
  primaryUnavailable: false,
  scans: NO_SCANS,
  error: undefined,
  failure: undefined,
};

function fresh(job: number, key: string, scansKey: string): Found {
  return {
    job,
    key,
    scansKey,
    scans: NO_SCANS,
    planned: undefined,
    built: 0,
    options: [],
    primaryUnavailable: false,
    failure: undefined,
    error: undefined,
  };
}

function merge(found: Found, msg: FromWorker): Found {
  return {
    ...found,
    ...(msg.plan ?? {}),
    built: msg.built,
    options: msg.options ?? found.options,
    failure: found.failure ?? msg.failure,
    error: msg.error,
  };
}

/**
 * Deck options for the Build page. A worker plans the builds for the current
 * settings and builds them one at a time, as the Analyze pane's best-deck
 * search does, sending the ranked options as each finishes. Finished options
 * survive pauses and screen changes; any change to the settings or the pool
 * starts over, reusing the scans when only the colors or styles changed.
 */
export function useDeckOptions(input: DeckOptionsInput): DeckOptions {
  const {
    enabled,
    index,
    config,
    pool,
    settings,
    size,
    colors,
    primary,
    secondary,
    commander,
    paused,
  } = input;
  // Commander decks wait for a commander; other sizes wait for a color.
  const active =
    enabled && Boolean(index) && colors.length > 0 && (size !== 100 || Boolean(commander));

  // The worker keeps its card index and scans while the pool and card data stay.
  const dataKey = useMemo(
    () =>
      JSON.stringify([
        pool.updatedAt,
        index?.dataVersion ?? '',
        index?.learnedVersion ?? '',
        configVersion(config),
      ]),
    [pool.updatedAt, index, config],
  );
  // A color subset's scan holds for a size and these settings, whatever else is picked.
  const scanKey = useMemo(
    () =>
      JSON.stringify([
        size,
        settings.maxCopies,
        settings.rarities ?? [],
        settings.unlimitedBasics,
        settings.includeUnsets,
      ]),
    [size, settings],
  );
  const scansKey = `${dataKey}|${scanKey}|${colors.join('')}`;
  const key = `${scansKey}|${commander ?? ''}|${primary ?? ''}|${secondary ?? ''}`;
  const request = useMemo<OptionsRequest>(
    () => ({
      size,
      colors,
      settings,
      ...(primary ? { primary } : {}),
      ...(secondary ? { secondary } : {}),
      ...(commander ? { commander } : {}),
    }),
    [size, colors, settings, primary, secondary, commander],
  );

  const worker = useRef<Worker>(undefined);
  /** What the worker was last sent: its data, and the current job. */
  const sent = useRef({ data: '', job: 0, key: '', scansKey: '' });
  const [found, setFound] = useState<Found>();

  useEffect(() => {
    const post = (msg: ToWorker) => worker.current?.postMessage(msg);
    if (!active || !index || paused) {
      post({ type: 'pause' });
      return;
    }
    /** Shows the error on the settings it stopped; the next change starts a fresh worker and job. */
    const fail = (message: string, on: { key: string; scansKey: string }) => {
      worker.current?.terminate();
      worker.current = undefined;
      const current = sent.current;
      sent.current = { ...current, data: '', key: '' };
      setFound((f) => ({
        ...(f?.job === current.job && f.key === on.key
          ? f
          : fresh(current.job, on.key, on.scansKey)),
        error: message,
      }));
    };
    if (!worker.current) {
      let w: Worker;
      try {
        w = new Worker(new URL('./deckOptions.worker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        // No job was sent yet, so the error belongs to the settings on screen.
        fail(String(err), { key, scansKey });
        return;
      }
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        const current = sent.current;
        if (msg.job !== current.job) return;
        setFound((f) =>
          merge(f?.job === msg.job ? f : fresh(msg.job, current.key, current.scansKey), msg),
        );
      };
      w.onerror = (e) => fail(e.message || 'Building deck options stopped.', sent.current);
      worker.current = w;
    }
    if (sent.current.data !== dataKey) {
      post({ type: 'data', data: { ...workerCards(pool, index, config), pool, config } });
      sent.current = { ...sent.current, data: dataKey, key: '' };
    }
    if (sent.current.key !== key) {
      sent.current = { ...sent.current, job: sent.current.job + 1, key, scansKey };
      post({ type: 'start', job: { id: sent.current.job, request, scanKey } });
    } else {
      post({ type: 'resume' });
    }
    // The keys cover the pool, settings, and picks; the objects behind them are read when sending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, key, index]);

  // A fresh worker on remount, so a stopped one is never reused.
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = undefined;
      sent.current = { ...sent.current, data: '', key: '' };
    },
    [],
  );

  return useMemo(() => {
    if (!active) return EMPTY;
    const current = found?.key === key ? found : undefined;
    if (!current || (current.planned === undefined && !current.error)) {
      // Planning is pending; keep the style scans when only the styles changed.
      return {
        ...EMPTY,
        scans: found?.scansKey === scansKey ? found.scans : NO_SCANS,
        working: true,
      };
    }
    const planned = current.planned ?? 0;
    return {
      options: current.options,
      built: current.built,
      planned,
      working: !current.error && current.built < planned,
      primaryUnavailable: current.primaryUnavailable,
      scans: current.scans,
      error: current.error,
      failure: current.failure,
    };
  }, [active, found, key, scansKey]);
}
