import {
  deckEntries,
  type BulkBrewConfig,
  type CardIndex,
  type Deck,
  type Pool,
  type Settings,
} from '@bulk-brew/core';

/**
 * Copies the pool lacks for committing this deck. The core's commit skips
 * missing copies silently, so callers check first; otherwise a later return
 * would add cards that were never there.
 */
export function poolShortfall(
  pool: Pool,
  deck: Deck,
  settings: Settings,
  index: CardIndex,
  config: BulkBrewConfig,
): number {
  const need = new Map<string, number>();
  for (const e of deckEntries(deck, !settings.unlimitedBasics, index, config)) {
    need.set(e.cardId, (need.get(e.cardId) ?? 0) + e.qty);
  }
  let short = 0;
  for (const [id, qty] of need) short += Math.max(0, qty - (pool.entries[id]?.qty ?? 0));
  return short;
}

export function shortfallMessage(short: number): string {
  return `${short} of this deck's cards ${short === 1 ? 'is' : 'are'} no longer in the pool, so it cannot be removed. Rebuild to use what the pool holds now.`;
}
