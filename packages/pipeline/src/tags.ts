// Scryfall Tagger oracle tags in, oracle_id -> tag slugs out.
// Each card gets its direct tags plus every ancestor tag, so config can
// reference a broad tag like "removal" and match "spot-removal" cards.
// Whole subtrees that describe trivia rather than function are dropped.

import type { TaggerTag } from './scryfall.ts';

/** Root tags whose subtrees are not about what a card does. */
const NOISE_ROOTS = new Set(['cycle', 'card-names', 'type-errata', 'draft-signpost']);

export type TagMap = Map<string, Set<string>>;

export function buildTagMap(tags: TaggerTag[]): TagMap {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const ancestors = new Map<string, Set<string> | null>();

  // Slugs of this tag and all ancestors, or null when the chain hits a noise root.
  function chain(id: string, seen = new Set<string>()): Set<string> | null {
    const cached = ancestors.get(id);
    if (cached !== undefined) return cached;
    const tag = byId.get(id);
    if (!tag || seen.has(id)) return new Set();
    seen.add(id);
    if (NOISE_ROOTS.has(tag.slug)) {
      ancestors.set(id, null);
      return null;
    }
    const out = new Set<string>([tag.slug]);
    for (const p of tag.parent_ids) {
      const up = chain(p, seen);
      if (up === null) {
        ancestors.set(id, null);
        return null;
      }
      for (const s of up) out.add(s);
    }
    ancestors.set(id, out);
    return out;
  }

  const map: TagMap = new Map();
  for (const tag of tags) {
    if (tag.type !== 'oracle') continue;
    const slugs = chain(tag.id);
    if (slugs === null) continue;
    for (const { oracle_id } of tag.taggings) {
      let set = map.get(oracle_id);
      if (!set) map.set(oracle_id, (set = new Set()));
      for (const s of slugs) set.add(s);
    }
  }
  return map;
}
