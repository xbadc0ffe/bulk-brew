// Test pools for the builder review (docs/algo-review.md, Phase 3): plain bulk
// samples, theme-rich samples, the public eval pools, and the owner's local
// bulk, each written as JSON under data/review/pools/ with an index the
// request generator reads. Recipes and seeds: docs/review/pools.md.
//
// Usage: npm run review:pools -- [--only plain|theme|public|owner] [--plain 30]
//   [--copies 3000] [--extra 120] [--seed-prefix <p>] [--out data/review/pools] [--force]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CardIndex,
  configVersion,
  factsFor,
  parseDecklist,
  parsePack,
  resolveLines,
  type BulkBrewConfig,
  type CardRecord,
  type Color,
  type Rarity,
} from '@bulk-brew/core';
import { PACK_FILE } from '../build.ts';
import { loadConfigDir } from '../check-config.ts';
import { arg, flag, hash32, median, noisePool, noiseSource, ROOT } from '../corpus.ts';
import { readPage, type EdhrecPage } from '../edhrec.ts';

export type PoolKind = 'plain' | 'theme' | 'public' | 'owner';
export const KINDS: readonly PoolKind[] = ['plain', 'theme', 'public', 'owner'];
/** [oracle id, copies] pairs. */
export type CardList = [string, number][];

export interface PoolFile {
  id: string;
  kind: PoolKind;
  recipe: string;
  seed: number;
  /** The data pack and config that made the pool: a new pack or config can change its cards. */
  dataVersion: string;
  configVersion: string;
  /** Every copy in the pool, sorted by id. */
  cards: CardList;
  /** Theme pools only: the theme copies added on top of the plain base, sorted by id. */
  added?: CardList;
}

export interface ColorCounts {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  multi: number;
  colorless: number;
}

export interface IndexEntry {
  id: string;
  kind: PoolKind;
  /** The pool file, relative to the index file. */
  path: string;
  copies: number;
  distinct: number;
  /** Copies by color identity. */
  colors: ColorCounts;
}

/** Theme pools per style, each on plain sample 1, 2, 3. */
export const THEME_SAMPLES = 3;
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

/**
 * EDHREC theme pages per themed style: the synergy entries of EDHREC_THEMES
 * in learn-build.ts, copied because that file runs when imported. Tappers has
 * no page there, so its pools use the matchers alone.
 */
export const EDHREC_PAGES: Record<string, readonly string[]> = {
  tokens: ['tokens', 'go-wide', 'populate'],
  counters: ['plus-1-plus-1-counters', 'counters-matter', 'proliferate'],
  aristocrats: ['aristocrats', 'sacrifice'],
  graveyard: ['reanimator', 'graveyard', 'self-mill', 'dredge'],
  spells: ['spellslinger', 'prowess', 'storm', 'spell-copy'],
  lifegain: ['lifegain'],
  artifacts: ['artifacts', 'affinity'],
  auras: ['voltron', 'equipment', 'auras'],
  flyers: ['flying', 'unblockable'],
  burn: ['burn', 'pingers'],
  landfall: ['landfall', 'lands-matter'],
  mill: ['mill'],
  enchantments: ['enchantress'],
  bigCreatures: ['ramp', 'big-mana', 'stompy'],
  groupHug: ['group-hug'],
  goad: ['forced-combat'],
  energy: ['energy'],
};

export const twoDigits = (n: number): string => String(n).padStart(2, '0');
export const plainSeed = (n: number): number => hash32(poolNames().plainSeedText(n));
export const themeSeed = (style: string, n: number): number =>
  hash32(poolNames().themeSeedText(style, n));

/** A seed prefix: letters and digits only, so ids, file names, and seed text stay unambiguous. */
export const SEED_PREFIX = /^[A-Za-z0-9]+$/;

/**
 * Why a seed prefix cannot be used, or undefined when it can. A pool kind is
 * refused: unprefixed ids start with one ("plain-01", "public-bulk-blue"), so
 * picking the set "plain" would also pick the first round's pools.
 */
export function seedPrefixProblem(prefix: string): string | undefined {
  if (!SEED_PREFIX.test(prefix)) return `takes letters and digits only, got "${prefix}"`;
  if ((KINDS as readonly string[]).includes(prefix.toLowerCase()))
    return `cannot be a pool kind (${KINDS.join(', ')}), got "${prefix}"`;
  return undefined;
}

