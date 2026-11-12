// Dev tool: build a deck from a decklist file against the real data pack.
// Usage: npm run demo:build -- <pool.txt> <color> [size] [style]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addToPool,
  BuildError,
  buildDeck,
  CardIndex,
  deckToDecklist,
  emptyPool,
  parseDecklist,
  parsePack,
  resolveLines,
  scanPool,
  toPoolEntries,
  validateConfig,
  type Color,
  type DeckSize,
  type Settings,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { attachLearned } from './learned-data.ts';
import { loadConfigDir } from './check-config.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function main(): number {
  const [poolPath, colorArg, sizeArg, style] = process.argv.slice(2);
  if (!poolPath || !colorArg) {
    console.error(
      'usage: npm run demo:build -- <pool.txt> <colors, such as W or WU> [60|40|20] [style]',
    );
    return 2;
  }
  const colors = [...colorArg.toUpperCase()] as Color[];
  if (colors.length === 0 || colors.some((c) => !'WUBRG'.includes(c))) {
    console.error(`colors must be letters from WUBRG, such as W or WU; got "${colorArg}"`);
    return 2;
  }
  const size = (sizeArg ? Number(sizeArg) : 60) as DeckSize;

  const t0 = Date.now();
  const pack = parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8'));
  const index = new CardIndex(pack);
  attachLearned(index);
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const problems = validateConfig(config);
  if (problems.length) {
    console.error('config problems:', problems);
    return 1;
  }
  const settings = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  const t1 = Date.now();

  const text = readFileSync(path.resolve(poolPath), 'utf8');
  const report = resolveLines(parseDecklist(text).lines, index, { suggest: false });
  const pool = addToPool(emptyPool('demo'), toPoolEntries(report.resolved), 'demo');
  console.log(
    `pool: ${report.cardCount} cards, ${report.resolved.length} lines, ${report.unresolved.length} unresolved (load ${t1 - t0} ms)`,
  );

  const t2 = Date.now();
  const scan = scanPool(pool, index, config, settings, size, colors);
  console.log(
    `scan ${colors.join('')} ${size}: ${scan.candidates} spell copies (${scan.distinct} distinct), ${scan.lands} lands, ${scan.spellSlots} slots, possible=${scan.possible} (${Date.now() - t2} ms)`,
  );
  for (const a of scan.archetypes) {
    const counts =
      a.kind === 'synergy'
        ? `enablers ${a.enablers.have}/${a.enablers.want}, payoffs ${a.payoffs.have}/${a.payoffs.want}`
        : `spells ${a.enablers.have}/${a.enablers.want}`;
    console.log(
      `  ${a.viable ? 'ok ' : '-- '} ${a.label.padEnd(24)} ${counts}${a.notes.length ? '  (' + a.notes.join('; ') + ')' : ''}`,
    );
  }

  const t3 = Date.now();
  try {
    // A named style is the player's pick, as the app sends it: built, or answered with the nearest deck.
    const request = style
      ? { size, colors, settings, style, requireStyle: true, id: 'demo', createdAt: 'demo' }
      : { size, colors, settings, id: 'demo', createdAt: 'demo' };
    const result = buildDeck(request, pool, index, config);
    const ms = Date.now() - t3;
    console.log(`\nbuilt "${result.deck.name}" in ${ms} ms\n`);
    console.log(deckToDecklist(result.deck, index, config));
    const e = result.explanation;
    console.log('curve (0..7+):', e.curve.join(' '));
    console.log(
      'roles:',
      Object.entries(e.roles)
        .map(([k, v]) => `${k} ${v.have}/${v.want}`)
        .join(', '),
    );
    console.log('synergies:', e.synergies.length ? e.synergies.join(' | ') : 'none');
    for (const n of e.notes) console.log('note:', n);
    console.log('\nwhy:');
    for (const c of result.deck.cards) {
      console.log(`  ${c.qty} ${index.get(c.cardId)?.name}: ${c.why}`);
    }
    return 0;
  } catch (err) {
    if (err instanceof BuildError) {
      console.error(`cannot build: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

process.exitCode = main();
