import {
  COLORS,
  factsFor,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type CardType,
  type Color,
  type Pool,
  type PoolEntry,
} from '@bulk-brew/core';

export interface PoolRow {
  entry: PoolEntry;
  card: CardRecord;
}

/** A card's color class: one of the five, colorless, or multicolor. */
export type ColorKey = Color | 'C' | 'M';
export type PoolSort = 'name' | 'mv' | 'color' | 'qty';

export const POOL_SORTS: { id: PoolSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'mv', label: 'Mana value' },
  { id: 'color', label: 'Color' },
  { id: 'qty', label: 'Quantity' },
];

export const COLOR_KEYS: { id: ColorKey; label: string }[] = [
  { id: 'W', label: 'White' },
  { id: 'U', label: 'Blue' },
  { id: 'B', label: 'Black' },
  { id: 'R', label: 'Red' },
  { id: 'G', label: 'Green' },
  { id: 'C', label: 'Colorless' },
  { id: 'M', label: 'Multicolor' },
];

export type TypeKey = Exclude<CardType, 'kindred'>;

export const TYPE_KEYS: { id: TypeKey; label: string }[] = [
  { id: 'creature', label: 'Creature' },
  { id: 'instant', label: 'Instant' },
  { id: 'sorcery', label: 'Sorcery' },
  { id: 'enchantment', label: 'Enchantment' },
  { id: 'artifact', label: 'Artifact' },
  { id: 'planeswalker', label: 'Planeswalker' },
  { id: 'battle', label: 'Battle' },
  { id: 'land', label: 'Land' },
];

/** Mana value buckets; 6 means six or more. */
export const MANA_VALUES: { id: number; label: string }[] = [0, 1, 2, 3, 4, 5, 6].map((n) => ({
  id: n,
  label: n === 6 ? '6+' : String(n),
}));

export interface PoolFilters {
  search: string;
  colors: ColorKey[];
  types: TypeKey[];
  manaValues: number[];
  /** Tag ids from cardTags(). */
  tags: string[];
}

export const EMPTY_FILTERS: PoolFilters = {
  search: '',
  colors: [],
  types: [],
  manaValues: [],
  tags: [],
};

export interface PoolViewOptions extends Partial<PoolFilters> {
  sort?: PoolSort;
  /** Needed for tag filters. */
  config?: BulkBrewConfig;
}

export function colorKey(card: CardRecord): ColorKey {
  if (card.identity.length === 0) return 'C';
  if (card.identity.length > 1) return 'M';
  return card.identity[0]!;
}

/** Mono colors in WUBRG order, then multicolor, then colorless. */
function colorRank(card: CardRecord): number {
  const k = colorKey(card);
  if (k === 'M') return COLORS.length;
  if (k === 'C') return COLORS.length + 1;
  return COLORS.indexOf(k);
}

function compareRows(sort: PoolSort): (a: PoolRow, b: PoolRow) => number {
  const byName = (a: PoolRow, b: PoolRow) => a.card.name.localeCompare(b.card.name);
  switch (sort) {
    case 'mv':
      return (a, b) => a.card.mv - b.card.mv || byName(a, b);
    case 'color':
      return (a, b) => colorRank(a.card) - colorRank(b.card) || byName(a, b);
    case 'qty':
      return (a, b) => b.entry.qty - a.entry.qty || byName(a, b);
    default:
      return byName;
  }
}

export interface CardTag {
  /** "role:<id>" or "style:<archetype id>"; enabler and payoff share the style id. */
  id: string;
  label: string;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Plain-language tags for a card: the config's role labels, then the styles
 * it enables or pays off. Raw Scryfall tags stay behind a disclosure.
 */
export function cardTags(index: CardIndex, config: BulkBrewConfig, card: CardRecord): CardTag[] {
  const facts = factsFor(index, config, card);
  const out: CardTag[] = [];
  const roleLabel = (id: string) => config.roles.roles.find((r) => r.id === id)?.label ?? id;
  const styleLabel = (id: string) =>
    config.archetypes.archetypes.find((a) => a.id === id)?.label ?? id;
  for (const id of facts.roles) out.push({ id: `role:${id}`, label: lowerFirst(roleLabel(id)) });
  for (const id of facts.enablerOf)
    out.push({ id: `style:${id}`, label: lowerFirst(styleLabel(id)) });
  for (const id of facts.payoffOf)
    out.push({ id: `style:${id}`, label: `${lowerFirst(styleLabel(id))} payoff` });
  return out;
}

/** Every tag the filter can offer: roles, then styles. */
export function tagOptions(config: BulkBrewConfig): { group: string; tags: CardTag[] }[] {
  return [
    {
      group: 'Roles',
      tags: config.roles.roles.map((r) => ({ id: `role:${r.id}`, label: r.label })),
    },
    {
      group: 'Styles',
      tags: config.archetypes.archetypes
        .filter((a) => a.kind === 'synergy')
        .map((a) => ({ id: `style:${a.id}`, label: a.label })),
    },
  ];
}

/** Number of filters applied, search excluded. */
export function filterCount(f: PoolFilters): number {
  return f.colors.length + f.types.length + f.manaValues.length + f.tags.length;
}

/** Pool entries joined with card records, filtered and sorted. */
export function poolRows(pool: Pool, index: CardIndex, opts: PoolViewOptions = {}): PoolRow[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  const colors = new Set(opts.colors ?? []);
  const types = opts.types ?? [];
  const mvs = new Set(opts.manaValues ?? []);
  const tags = new Set(opts.tags ?? []);
  const config = opts.config;
  const rows: PoolRow[] = [];
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (!card) continue;
    if (
      q &&
      !card.name.toLowerCase().includes(q) &&
      !card.typeLine.toLowerCase().includes(q) &&
      !card.text.toLowerCase().includes(q)
    )
      continue;
    if (colors.size && !colors.has(colorKey(card))) continue;
    if (types.length && !types.some((t) => card.types.includes(t))) continue;
    if (mvs.size && !mvs.has(Math.min(6, Math.floor(card.mv)))) continue;
    if (tags.size && config && !cardTags(index, config, card).some((t) => tags.has(t.id))) continue;
    rows.push({ entry, card });
  }
  rows.sort(compareRows(opts.sort ?? 'name'));
  return rows;
}

export interface PoolSummary {
  cards: number;
  distinct: number;
  byColor: Record<ColorKey, number>;
}

/** Totals for the pool header. Gold cards count under M, colorless under C. */
export function poolSummary(pool: Pool, index: CardIndex): PoolSummary {
  const s: PoolSummary = {
    cards: 0,
    distinct: 0,
    byColor: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 },
  };
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (!card) continue;
    s.cards += entry.qty;
    s.distinct += 1;
    s.byColor[colorKey(card)] += entry.qty;
  }
  return s;
}
