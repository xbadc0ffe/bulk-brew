// One pass over every printing in Scryfall's default_cards file: the lowest
// rarity per card, and the flavor names some printings carry in place of the
// card's name (Universes Beyond, Godzilla, and similar), so lists that use
// those names import.

import { normalizeName, type CardRecord, type Rarity } from '@bulk-brew/core';
import { foldLowest } from './rarity.ts';
import { readJsonl } from './read.ts';
import type { ScryfallCard } from './scryfall.ts';

/**
 * Fold one printing's flavor names into the map, by oracle id (per face for
 * reversible cards). Every printing counts, Arena and foreign ones too, since
 * lists come from those clients as well.
 */
export function foldFlavorNames(names: Map<string, Set<string>>, printing: ScryfallCard): void {
  const add = (oracleId: string | undefined, name: string | undefined) => {
    if (!oracleId || !name?.trim()) return;
    let set = names.get(oracleId);
    if (!set) names.set(oracleId, (set = new Set()));
    set.add(name.trim());
  };
  add(printing.oracle_id, printing.flavor_name);
  for (const face of printing.card_faces ?? [])
    add(face.oracle_id ?? printing.oracle_id, face.flavor_name);
}

/** A card's flavor names, sorted, without any that repeat its own name or a face name. */
export function flavorNamesFor(card: CardRecord, found: Set<string> | undefined): string[] {
  if (!found) return [];
  const own = new Set([card.name, ...(card.faces ?? []).map((f) => f.name)].map(normalizeName));
  return [...found].filter((n) => !own.has(normalizeName(n))).sort();
}

export async function readPrintings(
  file: string,
): Promise<{ lowest: Map<string, Rarity>; flavors: Map<string, Set<string>> }> {
  const lowest = new Map<string, Rarity>();
  const flavors = new Map<string, Set<string>>();
  for await (const printing of readJsonl<ScryfallCard>(file)) {
    foldLowest(lowest, printing);
    foldFlavorNames(flavors, printing);
  }
  return { lowest, flavors };
}
