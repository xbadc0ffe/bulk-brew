// Lowest rarity per card across its paper printings. Rarity-based formats
// treat a card by the lowest rarity it was ever printed at, so a common
// reprint makes the card a common wherever it came from.

import type { Rarity } from '@bulk-brew/core';
import { readJsonl } from './read.ts';
import type { ScryfallCard } from './scryfall.ts';
import { rarityOf } from './transform.ts';

const ORDER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3 };

/** Fold one printing into the map: keep the lower rarity per oracle id. Paper printings only. */
export function foldLowest(lowest: Map<string, Rarity>, printing: ScryfallCard): void {
  if (!printing.oracle_id || printing.oversized) return;
  if (!(printing.games ?? []).includes('paper')) return;
  const r = rarityOf(printing.rarity);
  if (!r) return;
  const have = lowest.get(printing.oracle_id);
  if (!have || ORDER[r] < ORDER[have]) lowest.set(printing.oracle_id, r);
}

/** Read every printing from a default_cards bulk file. */
export async function lowestRarities(file: string): Promise<Map<string, Rarity>> {
  const lowest = new Map<string, Rarity>();
  for await (const printing of readJsonl<ScryfallCard>(file)) foldLowest(lowest, printing);
  return lowest;
}
