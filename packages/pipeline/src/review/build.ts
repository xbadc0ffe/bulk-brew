// Entry point for `npm run review:build`: build any registered version on any
// pool and store the deck as one ReviewDeck JSON file in data/review/decks/.
// Usage and file naming: docs/review/runner.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  addToPool,
  BuildError,
  canBeCommander,
  CardIndex,
  deckToDecklist,
  emptyPool,
  normalizeColors,
  parseDecklist,
  parsePack,
  resolveLines,
  toPoolEntries,
  validateConfig,
  type CardRecord,
  type Color,
  type Deck,
  type Pool,
  type PoolEntry,
  type Settings,
} from '@bulk-brew/core';
import { PACK_FILE } from '../build.ts';
import { loadConfigDir } from '../check-config.ts';
import { arg, flag, hash32, ROOT } from '../corpus.ts';
import { attachLearned } from '../learned-data.ts';
import {
  deckColorsOf,
  VersionLoadError,
  type BuilderVersion,
  type BuiltDeck,
  type PrepareContext,
  type ReviewDeck,
  type ReviewPoolInfo,
  type ReviewRequest,
  type ReviewSize,
} from './version.ts';
import { getVersion, listVersions } from './versions.ts';

export const DEFAULT_OUT = path.join(ROOT, 'data', 'review', 'decks');
const SIZES: readonly ReviewSize[] = [100, 60, 40, 20];
// Fixed pool and deck stamps keep files free of clocks (builtAt is the one exception).
const STAMP = 'review';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One build as a batch file or a script asks for it. Paths are relative to the repo root. */
export interface ReviewJob {
  version: string;
  pool: string;
  /** Letters such as "B" or "WU", or an array; optional at 100 cards (the commander decides). */
  colors?: string | Color[];
  size: number;
  style?: string;
  secondary?: string;
  /** Name, part of a name, or oracle id; required at 100 cards. */
  commander?: string;
  /** Defaults to 1. */
  seed?: number;
}

export interface LoadedPool {
  info: ReviewPoolInfo;
  pool: Pool;
  /** Copies whose names or ids are not in the pack. */
  unresolved: number;
}

export interface RunContext extends PrepareContext {
  outDir: string;
  /** Rebuild jobs whose file exists. */
  force: boolean;
  pools: Map<string, LoadedPool>;
  versions: Map<string, { version: BuilderVersion; notes: string }>;
}

export interface JobResult {
  file: string;
  deck: ReviewDeck;
  skipped: boolean;
}

/** A job that cannot run as written: unknown version, bad colors, missing file. */
export class JobError extends Error {
  override name = 'JobError';
}

/**
 * Every version shares the config, settings, and pools in a run, so a write to
 * them would change later builds; frozen, such a write throws instead.
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Load the pack, learned data, config, and settings once for a whole run. */
export function createContext(opts: { outDir?: string; force?: boolean } = {}): RunContext {
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) throw new Error('no data pack at data/packs/; run npm run data:pull');
  const index = new CardIndex(parsePack(readFileSync(packPath, 'utf8')));
  attachLearned(index);
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const problems = validateConfig(config);
  if (problems.length) throw new Error(`config problems: ${problems.join('; ')}`);
  const settings = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  return {
    index,
    config: deepFreeze(config),
    settings: deepFreeze(settings),
    root: ROOT,
    outDir: path.resolve(ROOT, opts.outDir ?? DEFAULT_OUT),
    force: opts.force ?? false,
    pools: new Map(),
    versions: new Map(),
  };
}

/** FNV-1a of the sorted [oracle id, qty] pairs, as 8 hex digits. */
export function poolHash(pairs: Iterable<readonly [string, number]>): string {
  const sorted = [...pairs]
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => [id, qty] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  return hash32(JSON.stringify(sorted)).toString(16).padStart(8, '0');
}

/**
 * A decklist text file, or a JSON pool file { id, cards: [[oracleId, qty], ...] }.
 * The pool id is the JSON id, else the file's base name.
 */
