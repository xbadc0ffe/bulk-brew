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
import type { DecksState } from './useDecks.ts';
import type { PoolState } from './usePool.ts';

export interface BuildFlowInput {
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: PoolState;
  settings: Settings;
  decks: DecksState;
}

export interface BuildFlow {
  size: DeckSize;
  setSize(size: DeckSize): void;
  color: Color | undefined;
  setColor(color: Color): void;
  /** Archetype id, or undefined for best fit. */
  style: string | undefined;
  setStyle(style: string | undefined): void;
  /** Scan of every color for the current size. */
  scans: Record<Color, ScanReport> | undefined;
  /** Scan of the chosen color. */
  colorScan: ScanReport | undefined;
  result: BuildResult | undefined;
  error: string | undefined;
  building: boolean;
  canBuild: boolean;
  build(): void;
  /** Save the fresh deck, remove its cards from the pool, and return it. */
  accept(): Deck | undefined;
  /** Drop the fresh deck and return to the form with size, color, and style kept. */
  discard(): void;
  /** Drop the fresh deck and ask the form to focus the style list. */
  tryAnotherStyle(): void;
  /** Increments each time tryAnotherStyle runs, so the form can react. */
  styleFocusRequest: number;
  /** The deck most recently accepted, for a confirmation line. */
  accepted: Deck | undefined;
}

/** State for the Build screen: choices, scan, build, accept. Lives in the app provider so it survives navigation. */
export function useBuildFlow(input: BuildFlowInput): BuildFlow {
  const { index, config, pool, settings, decks } = input;
  const [size, setSizeState] = useState<DeckSize>(60);
  const [color, setColorState] = useState<Color>();
  const [style, setStyleState] = useState<string>();
  const [result, setResult] = useState<BuildResult>();
  const [error, setError] = useState<string>();
  const [building, setBuilding] = useState(false);
  const [accepted, setAccepted] = useState<Deck>();
  const [styleFocusRequest, setStyleFocusRequest] = useState(0);

  const scans = useMemo(
    () => (index ? scanAll(pool.pool, index, config, settings, size) : undefined),
    [index, pool.pool, config, settings, size],
  );
  const colorScan = color && scans ? scans[color] : undefined;

  const setSize = useCallback((s: DeckSize) => {
    setSizeState(s);
    setResult(undefined);
    setError(undefined);
  }, []);
  const setColor = useCallback((c: Color) => {
    setColorState(c);
    setStyleState(undefined);
    setResult(undefined);
    setError(undefined);
  }, []);
  const setStyle = useCallback((s: string | undefined) => {
    setStyleState(s);
    setResult(undefined);
    setError(undefined);
  }, []);

  // Run the build on the next tick so the working state can paint first.
  useEffect(() => {
    if (!building || !index || !color) return;
    const handle = setTimeout(() => {
      try {
        const request = style ? { size, color, settings, style } : { size, color, settings };
        setResult(buildDeck(request, pool.pool, index, config));
        setError(undefined);
      } catch (err) {
        setResult(undefined);
        setError(err instanceof BuildError ? err.message : `Build failed: ${String(err)}`);
      } finally {
        setBuilding(false);
      }
    }, 0);
    return () => clearTimeout(handle);
  }, [building, index, color, size, style, settings, pool.pool, config]);

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
    const fresh: Deck = { ...result.deck, id, createdAt: now };
    // commitDeck is pure, so computing the deck here and the pool in the
    // updater gives the same answer.
    const { deck } = commitDeck(pool.pool, fresh, settings, index, config, now);
    pool.actions.transform((p) => commitDeck(p, fresh, settings, index, config, now).pool);
    decks.save(deck);
    setResult(undefined);
    setAccepted(deck);
    return deck;
  }, [result, index, decks, pool.pool, pool.actions, settings, config]);

  const discard = useCallback(() => {
    setResult(undefined);
    setError(undefined);
  }, []);

  const tryAnotherStyle = useCallback(() => {
    setResult(undefined);
    setError(undefined);
    setStyleFocusRequest((n) => n + 1);
  }, []);

  return {
    size,
    setSize,
    color,
    setColor,
    style,
    setStyle,
    scans,
    colorScan,
    result,
    error,
    building,
    canBuild,
    build,
    accept,
    discard,
    tryAnotherStyle,
    styleFocusRequest,
    accepted,
  };
}