/**
 * Ids, files, and seed text of plain and theme pools. A seed prefix gives a new
 * set of pools ("h1-plain-01" from "review:h1:plain:1"); without one the names
 * and seeds are the original ones.
 */
export function poolNames(prefix?: string) {
  const p = prefix ? `${prefix}-` : '';
  const seed = prefix ? `review:${prefix}:` : 'review:';
  return {
    plainId: (n: number) => `${p}plain-${twoDigits(n)}`,
    plainFile: (n: number) => `plain/${p}plain-${twoDigits(n)}.json`,
    plainSeedText: (n: number) => `${seed}plain:${n}`,
    themeId: (style: string, n: number) => `${p}theme-${style}-${twoDigits(n)}`,
    themeFile: (style: string, n: number) => `theme/${p}${style}-${twoDigits(n)}.json`,
    themeSeedText: (style: string, n: number) => `${seed}theme:${style}:${n}`,
    /** Theme candidate counts, one file per prefix so a new set never overwrites the first. */
    themesFile: prefix ? `themes-${prefix}.json` : 'themes.json',
  };
}

/** A rarity source cut down to the given card ids. */
export function restrictSource(
  source: ReadonlyMap<Rarity, readonly CardRecord[]>,
  ids: ReadonlySet<string>,
): Map<Rarity, CardRecord[]> {
  return new Map(RARITIES.map((r) => [r, (source.get(r) ?? []).filter((c) => ids.has(c.id))]));
}

/**
 * Every empty rarity bucket borrows the cards of the nearest non-empty one,
 * rarer first (mythic falls back to rare). noisePool keeps its own shares and
 * copy limits, so a borrowed card takes the empty bucket's limit.
 */
export function withFallback(
  source: ReadonlyMap<Rarity, readonly CardRecord[]>,
): Map<Rarity, CardRecord[]> {
  const out = new Map<Rarity, CardRecord[]>();
  RARITIES.forEach((rarity, i) => {
    const order = [...RARITIES.slice(i), ...RARITIES.slice(0, i).reverse()];
    const list = order.map((r) => source.get(r) ?? []).find((l) => l.length > 0);
    if (!list) throw new Error('no cards to draw from');
    out.set(rarity, [...list]);
  });
  return out;
}

/** `count` theme copies, drawn the way noisePool draws bulk. */
export function drawExtras(
  source: ReadonlyMap<Rarity, readonly CardRecord[]>,
  seed: number,
  count: number,
): CardList {
  return noisePool(withFallback(source), seed, count);
}

