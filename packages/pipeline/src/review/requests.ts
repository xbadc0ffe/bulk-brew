// Entry point for `npm run review:requests`: the Phase 3 job files for every
// builder version, made the same way every time so each version gets exactly
// the same requests. Rules and counts: docs/review/requests.md.
//
// Usage: npm run review:requests -- [--pools plain,theme,public,owner] [--plain 30]
//   [--prefix <p>] [--sizes 60,100,40,20] [--versions head,head-web,v26.0.30,random]
//   [--bestfit-only head-web,random] [--no-two-color] [--out data/review/jobs] [--force]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  COLORS,
  commanderCandidates,
  configVersion,
  listCandidates,
  normalizeColors,
  scanCandidates,
  scanPool,
  type CardRecord,
  type Color,
  type CommanderTier,
  type ScanReport,
} from '@bulk-brew/core';
import { arg, flag, ROOT } from '../corpus.ts';
import { createContext, deckFileName, loadPool, type ReviewJob } from './build.ts';
import type { ColorCounts, IndexEntry, PoolKind } from './pools.ts';
import type { ReviewSize } from './version.ts';
import { listVersions } from './versions.ts';

export const DEFAULT_OUT = path.join(ROOT, 'data', 'review', 'jobs');
const POOLS_DIR = path.join(ROOT, 'data', 'review', 'pools');
const KIND_ORDER: readonly PoolKind[] = ['plain', 'theme', 'public', 'owner'];
export const DEFAULT_KINDS: readonly PoolKind[] = ['plain', 'theme', 'public'];
export const DEFAULT_VERSIONS: readonly string[] = ['head', 'head-web', 'v26.0.30', 'random'];
/** head-web differs from head only in best fit, and a random pile ignores the style. */
export const DEFAULT_BESTFIT_ONLY: readonly string[] = ['head-web', 'random'];
const ALL_SIZES: readonly ReviewSize[] = [60, 100, 40, 20];
/** Rough build seconds per job, from the runner's timings (docs/review/runner.md). */
export const SECONDS: Record<ReviewSize, number> = { 60: 0.1, 40: 0.07, 20: 0.05, 100: 0.5 };
/** Commanders per pool at 100, and how far down the list a theme pool looks for its color. */
export const COMMANDERS = 2;
export const COLOR_WINDOW = 10;
/** Sizes that get the two-color slice on plain pools. */
export const TWO_COLOR_SIZES: readonly ReviewSize[] = [60, 40];

export type Reason = 'bestfit' | 'shape' | 'viable' | 'enriched';
/** A request outside the mono-color set; absent on every other request. */
export type Slice = 'two-color';
export type JobSet = 'main' | 'small';

/** A runner job plus why it exists and where its deck lands; the runner ignores the extra fields. */
export interface RequestJob extends ReviewJob {
  colors: string;
  seed: number;
  reason: Reason;
  slice?: Slice;
  commanderName?: string;
  /** The deck file the runner writes, relative to its output folder. */
  deck: string;
}

/** One request before it is copied per version and seed. */
export interface PoolRequest {
  pool: string;
  poolId: string;
  kind: PoolKind;
  size: ReviewSize;
  colors: Color[];
  style?: string;
  reason: Reason;
  slice?: Slice;
  commander?: { id: string; name: string };
}

export function setOf(size: ReviewSize): JobSet {
  return size === 60 || size === 100 ? 'main' : 'small';
}

export function jobFileName(set: JobSet, version: string): string {
  return `${set}-${version}.json`;
}

/** Random piles get two seeds per request, so the panel's calibration sees more of them. */
export function seedsFor(version: string): number[] {
  return version === 'random' ? [1, 2] : [1];
}

const COLOR_WORDS: Record<string, Color> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
};

