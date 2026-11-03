import { useMemo } from 'react';
import {
  scanAll,
  type BulkBrewConfig,
  type CardIndex,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import { DECK_SIZES, type ScansBySize } from './analysis.ts';

/** Every color at every size, recomputed when the pool or settings change. */
export function usePoolScans(
  index: CardIndex | undefined,
  pool: Pool,
  config: BulkBrewConfig,
  settings: Settings,
): ScansBySize | undefined {
  return useMemo(() => {
    if (!index) return undefined;
    const out = {} as ScansBySize;
    for (const size of DECK_SIZES) out[size] = scanAll(pool, index, config, settings, size);
    return out;
  }, [index, pool, config, settings]);
}
