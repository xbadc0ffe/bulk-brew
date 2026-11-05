// Attach the committed card-level learned data (data/learned.json) to a card
// index, as the apps do, so the eval scripts measure the builder that ships.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseLearnedData, type CardIndex, type LearnedDataFile } from '@bulk-brew/core';
import { ROOT } from './corpus.ts';

export const LEARNED_DATA = path.join(ROOT, 'data', 'learned.json');

/**
 * Read data/learned.json into the index when it is there and valid. `drop`
 * leaves out commanders (by oracle id), so corpus:eval's test split never
 * sees EDHREC lists of the commanders it holds out.
 */
export function attachLearned(index: CardIndex, drop?: ReadonlySet<string>): string | undefined {
  if (!existsSync(LEARNED_DATA)) return undefined;
  const file = JSON.parse(readFileSync(LEARNED_DATA, 'utf8')) as LearnedDataFile;
  if (drop?.size) file.commanders = file.commanders.filter(([c]) => !drop.has(file.ids[c]!));
  const { data, problems } = parseLearnedData(JSON.stringify(file));
  if (!data) {
    console.warn(`data/learned.json not used: ${problems.join('; ')}`);
    return undefined;
  }
  index.learned = data;
  return data.version;
}
