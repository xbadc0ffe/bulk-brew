import { useEffect, useMemo, useState } from 'react';
import {
  commanderCandidates,
  commanderCanBuild,
  configVersion,
  filterCommanders,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type CommanderCandidate,
  type Pool,
  type ScanReport,
  type Settings,
} from '@bulk-brew/core';

/** With a style picked: the pool can build it under the commander, is still being checked, or is short. */
export type CommanderFit = 'fits' | 'checking' | 'short';

export interface CommanderList {
  /** Every commander in the pool, best first; undefined until listed. */
  list: CommanderCandidate[] | undefined;
  /** Scans of each listed commander's colors at 100, keyed by color letters such as "WU". */
  scans: ReadonlyMap<string, ScanReport>;
  /** The commanders that fit the picked colors and style, best first. */
  shown: CommanderCandidate[];
  /** The listed commanders that fit the picked colors, whatever the style. */
  inColors: CommanderCandidate[];
  /** With a style picked: each shown commander's fit, by id. */
  fit: ReadonlyMap<string, CommanderFit>;
  /** Shown commanders still waiting for their check. */
  checking: number;
  /** Still listing. */
  working: boolean;
}

const NO_SCANS: ReadonlyMap<string, ScanReport> = new Map();
const NO_FIT: ReadonlyMap<string, CommanderFit> = new Map();

/**
 * Commanders in the pool for the Build page. Listing scans the pool once per
 * color identity, which takes a moment on a big collection, so it runs on
 * the next tick and is kept until the pool or settings change. Colors and a
 * style filter the list without listing again. With a style picked, each
 * shown commander whose colors can build it gets a full build to confirm,
 * one per tick and best first, so the order settles while the page stays
 * responsive. Checks wait while `paused` and are kept until the list changes.
 */
export function useCommanderList(input: {
  enabled: boolean;
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: Pool;
  settings: Settings;
  colors: Color[];
  style: string | undefined;
  paused: boolean;
}): CommanderList {
  const { enabled, index, config, pool, settings, colors, style, paused } = input;
  const key = useMemo(
    () =>
      JSON.stringify([
        settings.rarities ?? [],
        settings.unlimitedBasics,
        settings.includeUnsets,
        pool.updatedAt,
        index?.dataVersion ?? '',
        configVersion(config),
      ]),
    [settings, pool.updatedAt, index, config],
  );
  const [state, setState] = useState<{
    key: string;
    list: CommanderCandidate[];
    scans: ReadonlyMap<string, ScanReport>;
  }>();
  /** Build checks for the list with this key, by "style|commander id". */
  const [checks, setChecks] = useState<{ key: string; done: ReadonlyMap<string, boolean> }>({
    key: '',
    done: new Map(),
  });

  useEffect(() => {
    if (!enabled || !index || state?.key === key) return;
    const handle = setTimeout(() => {
      const scans = new Map<string, ScanReport>();
      const list = commanderCandidates(pool, index, config, settings, scans);
      setState({ key, list, scans });
    }, 0);
    return () => clearTimeout(handle);
    // The key covers every input that matters; the objects behind it are read when listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, state?.key]);

  const ready = enabled && Boolean(index) && state?.key === key;
  const list = ready ? state!.list : undefined;
  const scans = ready ? state!.scans : NO_SCANS;
  const done = checks.key === key ? checks.done : undefined;

  const inColors = useMemo(
    () => (list ? filterCommanders(list, colors, undefined, config) : []),
    [list, colors, config],
  );
  const shown = useMemo(
    () => (list && style ? filterCommanders(inColors, [], style, config) : inColors),
    [list, inColors, style, config],
  );
  const fit = useMemo(() => {
    if (!style) return NO_FIT;
    const out = new Map<string, CommanderFit>();
    for (const c of shown) {
      const checked = done?.get(`${style}|${c.id}`);
      if (checked !== undefined) {
        out.set(c.id, checked ? 'fits' : 'short');
        continue;
      }
      // The scan of its colors counts the commander too, so a style it rules out the 99 cannot build.
      const report = scans.get(c.colors.join(''))?.archetypes.find((r) => r.archetype === style);
      out.set(c.id, report?.viable ? 'checking' : 'short');
    }
    return out;
  }, [shown, style, done, scans]);
  const nextCheck = shown.find((c) => fit.get(c.id) === 'checking')?.id;

  useEffect(() => {
    if (paused || !index || !style || !nextCheck) return;
    const handle = setTimeout(() => {
      let ok = false;
      try {
        ok = commanderCanBuild(nextCheck, style, pool, index, config, settings);
      } catch (err) {
        // A builder bug under one commander must not leave the list checking forever.
        console.error(`Checking ${style} under ${nextCheck} failed:`, err);
      }
      setChecks((s) => {
        const base = s.key === key ? s.done : new Map<string, boolean>();
        return { key, done: new Map(base).set(`${style}|${nextCheck}`, ok) };
      });
    }, 0);
    return () => clearTimeout(handle);
    // The key covers the pool and settings; the next commander and style pick the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, key, style, nextCheck]);

  if (!enabled || !index) {
    return {
      list: undefined,
      scans: NO_SCANS,
      shown: [],
      inColors: [],
      fit: NO_FIT,
      checking: 0,
      working: false,
    };
  }
  let checking = 0;
  for (const f of fit.values()) if (f === 'checking') checking += 1;
  return { list, scans, shown, inColors, fit, checking, working: !ready };
}
