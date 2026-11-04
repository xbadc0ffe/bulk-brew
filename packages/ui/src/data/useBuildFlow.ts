import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuildError,
  buildDeck,
  commitDeck,
  newDeckId,
  normalizeColors,
  scanAll,
  scanPool,
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
  /**
   * Deck colors in WUBRG order: the picked ones, or at 100 the commander's
   * once one is picked. Before that, the picked colors filter the commanders.
   */
  colors: Color[];
  /** Add or remove one color. Ignored at 100 while a commander is picked. */
  toggleColor(color: Color): void;
  /** The first picked color, for screens that work with one. */
  color: Color | undefined;
  /** Pick exactly this one color. */
  setColor(color: Color): void;
  /** Primary style (archetype id), or undefined for best fit. */
  style: string | undefined;
  setStyle(style: string | undefined): void;
  /** Secondary style, only once a primary style is picked. */
  secondary: string | undefined;
  setSecondary(style: string | undefined): void;
  /** Commander card id for 100-card decks; while one is picked, the deck colors are its own. */
  commander: string | undefined;
  setCommander(id: string | undefined): void;
  /** The settings a build uses: the stored ones with this build's copy limit. */
  buildSettings: Settings;
  /** Show a finished build, such as a deck option, as the result. */
  open(result: BuildResult): void;
  /** Clear colors and styles, keeping size and copies. */
  clearChoices(): void;
  /** Copy limit for this build; starts at the setting for the size. */
  maxCopies: number;
  setMaxCopies(n: number): void;
  /** Scan of every color for the current size and copy limit. */
  sizeScans: Record<Color, ScanReport> | undefined;
  /** Scan of the picked colors together. */
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
   * all the cards. With `removeCards` false the deck is saved and the pool
   * is left alone; the deck can be accepted later from Decks.
   */
  accept(removeCards?: boolean): Deck | undefined;
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
  const [picked, setColorsState] = useState<Color[]>([]);
  const [style, setStyleState] = useState<string>();
  const [secondary, setSecondaryState] = useState<string>();
  const [commander, setCommanderState] = useState<string>();
  const lead = size === 100 && commander && index ? index.get(commander) : undefined;
  const leadIdentity = lead?.identity;
  const colors = useMemo(
    () => (leadIdentity ? normalizeColors(leadIdentity) : picked),
    [leadIdentity, picked],
  );
  const color = colors[0];
  /** A copy limit for this build, valid only while the size and stored setting match. */
  const [override, setOverride] = useState<{ size: DeckSize; base: number; value: number }>();
  const [result, setResult] = useState<BuildResult>();
  const [resultMaxCopies, setResultMaxCopies] = useState<number>();
  const [error, setError] = useState<string>();
  const [building, setBuilding] = useState(false);
  const [accepted, setAccepted] = useState<Deck>();

  // A commander that left the pool (its kept deck was accepted from Decks, or
  // a backup replaced the pool) is no longer picked; the commander list returns.
  if (commander && pool.loaded && (pool.pool.entries[commander]?.qty ?? 0) <= 0) {
    setCommanderState(undefined);
    setResult(undefined);
  }

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
    // Commander colors come from the commander, so there is no per-color scan at 100.
    if (!index || size === 100) return undefined;
    if (buildSettings === settings && scans) return scans[size];
    return scanAll(pool.pool, index, config, buildSettings, size);
  }, [index, pool.pool, config, buildSettings, settings, scans, size]);
  const colorScan = useMemo(() => {
    // Before a commander is picked, the colors at 100 only filter the commanders.
    if (!index || colors.length === 0 || (size === 100 && !commander)) return undefined;
    if (colors.length === 1 && sizeScans) return sizeScans[colors[0]!];
    return scanPool(pool.pool, index, config, buildSettings, size, colors);
  }, [index, colors, sizeScans, pool.pool, config, buildSettings, size, commander]);

  const reject = useCallback(() => {
    setResult(undefined);
    setError(undefined);
  }, []);

  const setSize = useCallback(
    (s: DeckSize) => {
      // Colors and styles carry over; at 100 they filter the commanders until one is picked.
      if (s !== 100) setCommanderState(undefined);
      setSizeState(s);
      reject();
    },
    [reject],
  );
  const setColor = useCallback(
    (c: Color) => {
      setColorsState([c]);
      setStyleState(undefined);
      setSecondaryState(undefined);
      reject();
    },
    [reject],
  );
  const toggleColor = useCallback(
    (c: Color) => {
      // A picked commander sets the colors; Change returns to the list and its filter.
      if (lead) return;
      setColorsState((cs) =>
        normalizeColors(cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]),
      );
      reject();
    },
    [reject, lead],
  );
  const setStyle = useCallback(
    (s: string | undefined) => {
      setStyleState(s);
      setSecondaryState(undefined);
      reject();
    },
    [reject],
  );
  const setCommander = useCallback(
    (id: string | undefined) => {
      // Picked colors and styles stay: the styles lead the commander's options, and the
      // colors filter the list again after Change.
      setCommanderState(id);
      reject();
    },
    [reject],
  );
  const setSecondary = useCallback(
    (s: string | undefined) => {
      setSecondaryState(s);
      reject();
    },
    [reject],
  );
  const open = useCallback(
    (r: BuildResult) => {
      setResult(r);
      setResultMaxCopies(maxCopies);
      setError(undefined);
      setAccepted(undefined);
    },
    [maxCopies],
  );
  const clearChoices = useCallback(() => {
    setCommanderState(undefined);
    setColorsState([]);
    setStyleState(undefined);
    setSecondaryState(undefined);
    reject();
  }, [reject]);
  const setMaxCopies = useCallback(
    (n: number) => {
      setOverride({ size, base: stored, value: Math.max(1, Math.min(99, Math.floor(n))) });
      reject();
    },
    [reject, size, stored],
  );

  // Run the build on the next tick so the working state can paint first.
  useEffect(() => {
    if (!building || !index || colors.length === 0) return;
    const handle = setTimeout(() => {
      try {
        const request = style
          ? { size, colors, settings: buildSettings, style, ...(commander ? { commander } : {}) }
          : { size, colors, settings: buildSettings, ...(commander ? { commander } : {}) };
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
  }, [
    building,
    index,
    colors,
    size,
    style,
    commander,
    buildSettings,
    maxCopies,
    pool.pool,
    config,
  ]);

  const canBuild = Boolean(index && colors.length > 0 && colorScan?.possible && !building);

  const build = useCallback(() => {
    if (!canBuild) return;
    setAccepted(undefined);
    setBuilding(true);
  }, [canBuild]);

  const accept = useCallback(
    (removeCards = true): Deck | undefined => {
      if (!result || !index) return undefined;
      const now = new Date().toISOString();
      const id = newDeckId(`${now}:${JSON.stringify(result.deck.cards)}:${decks.decks.length}`);
      const fresh: Deck = { ...result.deck, id, createdAt: now, committed: false };
      if (!removeCards) {
        // Saved as is: the cards stay in the pool, and the deck can be accepted later.
        decks.save(fresh);
        reject();
        setAccepted(fresh);
        return fresh;
      }
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
      // The commander left the pool with its deck; the list of commanders comes back.
      if (deck.commander) setCommanderState(undefined);
      return deck;
    },
    [result, index, decks, pool.pool, pool.actions, settings, config, reject],
  );

  const reset = useCallback(() => {
    reject();
    setAccepted(undefined);
    setOverride(undefined);
    setCommanderState(undefined);
  }, [reject]);

  return {
    size,
    setSize,
    colors,
    toggleColor,
    color,
    setColor,
    style,
    setStyle,
    secondary,
    setSecondary,
    commander,
    setCommander,
    buildSettings,
    open,
    clearChoices,
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