/** The colors a pool file's first comment names before its first colon or full stop. */
export function colorsInComment(text: string): Color[] {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('//') || l.startsWith('#'));
  if (!line) return [];
  const lead = line.replace(/^(\/\/|#)\s*/, '').split(/[:.]/)[0] ?? '';
  const found = new Set<Color>();
  for (const m of lead.toLowerCase().matchAll(/\b(white|blue|black|red|green)\b/g))
    found.add(COLOR_WORDS[m[1]!]!);
  return normalizeColors([...found]);
}

/** The color with the most copies of its own; ties go to WUBRG order. */
export function largestColor(counts: Pick<ColorCounts, Color>): Color {
  let best: Color = 'W';
  for (const c of COLORS) if (counts[c] > counts[best]) best = c;
  return best;
}

/** Color sets requested below 100 cards: every mono color, or what a public pool's comment names. */
export function poolColorSets(
  kind: PoolKind,
  counts: Pick<ColorCounts, Color>,
  comment?: string,
): Color[][] {
  if (kind !== 'public') return COLORS.map((c) => [c]);
  const named = comment ? colorsInComment(comment) : [];
  return [named.length ? named : [largestColor(counts)]];
}

/** Every two-color pair, each in WUBRG order: WU, WB, WR, WG, UB, UR, UG, BR, BG, RG. */
export function twoColorSets(): Color[][] {
  return COLORS.flatMap((a, i) => COLORS.slice(i + 1).map((b) => [a, b]));
}

/** Plain pools get the two-color slice at 60 and 40 cards, unless it is turned off. */
export function hasTwoColor(kind: PoolKind, size: ReviewSize, on = true): boolean {
  return on && kind === 'plain' && TWO_COLOR_SIZES.includes(size);
}

/**
 * "theme-energy-01" and "h1-theme-energy-01" (a seed prefix, docs/review/pools.md)
 * are energy pools; plain and public pools have no enriched style.
 */
export function themeStyleOf(poolId: string): string | undefined {
  return /^(?:[A-Za-z0-9]+-)?theme-(.+)-\d+$/.exec(poolId)?.[1];
}

/** Pools made with a seed prefix ("h1-plain-01"), or every pool when no prefix is given. */
export function hasPrefix(poolId: string, prefix?: string): boolean {
  return prefix === undefined || poolId.startsWith(`${prefix}-`);
}

/**
 * Best fit first, then each viable style in config order (the Aggro, Midrange,
 * and Control shapes as "shape", themed styles as "viable"), then extra viable
 * ids (a commander's tribes), then the enriched style when the scan did not
 * already list it.
 */
export function styleRequests(
  scan: Pick<ScanReport, 'archetypes'>,
  enriched?: string,
  extraViable: readonly string[] = [],
): { style?: string; reason: Reason }[] {
  const out: { style?: string; reason: Reason }[] = [{ reason: 'bestfit' }];
  // The shapes are the plain baseline a themed deck must beat.
  for (const r of scan.archetypes)
    if (r.viable)
      out.push({ style: r.archetype, reason: r.kind === 'synergy' ? 'viable' : 'shape' });
  for (const id of [...extraViable].sort())
    if (!out.some((o) => o.style === id)) out.push({ style: id, reason: 'viable' });
  if (enriched && !out.some((o) => o.style === enriched))
    out.push({ style: enriched, reason: 'enriched' });
  return out;
}

/** Partner, Partner with, Friends forever, Choose a Background, Doctor's companion. */
export function isPartner(card: Pick<CardRecord, 'keywords'>): boolean {
  return card.keywords.some((k) =>
    /^(partner|friends|choose a background|doctor's companion)/i.test(k),
  );
}

export interface CommanderPick {
  id: string;
  name: string;
  colors: Color[];
  tier: CommanderTier;
  score: number;
  enough: boolean;
  partner: boolean;
  primaryTribes: string[];
}

const TIER_ORDER: Record<CommanderTier, number> = { top: 0, good: 1, possible: 2 };

/**
 * The commanders to request: drop partners and those the core finds short
 * of cards for the 99, order as the core does (tier, then score, then name),
 * take the first `count`. With a preferred color that none of them has, the
 * first commander with it among the first `window` takes the last place.
 */
export function pickCommanders(
  list: readonly CommanderPick[],
  prefer?: Color,
  count = COMMANDERS,
  window = COLOR_WINDOW,
): CommanderPick[] {
  const eligible = list
    .filter((c) => c.enough && !c.partner)
    .sort(
      (a, b) =>
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
        b.score - a.score ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
  const picks = eligible.slice(0, count);
  if (prefer && picks.length === count && !picks.some((c) => c.colors.includes(prefer))) {
    const alt = eligible.slice(count, window).find((c) => c.colors.includes(prefer));
    if (alt) picks[count - 1] = alt;
  }
  return picks;
}

/**
 * The enriched style's best color: the mono color whose 100-card scan counts
 * the most enabler plus payoff copies, among the style's own colors when the
 * config limits them; ties go to WUBRG order, and no copies means no color.
 */
export function bestColorFor(
  counts: Partial<Record<Color, number>>,
  styleColors?: readonly Color[],
): Color | undefined {
  let best: Color | undefined;
  for (const c of COLORS) {
    if (styleColors && !styleColors.includes(c)) continue;
    const n = counts[c] ?? 0;
    if (n > 0 && (best === undefined || n > (counts[best] ?? 0))) best = c;
  }
  return best;
}

/** The requests a version gets: all of them, or only best fit for a best-fit-only version. */
export function requestsFor<T extends { reason: Reason }>(
  requests: readonly T[],
  version: string,
  bestfitOnly: ReadonlySet<string>,
): readonly T[] {
  return bestfitOnly.has(version) ? requests.filter((r) => r.reason === 'bestfit') : requests;
}

/** Copy each request per version and seed into its job set, in request order. */
export function expandJobs(
  requests: readonly PoolRequest[],
  versions: readonly string[],
  bestfitOnly: ReadonlySet<string> = new Set(),
): Map<string, RequestJob[]> {
  const files = new Map<string, RequestJob[]>();
  for (const version of versions) {
    for (const r of requestsFor(requests, version, bestfitOnly)) {
      const name = jobFileName(setOf(r.size), version);
      let jobs = files.get(name);
      if (!jobs) files.set(name, (jobs = []));
      for (const seed of seedsFor(version)) {
        const deck = deckFileName(
          r.poolId,
          {
            size: r.size,
            colors: r.colors,
            ...(r.style ? { style: r.style } : {}),
            ...(r.commander ? { commander: r.commander.id } : {}),
            seed,
          },
          r.commander?.name,
        );
        jobs.push({
          version,
          pool: r.pool,
          colors: r.colors.join(''),
          size: r.size,
          ...(r.style ? { style: r.style } : {}),
          ...(r.commander ? { commander: r.commander.id, commanderName: r.commander.name } : {}),
          seed,
          reason: r.reason,
          ...(r.slice ? { slice: r.slice } : {}),
          deck: `${version}/${deck}`,
        });
      }
    }
  }
  return files;
}

function list<T extends string>(raw: string | undefined, fallback: readonly T[]): T[] {
  return raw === undefined
    ? [...fallback]
    : (raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as T[]);
}

function rel(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

/** One job per line, so the files read and diff well. */
function formatJobs(jobs: readonly RequestJob[]): string {
  return jobs.length ? `[\n${jobs.map((j) => '  ' + JSON.stringify(j)).join(',\n')}\n]\n` : '[]\n';
}

function pad(s: string | number, n: number, left = false): string {
  const t = String(s);
  return left ? t.padEnd(n) : t.padStart(n);
}

function minutes(secs: number): string {
  return secs < 60 ? `${secs.toFixed(0)} s` : `${(secs / 60).toFixed(1)} min`;
}

function main(): number {
  const kinds = list<PoolKind>(arg('pools'), DEFAULT_KINDS);
  const sizes = list(arg('sizes'), ALL_SIZES.map(String)).map(Number) as ReviewSize[];
  const versions = list(arg('versions'), DEFAULT_VERSIONS);
  const bestfitOnly = new Set(
    list(arg('bestfit-only'), DEFAULT_BESTFIT_ONLY).filter((v) => v !== 'none'),
  );
  const plainArg = arg('plain');
  const plainCount = plainArg === undefined ? Infinity : Number(plainArg);
  const outDir = path.resolve(ROOT, arg('out') ?? DEFAULT_OUT);
  const force = flag('force');
  const twoColor = !flag('no-two-color');
  const prefix = arg('prefix');
  if (prefix !== undefined && !/^[A-Za-z0-9]+$/.test(prefix)) {
    console.error(`--prefix takes a seed prefix of letters and digits; got ${prefix}`);
    return 2;
  }
  if (kinds.some((k) => !KIND_ORDER.includes(k))) {
    console.error(`--pools takes ${KIND_ORDER.join(', ')}; got ${kinds.join(',')}`);
    return 2;
  }
  if (sizes.some((s) => !ALL_SIZES.includes(s))) {
    console.error(`--sizes takes 60, 100, 40, 20; got ${sizes.join(',')}`);
    return 2;
  }
  if (!Number.isInteger(plainCount) && plainCount !== Infinity) {
    console.error(`--plain takes a whole number; got ${plainArg}`);
    return 2;
  }
  if (versions.some((v) => !/^[A-Za-z0-9._-]+$/.test(v))) {
    console.error(`--versions takes ids of letters, digits, dots, and dashes; got ${versions}`);
    return 2;
  }
  const indexFile = path.join(POOLS_DIR, 'index.json');
  if (!existsSync(indexFile)) {
    console.error('no pools at data/review/pools/; run npm run review:pools');
    return 1;
  }

  const ctx = createContext();
  const { index, config, settings } = ctx;
  const byKind = new Map<PoolKind, IndexEntry[]>();
  for (const e of JSON.parse(readFileSync(indexFile, 'utf8')) as IndexEntry[]) {
    if (!kinds.includes(e.kind) || !hasPrefix(e.id, prefix)) continue;
    byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  }
  const entries: IndexEntry[] = [];
  for (const kind of KIND_ORDER) {
    const group = (byKind.get(kind) ?? []).sort((a, b) => (a.id < b.id ? -1 : 1));
    entries.push(...(kind === 'plain' ? group.slice(0, plainCount) : group));
  }
  const ordered = ALL_SIZES.filter((s) => sizes.includes(s));
  const styleColors = new Map(
    config.archetypes.archetypes.map((a) => [a.id, a.kind === 'synergy' ? a.colors : undefined]),
  );

  // Requests are the same for every version, so they are worked out once per pool.
  const perPool = new Map<string, PoolRequest[]>();
  const noCommander: string[] = [];
  const preferred: string[] = [];
  for (const entry of entries) {
    const file = path.join(POOLS_DIR, entry.path);
    const poolPath = rel(file);
    const loaded = loadPool(poolPath, index);
    const pool = loaded.pool;
    const poolId = loaded.info.id;
    const enriched = entry.kind === 'theme' ? themeStyleOf(entry.id) : undefined;
    if (entry.kind === 'theme' && !styleColors.has(enriched ?? '')) {
      console.error(`${entry.id}: no style "${enriched}" in config/archetypes.json`);
      return 1;
    }
    let comment: string | undefined;
    if (entry.kind === 'public') {
      const source = (JSON.parse(readFileSync(file, 'utf8')) as { recipe?: string }).recipe;
      const abs = source ? path.resolve(ROOT, source) : '';
      if (abs && existsSync(abs)) comment = readFileSync(abs, 'utf8');
    }
    const out: PoolRequest[] = [];
    const base = { pool: poolPath, poolId, kind: entry.kind };
    for (const size of ordered) {
      if (size !== 100) {
        for (const colors of poolColorSets(entry.kind, entry.colors, comment)) {
          const scan = scanPool(pool, index, config, settings, size, colors);
          for (const s of styleRequests(scan, enriched)) out.push({ ...base, size, colors, ...s });
        }
        if (hasTwoColor(entry.kind, size, twoColor))
          for (const colors of twoColorSets()) {
            const scan = scanPool(pool, index, config, settings, size, colors);
            for (const s of styleRequests(scan))
              out.push({ ...base, size, colors, ...s, slice: 'two-color' });
          }
        continue;
      }
      const scans = new Map<string, ScanReport>();
      const listed = commanderCandidates(pool, index, config, settings, scans);
      let prefer: Color | undefined;
      if (enriched) {
        const counts: Partial<Record<Color, number>> = {};
        for (const c of COLORS) {
          let scan = scans.get(c);
          if (!scan) scans.set(c, (scan = scanPool(pool, index, config, settings, 100, [c])));
          const r = scan.archetypes.find((a) => a.archetype === enriched);
          counts[c] = (r?.enablers.have ?? 0) + (r?.payoffs.have ?? 0);
        }
        prefer = bestColorFor(counts, styleColors.get(enriched));
      }
      const candidates = listed.map((c) => ({ ...c, partner: isPartner(index.get(c.id)!) }));
      const picks = pickCommanders(candidates, prefer);
      if (picks.length === 0) noCommander.push(entry.id);
      if (prefer && pickCommanders(candidates).some((c, i) => picks[i]?.id !== c.id))
        preferred.push(`${entry.id} (${prefer})`);
      for (const pick of picks) {
        // The builder scans without the commander among the candidates, so the requests do too.
        const cands = listCandidates(pool, index, config, settings, pick.colors, 100).filter(
          (c) => c.facts.card.id !== pick.id,
        );
        const scan = scanCandidates(cands, config, settings, 100, pick.colors);
        for (const s of styleRequests(scan, enriched, pick.primaryTribes))
          out.push({
            ...base,
            size,
            colors: pick.colors,
            commander: { id: pick.id, name: pick.name },
            ...s,
          });
      }
    }
    perPool.set(entry.id, out);
  }

  // Jobs run size by size, so a part run covers whole sizes first.
  const requests: PoolRequest[] = [];
  for (const size of ordered)
    for (const entry of entries)
      requests.push(...perPool.get(entry.id)!.filter((r) => r.size === size));
  const files = expandJobs(requests, versions, bestfitOnly);

  // A changed job set must be asked for: decks already built from the old one stay keyed to it.
  const contents = new Map<string, string>();
  for (const [name, jobs] of files) contents.set(path.join(outDir, name), formatJobs(jobs));
  const indexOut = {
    dataVersion: index.dataVersion,
    configVersion: configVersion(config),
    scope: {
      pools: KIND_ORDER.filter((k) => kinds.includes(k)),
      ...(prefix !== undefined ? { prefix } : {}),
      plain: entries.filter((e) => e.kind === 'plain').length,
      sizes: ordered,
      versions,
      bestfitOnly: versions.filter((v) => bestfitOnly.has(v)),
      twoColor,
    },
    files: versions.flatMap((version) =>
      (['main', 'small'] as const)
        .filter((set) => ordered.some((s) => setOf(s) === set))
        .map((set) => {
          const jobs = files.get(jobFileName(set, version)) ?? [];
          return {
            file: jobFileName(set, version),
            set,
            version,
            ...(bestfitOnly.has(version) ? { bestfitOnly: true } : {}),
            sizes: ordered.filter((s) => setOf(s) === set),
            jobs: jobs.length,
            estimateSeconds: Math.round(
              jobs.reduce((n, j) => n + SECONDS[j.size as ReviewSize], 0),
            ),
          };
        }),
    ),
  };
  contents.set(path.join(outDir, 'index.json'), JSON.stringify(indexOut, null, 2) + '\n');
  const changed = [...contents].filter(
    ([file, text]) => existsSync(file) && readFileSync(file, 'utf8') !== text,
  );
  if (changed.length && !force) {
    console.error(
      `these job files exist with other jobs; pass --force to replace them:\n${changed
        .map(([f]) => '  ' + rel(f))
        .join('\n')}`,
    );
    return 1;
  }
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const [file, text] of contents) {
    if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
    writeFileSync(file, text);
    written++;
  }

  // Jobs per version, size, and pool kind, with the rough build time. Shape and
  // two-color jobs are in the pool kind columns too; their own columns call them out.
  const shown = KIND_ORDER.filter((k) => kinds.includes(k));
  const head = [
    'version'.padEnd(10),
    'size',
    ...shown.map((k) => pad(k, 7)),
    '  total',
    '  shape',
    '2-color',
    '   time',
  ];
  console.log(head.join(' '));
  const all = new Map<string, number>();
  let allSecs = 0;
  let allShape = 0;
  let allTwo = 0;
  for (const version of versions) {
    let vTotal = 0;
    let vSecs = 0;
    let vShape = 0;
    let vTwo = 0;
    const seeds = seedsFor(version).length;
    const mine = requestsFor(requests, version, bestfitOnly);
    for (const size of ordered) {
      const sized = mine.filter((r) => r.size === size);
      const cells = shown.map((k) => sized.filter((r) => r.kind === k).length * seeds);
      shown.forEach((k, i) => all.set(k, (all.get(k) ?? 0) + cells[i]!));
      const n = cells.reduce((a, b) => a + b, 0);
      const shape = sized.filter((r) => r.reason === 'shape').length * seeds;
      const two = sized.filter((r) => r.slice === 'two-color').length * seeds;
      const secs = n * SECONDS[size];
      vTotal += n;
      vSecs += secs;
      vShape += shape;
      vTwo += two;
      console.log(
        [
          pad(version, 10, true),
          pad(size, 4),
          ...cells.map((c) => pad(c, 7)),
          pad(n, 7),
          pad(shape, 7),
          pad(two, 7),
          pad(minutes(secs), 7),
        ].join(' '),
      );
    }
    allSecs += vSecs;
    allShape += vShape;
    allTwo += vTwo;
    console.log(
      [pad(version, 10, true), ' all', ...shown.map(() => pad('', 7)), pad(vTotal, 7)]
        .concat(pad(vShape, 7), pad(vTwo, 7), pad(minutes(vSecs), 7))
        .concat(bestfitOnly.has(version) ? '  best fit only' : '')
        .join(' ')
        .trimEnd(),
    );
  }
  const grand = [...files.values()].reduce((n, j) => n + j.length, 0);
  console.log(
    [pad('all', 10, true), ' all', ...shown.map((k) => pad(all.get(k) ?? 0, 7)), pad(grand, 7)]
      .concat(pad(allShape, 7), pad(allTwo, 7), pad(minutes(allSecs), 7))
      .join(' '),
  );
  const reasons = requests.reduce<Record<string, number>>(
    (m, r) => ((m[r.reason] = (m[r.reason] ?? 0) + 1), m),
    {},
  );
  const sliced = requests.filter((r) => r.slice === 'two-color').length;
  console.log(
    `\n${requests.length} requests per version (bestfit ${reasons.bestfit ?? 0}, shape ${reasons.shape ?? 0}, ` +
      `viable ${reasons.viable ?? 0}, enriched ${reasons.enriched ?? 0}; two-color slice ${sliced}` +
      `${twoColor ? '' : ', turned off'}); ${entries.length} pools` +
      `${prefix !== undefined ? ` with prefix ${prefix}` : ''}; data ${index.dataVersion}`,
  );
  if (noCommander.length) console.log(`no commander at 100 for: ${noCommander.join(', ')}`);
  if (preferred.length)
    console.log(`commander swapped for the theme's color: ${preferred.join(', ')}`);
  const known = listVersions();
  const unknown = versions.filter((v) => !known.includes(v));
  if (unknown.length)
    console.log(
      `not registered yet: ${unknown.join(', ')} (known: ${known.join(', ')}); the runner reports those jobs as bad until they are`,
    );
  console.log(
    `${written ? `wrote ${written}` : 'no changes to'} file${written === 1 ? '' : 's'} in ${rel(outDir)}`,
  );
  return 0;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/requests.ts')) {
  process.exitCode = main();
}
