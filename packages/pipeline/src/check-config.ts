// Entry point for `npm run config:check`. Validates the config bundle, then,
// when a built data pack is present, verifies every tag slug exists and
// reports how many mono-color cards each role and archetype matches per
// color, so unproductive tags and thin themes are visible before building.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONFIG_FILES,
  LEARNED_FILES,
  cardMatches,
  collectTagReferences,
  configVersion,
  displayTagReferences,
  displayTagsFor,
  factsFor,
  CardIndex,
  validateConfig,
  validateDisplayTags,
  type DisplayTagsConfig,
  type BulkBrewConfig,
  type CardRecord,
  type Color,
  type DataPack,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const PACK_PATH = path.join(ROOT, 'data', 'packs', PACK_FILE);
const COLORS: (Color | 'C')[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export function loadConfigDir(dir: string): BulkBrewConfig {
  const bundle: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(CONFIG_FILES)) {
    bundle[key] = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  }
  // The learned config is optional: config/learned/ appears once npm run learn:build has run.
  const learned: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(LEARNED_FILES)) {
    const p = path.join(dir, 'learned', file);
    if (existsSync(p)) learned[key] = JSON.parse(readFileSync(p, 'utf8'));
  }
  if (Object.keys(learned).length === Object.keys(LEARNED_FILES).length) bundle.learned = learned;
  return bundle as unknown as BulkBrewConfig;
}

function colorOf(card: CardRecord): Color | 'C' {
  return card.identity[0] ?? 'C';
}

function countRow(label: string, counts: Record<string, number>): string {
  const cells = COLORS.map((c) => `${c}${String(counts[c] ?? 0).padStart(5)}`).join(' ');
  return `  ${label.padEnd(28)} ${cells}`;
}

function main(): number {
  const config = loadConfigDir(CONFIG_DIR);
  const displayTags = JSON.parse(
    readFileSync(path.join(CONFIG_DIR, 'display-tags.json'), 'utf8'),
  ) as DisplayTagsConfig;
  const problems = [...validateConfig(config), ...validateDisplayTags(displayTags, config)];
  if (problems.length) {
    console.error(`config has ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(`config ${configVersion(config)} is valid`);

  if (!existsSync(PACK_PATH)) {
    console.log(
      'no data pack at data/packs/cards.json; skipping tag checks (run npm run data:build)',
    );
    return 0;
  }
  const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8')) as DataPack;
  const mono = pack.cards.filter((c) => c.identity.length <= 1 && !c.unset);

  const universe = new Set<string>();
  for (const c of pack.cards) for (const t of c.tags) universe.add(t);
  const referenced = new Set([
    ...collectTagReferences(config),
    ...displayTagReferences(displayTags),
  ]);
  const missing = [...referenced].filter((t) => !universe.has(t)).sort();
  if (missing.length) {
    console.error(`${missing.length} tag(s) referenced in config do not exist in the pack:`);
    for (const t of missing) console.error(`  - ${t}`);
    return 1;
  }
  console.log(
    `all ${referenced.size} referenced tags exist in the pack (${universe.size} tags total)`,
  );

  const index = new CardIndex(pack);
  console.log(`
display tag matches among ${mono.length} mono-color cards:`);
  for (const tag of displayTags.tags) {
    const counts: Record<string, number> = {};
    for (const c of mono)
      if (displayTagsFor(c, factsFor(index, config, c), displayTags).some((t) => t.id === tag.id))
        counts[colorOf(c)] = (counts[colorOf(c)] ?? 0) + 1;
    console.log(countRow(tag.label, counts));
  }

  console.log(`\nrole matches among ${mono.length} mono-color cards:`);
  for (const role of config.roles.roles) {
    const counts: Record<string, number> = {};
    for (const c of mono)
      if (cardMatches(c, role.match)) counts[colorOf(c)] = (counts[colorOf(c)] ?? 0) + 1;
    console.log(countRow(role.id, counts));
  }

  console.log('\nsynergy archetype enablers / payoffs:');
  for (const a of config.archetypes.archetypes) {
    if (a.kind !== 'synergy') continue;
    const en: Record<string, number> = {};
    const pay: Record<string, number> = {};
    for (const c of mono) {
      const col = colorOf(c);
      if (cardMatches(c, a.enablers)) en[col] = (en[col] ?? 0) + 1;
      if (cardMatches(c, a.payoffs)) pay[col] = (pay[col] ?? 0) + 1;
    }
    console.log(countRow(`${a.id} enablers`, en));
    console.log(countRow(`${a.id} payoffs`, pay));
  }

  let unmatched = 0;
  for (const c of mono) {
    if (c.types.includes('land')) continue;
    if (!config.roles.roles.some((r) => cardMatches(c, r.match))) unmatched++;
  }
  console.log(`\n${unmatched} mono-color nonland cards match no role (filler by tiebreaks)`);
  return 0;
}

// Run only when invoked as a script, so loadConfigDir can be imported elsewhere.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/check-config.ts')) {
  process.exitCode = main();
}