export function loadPool(file: string, index: CardIndex, root: string = ROOT): LoadedPool {
  const abs = path.resolve(root, file);
  if (!existsSync(abs)) throw new JobError(`pool file not found: ${file}`);
  const text = readFileSync(abs, 'utf8');
  let entries: PoolEntry[];
  let unresolved = 0;
  let id = path.basename(abs, path.extname(abs));
  if (path.extname(abs).toLowerCase() === '.json') {
    const data = JSON.parse(text) as { id?: unknown; cards?: unknown };
    if (!Array.isArray(data.cards))
      throw new JobError(`${file}: a JSON pool needs "cards": [[oracleId, qty], ...]`);
    // review:pools names pools by kind (public-bulk-black, owner-b), so they never share
    // deck files with the eval/pools or test-bulk lists they came from.
    if (typeof data.id === 'string' && slug(data.id)) id = slug(data.id);
    entries = [];
    for (const row of data.cards as unknown[]) {
      const [id, qty] = Array.isArray(row) ? (row as unknown[]) : [];
      if (typeof id !== 'string' || typeof qty !== 'number' || !Number.isInteger(qty))
        throw new JobError(`${file}: bad pool row ${JSON.stringify(row)}`);
      if (index.get(id)) entries.push({ cardId: id, qty });
      else unresolved += qty;
    }
  } else {
    const report = resolveLines(parseDecklist(text).lines, index, { suggest: false });
    for (const u of report.unresolved) unresolved += u.line.qty;
    entries = toPoolEntries(report.resolved);
  }
  const pool = deepFreeze(addToPool(emptyPool(STAMP), entries, STAMP));
  const pairs = Object.values(pool.entries).map((e) => [e.cardId, e.qty] as const);
  return {
    info: {
      id,
      source: path.relative(root, abs).replace(/\\/g, '/'),
      hash: poolHash(pairs),
      cards: pairs.reduce((n, [, qty]) => n + qty, 0),
    },
    pool,
    unresolved,
  };
}

export function parseColors(input: string | readonly string[] | undefined): Color[] {
  if (input === undefined) return [];
  const letters = (typeof input === 'string' ? input : input.join('')).replace(/[\s,]/g, '');
  const up = [...letters.toUpperCase()];
  if (up.some((c) => !'WUBRG'.includes(c)))
    throw new JobError(`colors must be letters from WUBRG, such as B or WU; got "${letters}"`);
  return normalizeColors(up as Color[]);
}

/** An oracle id, a full name, or a part of a name unique among the pool's possible commanders. */
export function resolveCommander(input: string, pool: Pool, index: CardIndex): CardRecord {
  // A commander outside the pool is a mistake in the job, not a build the pool failed.
  const inPool = (card: CardRecord): CardRecord => {
    if ((pool.entries[card.id]?.qty ?? 0) < 1)
      throw new JobError(`${card.name} is not in the pool`);
    if (!canBeCommander(card)) throw new JobError(`${card.name} cannot be a commander`);
    return card;
  };
  if (UUID.test(input)) {
    const card = index.get(input.toLowerCase());
    if (!card) throw new JobError(`no card with oracle id ${input}`);
    return inPool(card);
  }
  const exact = index.find(input);
  if (exact && (pool.entries[exact.id]?.qty ?? 0) > 0) return inPool(exact);
  const needle = input.toLowerCase();
  const hits = Object.keys(pool.entries)
    .map((id) => index.get(id))
    .filter(
      (c): c is CardRecord => !!c && canBeCommander(c) && c.name.toLowerCase().includes(needle),
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new JobError(`no possible commander in the pool matches "${input}"`);
  throw new JobError(
    `"${input}" matches ${hits.length} commanders in the pool: ${hits
      .slice(0, 5)
      .map((c) => c.name)
      .join('; ')}`,
  );
}

/** Turn a job into the request every version receives, plus the commander's name for the file. */
export function resolveRequest(
  job: ReviewJob,
  pool: Pool,
  index: CardIndex,
): { request: ReviewRequest; commanderName?: string } {
  const size = Number(job.size) as ReviewSize;
  if (!SIZES.includes(size)) throw new JobError(`size must be 100, 60, 40, or 20; got ${job.size}`);
  const seed = job.seed ?? 1;
  if (!Number.isInteger(seed)) throw new JobError(`seed must be a whole number; got ${job.seed}`);
  let colors = parseColors(job.colors);
  let commander: CardRecord | undefined;
  if (size === 100) {
    if (!job.commander) throw new JobError('a 100-card build needs a commander');
    commander = resolveCommander(job.commander, pool, index);
    // A Commander deck takes its commander's colors.
    const identity = normalizeColors(commander.identity);
    if (colors.length && colors.join('') !== identity.join(''))
      throw new JobError(
        `colors ${colors.join('')} differ from ${commander.name}'s identity ${identity.join('') || 'colorless'}; leave colors out at 100 cards`,
      );
    colors = identity;
  } else {
    if (job.commander) throw new JobError('a commander goes only with size 100');
    if (!colors.length) throw new JobError('colors are required below 100 cards');
  }
  const request: ReviewRequest = {
    size,
    colors,
    ...(job.style ? { style: job.style } : {}),
    ...(job.secondary ? { secondary: job.secondary } : {}),
    ...(commander ? { commander: commander.id } : {}),
    seed,
  };
  return commander ? { request, commanderName: commander.name } : { request };
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9_.]+/g, '-').replace(/^-+|-+$/g, '');
}

