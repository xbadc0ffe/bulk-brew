import {
  displayTagsFor,
  factsFor,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type CardType,
  type Color,
  type DisplayTagDef,
  type DisplayTagsConfig,
  type Pool,
  type PoolEntry,
} from '@bulk-brew/core';

export interface PoolRow {
  entry: PoolEntry;
  card: CardRecord;
}

/** A card's color class: one of the five, colorless, or multicolor. */
export type ColorKey = Color | 'C' | 'M';

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

/** Comparison for the mana value filter; "any" turns it off. */
export type MvOp = 'any' | 'lt' | 'le' | 'eq' | 'ge' | 'gt';

export const MV_OPS: { id: MvOp; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'lt', label: '<' },
  { id: 'le', label: '≤' },
  { id: 'eq', label: '=' },
  { id: 'ge', label: '≥' },
  { id: 'gt', label: '>' },
];

export interface PoolFilters {
  search: string;
  colors: ColorKey[];
  types: TypeKey[];
  subtypes: string[];
  mv: { op: MvOp; value: number };
  /** Display tag ids (the short tags). */
  tags: string[];
  /** General tag ids from cardTags(): roles and styles. */
  subtags: string[];
}

export const EMPTY_FILTERS: PoolFilters = {
  search: '',
  colors: [],
  types: [],
  subtypes: [],
  mv: { op: 'any', value: 0 },
  tags: [],
  subtags: [],
};

export type SortKey = 'qty' | 'name' | 'cost' | 'type' | 'subtype' | 'tags';
/** A column sort; undefined means the default order, by name. */
export type PoolSort = { key: SortKey; dir: 'asc' | 'desc' } | undefined;

