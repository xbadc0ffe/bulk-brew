// One build interface for every builder version in the review (docs/algo-review.md),
// so the current builder, the old one, and the prototypes store decks the same way.

import type { BulkBrewConfig, CardIndex, Color, Pool, Settings } from '@bulk-brew/core';

export type ReviewSize = 100 | 60 | 40 | 20;

export interface ReviewRequest {
  size: ReviewSize;
  /** WUBRG order. At 100 cards, the commander's color identity. */
  colors: Color[];
  /** Style id from config/archetypes.json (or "tribal:<Type>" under a commander); absent means best fit. */
  style?: string;
  /** Secondary style id or "tribal:<Type>", used only with a style. */
  secondary?: string;
  /** Commander oracle id; required at 100 cards. */
  commander?: string;
  seed: number;
}

export interface ReviewCard {
  /** Scryfall oracle id. */
  id: string;
  name: string;
  qty: number;
  why?: string;
}

export interface ReviewPoolInfo {
  /** A JSON pool's id, else the pool file's base name. */
  id: string;
  /** The pool file, relative to the repo root. */
  source: string;
  /** FNV-1a of the sorted [oracle id, qty] pairs, as 8 hex digits. */
  hash: string;
  /** Card copies in the pool. */
  cards: number;
}

export interface ReviewDeck {
  version: string;
  versionNotes?: string;
  pool: ReviewPoolInfo;
  request: ReviewRequest;
  deck: {
    name: string;
    /** Style id the version built. */
    archetype: string;
    /** The built deck's own colors, WUBRG order; a best fit can use fewer than were requested. */
    colors?: Color[];
    /** Commander oracle id; the commander is also one of `cards`, as in the core. */
    commander?: string;
    /** Spells and nonbasic lands. */
    cards: ReviewCard[];
    basics: Partial<Record<Color, number>>;
  };
  buildMs: number;
  /** Whatever the version reports about its choices (the core's BuildExplanation for head). */
  explanation?: unknown;
  /** Set when the version could not build the request; the deck is then empty. */
  error?: string;
  builtAt: string;
  dataVersion: string;
}

/** The deck's own colors; files written before `deck.colors` existed fall back to the request's. */
export function deckColorsOf(d: Pick<ReviewDeck, 'deck' | 'request'>): Color[] {
  return d.deck.colors ?? d.request.colors;
}

/** Loaded once per run and shared by every version. The config, settings, and pool are frozen. */
export interface PrepareContext {
  /** The current data pack, with data/learned.json attached. */
  index: CardIndex;
  /** The current config/ (with config/learned/). Versions may ignore it. */
  config: BulkBrewConfig;
  /** config/settings.defaults.json. */
  settings: Settings;
  /** Repo root, for versions that read files of their own. */
  root: string;
}

export interface BuildContext extends PrepareContext {
  pool: Pool;
  request: ReviewRequest;
}

/** What a version returns. The runner adds card names from the pack. */
export interface BuiltDeck {
  name: string;
  archetype: string;
  /** The deck's own colors; the runner records the request's when absent. */
  colors?: Color[];
  commander?: string;
  cards: { id: string; qty: number; why?: string }[];
  basics: Partial<Record<Color, number>>;
  explanation?: unknown;
}

/** A version cannot load (a missing worktree, a pack it cannot read); the runner prints it without a stack. */
export class VersionLoadError extends Error {
  override name = 'VersionLoadError';
}

export interface BuilderVersion {
  /** Folder name under data/review/decks/ and the --version value. */
  id: string;
  label: string;
  notes: string;
  /**
   * Optional one-time setup before the first build (loading an old core,
   * precomputing tables), kept out of build times. A returned string is
   * recorded with every deck, such as the config version it loaded.
   */
  prepare?(ctx: PrepareContext): Promise<string | undefined> | string | undefined;
  /**
   * Build one deck. Throw the core's BuildError when the pool cannot make the
   * request; the runner records it in the deck file. Same pool, request, and
   * seed must give the same deck.
   */
  build(ctx: BuildContext): Promise<BuiltDeck> | BuiltDeck;
}
