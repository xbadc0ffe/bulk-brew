// Domain types shared by the data pipeline, the builder, and both app shells.
// Keep this file free of logic. Changes here are schema changes: bump
// DATA_SCHEMA_VERSION when the data pack shape changes.

export const DATA_SCHEMA_VERSION = 1;

/** The five Magic colors. */
export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

/** A color a permanent can produce; 'C' is colorless. */
export type ManaColor = Color | 'C';

/** Supported deck sizes: 60 constructed, 40 limited-style, 20 Jumpstart packet. */
export type DeckSize = 60 | 40 | 20;

/** Normalized card types. A card can have several (artifact creature, kindred instant). */
export type CardType =
  | 'creature'
  | 'instant'
  | 'sorcery'
  | 'enchantment'
  | 'artifact'
  | 'planeswalker'
  | 'battle'
  | 'land'
  | 'kindred';

/** One face of a multi-face card (split, adventure, transform, modal DFC, flip, meld). */
export interface CardFace {
  name: string;
  manaCost?: string;
  typeLine: string;
  text?: string;
  colors: Color[];
  power?: string;
  toughness?: string;
  loyalty?: string;
}

/**
 * One card as shipped in the data pack. Keyed on Scryfall oracle_id.
 * Printings, sets, and collector numbers are deliberately absent.
 */
export interface CardRecord {
  /** Scryfall oracle_id. The identity of the card everywhere in the app. */
  id: string;
  /** Full Scryfall name. Multi-face cards use "Front // Back". */
  name: string;
  /** Scryfall layout string (normal, split, adventure, transform, modal_dfc, ...). */
  layout: string;
  /** Mana cost of the card as cast (front face for transforming cards). */
  manaCost?: string;
  /** Mana value as cast. */
  mv: number;
  typeLine: string;
  /** Oracle text. Faces are joined with a line containing only "//". */
  text: string;
  colors: Color[];
  /** Color identity. Mono-color builds use this for candidate selection. */
  identity: Color[];
  keywords: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  /** Mana this permanent can produce, when any. */
  produces?: ManaColor[];
  /** Normalized types derived from the type line. */
  types: CardType[];
  /** Lands only: derived from oracle text. */
  entersTapped?: true;
  /** Un-set, acorn, or otherwise not tournament-legal in any format. Excluded unless enabled. */
  unset?: true;
  /** Function and synergy tags: Scryfall Tagger slugs plus the local overlay. */
  tags: string[];
  faces?: CardFace[];
  /** Scryfall printing id of the default image. Build URLs with imageUrl(). */
  img: string;
}

/** The whole shipped database. */
export interface DataPack {
  schema: typeof DATA_SCHEMA_VERSION;
  /** Pack version: the Scryfall bulk data date it was built from (YYYY-MM-DD). */
  version: string;
  builtAt: string;
  cardCount: number;
  cards: CardRecord[];
}

/** Pinned pointer to a published data pack. Lives in data/manifest.json. */
export interface DataManifest {
  schema: typeof DATA_SCHEMA_VERSION;
  version: string;
  url: string;
  sha256: string;
  bytes: number;
  cardCount: number;
}

/** Which printing to show art for. Only ever used for images, never for building. */
export interface PrintingHint {
  /** Scryfall set code, lower case. */
  set: string;
  collectorNumber?: string;
}

export interface PoolEntry {
  cardId: string;
  qty: number;
  printing?: PrintingHint;
}

/** The user's active pool of available cards. Stored locally only. */
export interface Pool {
  entries: Record<string, PoolEntry>;
  updatedAt: string;
}

export interface DeckCard {
  cardId: string;
  qty: number;
  printing?: PrintingHint;
}

export interface Deck {
  id: string;
  name: string;
  size: DeckSize;
  color: Color;
  archetype: string;
  /** Spells and nonbasic lands. */
  cards: DeckCard[];
  /** Basic land counts by color. */
  basics: Partial<Record<Color, number>>;
  /** True once the deck's cards were removed from the pool. */
  committed: boolean;
  createdAt: string;
  configVersion: string;
  dataVersion: string;
  explanation?: BuildExplanation;
}

/** User settings. Defaults live in config/settings.defaults.json. */
export interface Settings {
  maxCopies: Record<DeckSize, number>;
  unlimitedBasics: boolean;
  includeUnsets: boolean;
  showArt: boolean;
}

export interface BuildRequest {
  size: DeckSize;
  color: Color;
  /** Preferred archetype id. Used when viable, otherwise the strongest viable one. */
  style?: string;
  settings: Settings;
}

export interface RoleCount {
  have: number;
  want: number;
}

/** Why the builder made the deck it made. Also the builder's debugging output. */
export interface BuildExplanation {
  archetype: string;
  /**
   * Spell count per mana value, index 0 through 7 (7 means seven or more).
   * Curve profiles cover 1 through 7-plus; zero-cost spells are compared
   * against the 1 bucket.
   */
  curve: number[];
  roles: Record<string, RoleCount>;
  lands: {
    count: number;
    averageMv: number;
    cheapManaSources: number;
  };
  synergies: string[];
  notes: string[];
}

export interface BuildResult {
  deck: Deck;
  explanation: BuildExplanation;
}

/** Viability of one archetype for one color and deck size. */
export interface ArchetypeReport {
  archetype: string;
  viable: boolean;
  enablers: RoleCount;
  payoffs: RoleCount;
  notes: string[];
}

export interface ScanReport {
  color: Color;
  size: DeckSize;
  candidates: number;
  archetypes: ArchetypeReport[];
}