/** Click a column: ascending, then descending, then off. Quantity starts high. */
export function nextSort(current: PoolSort, key: SortKey): PoolSort {
  const first = key === 'qty' ? 'desc' : 'asc';
  if (!current || current.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' };
  return undefined;
}

/** Sort choices for a plain picker (phone). */
export const SORT_CHOICES: { id: string; label: string; sort: PoolSort }[] = [
  { id: 'name', label: 'Name', sort: undefined },
  { id: 'cost', label: 'Mana value', sort: { key: 'cost', dir: 'asc' } },
  { id: 'qty', label: 'Quantity', sort: { key: 'qty', dir: 'desc' } },
  { id: 'type', label: 'Type', sort: { key: 'type', dir: 'asc' } },
];

export interface PoolViewOptions extends Partial<PoolFilters> {
  sort?: PoolSort;
  /** Needed for tag filters and the tags column. */
  config?: BulkBrewConfig;
  displayTags?: DisplayTagsConfig;
}

export function colorKey(card: CardRecord): ColorKey {
  if (card.identity.length === 0) return 'C';
  if (card.identity.length > 1) return 'M';
  return card.identity[0]!;
}

const DASH = /\s+—\s+/;

/** "Legendary Creature — Human Soldier" as type and subtype; faces stay paired. */
export function typeParts(typeLine: string): { type: string; subtype: string } {
  const faces = typeLine.split(' // ').map((f) => {
    const [type, ...rest] = f.split(DASH);
    return { type: (type ?? '').trim(), subtype: rest.join(' ').trim() };
  });
  return {
    type: faces.map((f) => f.type).join(' // '),
    subtype: faces
      .map((f) => f.subtype)
      .filter(Boolean)
      .join(' // '),
  };
}

/** Individual subtype words, for the subtype filter. */
export function subtypesOf(card: CardRecord): string[] {
  const { subtype } = typeParts(card.typeLine);
  return subtype ? [...new Set(subtype.split(/\s+|\s*\/\/\s*/).filter(Boolean))] : [];
}

export interface CardTag {
  /** "role:<id>" or "style:<archetype id>"; enabler and payoff share the style id. */
  id: string;
  label: string;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * General tags for a card: the config's role labels, then the styles it
 * enables or pays off. The short display tags and the raw Scryfall tags
 * are shown beside these in the card detail.
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

const majorCache = new WeakMap<
  CardIndex,
  WeakMap<DisplayTagsConfig, Map<string, DisplayTagDef[]>>
>();

/** The short display tags for a card, cached per index and tag config. */
export function majorTags(
  index: CardIndex,
  config: BulkBrewConfig,
  displayTags: DisplayTagsConfig,
  card: CardRecord,
): DisplayTagDef[] {
  let byTags = majorCache.get(index);
  if (!byTags) majorCache.set(index, (byTags = new WeakMap()));
  let byId = byTags.get(displayTags);
  if (!byId) byTags.set(displayTags, (byId = new Map()));
  let tags = byId.get(card.id);
  if (!tags)
    byId.set(card.id, (tags = displayTagsFor(card, factsFor(index, config, card), displayTags)));
  return tags;
}

/** Number of filters applied, search excluded. */
export function filterCount(f: PoolFilters): number {
  return (
    f.colors.length +
    f.types.length +
    f.subtypes.length +
    (f.mv.op === 'any' ? 0 : 1) +
    f.tags.length +
    f.subtags.length
  );
}

function mvMatches(mv: number, op: MvOp, value: number): boolean {
  switch (op) {
    case 'lt':
      return mv < value;
    case 'le':
      return mv <= value;
    case 'eq':
      return mv === value;
    case 'ge':
      return mv >= value;
    case 'gt':
      return mv > value;
    default:
      return true;
  }
}

function compareRows(
  sort: PoolSort,
  tagLabel: (card: CardRecord) => string,
): (a: PoolRow, b: PoolRow) => number {
  const byName = (a: PoolRow, b: PoolRow) => a.card.name.localeCompare(b.card.name);
  if (!sort) return byName;
  const sign = sort.dir === 'asc' ? 1 : -1;
  // Empty values sort last in either direction.
  const text = (pick: (c: CardRecord) => string) => (a: PoolRow, b: PoolRow) => {
    const x = pick(a.card);
    const y = pick(b.card);
    if (!x !== !y) return x ? -1 : 1;
    return sign * x.localeCompare(y) || byName(a, b);
  };
  switch (sort.key) {
    case 'qty':
      return (a, b) => sign * (a.entry.qty - b.entry.qty) || byName(a, b);
    case 'cost':
      return (a, b) => sign * (a.card.mv - b.card.mv) || byName(a, b);
    case 'type':
      return text((c) => typeParts(c.typeLine).type);
    case 'subtype':
      return text((c) => typeParts(c.typeLine).subtype);
    case 'tags':
      return text(tagLabel);
    default:
      return (a, b) => sign * a.card.name.localeCompare(b.card.name);
  }
}

/** Pool entries joined with card records, filtered and sorted. */
export function poolRows(pool: Pool, index: CardIndex, opts: PoolViewOptions = {}): PoolRow[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  const colors = new Set(opts.colors ?? []);
  const types = opts.types ?? [];
  const subtypes = new Set(opts.subtypes ?? []);
  const mv = opts.mv ?? EMPTY_FILTERS.mv;
  const tags = new Set(opts.tags ?? []);
  const subtags = new Set(opts.subtags ?? []);
  const { config, displayTags } = opts;
  const major = (card: CardRecord) =>
    config && displayTags ? majorTags(index, config, displayTags, card) : [];
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
    if (subtypes.size && !subtypesOf(card).some((s) => subtypes.has(s))) continue;
    if (!mvMatches(card.mv, mv.op, mv.value)) continue;
    if (tags.size && !major(card).some((t) => tags.has(t.id))) continue;
    if (subtags.size && config && !cardTags(index, config, card).some((t) => subtags.has(t.id)))
      continue;
    rows.push({ entry, card });
  }
  rows.sort(compareRows(opts.sort, (c) => major(c)[0]?.label ?? ''));
  return rows;
}

export interface Facet<T extends string | number> {
  id: T;
  label: string;
  count: number;
}

export interface PoolFacets {
  types: Facet<TypeKey>[];
  subtypes: Facet<string>[];
  manaValues: number[];
  tags: Facet<string>[];
  subtags: Facet<string>[];
}

/** What the filter menus offer: only values present in the pool, with card counts. */
export function poolFacets(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  displayTags: DisplayTagsConfig,
): PoolFacets {
  const types = new Map<TypeKey, number>();
  const subtypes = new Map<string, number>();
  const mvs = new Set<number>();
  const tags = new Map<string, number>();
  const subtags = new Map<string, { label: string; count: number }>();
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (!card) continue;
    for (const t of card.types) if (t !== 'kindred') types.set(t, (types.get(t) ?? 0) + 1);
    for (const s of subtypesOf(card)) subtypes.set(s, (subtypes.get(s) ?? 0) + 1);
    mvs.add(Math.floor(card.mv));
    for (const t of majorTags(index, config, displayTags, card))
      tags.set(t.id, (tags.get(t.id) ?? 0) + 1);
    const seen = new Set<string>();
    for (const t of cardTags(index, config, card)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const label = t.id.startsWith('style:')
        ? (config.archetypes.archetypes.find((a) => `style:${a.id}` === t.id)?.label ?? t.label)
        : (config.roles.roles.find((r) => `role:${r.id}` === t.id)?.label ?? t.label);
      const cur = subtags.get(t.id);
      subtags.set(t.id, { label, count: (cur?.count ?? 0) + 1 });
    }
  }
  return {
    types: TYPE_KEYS.filter((t) => types.has(t.id)).map((t) => ({
      ...t,
      count: types.get(t.id)!,
    })),
    subtypes: [...subtypes]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: id, count })),
    manaValues: [...mvs].sort((a, b) => a - b),
    tags: displayTags.tags
      .filter((t) => tags.has(t.id))
      .map((t) => ({ id: t.id, label: t.label, count: tags.get(t.id)! })),
    subtags: [...subtags]
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([id, v]) => ({ id, label: v.label, count: v.count })),
  };
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