/** <pool>-<colors>-<size>-<style or bestfit>[+<secondary>][-<commander>]-s<seed>.json */
export function deckFileName(
  poolId: string,
  request: ReviewRequest,
  commanderName?: string,
): string {
  let style = request.style ? slug(request.style) : 'bestfit';
  if (request.secondary) style += `+${slug(request.secondary)}`;
  const parts = [poolId, request.colors.join('') || 'C', String(request.size), style];
  if (request.commander) {
    const name = commanderName ? slug(commanderName.toLowerCase()) : request.commander.slice(0, 8);
    parts.push(name.slice(0, 40).replace(/-+$/, ''));
  }
  return `${parts.join('-')}-s${request.seed}.json`;
}

function poolFor(ctx: RunContext, file: string): LoadedPool {
  const key = path.resolve(ctx.root, file);
  let loaded = ctx.pools.get(key);
  if (!loaded) {
    loaded = loadPool(key, ctx.index, ctx.root);
    ctx.pools.set(key, loaded);
  }
  return loaded;
}

async function versionFor(
  ctx: RunContext,
  id: string,
): Promise<{ version: BuilderVersion; notes: string }> {
  let entry = ctx.versions.get(id);
  if (!entry) {
    const version = await getVersion(id);
    const { index, config, settings, root } = ctx;
    const extra = await version.prepare?.({ index, config, settings, root });
    entry = { version, notes: extra ? `${version.notes} ${extra}` : version.notes };
    ctx.versions.set(id, entry);
  }
  return entry;
}

function round1(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/** Build once and wrap the result as a ReviewDeck. A BuildError becomes `error`; other errors throw. */
export async function buildReviewDeck(
  versionId: string,
  pool: LoadedPool,
  request: ReviewRequest,
  ctx: RunContext,
): Promise<ReviewDeck> {
  const { version, notes } = await versionFor(ctx, versionId);
  const { index, config, settings, root } = ctx;
  let built: BuiltDeck | undefined;
  let error: string | undefined;
  const t0 = performance.now();
  try {
    built = await version.build({
      index,
      config,
      settings,
      root,
      pool: pool.pool,
      request: { ...request, colors: [...request.colors] },
    });
  } catch (err) {
    if (!(err instanceof BuildError)) throw err;
    error = err.message;
  }
  const buildMs = round1(performance.now() - t0);
  const deck: ReviewDeck['deck'] = built
    ? {
        name: built.name,
        archetype: built.archetype,
        // A version that does not report colors built the requested ones.
        colors: normalizeColors(built.colors ?? request.colors),
        ...(built.commander ? { commander: built.commander } : {}),
        cards: built.cards.map((c) => ({
          id: c.id,
          name: index.get(c.id)?.name ?? '(not in the pack)',
          qty: c.qty,
          ...(c.why ? { why: c.why } : {}),
        })),
        basics: built.basics,
      }
    : { name: '', archetype: '', cards: [], basics: {} };
  return {
    version: version.id,
    ...(notes ? { versionNotes: notes } : {}),
    pool: pool.info,
    request,
    deck,
    buildMs,
    ...(built?.explanation !== undefined ? { explanation: built.explanation } : {}),
    ...(error !== undefined ? { error } : {}),
    builtAt: new Date().toISOString(),
    dataVersion: index.dataVersion,
  };
}

export function writeReviewDeck(file: string, deck: ReviewDeck): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(deck, null, 2) + '\n');
}

/** Where a job's deck goes, and the request it resolves to. */
export function planJob(
  job: ReviewJob,
  ctx: RunContext,
): { pool: LoadedPool; request: ReviewRequest; file: string } {
  if (typeof job?.version !== 'string' || typeof job.pool !== 'string')
    throw new JobError('a job needs "version" and "pool" as strings');
  if (!listVersions().includes(job.version))
    throw new JobError(`unknown version "${job.version}"; known: ${listVersions().join(', ')}`);
  const pool = poolFor(ctx, job.pool);
  const { request, commanderName } = resolveRequest(job, pool.pool, ctx.index);
  const file = path.join(
    ctx.outDir,
    job.version,
    deckFileName(pool.info.id, request, commanderName),
  );
  return { pool, request, file };
}

