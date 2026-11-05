// EDHREC page cache shared by edhrec-fetch.ts and learn-build.ts. EDHREC has
// no official API; its site reads these JSON pages. Developer-side only.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './corpus.ts';

export const EDHREC_DIR = path.join(ROOT, 'data', 'edhrec');

/** EDHREC's slug for a card name: the front face, lowercase, no diacritics or punctuation. */
export function edhrecSlug(name: string): string {
  return (name.split(' // ')[0] ?? name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/['’,]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Cache file for a page path such as "commanders/atraxa-praetors-voice". */
export function cachePath(page: string): string {
  return path.join(EDHREC_DIR, 'pages', `${page}.json`);
}

/** A cached page, or undefined when it was missing or never fetched. */
export function readPage<T>(page: string): T | undefined {
  const file = cachePath(page);
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/** A card list entry on a theme or commander page. Ids are Scryfall printing ids. */
export interface EdhrecCardView {
  id: string;
  name: string;
  url?: string;
  num_decks?: number;
  potential_decks?: number;
  synergy?: number;
  lift?: number;
}

export interface EdhrecPage {
  header?: string;
  container: {
    json_dict: {
      cardlists: { header: string; cardviews: EdhrecCardView[] }[];
      card?: { num_decks?: number; id?: string; name?: string; color_identity?: string[] };
    };
  };
  panels?: { taglinks?: { slug: string; value: string; count: number }[] };
}
