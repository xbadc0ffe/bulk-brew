// Local tag overlay: fixes and gap-fills applied on top of Tagger tags.
// Keyed by exact Scryfall card name so the file stays readable in review.

import type { TagMap } from './tags.ts';

export interface TagOverlay {
  version: string;
  /** Card name -> tags to add. */
  add: Record<string, string[]>;
  /** Card name -> tags to remove. */
  remove: Record<string, string[]>;
}

export interface OverlayReport {
  applied: number;
  unknownNames: string[];
}

export function applyOverlay(
  map: TagMap,
  overlay: TagOverlay,
  idByName: Map<string, string>,
): OverlayReport {
  const report: OverlayReport = { applied: 0, unknownNames: [] };

  for (const [name, tags] of Object.entries(overlay.add)) {
    const id = idByName.get(name);
    if (!id) {
      report.unknownNames.push(name);
      continue;
    }
    let set = map.get(id);
    if (!set) map.set(id, (set = new Set()));
    for (const t of tags) set.add(t);
    report.applied++;
  }

  for (const [name, tags] of Object.entries(overlay.remove)) {
    const id = idByName.get(name);
    if (!id) {
      report.unknownNames.push(name);
      continue;
    }
    const set = map.get(id);
    if (!set) continue;
    for (const t of tags) set.delete(t);
    report.applied++;
  }

  return report;
}