function readDeck(file: string): ReviewDeck | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as ReviewDeck;
  } catch {
    return undefined;
  }
}

/**
 * Build one job and write its file. Unless ctx.force, a job whose file holds the
 * same build (pool file, pool cards, request, data version) is skipped.
 */
export async function runJob(job: ReviewJob, ctx: RunContext): Promise<JobResult> {
  const { pool, request, file } = planJob(job, ctx);
  // An unreadable file (a run stopped mid-write) is rebuilt.
  const old = !ctx.force && existsSync(file) ? readDeck(file) : undefined;
  if (old) {
    if (old.pool?.source !== pool.info.source || !isDeepStrictEqual(old.request, request))
      throw new JobError(
        `${rel(file)} holds a build of ${old.pool?.source ?? 'another pool'}; rename one pool or use --force`,
      );
    // A changed pool file or data pack makes the file stale.
    if (old.pool.hash === pool.info.hash && old.dataVersion === ctx.index.dataVersion)
      return { file, deck: old, skipped: true };
  }
  const deck = await buildReviewDeck(job.version, pool, request, ctx);
  writeReviewDeck(file, deck);
  return { file, deck, skipped: false };
}

/** Differences between two builds of one request; empty when they match. */
export function deckDifferences(a: ReviewDeck, b: ReviewDeck): string[] {
  const out: string[] = [];
  if (a.error !== b.error) out.push(`error: ${a.error ?? 'none'} / ${b.error ?? 'none'}`);
  if (a.deck.name !== b.deck.name) out.push(`name: ${a.deck.name} / ${b.deck.name}`);
  if (a.deck.archetype !== b.deck.archetype)
    out.push(`archetype: ${a.deck.archetype} / ${b.deck.archetype}`);
  // Files built before deck.colors existed say nothing about the built colors.
  if (a.deck.colors && b.deck.colors) {
    const [ca, cb] = [a.deck.colors.join(''), b.deck.colors.join('')];
    if (ca !== cb) out.push(`colors: ${ca || 'none'} / ${cb || 'none'}`);
  }
  if (a.deck.commander !== b.deck.commander)
    out.push(`commander: ${a.deck.commander ?? 'none'} / ${b.deck.commander ?? 'none'}`);
  const list = (d: ReviewDeck) =>
    d.deck.cards
      .map((c) => `${c.id} x${c.qty}`)
      .sort()
      .join('\n');
  if (list(a) !== list(b)) out.push('cards differ');
  const basics = (d: ReviewDeck) =>
    (['W', 'U', 'B', 'R', 'G'] as const).map((c) => d.deck.basics[c] ?? 0).join(',');
  if (basics(a) !== basics(b)) out.push(`basics: ${basics(a)} / ${basics(b)}`);
  return out;
}

function deckCount(d: ReviewDeck): number {
  let n = 0;
  for (const c of d.deck.cards) n += c.qty;
  for (const q of Object.values(d.deck.basics)) n += q ?? 0;
  return n;
}

/** Decklist text grouped by type, as the core exports decks. */
export function deckText(d: ReviewDeck, ctx: RunContext): string {
  const colors = deckColorsOf(d);
  const deck: Deck = {
    id: STAMP,
    name: d.deck.name,
    size: d.request.size,
    color: colors[0] ?? 'W',
    colors,
    archetype: d.deck.archetype,
    ...(d.deck.commander ? { commander: d.deck.commander } : {}),
    cards: d.deck.cards.map((c) => ({ cardId: c.id, qty: c.qty })),
    basics: d.deck.basics,
    committed: false,
    createdAt: STAMP,
    configVersion: '',
    dataVersion: d.dataVersion,
  };
  return deckToDecklist(deck, ctx.index, ctx.config);
}

function describe(job: ReviewJob, request?: ReviewRequest): string {
  if (typeof job?.pool !== 'string') return JSON.stringify(job);
  const colors = request
    ? request.colors.join('')
    : Array.isArray(job.colors)
      ? job.colors.join('')
      : (job.colors ?? '');
  let style = job.style ?? 'bestfit';
  if (job.secondary) style += `+${job.secondary}`;
  const cmd = job.commander ? ` "${job.commander}"` : '';
  const pool = path.basename(job.pool, path.extname(job.pool));
  return `${job.version} ${pool} ${colors || '-'} ${job.size} ${style}${cmd} s${job.seed ?? 1}`;
}

