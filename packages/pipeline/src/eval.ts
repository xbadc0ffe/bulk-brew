// Evaluation runner: build decks from every fixture pool, score them with
// the automatic metrics, record the results, and show deltas against the
// previous comparable run.
// Usage: npm run eval [-- --styles] [--pools <substring>] [--out <file>]
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
  COLORS,
  configVersion,
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
import { loadConfigDir } from './check-config.ts';
import { deckMetrics, type DeckMetrics } from './metrics.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const POOLS_DIR = path.join(ROOT, 'eval', 'pools');
const RESULTS_DIR = path.join(ROOT, 'eval', 'results');
const SIZES: DeckSize[] = [60, 40, 20];

export interface DeckRun {
  pool: string;
  size: DeckSize;
  color: Color;
  /** Requested style, or "best" for best fit. */
  style: string;
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
  color: Color;
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
    uncastable: built.filter((r) => !r.metrics!.castable).length,
    sizeErrors: built.filter((r) => hasSizeError(r.metrics!)).length,
    ms: n === 0 ? 0 : Math.round(built.reduce((s, r) => s + r.ms, 0) / n),
  };
}

function loadPool(file: string, index: CardIndex): { pool: Pool; unresolved: number } {
  const text = readFileSync(file, 'utf8');
  const report = resolveLines(parseDecklist(text).lines, index, { suggest: false });
  return {
    pool: addToPool(emptyPool('eval'), toPoolEntries(report.resolved), 'eval'),
    unresolved: report.unresolved.length,
  };
}

function row(name: string, s: Summary): string {
  return `| ${name} | ${s.decks} | ${s.failures} | ${s.skipped} | ${s.lands} | ${s.averageMv} | ${s.curveDeviation} | ${s.rolesBelowMin} | ${s.synergyDensity} | ${s.filler} | ${s.uncastable} | ${s.sizeErrors} | ${s.ms} |`;
}

const HEADER = [
  '| rows | decks | fail | skip | lands | avg mv | curve dev | roles < min | synergy | filler | uncastable | size errors | ms |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
].join('\n');

/** Latest earlier full run with the same styles flag, by runAt. */
function previousResults(styles: boolean, exclude: string): Results | undefined {
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
  for (const size of SIZES) {
    const before = summarize(inCommon(previous.runs, size), inCommon(previous.skips ?? [], size));
    const after = summarize(inCommon(current.runs, size), inCommon(current.skips, size));
    console.log(`${size}-card:`);
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
    // Timings vary with the machine, so they are shown without a verdict.
    console.log(deltaLine('build ms', before.ms, after.ms, 'none'));
  }
}

function main(): number {
  const styles = process.argv.includes('--styles');
  const poolFilter = arg('pools') ?? null;
  const t0 = Date.now();
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) {
    console.error('no data pack at data/packs/cards.json; run npm run data:pull first');
    return 1;
  }
  const pack = parsePack(readFileSync(packPath, 'utf8'));
  const index = new CardIndex(pack);
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

  const files = readdirSync(POOLS_DIR)
    .filter((f) => f.endsWith('.txt') && (!poolFilter || f.includes(poolFilter)))
    .sort();
  if (files.length === 0) {
    console.error('no pools found in eval/pools');
    return 1;
  }

  const runs: DeckRun[] = [];
  const skips: Skip[] = [];
  const poolNames: string[] = [];
  for (const file of files) {
    const name = file.replace(/\.txt$/, '');
    poolNames.push(name);
    const { pool, unresolved } = loadPool(path.join(POOLS_DIR, file), index);
    if (unresolved > 0) console.log(`${name}: ${unresolved} unresolved lines ignored`);
    for (const size of SIZES) {
      for (const color of COLORS) {
        const scan = scanPool(pool, index, config, settings, size, color);
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
            color,
            settings,
            id: `${name}-${size}-${color}-${style}`,
            createdAt: 'eval',
            ...(style === 'best' ? {} : { style }),
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
  }

  const pools: Record<string, Summary> = {};
  for (const name of poolNames) {
    pools[name] = summarize(
      runs.filter((r) => r.pool === name),
      skips.filter((s) => s.pool === name),
    );
  }
  const bySize: Record<string, Summary> = {};
  for (const size of SIZES) {
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
  const stem = [date, sha, dirty && 'dirty', styles && 'styles', poolFilter && 'partial']
    .filter(Boolean)
    .join('-');
  const outFile = uniquePath(path.resolve(arg('out') ?? path.join(RESULTS_DIR, `${stem}.json`)));
  const results: Results = {
    date,
    runAt,
    sha,
    dirty,
    dataVersion: pack.version,
    configVersion: configVersion(config),
    styles,
    poolFilter,
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
  for (const size of SIZES) console.log(row(`all ${size}-card`, bySize[String(size)]!));
  console.log(row('**overall**', overall));

  const failures = runs.filter((r) => !r.ok);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures)
      console.log(`  ${f.pool} ${f.size} ${f.color} ${f.style}: ${f.error}`);
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
      console.log(`  ${r.pool} ${r.size} ${r.color} ${r.style}: ${why}`);
    }
  }

  const previous = previousResults(styles, outFile);
  if (previous) printDeltas(previous, results);
  else console.log('\nno earlier full run with the same options to compare against');

  console.log(
    `\nwrote ${path.relative(ROOT, outFile)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  return overall.failures > 0 || overall.sizeErrors > 0 ? 1 : 0;
}

process.exitCode = main();
