// Messages between useDeckOptions and its worker.

import type {
  BulkBrewConfig,
  DataPack,
  DeckOption,
  LearnedDataFile,
  OptionsRequest,
  Pool,
  ScanReport,
} from '@bulk-brew/core';

/** The pool and card data. Sent again only when they change; the worker keeps its index and scans until then. */
export interface DeckOptionsData {
  /** Only the pool's cards and the basics (see poolPack). */
  pack: DataPack;
  /** The learned card data, when the app loaded it. */
  learned?: LearnedDataFile;
  pool: Pool;
  config: BulkBrewConfig;
}

export interface DeckOptionsJob {
  /** Grows with each job; updates for an older job are ignored. */
  id: number;
  request: OptionsRequest;
  /** Jobs with the same scan key (the size and build settings) reuse each other's scans. */
  scanKey: string;
}

export type ToWorker =
  | { type: 'data'; data: DeckOptionsData }
  | { type: 'start'; job: DeckOptionsJob }
  | { type: 'pause' }
  | { type: 'resume' };

export interface FromWorker {
  type: 'update';
  job: number;
  /** Sent with the plan, once every color subset is scanned. */
  plan?: {
    scans: ReadonlyMap<string, ScanReport>;
    planned: number;
    primaryUnavailable: boolean;
  };
  built: number;
  /** Sent only when the ranked options changed. */
  options?: DeckOption[];
  failure?: string;
  /** Something unexpected stopped the work. */
  error?: string;
}