function rel(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function result(d: ReviewDeck): string {
  return d.error
    ? `cannot build: ${d.error} (${d.buildMs} ms)`
    : `${d.deck.archetype} "${d.deck.name}", ${deckCount(d)} cards, ${d.buildMs} ms`;
}

async function runSingle(ctx: RunContext): Promise<number> {
  const poolArg = arg('pool');
  if (!poolArg) {
    console.error(USAGE);
    return 2;
  }
  const [colors, style, secondary, commander, seed] = [
    arg('colors'),
    arg('style'),
    arg('secondary'),
    arg('commander'),
    arg('seed'),
  ];
  const job: ReviewJob = {
    version: arg('version') ?? 'head',
    pool: poolArg,
    size: Number(arg('size') ?? 60),
    ...(colors ? { colors } : {}),
    ...(style ? { style } : {}),
    ...(secondary ? { secondary } : {}),
    ...(commander ? { commander } : {}),
    ...(seed !== undefined ? { seed: Number(seed) } : {}),
  };
  const { pool, request, file } = planJob(job, ctx);
  console.log(
    `pool ${pool.info.id}: ${pool.info.cards} cards, hash ${pool.info.hash}${pool.unresolved ? `, ${pool.unresolved} unresolved` : ''}`,
  );
  const deck = await buildReviewDeck(job.version, pool, request, ctx);
  writeReviewDeck(file, deck);
  console.log(`${describe(job, request)}: ${result(deck)}`);
  console.log(`wrote ${rel(file)}`);
  let code = deck.error ? 1 : 0;
  if (flag('twice')) {
    const again = await buildReviewDeck(job.version, pool, request, ctx);
    const diff = deckDifferences(deck, again);
    console.log(
      diff.length
        ? `second build differs (${again.buildMs} ms): ${diff.join('; ')}`
        : `second build identical (${again.buildMs} ms)`,
    );
    if (diff.length) code = 1;
  }
  if (flag('print') && !deck.error) console.log('\n' + deckText(deck, ctx));
  return code;
}

async function runBatch(jobsFile: string, ctx: RunContext): Promise<number> {
  const jobs = JSON.parse(readFileSync(path.resolve(ROOT, jobsFile), 'utf8')) as unknown;
  if (!Array.isArray(jobs)) throw new Error(`${jobsFile} must hold an array of jobs`);
  const counts = { built: 0, failed: 0, skipped: 0, bad: 0 };
  const t0 = performance.now();
  for (const [i, job] of (jobs as ReviewJob[]).entries()) {
    const at = `[${i + 1}/${jobs.length}]`;
    try {
      const r = await runJob(job, ctx);
      const head = `${at} ${describe(job, r.deck.request)}`;
      if (r.skipped) {
        counts.skipped++;
        console.log(`${head}: skipped, ${rel(r.file)} exists`);
        continue;
      }
      if (r.deck.error) counts.failed++;
      else counts.built++;
      console.log(`${head}: ${result(r.deck)}`);
    } catch (err) {
      counts.bad++;
      const msg = err instanceof Error ? err.message : String(err);
      const kind =
        err instanceof JobError
          ? 'bad job'
          : err instanceof VersionLoadError
            ? 'version did not load'
            : 'crashed';
      console.log(`${at} ${describe(job)}: ${kind}: ${msg}`);
      if (kind === 'crashed' && err instanceof Error && err.stack) console.error(err.stack);
    }
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n${jobs.length} jobs in ${secs} s: ${counts.built} built, ${counts.failed} could not build (recorded), ` +
      `${counts.skipped} skipped, ${counts.bad} bad or crashed`,
  );
  return counts.bad ? 1 : 0;
}

const USAGE = `usage:
  npm run review:build -- --pool <file> --colors <WUBRG letters> [--size 60|40|20|100]
      [--version ${listVersions().join('|')}] [--style <id>] [--secondary <id or tribal:Type>]
      [--commander "<name, part of a name, or oracle id>"] [--seed 1] [--out data/review/decks]
      [--twice] [--print]
  npm run review:build -- --jobs <jobs.json> [--force] [--out data/review/decks]`;

async function main(): Promise<number> {
  if (flag('help') || process.argv.length <= 2) {
    console.log(USAGE);
    return 2;
  }
  const outDir = arg('out');
  const ctx = createContext({ ...(outDir ? { outDir } : {}), force: flag('force') });
  const jobs = arg('jobs');
  try {
    return jobs ? await runBatch(jobs, ctx) : await runSingle(ctx);
  } catch (err) {
    if (err instanceof JobError) {
      console.error(err.message);
      return 2;
    }
    if (err instanceof VersionLoadError) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }
}

// Run only as a script, so Phase 3 tools can import runJob and friends.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/build.ts')) {
  process.exitCode = await main();
}
