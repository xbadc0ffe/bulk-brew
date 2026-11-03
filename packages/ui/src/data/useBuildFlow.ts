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
import { archetypeViability, type ScansBySize } from './analysis.ts';
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
  /** The saved copy of the current result, once saved. */
  saved: Deck | undefined;
  error: string | undefined;
  building: boolean;
  canBuild: boolean;
  build(): void;
  /** Build again with the next viable style after the current deck's. */
  rebuild(): void;
  /** How many other viable styles Rebuild can move to. */
  otherStyles: number;
  /** Save the deck and keep its cards in the pool. */
  save(): Deck | undefined;
  /** Save if needed, remove the deck's cards from the pool, and return to the form. */
  removeFromPool(): Deck | undefined;
  /** Leave the result and return to the form with every choice kept. */
  editSettings(): void;
  /** The deck most recently removed from the pool, for a confirmation line. */
  accepted: Deck | undefined;
}

/** State for the Build screen: choices, scan, build, save. Lives in the app provider so it survives navigation. */
export function useBuildFlow(input: BuildFlowInput): BuildFlow {
  const { index, config, pool, settings, decks, scans } = input;
  const [size, setSizeState] = useState<DeckSize>(60);
  const [color, setColorState] = useState<Color>();
  const [style, setStyleState] = useState<string>();
  const [copiesOverride, setCopiesOverride] = useState<number>();
  const [result, setResult] = useState<BuildResult>();
  const [resultMaxCopies, setResultMaxCopies] = useState<number>();
  const [saved, setSaved] = useState<Deck>();
  const [error, setError] = useState<string>();
  const [building, setBuilding] = useState(false);
  const [accepted, setAccepted] = useState<Deck>();

  const maxCopies = copiesOverride ?? settings.maxCopies[size];
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

  const clearResult = useCallback(() => {
    setResult(undefined);
    setSaved(undefined);
    setError(undefined);
  }, []);

  const setSize = useCallback(
    (s: DeckSize) => {
      setSizeState(s);
      setCopiesOverride(undefined);
      clearResult();
    },
    [clearResult],
  );
  const setColor = useCallback(
    (c: Color) => {
      setColorState(c);
      setStyleState(undefined);
      clearResult();
    },
    [clearResult],
  );
  const setStyle = useCallback(
    (s: string | undefined) => {
      setStyleState(s);
      clearResult();
    },
    [clearResult],
  );
  const setMaxCopies = useCallback(
    (n: number) => {
      setCopiesOverride(Math.max(1, Math.floor(n)));
      clearResult();
    },
    [clearResult],
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
        setSaved(undefined);
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

  const viableStyles = useMemo(
    () =>
      colorScan
        ? colorScan.archetypes
            .filter((a) => archetypeViability(a, colorScan) === 'viable')
            .map((a) => a.archetype)
        : [],
    [colorScan],
  );
  const current = result?.deck.archetype;
  const otherStyles = viableStyles.filter((s) => s !== current).length;

  const rebuild = useCallback(() => {
    if (!current || building || viableStyles.length === 0) return;
    const at = viableStyles.indexOf(current);
    const next = viableStyles[(at + 1) % viableStyles.length];
    if (!next || next === current) return;
    // Keep the old result on screen until the new one replaces it.
    setStyleState(next);
    setBuilding(true);
  }, [current, building, viableStyles]);

  /** The deck as it should be stored: the saved copy, or a fresh one with an id and time. */
  const toSave = useCallback((): Deck | undefined => {
    if (saved) return saved;
    if (!result) return undefined;
    const now = new Date().toISOString();
    const id = newDeckId(`${now}:${JSON.stringify(result.deck.cards)}:${decks.decks.length}`);
    return { ...result.deck, id, createdAt: now, committed: false };
  }, [saved, result, decks.decks.length]);

  const save = useCallback((): Deck | undefined => {
    if (saved) return saved;
    const deck = toSave();
    if (!deck) return undefined;
    decks.save(deck);
    setSaved(deck);
    return deck;
  }, [saved, toSave, decks]);

  const removeFromPool = useCallback((): Deck | undefined => {
    const base = toSave();
    if (!base || !index) return undefined;
    const now = new Date().toISOString();
    // commitDeck is pure, so computing the deck here and the pool in the
    // updater gives the same answer.
    const { deck } = commitDeck(pool.pool, base, settings, index, config, now);
    pool.actions.transform((p) => commitDeck(p, base, settings, index, config, now).pool);
    decks.save(deck);
    clearResult();
    setAccepted(deck);
    return deck;
  }, [toSave, index, pool.pool, pool.actions, settings, config, decks, clearResult]);

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
    saved,
    error,
    building,
    canBuild,
    build,
    rebuild,
    otherStyles,
    save,
    removeFromPool,
    editSettings: clearResult,
    accepted,
  };
}
