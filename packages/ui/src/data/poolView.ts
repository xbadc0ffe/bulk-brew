import {
  COLORS,
  type CardIndex,
  type CardRecord,
  type Color,
  type Pool,
  type PoolEntry,
} from '@bulk-brew/core';

export interface PoolRow {
  entry: PoolEntry;
  card: CardRecord;
}

export type ColorFilter = Color | 'C' | 'all';
export type PoolSort = 'name' | 'mv' | 'color' | 'qty';

export const POOL_SORTS: { id: PoolSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'mv', label: 'Mana value' },
  { id: 'color', label: 'Color' },
  { id: 'qty', label: 'Quantity' },
];

export interface PoolViewOptions {
  search?: string;
  color?: ColorFilter;
  sort?: PoolSort;
}

/** Mono colors in WUBRG order, then multicolor, then colorless. */
function colorRank(card: CardRecord): number {
  if (card.identity.length === 0) return COLORS.length + 1;
  if (card.identity.length > 1) return COLORS.length;
  return COLORS.indexOf(card.identity[0]!);
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

/** Pool entries joined with card records, filtered and sorted. */
export function poolRows(pool: Pool, index: CardIndex, opts: PoolViewOptions = {}): PoolRow[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  const color = opts.color ?? 'all';
  const rows: PoolRow[] = [];
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (!card) continue;
    if (q && !card.name.toLowerCase().includes(q) && !card.typeLine.toLowerCase().includes(q))
      continue;
    if (color === 'C' && card.identity.length !== 0) continue;
    if (color !== 'all' && color !== 'C' && !card.identity.includes(color)) continue;
    rows.push({ entry, card });
  }
  rows.sort(compareRows(opts.sort ?? 'name'));
  return rows;
}

export interface PoolSummary {
  cards: number;
  distinct: number;
  byColor: Record<Color | 'C' | 'M', number>;
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
    const id = card.identity;
    if (id.length === 0) s.byColor.C += entry.qty;
    else if (id.length > 1) s.byColor.M += entry.qty;
    else s.byColor[id[0]!] += entry.qty;
  }
  return s;
}
