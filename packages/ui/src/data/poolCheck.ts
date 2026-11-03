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

export function shortfallMessage(short: number, action: 'accept' | 'merge' = 'accept'): string {
  const n = `${short} ${short === 1 ? 'card is' : 'cards are'}`;
  return action === 'merge'
    ? `${n} from the packets no longer in your bulk list, so they cannot be merged.`
    : `${n} from this deck no longer in your bulk list, so it cannot be accepted. Build again to use what the list holds now.`;
}
