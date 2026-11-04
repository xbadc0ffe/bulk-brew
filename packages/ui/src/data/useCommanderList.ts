import { useEffect, useMemo, useState } from 'react';
import {
  commanderCandidates,
  configVersion,
  type BulkBrewConfig,
  type CardIndex,
  type CommanderCandidate,
  type Pool,
  type Settings,
} from '@bulk-brew/core';

export interface CommanderList {
  /** Commanders in the pool, best first; undefined until listed. */
  list: CommanderCandidate[] | undefined;
  /** Still listing. */
  working: boolean;
}

/**
 * Commanders in the pool for the Build page. Listing scans the pool once per
 * color identity, which takes a moment on a big collection, so it runs on
 * the next tick and is kept until the pool or settings change.
 */
export function useCommanderList(input: {
  enabled: boolean;
  index: CardIndex | undefined;
  config: BulkBrewConfig;
  pool: Pool;
  settings: Settings;
}): CommanderList {
  const { enabled, index, config, pool, settings } = input;
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
  const [state, setState] = useState<{ key: string; list: CommanderCandidate[] }>();

  useEffect(() => {
    if (!enabled || !index || state?.key === key) return;
    const handle = setTimeout(() => {
      setState({ key, list: commanderCandidates(pool, index, config, settings) });
    }, 0);
    return () => clearTimeout(handle);
    // The key covers every input that matters; the objects behind it are read when listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, state?.key]);

  if (!enabled || !index) return { list: undefined, working: false };
  return state?.key === key
    ? { list: state.list, working: false }
    : { list: undefined, working: true };
}
