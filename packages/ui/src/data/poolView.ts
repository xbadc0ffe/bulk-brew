import type { CardIndex, CardRecord, Color, Pool, PoolEntry } from '@bulk-brew/core';

export interface PoolRow {
  entry: PoolEntry;
  card: CardRecord;
}

export type ColorFilter = Color | 'C' | 'all';

export interface PoolViewOptions {
  search?: string;
  color?: ColorFilter;
}

/** Pool entries joined with card records, filtered and sorted by name. */
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
  rows.sort((a, b) => a.card.name.localeCompare(b.card.name));
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
