// Evaluation runner: build decks from every fixture pool, score them with
// the automatic metrics, record the results, and show deltas against the
// previous comparable run.
// Usage: npm run eval [-- --styles] [--pools <substring>] [--colors pairs|all] [--out <file>]
//        npm run eval -- --dir <folder> [--combine]   (a local folder, results written there)
//        --commanders <n> builds the n most promising commanders of each pool (default 2, 0 skips)
// Exits 1 when any build fails or any deck breaks a hard invariant.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addToPool,
  BuildError,
  buildDeck,
  CardIndex,
  commanderCandidates,
  COLORS,
  configVersion,
  normalizeColors,
  emptyPool,
  parseDecklist,
  parsePack,
  resolveLines,
  scanPool,
  toPoolEntries,
  validateConfig,
  type Color,
  type DeckSize,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { attachLearned } from './learned-data.ts';
import { loadConfigDir } from './check-config.ts';
import { deckMetrics, type DeckMetrics } from './metrics.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const POOLS_DIR = path.join(ROOT, 'eval', 'pools');
const RESULTS_DIR = path.join(ROOT, 'eval', 'results');
const SIZES: DeckSize[] = [60, 40, 20];
/** Every size a run may hold; Commander rows appear once a run builds them. */
const ALL_SIZES: DeckSize[] = [100, ...SIZES];
const DEFAULT_COMMANDERS = 2;

export interface DeckRun {
  pool: string;
  size: DeckSize;
  /** Color letters in WUBRG order, such as "W" or "WU". */
  color: string;
  /** Requested style, or "best" for best fit. */
  style: string;
  /** Commander name for 100-card runs. */
  commander?: string;
  ok: boolean;
  error?: string;
  archetype?: string;
  ms: number;
  metrics?: DeckMetrics;
}

/** A pool, size, and color the scan said cannot make a deck. */
export interface Skip {
  pool: string;
  size: DeckSize;
  color: string;
  reason: string;
}

export interface Summary {
  decks: number;
  failures: number;
  skipped: number;
  lands: number;
  averageMv: number;
  curveDeviation: number;
  rolesBelowMin: number;
  synergyDensity: number;
  filler: number;
  /** Absent in results recorded before strength existed. */
  strength?: number;
  score?: number;
  uncastable: number;
  sizeErrors: number;
  ms: number;
}

