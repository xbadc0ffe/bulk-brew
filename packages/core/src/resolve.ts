// Match parsed decklist lines against the card index.

import type { ParsedLine } from './decklist.ts';
import type { CardIndex } from './pack.ts';
import { normalizeName } from './names.ts';
import type { CardRecord, PoolEntry, PrintingHint } from './types.ts';

export interface ResolvedLine {
  line: ParsedLine;
  card: CardRecord;
}

export interface UnresolvedLine {
  line: ParsedLine;
  suggestions: string[];
}

export interface ImportReport {
  resolved: ResolvedLine[];
  unresolved: UnresolvedLine[];
  /** Total copies across resolved lines. */
  cardCount: number;
}

export interface ResolveOptions {
  includeUnsets?: boolean;
  /** Compute "did you mean" suggestions for unresolved lines (slower). */
  suggest?: boolean;
}

export function resolveLines(
  lines: ParsedLine[],
  index: CardIndex,
  opts: ResolveOptions = {},
): ImportReport {
  const report: ImportReport = { resolved: [], unresolved: [], cardCount: 0 };
  const findOpts = opts.includeUnsets ? { includeUnsets: true } : {};
  for (const line of lines) {
    const card = index.find(line.name, findOpts);
    if (card) {
      report.resolved.push({ line, card });
      report.cardCount += line.qty;
    } else {
      report.unresolved.push({
        line,
        suggestions: opts.suggest === false ? [] : suggestNames(index, line.name),
      });
    }
  }
  return report;
}

/** Merge resolved lines into pool additions, one entry per card. */
export function toPoolEntries(resolved: ResolvedLine[]): PoolEntry[] {
  const byId = new Map<string, PoolEntry>();
  for (const { line, card } of resolved) {
    const existing = byId.get(card.id);
    if (existing) {
      existing.qty += line.qty;
      continue;
    }
    const entry: PoolEntry = { cardId: card.id, qty: line.qty };
    if (line.set) {
      const hint: PrintingHint = { set: line.set };
      if (line.collectorNumber) hint.collectorNumber = line.collectorNumber;
      entry.printing = hint;
    }
    byId.set(card.id, entry);
  }
  return [...byId.values()];
}

/** Closest card names by edit distance. Returns display-cased names from the pack. */
export function suggestNames(index: CardIndex, name: string, limit = 3): string[] {
  const key = normalizeName(name);
  if (!key) return [];
  const maxDistance = Math.max(2, Math.floor(key.length / 4));
  const scored: { name: string; d: number }[] = [];
  for (const candidate of index.names()) {
    if (Math.abs(candidate.length - key.length) > maxDistance) continue;
    const d = editDistance(key, candidate, maxDistance);
    if (d <= maxDistance) scored.push({ name: candidate, d });
  }
  scored.sort((a, b) => a.d - b.d || a.name.localeCompare(b.name));
  return scored
    .slice(0, limit)
    .map((s) => index.find(s.name, { includeUnsets: true })?.name ?? s.name);
}

/** Levenshtein distance with an early exit once `max` is exceeded. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}
