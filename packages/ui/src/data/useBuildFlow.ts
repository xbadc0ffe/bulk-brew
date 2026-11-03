import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuildError,
  buildDeck,
  commitDeck,
  newDeckId,
  scanAll,
  type BuildResult,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type Deck,
  type DeckSize,
  type ScanReport,
  type Settings,
} from '@bulk-brew/core';
import type { ScansBySize } from './analysis.ts';
import { poolShortfall, shortfallMessage } from './poolCheck.ts';
import type { DecksState } from './useDecks.ts';
import type { PoolState } from './usePool.ts';

export interface BuildFlowInput {
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  settings: Settings;
  decks: DecksState;
  /** Shared scans with the stored settings; reused when no per-build override applies. */
  scans: ScansBySize | undefined;
}

export interface BuildFlow {
  size: DeckSize;
  setSize(size: DeckSize): void;
  color: Color | undefined;
  setColor(color: Color): void;
  /** Archetype id, or undefined for best fit. */
  style: string | undefined;
  setStyle(style: string | undefined): void;
  /** Copy limit for this build; starts at the setting for the size. */
  maxCopies: number;
  setMaxCopies(n: number): void;
  /** Scan of every color for the current size and copy limit. */
  sizeScans: Record<Color, ScanReport> | undefined;
  /** Scan of the chosen color. */
  colorScan: ScanReport | undefined;
  result: BuildResult | undefined;
  /** Copy limit the current result was built with. */
  resultMaxCopies: number | undefined;
  error: string | undefined;
  building: boolean;
  canBuild: boolean;
  build(): void;
  /**
   * Save the deck and take its cards out of the pool, then return to the
   * form. Refuses, with a message in `error`, when the pool no longer holds
   * all the cards.
   */
  accept(): Deck | undefined;
  /** Drop the result and return to the form with every choice kept. */
  reject(): void;
  /** Forget the result, the last confirmation, and the copy override. For pool resets. */
  reset(): void;
  /** The deck most recently accepted, for a confirmation line. */
  accepted: Deck | undefined;
}

/** State for the Build screen: choices, scan, build, accept. Lives in the app provider so it survives navigation. */
export function useBuildFlow(input: BuildFlowInput): BuildFlow {
  const { index, config, pool, settings, decks, scans } = input;
  const [size, setSizeState] = useState<DeckSize>(60);
  const [color, setColorState] = useState<Color>();
  const [style, setStyleState] = useState<string>();
  /** A copy limit for this build, valid only while the size and stored setting match. */
  const [override, setOverride] = useState<{ size: DeckSize; base: number; value: number }>();
  const [result, setResult] = useState<BuildResult>();
  const [resultMaxCopies, setResultMaxCopies] = useState<number>();
  const [error, setError] = useState<string>();
  const [building, setBuilding] = useState(false);
  const [accepted, setAccepted] = useState<Deck>();

  const stored = settings.maxCopies[size];
  const maxCopies =
    override && override.size === size && override.base === stored ? override.value : stored;
  const buildSettings = useMemo(
    (): Settings =>
      maxCopies === settings.maxCopies[size]
        ? settings
        : { ...settings, maxCopies: { ...settings.maxCopies, [size]: maxCopies } },
    [settings, size, maxCopies],
  );
  const sizeScans = useMemo(() => {
    if (!index) return undefined;
    if (buildSettings === settings && scans) return scans[size];
    return scanAll(pool.pool, index, config, buildSettings, size);
  }, [index, pool.pool, config, buildSettings, settings, scans, size]);
  const colorScan = color && sizeScans ? sizeScans[color] : undefined;

  const reject = useCallback(() => {
    setResult(undefined);
    setError(undefined);
  }, []);

  const setSize = useCallback(
    (s: DeckSize) => {
      setSizeState(s);
      reject();
    },
    [reject],
  );
  const setColor = useCallback(
    (c: Color) => {
      setColorState(c);
      setStyleState(undefined);
      reject();
    },
    [reject],
  );
  const setStyle = useCallback(
    (s: string | undefined) => {
      setStyleState(s);
      reject();
    },
    [reject],
  );
  const setMaxCopies = useCallback(
    (n: number) => {
      setOverride({ size, base: stored, value: Math.max(1, Math.min(99, Math.floor(n))) });
      reject();
    },
    [reject, size, stored],
  );

  // Run the build on the next tick so the working state can paint first.
  useEffect(() => {
    if (!building || !index || !color) return;
    const handle = setTimeout(() => {
      try {
        const request = style
          ? { size, color, settings: buildSettings, style }
          : { size, color, settings: buildSettings };
        setResult(buildDeck(request, pool.pool, index, config));
        setResultMaxCopies(maxCopies);
        setError(undefined);
      } catch (err) {
        setResult(undefined);
        setError(err instanceof BuildError ? err.message : `Build failed: ${String(err)}`);
      } finally {
        setBuilding(false);
      }
    }, 0);
    return () => clearTimeout(handle);
  }, [building, index, color, size, style, buildSettings, maxCopies, pool.pool, config]);

  const canBuild = Boolean(index && color && colorScan?.possible && !building);

  const build = useCallback(() => {
    if (!canBuild) return;
    setAccepted(undefined);
    setBuilding(true);
  }, [canBuild]);

  const accept = useCallback((): Deck | undefined => {
    if (!result || !index) return undefined;
    const now = new Date().toISOString();
    const id = newDeckId(`${now}:${JSON.stringify(result.deck.cards)}:${decks.decks.length}`);
    const fresh: Deck = { ...result.deck, id, createdAt: now, committed: false };
    const short = poolShortfall(pool.pool, fresh, settings, index, config);
    if (short > 0) {
      setError(shortfallMessage(short));
      return undefined;
    }
    // commitDeck is pure, so computing the deck here and the pool in the
    // updater gives the same answer.
    const { deck } = commitDeck(pool.pool, fresh, settings, index, config, now);
    pool.actions.transform((p) => commitDeck(p, fresh, settings, index, config, now).pool);
    decks.save(deck);
    reject();
    setAccepted(deck);
    return deck;
  }, [result, index, decks, pool.pool, pool.actions, settings, config, reject]);

  const reset = useCallback(() => {
    reject();
    setAccepted(undefined);
    setOverride(undefined);
  }, [reject]);

  return {
    size,
    setSize,
    color,
    setColor,
    style,
    setStyle,
    maxCopies,
    setMaxCopies,
    sizeScans,
    colorScan,
    result,
    resultMaxCopies,
    error,
    building,
    canBuild,
    build,
    accept,
    reject,
    reset,
    accepted,
  };
}