/** Card lists summed into one, sorted by id. */
export function mergeLists(...lists: CardList[]): CardList {
  const qty = new Map<string, number>();
  for (const list of lists) for (const [id, n] of list) qty.set(id, (qty.get(id) ?? 0) + n);
  return [...qty.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Copies whose identity is exactly one color, multicolor, or colorless. Unknown ids are skipped. */
export function colorCounts(
  cards: CardList,
  identityOf: (id: string) => readonly Color[] | undefined,
): ColorCounts {
  const out: ColorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, multi: 0, colorless: 0 };
  for (const [id, qty] of cards) {
    const identity = identityOf(id);
    if (!identity) continue;
    if (identity.length === 0) out.colorless += qty;
    else if (identity.length > 1) out.multi += qty;
    else out[identity[0]!] += qty;
  }
  return out;
}

export function indexEntry(
  pool: PoolFile,
  relPath: string,
  identityOf: (id: string) => readonly Color[] | undefined,
): IndexEntry {
  return {
    id: pool.id,
    kind: pool.kind,
    path: relPath,
    copies: pool.cards.reduce((n, [, q]) => n + q, 0),
    distinct: pool.cards.length,
    colors: colorCounts(pool.cards, identityOf),
  };
}

/** A pool as JSON with one card per line, so files stay easy to diff and grep. */
export function formatPool(pool: PoolFile): string {
  const list = (l: CardList) =>
    l.length === 0 ? '[]' : `[\n${l.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`;
  const fields = [
    `  "id": ${JSON.stringify(pool.id)}`,
    `  "kind": ${JSON.stringify(pool.kind)}`,
    `  "recipe": ${JSON.stringify(pool.recipe)}`,
    `  "seed": ${pool.seed}`,
    `  "dataVersion": ${JSON.stringify(pool.dataVersion)}`,
    `  "configVersion": ${JSON.stringify(pool.configVersion)}`,
    `  "cards": ${list(pool.cards)}`,
  ];
  if (pool.added) fields.push(`  "added": ${list(pool.added)}`);
  return `{\n${fields.join(',\n')}\n}\n`;
}

// ---- Theme candidates ----

export interface ThemeStats {
  /** Cards the style's enabler or payoff matchers accept. */
  matchers: number;
  /** EDHREC pages read for the style. */
  pages: string[];
  /** Cards from those pages that can be drawn. */
  edhrec: number;
  /** Of those, cards the matchers do not accept. */
  edhrecAdded: number;
  /** EDHREC names that matched no card in the pack. */
  edhrecUnknown: number;
  /** The union, by rarity. */
  byRarity: Record<Rarity, number>;
  candidates: number;
  /** Copies of candidate cards already in each plain base, samples 1 to 3. */
  baseCopies: number[];
}

/**
 * Spells on a style's EDHREC theme pages that a bulk box can hold. Commander
 * lists are skipped, and so are cards with no positive synergy: those are
 * format staples such as Sol Ring, not theme cards.
 */
function edhrecCards(
  style: string,
  index: CardIndex,
  config: BulkBrewConfig,
  drawable: ReadonlySet<string>,
): { pages: string[]; ids: Set<string>; unknown: number } {
  const pages: string[] = [];
  const ids = new Set<string>();
  const unknown = new Set<string>();
  for (const slug of EDHREC_PAGES[style] ?? []) {
    const page = readPage<EdhrecPage>(`tags/${slug}`);
    if (!page) continue;
    pages.push(slug);
    for (const list of page.container.json_dict.cardlists) {
      if (/commanders/i.test(list.header)) continue;
      for (const v of list.cardviews) {
        if (!(typeof v.synergy === 'number' && v.synergy > 0)) continue;
        const card = index.find(v.name);
        if (!card) unknown.add(v.name);
        else if (drawable.has(card.id) && factsFor(index, config, card).spell) ids.add(card.id);
      }
    }
  }
  return { pages, ids, unknown: unknown.size };
}

/**
 * A style's theme cards: spells its enabler or payoff matchers accept (the
 * facts scan.ts counts), plus the spells on its EDHREC theme pages.
 */
function themeCandidates(
  style: string,
  source: Map<Rarity, CardRecord[]>,
  index: CardIndex,
  config: BulkBrewConfig,
): { ids: Set<string>; stats: ThemeStats } {
  const drawable = new Set<string>();
  const matched = new Set<string>();
  for (const list of source.values())
    for (const card of list) {
      drawable.add(card.id);
      const f = factsFor(index, config, card);
      if (f.spell && (f.enablerOf.includes(style) || f.payoffOf.includes(style)))
        matched.add(card.id);
    }
  const edh = edhrecCards(style, index, config, drawable);
  const ids = new Set([...matched, ...edh.ids]);
  const restricted = restrictSource(source, ids);
  const byRarity = Object.fromEntries(
    RARITIES.map((r) => [r, restricted.get(r)!.length]),
  ) as Record<Rarity, number>;
  return {
    ids,
    stats: {
      matchers: matched.size,
      pages: edh.pages,
      edhrec: edh.ids.size,
      edhrecAdded: [...edh.ids].filter((id) => !matched.has(id)).length,
      edhrecUnknown: edh.unknown,
      byRarity,
      candidates: ids.size,
      baseCopies: [],
    },
  };
}

// ---- Main ----

interface Options {
  out: string;
  only?: PoolKind;
  plain: number;
  copies: number;
  extra: number;
  force: boolean;
  /** Plain and theme pools only; public and owner pools have no seed. */
  prefix?: string;
}

function count(name: string, fallback: number): number {
  const v = arg(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`--${name} must be a whole number, got "${v}"`);
  return n;
}

function readOptions(): Options {
  const only = arg('only');
  if (only !== undefined && !KINDS.includes(only as PoolKind))
    throw new Error(`--only must be one of ${KINDS.join(', ')}, got "${only}"`);
  const opts: Options = {
    out: path.resolve(ROOT, arg('out') ?? path.join('data', 'review', 'pools')),
    plain: count('plain', 30),
    copies: count('copies', 3000),
    extra: count('extra', 120),
    force: flag('force'),
  };
  if (only) opts.only = only as PoolKind;
  const prefix = arg('seed-prefix');
  if (prefix !== undefined) {
    const problem = seedPrefixProblem(prefix);
    if (problem) throw new Error(`--seed-prefix ${problem}`);
    if (only === 'public' || only === 'owner')
      throw new Error('--seed-prefix applies to plain and theme pools only');
    opts.prefix = prefix;
  }
  return opts;
}

/** Resolve every list in a folder. Returns pools by file name; logs counts only. */
function listPools(
  dir: string,
  kind: 'public' | 'owner',
  index: CardIndex,
  versions: Pick<PoolFile, 'dataVersion' | 'configVersion'>,
  showLines: boolean,
): PoolFile[] {
  if (!existsSync(dir)) {
    console.log(`${kind}: no folder ${path.relative(ROOT, dir)}, skipped`);
    return [];
  }
  const out: PoolFile[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort()) {
    const name = file.slice(0, -4);
    const parsed = parseDecklist(readFileSync(path.join(dir, file), 'utf8'));
    const report = resolveLines(parsed.lines, index, { suggest: false });
    const cards = mergeLists(report.resolved.map((r): [string, number] => [r.card.id, r.line.qty]));
    console.log(
      `${kind} ${name}: ${report.cardCount} copies, ${cards.length} distinct, ` +
        `${report.unresolved.length} unresolved lines, ${parsed.skipped.length} unreadable lines`,
    );
    if (showLines) {
      for (const u of report.unresolved)
        console.log(`  unresolved line ${u.line.line}: ${u.line.raw}`);
      for (const s of parsed.skipped) console.log(`  unreadable line ${s.line}: ${s.raw}`);
    }
    const rel = path.relative(ROOT, path.join(dir, file)).replace(/\\/g, '/');
    out.push({ id: `${kind}-${name}`, kind, recipe: rel, seed: 0, ...versions, cards });
  }
  return out;
}

function main(): number {
  let opts: Options;
  try {
    opts = readOptions();
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) {
    console.error('no data pack at data/packs/cards.json; run npm run data:pull first');
    return 1;
  }
  const t0 = Date.now();
  const index = new CardIndex(parsePack(readFileSync(packPath, 'utf8')));
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const source = noiseSource(index);
  const versions = { dataVersion: index.dataVersion, configVersion: configVersion(config) };
  // A prefix makes new seeded pools; the fixed public and owner lists have nothing to vary.
  const wants = (k: PoolKind) =>
    (!opts.only || opts.only === k) && !(opts.prefix && (k === 'public' || k === 'owner'));
  const names = poolNames(opts.prefix);
  let written = 0;
  let kept = 0;
  const save = (rel: string, pool: PoolFile) => {
    const file = path.join(opts.out, rel);
    if (!opts.force && existsSync(file)) {
      kept++;
      return;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, formatPool(pool));
    written++;
  };
  const plainSeedOf = (n: number) => hash32(names.plainSeedText(n));
  const plainOf = (n: number) => noisePool(source, plainSeedOf(n), opts.copies);
  const plainRecipe = (n: number) =>
    `noisePool(noiseSource(index), hash32('${names.plainSeedText(n)}'), ${opts.copies})`;

  if (wants('plain')) {
    for (let n = 1; n <= opts.plain; n++) {
      save(names.plainFile(n), {
        id: names.plainId(n),
        kind: 'plain',
        recipe: plainRecipe(n),
        seed: plainSeedOf(n),
        ...versions,
        cards: plainOf(n),
      });
    }
    console.log(
      `plain: ${opts.plain} pools of ${opts.copies} copies` +
        (opts.prefix ? `, seed prefix ${opts.prefix}` : ''),
    );
  }

  if (wants('theme')) {
    const stats: Record<string, ThemeStats> = {};
    const styles = config.archetypes.archetypes
      .filter((a) => a.kind === 'synergy')
      .map((a) => a.id);
    for (const style of styles) {
      const theme = themeCandidates(style, source, index, config);
      stats[style] = theme.stats;
      const themeSource = restrictSource(source, theme.ids);
      const from = theme.stats.pages.length
        ? `${theme.stats.matchers} from the matchers, ${theme.stats.edhrecAdded} more from EDHREC pages ${theme.stats.pages.join(', ')}`
        : `${theme.stats.matchers} from the matchers, no EDHREC page`;
      for (let n = 1; n <= THEME_SAMPLES; n++) {
        const base = plainOf(n);
        theme.stats.baseCopies.push(
          base.reduce((a, [id, q]) => a + (theme.ids.has(id) ? q : 0), 0),
        );
        const seed = hash32(names.themeSeedText(style, n));
        const added = drawExtras(themeSource, seed, opts.extra);
        save(names.themeFile(style, n), {
          id: names.themeId(style, n),
          kind: 'theme',
          recipe:
            `${names.plainId(n)} [${plainRecipe(n)}] plus ${opts.extra} copies from ` +
            `${theme.stats.candidates} ${style} cards (${from}), drawn by noisePool with ` +
            `hash32('${names.themeSeedText(style, n)}')`,
          seed,
          ...versions,
          cards: mergeLists(base, added),
          added,
        });
      }
    }
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(path.join(opts.out, names.themesFile), JSON.stringify(stats, null, 2) + '\n');
    console.log(
      `theme: ${styles.length * THEME_SAMPLES} pools, ${styles.length} styles` +
        (opts.prefix ? `, seed prefix ${opts.prefix} (counts in ${names.themesFile})` : ''),
    );
    console.log(
      '  style          matchers  edhrec  +edhrec  cands   c    u    r    m  base copies  pages',
    );
    for (const [style, s] of Object.entries(stats)) {
      const r = s.byRarity;
      console.log(
        `  ${style.padEnd(14)} ${String(s.matchers).padStart(8)} ${String(s.edhrec).padStart(7)} ` +
          `${String(s.edhrecAdded).padStart(8)} ${String(s.candidates).padStart(6)} ` +
          `${[r.common, r.uncommon, r.rare, r.mythic].map((x) => String(x).padStart(4)).join(' ')}  ` +
          `${s.baseCopies.join('/').padEnd(11)}  ${s.pages.join(', ') || '(none)'}`,
      );
    }
  }

  if (wants('public')) {
    const pools = listPools(path.join(ROOT, 'eval', 'pools'), 'public', index, versions, true);
    for (const p of pools) save(`public/${p.id.slice('public-'.length)}.json`, p);
  }

  if (wants('owner')) {
    // Personal lists: counts only, never card names.
    const pools = listPools(path.join(ROOT, 'test-bulk'), 'owner', index, versions, false);
    for (const p of pools) save(`owner/${p.id.slice('owner-'.length)}.json`, p);
  }

  // The index covers every pool on disk, so --only runs keep the other kinds listed.
  const identityOf = (id: string) => index.get(id)?.identity;
  const entries: IndexEntry[] = [];
  let stale = 0;
  for (const kind of KINDS) {
    const dir = path.join(opts.out, kind);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()) {
      const pool = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as PoolFile;
      if (
        pool.dataVersion !== versions.dataVersion ||
        pool.configVersion !== versions.configVersion
      )
        stale++;
      entries.push(indexEntry(pool, `${kind}/${file}`, identityOf));
    }
  }
  // Kept pools from an older pack or config would mix with fresh counts in the index and themes.json.
  if (stale)
    console.warn(
      `${stale} pools on disk were made with another data pack or config than ` +
        `${versions.dataVersion} / ${versions.configVersion}; pass --force to remake them`,
    );
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(
    path.join(opts.out, 'index.json'),
    `[\n${entries.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`,
  );

  const plain = entries.filter((e) => e.kind === 'plain');
  if (plain.length) {
    const med = (f: (e: IndexEntry) => number) => median(plain.map(f));
    const c = (k: keyof ColorCounts) => `${k} ${med((e) => e.colors[k])}`;
    console.log(
      `plain medians over ${plain.length} pools: ${med((e) => e.distinct)} distinct, ` +
        (['W', 'U', 'B', 'R', 'G', 'multi', 'colorless'] as const).map(c).join(', '),
    );
  }
  const byKind = KINDS.map((k) => `${entries.filter((e) => e.kind === k).length} ${k}`).join(', ');
  console.log(
    `${written} written, ${kept} kept (pass --force to rewrite); index lists ${byKind} ` +
      `in ${path.relative(ROOT, opts.out) || '.'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  return 0;
}

// Run only as a script, so the tests can import the pure parts.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/pools.ts')) {
  process.exitCode = main();
}
