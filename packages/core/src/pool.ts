// Pool operations. All functions return a new Pool; nothing mutates.

import type { CardIndex } from './pack.ts';
import type { Pool, PoolEntry } from './types.ts';

export function emptyPool(now: string = new Date().toISOString()): Pool {
  return { entries: {}, updatedAt: now };
}

export function poolSize(pool: Pool): number {
  let n = 0;
  for (const e of Object.values(pool.entries)) n += e.qty;
  return n;
}

export function addToPool(
  pool: Pool,
  additions: PoolEntry[],
  now: string = new Date().toISOString(),
): Pool {
  const entries = { ...pool.entries };
  for (const add of additions) {
    if (add.qty <= 0) continue;
    const existing = entries[add.cardId];
    if (existing) {
      const merged: PoolEntry = { ...existing, qty: existing.qty + add.qty };
      if (!merged.printing && add.printing) merged.printing = add.printing;
      entries[add.cardId] = merged;
    } else {
      entries[add.cardId] = { ...add };
    }
  }
  return { entries, updatedAt: now };
}

/** Remove up to `qty` copies (all copies when omitted). */
export function removeFromPool(
  pool: Pool,
  cardId: string,
  qty?: number,
  now: string = new Date().toISOString(),
): Pool {
  const existing = pool.entries[cardId];
  if (!existing) return pool;
  const entries = { ...pool.entries };
  const remaining = qty === undefined ? 0 : existing.qty - qty;
  if (remaining <= 0) delete entries[cardId];
  else entries[cardId] = { ...existing, qty: remaining };
  return { entries, updatedAt: now };
}

export function setPoolQty(
  pool: Pool,
  cardId: string,
  qty: number,
  now: string = new Date().toISOString(),
): Pool {
  if (qty <= 0) return removeFromPool(pool, cardId, undefined, now);
  const entries = { ...pool.entries };
  const existing = entries[cardId];
  entries[cardId] = existing ? { ...existing, qty } : { cardId, qty };
  return { entries, updatedAt: now };
}

/** Plain decklist text, one line per card, sorted by name. */
export function poolToDecklist(pool: Pool, index: CardIndex): string {
  const lines: string[] = [];
  for (const e of Object.values(pool.entries)) {
    const card = index.get(e.cardId);
    if (!card) continue;
    const printing = e.printing
      ? ` (${e.printing.set.toUpperCase()})${e.printing.collectorNumber ? ` ${e.printing.collectorNumber}` : ''}`
      : '';
    lines.push(`${e.qty} ${card.name}${printing}`);
  }
  return lines
    .sort((a, b) => a.slice(a.indexOf(' ') + 1).localeCompare(b.slice(b.indexOf(' ') + 1)))
    .join('\n');
}
