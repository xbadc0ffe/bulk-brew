// Domain types shared by the data pipeline, the builder, and both app shells.
// Keep this file free of logic. Changes here are schema changes: bump
// DATA_SCHEMA_VERSION when the data pack shape changes.

export const DATA_SCHEMA_VERSION = 2;

/** Pack schemas the core reads. Schema 1 lacks the Commander and rank fields; treat them as absent. */
export const SUPPORTED_DATA_SCHEMAS: readonly number[] = [1, 2];

/** The five Magic colors. */
export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

export const COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

export const COLOR_LABELS: Record<Color, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

/** Card rarity. Scryfall's special and bonus rarities are stored as rare. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
};

/** A color a permanent can produce; 'C' is colorless. */
export type ManaColor = Color | 'C';

/** Supported deck sizes: 100 Commander, 60 constructed, 40 limited-style, 20 Jumpstart packet. */
export type DeckSize = 100 | 60 | 40 | 20;

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
  /** Set when the card may not be played in Commander: banned, or not legal there (often not yet released). */
  commanderLegality?: 'banned' | 'not_legal';
  /** On the Commander Game Changers list. */
  gameChanger?: true;
  /** Scryfall's popularity rank among Commander decks; 1 is the most played. Absent when unranked. */
  rank?: number;
  /**
   * Lowest rarity among the card's paper printings, as rarity-based formats
   * count it. Absent in schema 1 packs.
   */
  rarity?: Rarity;
  /** Function and synergy tags: Scryfall Tagger slugs plus the local overlay. */
  tags: string[];
  faces?: CardFace[];
  /**
   * Flavor names printed in place of the card's name on some printings, such
   * as Universes Beyond and Godzilla printings ("Bartz Klauser" is Winota,
   * Joiner of Forces). Imports by those names find this card. Absent when the
   * card has none, and in packs built before they were added; an optional
   * field older readers ignore, so it needs no new schema.
   */
  flavorNames?: string[];
  /** Scryfall printing id of the default image. Build URLs with imageUrl(). */
  img: string;
}

/** The whole shipped database. */
export interface DataPack {
  /** One of SUPPORTED_DATA_SCHEMAS; new packs are written with DATA_SCHEMA_VERSION. */
  schema: number;
  /** Pack version: the Scryfall bulk data date it was built from (YYYY-MM-DD). */
  version: string;
  builtAt: string;
  cardCount: number;
  cards: CardRecord[];
}

/** Pinned pointer to a published data pack. Lives in data/manifest.json. */
export interface DataManifest {
  schema: number;
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
  /** Short reason the builder chose this card: a role, a theme slot, a curve need, or filler. */
  why?: string;
}

export interface Deck {
  id: string;
  name: string;
  size: DeckSize;
  /** The main color. Mono decks have only this; older saved decks always do. */
  color: Color;
  /** Every deck color, main first, when the deck has more than one. */
  colors?: Color[];
  archetype: string;
  /** Secondary style id, when one was asked for (see BuildRequest.secondary). */
  secondary?: string;
  /** The commander's card id (100-card decks); the card is also in `cards`. */
  commander?: string;
  /** Spells and nonbasic lands. */
  cards: DeckCard[];
  /** Basic land counts by color. */
  basics: Partial<Record<Color, number>>;
  /** True once the deck's cards were removed from the pool. */
  committed: boolean;
  /** Set when the commit also removed basics (basics were tracked), so a return puts them back. */
  basicsTaken?: true;
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
  /** Rarities the builder may use. Absent means all; basic lands are never filtered. */
  rarities?: Rarity[];
}

export interface BuildRequest {
  size: DeckSize;
  /** One to five colors. The builder uses every one of them. */
  colors: Color[];
  /** Preferred archetype id. Used when viable, otherwise the strongest viable one. */
  style?: string;
  /** Throw a BuildError when the style is not viable, instead of building the best fit. */
  requireStyle?: boolean;
  /** Commander card id; required for 100-card decks, which take its color identity. */
  commander?: string;
  /**
   * Secondary style, used only with a style: another archetype id, or
   * "tribal:<Type>" for a creature type such as "tribal:Bird".
   */
  secondary?: string;
  settings: Settings;
  /** Deck id and timestamp come from the caller so the core stays free of clocks and randomness. */
  id?: string;
  createdAt?: string;
}

export interface RoleCount {
  have: number;
  want: number;
}

/** How good a built deck looks: each part from 0 to 1, the total from 0 to 100. */
export interface DeckScore {
  total: number;
  /** Average card strength, scaled between the config's strength range. */
  strength: number;
  /** Share of role targets met. */
  roles: number;
  curve: number;
  typeMix: number;
  /** Plan depth: the style's own enablers and payoffs against its minimums (rule pairs for plain shapes). */
  synergy: number;
  /** Share of spells the mana base casts on curve at the color's target chance. Absent on older decks. */
  castability?: number;
}

/** Why the builder made the deck it made. Also the builder's debugging output. */
export interface BuildExplanation {
  archetype: string;
  /** The secondary style asked for, and whether the deck reached its minimums. */
  secondary?: { id: string; label: string; met: boolean };
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
    nonbasics: number;
    /** Lands that make each deck color (multi-color decks). */
    sources?: Partial<Record<Color, number>>;
  };
  synergies: string[];
  notes: string[];
  /** Absent on decks built before deck scores existed. */
  score?: DeckScore;
}

export interface BuildResult {
  deck: Deck;
  explanation: BuildExplanation;
}

/** Viability of one archetype for one color and deck size. */
export interface ArchetypeReport {
  archetype: string;
  label: string;
  kind: 'synergy' | 'composition';
  viable: boolean;
  /** Synergy archetypes count enablers and payoffs; composition ones count spells against slots. */
  enablers: RoleCount;
  payoffs: RoleCount;
  /** How far above the minimums the pool sits, as a ratio; negative means short. */
  margin: number;
  notes: string[];
}

export interface ScanReport {
  /** The first color of the set; the only one for mono scans. */
  color: Color;
  colors: Color[];
  size: DeckSize;
  /** Available spell copies that fit the color. */
  candidates: number;
  /** Of those, copies whose color identity is the color itself (not colorless). */
  colored: number;
  /** Distinct spell cards that fit the color. */
  distinct: number;
  lands: number;
  /** Spell slots the template leaves after its base land count. */
  spellSlots: number;
  /** Fewest spells that still build: the slots left at the template's most lands. */
  minSpells: number;
  /** Whether a deck of this size can be built at all. */
  possible: boolean;
  archetypes: ArchetypeReport[];
  /** Creature types with at least a few members: members (changelings included) and type payoffs. */
  tribes?: TribeReport[];
  notes: string[];
}

/** A creature type in the pool, for tribal secondary styles. */
export interface TribeReport {
  type: string;
  members: number;
  payoffs: number;
}
