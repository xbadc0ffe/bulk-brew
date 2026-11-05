import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addOption,
  BuildError,
  buildOption,
  colorSubsets,
  configVersion,
  planOptions,
  scanPool,
  type BuildResult,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type DeckOption,
  type DeckSize,
  type OptionPlan,
  type Pool,
  type ScanReport,
  type Settings,
} from '@bulk-brew/core';

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

interface Tagged extends DeckOptions {
  /** The settings these options belong to. */
  key: string;
  /** The settings the scans belong to (styles left out). */
  scanKey: string;
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

/**
 * Deck options for the Build page. Plans the builds for the current settings,
 * then builds one per tick so the page stays responsive, re-ranking as each
 * finishes. Finished options survive pauses and screen changes; any change to
 * the settings or the pool starts over.
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

  // Which cards the options draw from; styles are left out so a style change reuses the scans.
  const scanKey = useMemo(
    () =>
      JSON.stringify([
        size,
        colors,
        settings.maxCopies,
        settings.rarities ?? [],
        settings.unlimitedBasics,
        settings.includeUnsets,
        pool.updatedAt,
        index?.dataVersion ?? '',
        index?.learnedVersion ?? '',
        configVersion(config),
      ]),
    [size, colors, settings, pool.updatedAt, index, config],
  );
  const key = `${scanKey}|${commander ?? ''}|${primary ?? ''}|${secondary ?? ''}`;
  const request = useMemo(
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

  const [state, setState] = useState<Tagged>({ ...EMPTY, key: '', scanKey: '' });
  const plans = useRef<OptionPlan[]>([]);
  const next = useRef(0);
  const scanCache = useRef<{ key: string; scans: Map<string, ScanReport> }>(undefined);

  // Plan on the next tick (scans every color subset), once per settings key.
  useEffect(() => {
    if (!active || !index || paused || state.key === key) return;
    const handle = setTimeout(() => {
      try {
        let scans = scanCache.current?.key === scanKey ? scanCache.current.scans : undefined;
        if (!scans) {
          scans = new Map();
          // A commander fixes the colors, so only the full set is scanned.
          for (const subset of size === 100 ? [colors] : colorSubsets(colors)) {
            scans.set(subset.join(''), scanPool(pool, index, config, settings, size, subset));
          }
          scanCache.current = { key: scanKey, scans };
        }
        const plan = planOptions(request, pool, index, config, scans);
        plans.current = plan.plans;
        next.current = 0;
        setState({
          ...EMPTY,
          key,
          scanKey,
          scans,
          planned: plan.plans.length,
          working: plan.plans.length > 0,
          primaryUnavailable: plan.primaryUnavailable,
        });
      } catch (err) {
        setState({ ...EMPTY, key, scanKey: '', error: String(err) });
      }
    }, 0);
    return () => clearTimeout(handle);
    // The keys cover every input that matters; the objects behind them are read when planning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, paused, state.key]);

  // Build one option per tick while not paused.
  useEffect(() => {
    if (!active || !index || paused || state.key !== key || !state.working) return;
    const handle = setTimeout(() => {
      const plan = plans.current[next.current];
      next.current += 1;
      let result: BuildResult | undefined;
      let error: string | undefined;
      let failure: string | undefined;
      if (plan) {
        try {
          result = buildOption(plan, request, pool, index, config);
        } catch (err) {
          if (err instanceof BuildError) failure = err.message;
          else error = String(err);
        }
      }
      setState((s) => {
        if (s.key !== key) return s;
        const built = Math.min(next.current, plans.current.length);
        return {
          ...s,
          built,
          working: !error && built < plans.current.length,
          error,
          failure: s.failure ?? failure,
          options:
            plan && result
              ? addOption(s.options, plan.key, result, request, index, config)
              : s.options,
        };
      });
    }, 0);
    return () => clearTimeout(handle);
    // Re-runs after each build, since `state.built` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, paused, key, state.key, state.working, state.built]);

  if (!active) return EMPTY;
  if (state.key !== key) {
    // Planning is pending; keep the style scans when only the styles changed.
    return { ...EMPTY, scans: state.scanKey === scanKey ? state.scans : NO_SCANS, working: true };
  }
  const { options, built, planned, working, primaryUnavailable, scans, error, failure } = state;
  return { options, built, planned, working, primaryUnavailable, scans, error, failure };
}