export interface Results {
  date: string;
  runAt: string;
  sha: string;
  dirty: boolean;
  dataVersion: string;
  configVersion: string;
  styles: boolean;
  /** Color sets beyond mono: "pairs" or "all". Absent for mono-only runs. */
  colors?: string;
  /** Substring passed with --pools, or null for a full run. */
  poolFilter: string | null;
  poolNames: string[];
  pools: Record<string, Summary>;
  /** Summaries per deck size, the rows worth comparing over time. */
  bySize: Record<string, Summary>;
  overall: Summary;
  skips: Skip[];
  runs: DeckRun[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

/** Uncommitted changes outside eval/results, which only holds this script's output. */
function workingTreeDirty(): boolean {
  const out = git(['status', '--porcelain', '--', '.', ':(exclude)eval/results']);
  return out !== undefined && out.length > 0;
}

function hasSizeError(m: DeckMetrics): boolean {
  return !m.exactSize || !m.copyLimitOk || !m.colorLegal || !m.landsInClamp;
}

function summarize(runs: DeckRun[], skips: Skip[]): Summary {
  const built = runs.filter((r) => r.ok && r.metrics);
  const n = built.length;
  const avg = (f: (m: DeckMetrics) => number) =>
    n === 0 ? 0 : Math.round((built.reduce((s, r) => s + f(r.metrics!), 0) / n) * 100) / 100;
  return {
    decks: n,
    failures: runs.filter((r) => !r.ok).length,
    skipped: skips.length,
    lands: avg((m) => m.lands),
    averageMv: avg((m) => m.averageMv),
    curveDeviation: avg((m) => m.curveDeviation),
    rolesBelowMin: avg((m) => m.rolesBelowMin),
    synergyDensity: avg((m) => m.synergyDensity),
    filler: avg((m) => m.filler),
    ...(built.every((r) => r.metrics!.strength !== undefined)
      ? { strength: avg((m) => m.strength), score: avg((m) => m.score) }
      : {}),
    uncastable: built.filter((r) => !r.metrics!.castable).length,
    sizeErrors: built.filter((r) => hasSizeError(r.metrics!)).length,
    ms: n === 0 ? 0 : Math.round(built.reduce((s, r) => s + r.ms, 0) / n),
  };
}

function loadPool(files: string[], index: CardIndex): { pool: Pool; unresolved: number } {
  let pool = emptyPool('eval');
  let unresolved = 0;
  for (const file of files) {
    const report = resolveLines(parseDecklist(readFileSync(file, 'utf8')).lines, index, {
      suggest: false,
    });
    pool = addToPool(pool, toPoolEntries(report.resolved), 'eval');
    unresolved += report.unresolved.length;
  }
  return { pool, unresolved };
}

function row(name: string, s: Summary): string {
  return `| ${name} | ${s.decks} | ${s.failures} | ${s.skipped} | ${s.lands} | ${s.averageMv} | ${s.curveDeviation} | ${s.rolesBelowMin} | ${s.synergyDensity} | ${s.filler} | ${s.strength ?? '-'} | ${s.score ?? '-'} | ${s.uncastable} | ${s.sizeErrors} | ${s.ms} |`;
}

const HEADER = [
  '| rows | decks | fail | skip | lands | avg mv | curve dev | roles < min | synergy | filler | strength | score | uncastable | size errors | ms |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
].join('\n');

/** Latest earlier full run with the same styles flag, by runAt. */
function previousResults(
  styles: boolean,
  colors: string | undefined,
  exclude: string,
): Results | undefined {
  if (!existsSync(RESULTS_DIR)) return undefined;
  let best: Results | undefined;
  for (const f of readdirSync(RESULTS_DIR)) {
    if (!f.endsWith('.json') || path.join(RESULTS_DIR, f) === exclude) continue;
    let r: Results;
    try {
      r = JSON.parse(readFileSync(path.join(RESULTS_DIR, f), 'utf8')) as Results;
    } catch {
      continue;
    }
    if (typeof r.runAt !== 'string' || r.styles !== styles || r.poolFilter) continue;
    if ((r.colors ?? undefined) !== colors) continue;
    if (!best || r.runAt > best.runAt) best = r;
  }
  return best;
}

/** Never overwrite an earlier result: add -2, -3, ... before the extension. */
function uniquePath(file: string): string {
  if (!existsSync(file)) return file;
  const ext = path.extname(file);
  const stem = file.slice(0, -ext.length);
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existsSync(candidate)) return candidate;
  }
}

type Direction = 'lower' | 'higher' | 'none';

function deltaLine(label: string, before: number, after: number, better: Direction): string {
  const d = Math.round((after - before) * 100) / 100;
  const sign = d > 0 ? '+' : '';
  let verdict = '';
  if (better !== 'none') {
    verdict = d === 0 ? ', same' : d < 0 === (better === 'lower') ? ', better' : ', worse';
  }
  return `  ${label.padEnd(16)} ${String(before).padStart(8)} -> ${String(after).padStart(8)}  (${sign}${d}${verdict})`;
}

function printDeltas(previous: Results, current: Results): void {
  const common = current.poolNames.filter((p) => (previous.poolNames ?? []).includes(p));
  console.log(
    `\ndeltas against ${previous.runAt} (${previous.sha}${previous.dirty ? ', dirty' : ''}) over ${common.length} pools in both runs:`,
  );
  if (common.length === 0) return;
  const inCommon = <T extends { pool: string; size: DeckSize }>(xs: T[], size: DeckSize) =>
    xs.filter((x) => x.size === size && common.includes(x.pool));
  for (const size of ALL_SIZES) {
    if (!current.runs.some((r) => r.size === size)) continue;
    const before = summarize(inCommon(previous.runs, size), inCommon(previous.skips ?? [], size));
    const after = summarize(inCommon(current.runs, size), inCommon(current.skips, size));
    console.log(`${size}-card:`);
    if (before.decks + before.skipped === 0) {
      console.log('  no earlier runs at this size');
      continue;
    }
    console.log(deltaLine('decks', before.decks, after.decks, 'none'));
    console.log(deltaLine('failures', before.failures, after.failures, 'lower'));
    console.log(deltaLine('size errors', before.sizeErrors, after.sizeErrors, 'lower'));
    console.log(deltaLine('uncastable', before.uncastable, after.uncastable, 'lower'));
    console.log(deltaLine('lands', before.lands, after.lands, 'none'));
    console.log(deltaLine('avg mv', before.averageMv, after.averageMv, 'none'));
    console.log(deltaLine('curve deviation', before.curveDeviation, after.curveDeviation, 'lower'));
    console.log(deltaLine('roles < min', before.rolesBelowMin, after.rolesBelowMin, 'lower'));
    console.log(deltaLine('synergy', before.synergyDensity, after.synergyDensity, 'higher'));
    console.log(deltaLine('filler', before.filler, after.filler, 'lower'));
    if (before.strength !== undefined && after.strength !== undefined) {
      console.log(deltaLine('card strength', before.strength, after.strength, 'higher'));
      console.log(deltaLine('deck score', before.score ?? 0, after.score ?? 0, 'higher'));
    }
    // Timings vary with the machine, so they are shown without a verdict.
    console.log(deltaLine('build ms', before.ms, after.ms, 'none'));
  }
}

