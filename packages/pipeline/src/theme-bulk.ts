// The bulk baseline: what plain bulk holds of each themed style, so the
// builder can read a pool's richness in a theme against bulk of the same
// colors without computing it on the device. Per style and color class, the
// mean setup and payoff tally of one card, over every common and uncommon in
// the pack (Un-sets left out), nonlands plus modal double-faced land cards,
// read at 60 cards with the theme rules, each card once; and the same for the
// tribe of every creature type a commander in the pack names, under `tribes`.
// Rerun after any edit to config/theme-rules.json or a new data pack.
//
// Usage: npm run theme:bulk      (writes config/theme-bulk.json)

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  canBeCommander,
  colorClassOf,
  COLOR_CLASSES,
  isLand,
  matchCard,
  namedTribes,
  parsePack,
  pluralOf,
  ruleText,
  THEME_BULK_FILE,
  THEME_TALLY_KEYS,
  themeRulesFor,
  themeStyleOf,
  validateConfig,
  type BulkBrewConfig,
  type CardRecord,
  type ColorClass,
  type CompiledStyle,
  type DataPack,
  type ThemeBulkConfig,
  type ThemeTally,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { loadConfigDir } from './check-config.ts';
import { hash32, ROOT } from './corpus.ts';

const CONFIG_DIR = path.join(ROOT, 'config');
const PACK_PATH = path.join(ROOT, 'data', 'packs', PACK_FILE);

const emptyTally = (): ThemeTally => ({
  setupUnits: 0,
  setupWeight: 0,
  repeatable: 0,
  payoffUnits: 0,
  payoffWeight: 0,
});

