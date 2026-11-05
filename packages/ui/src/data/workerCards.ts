import {
  poolPack,
  trimLearned,
  type BulkBrewConfig,
  type CardIndex,
  type DataPack,
  type LearnedDataFile,
  type Pool,
} from '@bulk-brew/core';

/**
 * The card data a build worker gets: only the pool's cards and the basics
 * (see poolPack), and the learned data for those cards. Builds against them
 * give the same decks as against the full pack.
 */
export function workerCards(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): { pack: DataPack; learned?: LearnedDataFile } {
  const pack = poolPack(pool, index, config);
  if (!index.learned) return { pack };
  const learned = trimLearned(index.learned.file, new Set(pack.cards.map((c) => c.id)));
  return { pack, learned };
}