/** Every color set of the given sizes, in WUBRG order. */
function colorSets(spread: string | undefined): Color[][] {
  const max = spread === 'all' ? 5 : spread === 'pairs' ? 2 : 1;
  const out: Color[][] = [];
  const walk = (start: number, set: Color[]) => {
    if (set.length > 0) out.push(set);
    if (set.length === max) return;
    for (let i = start; i < COLORS.length; i++) walk(i + 1, [...set, COLORS[i]!]);
  };
  walk(0, []);
  return out.sort((a, b) => a.length - b.length);
}

function main(): number {
  const styles = process.argv.includes('--styles');
  const poolFilter = arg('pools') ?? null;
  const spread = arg('colors');
  const dir = arg('dir');
  const combine = process.argv.includes('--combine');
  const commanderCount = Math.max(0, Number(arg('commanders') ?? DEFAULT_COMMANDERS) || 0);
  const poolsDir = dir ? path.resolve(dir) : POOLS_DIR;
  const t0 = Date.now();
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) {
    console.error('no data pack at data/packs/cards.json; run npm run data:pull first');
    return 1;
  }
  const pack = parsePack(readFileSync(packPath, 'utf8'));
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
  console.log(
    `pack ${pack.version} (${pack.cardCount} cards), config ${configVersion(config)}, loaded in ${Date.now() - t0} ms`,
  );

  const files = readdirSync(poolsDir)
    .filter((f) => f.endsWith('.txt') && (!poolFilter || f.includes(poolFilter)))
    .sort();
  if (files.length === 0) {
    console.error(`no pools found in ${path.relative(ROOT, poolsDir) || poolsDir}`);
    return 1;
  }
  // One pool per file, or every file as one pool (a collection split by color).
  const poolsToRun: { name: string; files: string[] }[] = combine
    ? [{ name: path.basename(poolsDir), files }]
    : files.map((f) => ({ name: f.replace(/\.txt$/, ''), files: [f] }));
  const sets = colorSets(spread);

  const runs: DeckRun[] = [];
  const skips: Skip[] = [];
  const poolNames: string[] = [];
  for (const { name, files: group } of poolsToRun) {
    poolNames.push(name);
    const { pool, unresolved } = loadPool(
      group.map((f) => path.join(poolsDir, f)),
      index,
    );
    if (unresolved > 0) console.log(`${name}: ${unresolved} unresolved lines ignored`);
    for (const size of SIZES) {
      for (const set of sets) {
        const colors = normalizeColors(set);
        const color = colors.join('');
        const scan = scanPool(pool, index, config, settings, size, colors);
        if (!scan.possible) {
          skips.push({ pool: name, size, color, reason: scan.notes.join('; ') });
          continue;
        }
        const styleIds = ['best'];
        if (styles) {
          for (const a of scan.archetypes) if (a.viable) styleIds.push(a.archetype);
        }
        for (const style of styleIds) {
          const request = {
            size,
            colors,
            settings,
            id: `${name}-${size}-${color}-${style}`,
            createdAt: 'eval',
            // A requested style is the player's pick, as the app sends it.
            ...(style === 'best' ? {} : { style, requireStyle: true }),
          };
          const t1 = Date.now();
          try {
            const result = buildDeck(request, pool, index, config);
            runs.push({
              pool: name,
              size,
              color,
              style,
              ok: true,
              archetype: result.deck.archetype,
              ms: Date.now() - t1,
              metrics: deckMetrics(result.deck, index, config, settings),
            });
          } catch (err) {
            runs.push({
              pool: name,
              size,
              color,
              style,
              ok: false,
              error: err instanceof BuildError ? err.message : String(err),
              ms: Date.now() - t1,
            });
          }
        }
      }
    }
    // Commander: best fit under the most promising commanders that can build.
    const leaders = commanderCandidates(pool, index, config, settings)
      .filter((c) => c.tier !== 'possible')
      .slice(0, commanderCount);
    for (const lead of leaders) {
      const color = lead.colors.join('');
      const t1 = Date.now();
      const base = { pool: name, size: 100 as const, color, style: 'best', commander: lead.name };
      try {
        const result = buildDeck(
          {
            size: 100,
            colors: lead.colors,
            commander: lead.id,
            settings,
            id: `${name}-100-${lead.id}`,
            createdAt: 'eval',
          },
          pool,
          index,
          config,
        );
        runs.push({
          ...base,
          ok: true,
          archetype: result.deck.archetype,
          ms: Date.now() - t1,
          metrics: deckMetrics(result.deck, index, config, settings),
        });
      } catch (err) {
        runs.push({
          ...base,
          ok: false,
          error: err instanceof BuildError ? err.message : String(err),
          ms: Date.now() - t1,
        });
      }
    }
  }

  const pools: Record<string, Summary> = {};
  for (const name of poolNames) {
    pools[name] = summarize(
      runs.filter((r) => r.pool === name),
      skips.filter((s) => s.pool === name),
    );
  }
  const bySize: Record<string, Summary> = {};
  const sizesRun = ALL_SIZES.filter((size) => runs.some((r) => r.size === size));
  for (const size of sizesRun) {
    bySize[String(size)] = summarize(
      runs.filter((r) => r.size === size),
      skips.filter((s) => s.size === size),
    );
  }
  const overall = summarize(runs, skips);

  const runAt = new Date().toISOString();
  const date = runAt.slice(0, 10);
  const sha = git(['rev-parse', '--short', 'HEAD']) ?? 'nogit';
  const dirty = workingTreeDirty();
  const stem = [
    date,
    sha,
    dirty && 'dirty',
    styles && 'styles',
    spread && `colors-${spread}`,
    poolFilter && 'partial',
    dir && 'local',
  ]
    .filter(Boolean)
    .join('-');
  // Local folders keep their results beside the pools, out of the committed baselines.
  const resultsDir = dir ? poolsDir : RESULTS_DIR;
  const outFile = uniquePath(path.resolve(arg('out') ?? path.join(resultsDir, `${stem}.json`)));
  const results: Results = {
    date,
    runAt,
    sha,
    dirty,
    dataVersion: index.dataVersion,
    configVersion: configVersion(config),
    styles,
    ...(spread ? { colors: spread } : {}),
    poolFilter: dir ? `dir:${path.basename(poolsDir)}` : poolFilter,
    poolNames,
    pools,
    bySize,
    overall,
    skips,
    runs,
  };
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n');

  console.log('');
  console.log(HEADER);
  for (const [name, s] of Object.entries(pools)) console.log(row(name, s));
  for (const size of sizesRun) console.log(row(`all ${size}-card`, bySize[String(size)]!));
  console.log(row('**overall**', overall));

  const failures = runs.filter((r) => !r.ok);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures)
      console.log(`  ${f.pool} ${f.size} ${f.color} ${f.commander ?? f.style}: ${f.error}`);
  }
  const flagged = runs.filter(
    (r) => r.ok && r.metrics && (!r.metrics.castable || hasSizeError(r.metrics)),
  );
  if (flagged.length) {
    console.log('\nflagged decks:');
    for (const r of flagged) {
      const m = r.metrics!;
      const why = [
        !m.exactSize && `size ${m.total}`,
        !m.copyLimitOk && 'copy limit',
        !m.colorLegal && 'off-color card',
        !m.landsInClamp && `lands ${m.lands} outside ${m.landMin}-${m.landMax}`,
        !m.castable && `uncastable: ${m.offenders.join(', ')}`,
      ]
        .filter(Boolean)
        .join('; ');
      console.log(`  ${r.pool} ${r.size} ${r.color} ${r.commander ?? r.style}: ${why}`);
    }
  }

  const previous = dir ? undefined : previousResults(styles, spread, outFile);
  if (previous) printDeltas(previous, results);
  else console.log('\nno earlier full run with the same options to compare against');

  console.log(
    `\nwrote ${path.relative(ROOT, outFile)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  return overall.failures > 0 || overall.sizeErrors > 0 ? 1 : 0;
}

process.exitCode = main();