/** The cards bulk is made of. */
export function isBulkCard(card: CardRecord): boolean {
  if (card.unset || (card.rarity !== 'common' && card.rarity !== 'uncommon')) return false;
  return !isLand(card) || card.layout === 'modal_dfc';
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Add one bulk card's job for a style to its color class's sum. */
function addMatch(sum: Map<ColorClass, ThemeTally>, card: CardRecord, style: CompiledStyle): void {
  const m = matchCard(card, style, 60);
  // A rider weighs 0: it is not setup.
  if (!m || m.as === 'excluded' || m.weight <= 0) return;
  const k = colorClassOf(card);
  let t = sum.get(k);
  if (!t) sum.set(k, (t = emptyTally()));
  const units = Math.min(m.weight, 1);
  if (m.as === 'setup') {
    t.setupUnits += units;
    t.setupWeight += m.weight;
    if (m.repeatable) t.repeatable += 1;
  } else {
    t.payoffUnits += units;
    t.payoffWeight += m.weight;
  }
}

/**
 * The tribes of every creature type a commander in the pack names
 * (`namedTribes`), summed over the bulk cards as the styles are. Every tribe
 * rule reads the type's word in the type line or text, the Changeling
 * keyword, "every creature type", or "with changeling", so a card with none
 * of them is skipped without reading it.
 */
function tribeSums(
  pack: DataPack,
  config: BulkBrewConfig,
): Map<string, Map<ColorClass, ThemeTally>> {
  const ids = new Set<string>();
  for (const card of pack.cards)
    if (canBeCommander(card) && card.identity.length > 0)
      for (const id of namedTribes(config, card)) ids.add(id);
  const plurals = config.cardNeeds.vocabulary.plurals ?? {};
  const tribes = [...ids].sort().map((id) => {
    const type = id.slice('tribal:'.length);
    return {
      type,
      style: themeStyleOf(config, id)!,
      words: [type, pluralOf(type, plurals)].map((w) => w.toLowerCase()),
      sum: new Map<ColorClass, ThemeTally>(),
    };
  });
  for (const card of pack.cards) {
    if (!isBulkCard(card)) continue;
    const hay = `${card.typeLine}\n${ruleText(card)}`.toLowerCase();
    const every =
      card.keywords.includes('Changeling') || /every creature type|with changeling/.test(hay);
    for (const t of tribes)
      if (every || t.words.some((w) => hay.includes(w))) addMatch(t.sum, card, t.style);
  }
  return new Map(tribes.map((t) => [t.type, t.sum]));
}

/** The baseline for a pack and the config's theme rules; the version is a hash of the rest. */
export function computeThemeBulk(pack: DataPack, config: BulkBrewConfig): ThemeBulkConfig {
  const rules = themeRulesFor(config);
  const styles = [...rules.styles.values()];
  const sums = styles.map(() => new Map<ColorClass, ThemeTally>());
  const counts = new Map<ColorClass, number>();
  for (const card of pack.cards) {
    if (!isBulkCard(card)) continue;
    const k = colorClassOf(card);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    styles.forEach((style, i) => addMatch(sums[i]!, card, style));
  }
  const out: ThemeBulkConfig = {
    version: '',
    dataVersion: pack.version,
    rulesVersion: rules.version,
    styles: {},
  };
  const meanOf = (sum: Map<ColorClass, ThemeTally>, k: ColorClass): ThemeTally => {
    const n = counts.get(k) ?? 0;
    const t = sum.get(k);
    const mean = emptyTally();
    for (const key of THEME_TALLY_KEYS) mean[key] = n && t ? round6(t[key] / n) : 0;
    return mean;
  };
  styles.forEach((style, i) => {
    const per = {} as Record<ColorClass, ThemeTally>;
    for (const k of COLOR_CLASSES) per[k] = meanOf(sums[i]!, k);
    out.styles[style.id] = per;
  });
  const tribes = tribeSums(pack, config);
  if (tribes.size > 0) {
    out.tribes = {};
    for (const [type, sum] of [...tribes].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const per: Partial<Record<ColorClass, number[]>> = {};
      for (const k of COLOR_CLASSES) {
        const v = THEME_TALLY_KEYS.map((key) => meanOf(sum, k)[key]);
        if (v.some((x) => x > 0)) per[k] = v;
      }
      out.tribes[type] = per;
    }
  }
  const { version: _, ...rest } = out;
  out.version = hash32(JSON.stringify(rest)).toString(36);
  return out;
}

function main(): number {
  const t0 = Date.now();
  // A stale baseline must not stop its own rebuild, so validate without it.
  const { themeBulk: _old, ...config } = loadConfigDir(CONFIG_DIR);
  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`config has ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  const pack = parsePack(readFileSync(PACK_PATH, 'utf8'));
  const t1 = Date.now();
  const bulk = computeThemeBulk(pack, config);
  const ms = Date.now() - t1;
  const file = path.join(CONFIG_DIR, THEME_BULK_FILE);
  // A tribe's numbers on one line, as Prettier lays out a short array.
  const text = JSON.stringify(bulk, null, 2).replace(
    /\[\s+([\d.e-]+(?:,\s+[\d.e-]+)*)\s+\]/g,
    (_, nums: string) => `[${nums.split(/,\s+/).join(', ')}]`,
  );
  writeFileSync(file, `${text}\n`);

  const counts = new Map<ColorClass, number>();
  for (const c of pack.cards)
    if (isBulkCard(c)) counts.set(colorClassOf(c), (counts.get(colorClassOf(c)) ?? 0) + 1);
  console.log(
    `${path.relative(ROOT, file).replace(/\\/g, '/')} version ${bulk.version}: pack ${bulk.dataVersion}, rules ${bulk.rulesVersion}, ` +
      `${[...counts.values()].reduce((a, b) => a + b, 0)} bulk cards, computed in ${(ms / 1000).toFixed(1)} s ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)} s with loading)`,
  );
  console.log(
    `\nsetup / payoff units per 100 bulk cards, by color class (${COLOR_CLASSES.map((k) => `${k} ${counts.get(k) ?? 0}`).join(', ')}):`,
  );
  console.log(`  ${''.padEnd(13)}${COLOR_CLASSES.map((k) => k.padStart(10)).join('')}`);
  for (const [id, per] of Object.entries(bulk.styles)) {
    const cells = COLOR_CLASSES.map((k) =>
      `${(per[k].setupUnits * 100).toFixed(1)}/${(per[k].payoffUnits * 100).toFixed(1)}`.padStart(
        10,
      ),
    );
    console.log(`  ${id.padEnd(13)}${cells.join('')}`);
  }
  console.log(`\ntribes: ${Object.keys(bulk.tribes ?? {}).length} creature types commanders name`);
  return 0;
}

// Run only when invoked as a script, so computeThemeBulk can be imported by tests.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/theme-bulk.ts')) {
  process.exitCode = main();
}
