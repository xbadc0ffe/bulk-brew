// Messages between useBestDecks and its worker.

import type {
  BulkBrewConfig,
  DataPack,
  DeckOption,
  DeckSize,
  Pool,
  Settings,
} from '@bulk-brew/core';

export interface BestDecksJob {
  /** Grows with each job; updates for an older job are ignored. */
  id: number;
  /** Only the pool's cards and the basics (see poolPack). */
  pack: DataPack;
  pool: Pool;
  settings: Settings;
  config: BulkBrewConfig;
  /** How many of the best decks each size reports. */
  shown: number;
}

export type ToWorker =
  { type: 'start'; job: BestDecksJob } | { type: 'pause' } | { type: 'resume' };

export interface SizeUpdate {
  planned: number | undefined;
  built: number;
  done: boolean;
  commanders?: number;
  /** Sent only when the best decks changed; one list per color limit, mono first. */
  options?: DeckOption[][];
  /** Something unexpected stopped this size. */
  error?: string;
}

/** A scan of one color or pair at one size, for the color depth tiles. */
export interface DepthUpdate {
  /** Color letters, such as "W" or "WU". */
  key: string;
  size: DeckSize;
  /** Spell copies a deck in these colors can use. */
  spells: number;
  possible: boolean;
}

export interface FromWorker {
  type: 'update';
  job: number;
  sizes: Partial<Record<DeckSize, SizeUpdate>>;
  depth: DepthUpdate[];
}
