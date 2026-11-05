// Score the builder against the reference corpus. Each reference deck is
// shuffled into a seeded random bulk list and built at its own size (under
// its commander at 100, in its colors otherwise); the run measures how much
// of the deck the builder finds and how its shape compares. Each deck is
// also built from its own cards alone, to see whether our deck score rates
// the reference at least as high as our build.
//
// Usage: npm run corpus:eval                 every deck in data/corpus/decks.json
//        --sizes 100,20         only these sizes
//        --sources precon,local only these sources (precon, draft, local)
//        --since 2015           products released in or after this year (default 2015)
//        --split train|test     one split (default both, reported apart)
//        --limit <n>            at most n decks per size (draft decks default to 2000)
//        --noise <n>            random bulk copies per deck (default 3000)
//        --noise-dir <dir>      use the lists in a folder as the bulk for every deck instead
//
// Results go to data/corpus/results/<date>-<sha>.json; the summary shows
// deltas against the latest earlier run with the same options.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BuildError,
  buildDeck,
  canBeCommander,
  CardIndex,
  configVersion,
  factsFor,
  normalizeColors,
  parseDecklist,
  parsePack,
  resolveLines,
  validateConfig,
  type BuildRequest,
  type BuildResult,
  type CardRecord,
  type Color,
  type DeckSize,
  type Settings,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { loadConfigDir } from './check-config.ts';
import {
  arg,
  CORPUS_FILE,
  CORPUS_RESULTS,
  git,
  hash32,
  loadCorpus,
  mean,
  median,
  noisePool,
  noiseSource,
  poolOf,
  recordsOf,
  ROOT,
  round,
  shapeOf,
  SIZES,
  splitOf,
  stylesMet,
  type CorpusDeck,
  type DeckShape,
} from './corpus.ts';

const DEFAULT_NOISE = 3000;
const DEFAULT_DRAFT_LIMIT = 2000;

export interface EvalRow {
  id: string;
  size: DeckSize;
  kind: string;
  split: 'train' | 'test';
  /** Built from bulk plus the deck. */
  ok: boolean;
  error?: string;
  style?: string;
  score?: number;
  /** Built from the deck alone. */
  selfOk: boolean;
  selfError?: string;
  selfScore?: number;
  /** Share of the deck's distinct spells our build used. */
  recall?: number;
  /** Share of the deck's distinct nonbasic lands our build used. */
  landRecall?: number;
  ours?: DeckShape;
  ref: DeckShape;
  /** Synergy styles whose enabler and payoff minimums the reference deck meets. */
  refStyles: string[];
  /** Whether our build's style is one of them (absent when the deck meets none). */
  styleMatch?: boolean;
  /** Average card strength and median popularity rank of the spells. */
  strength?: number;
  refStrength: number;
  rank?: number;
  refRank: number;
  ms: number;
}

interface SizeSummary {
  decks: number;
  failed: number;
  selfFailed: number;
  recall: number;
  /** Share of reference decks that meet at least one of our synergy styles. */
  themed: number;
  /** Among those, share of our builds that picked one of the styles the deck meets. */
  styleMatch: number;
  landRecall: number;
  score: number;
  selfScore: number;
  /** Share of decks whose own cards score at least as high as our build. */
  refAhead: number;
  lands: number;
  refLands: number;
  avgMv: number;
  refAvgMv: number;
  creatureShare: number;
  refCreatureShare: number;
  strength: number;
  refStrength: number;
  rank: number;
  refRank: number;
  /** Mean per-deck difference, ours minus reference, in spell copies. */
  roleDelta: Record<string, number>;
  ms: number;
}

interface Results {
  runAt: string;
  sha: string;
  dirty: boolean;
  dataVersion: string;
  configVersion: string;
  options: string;
  summary: Record<string, SizeSummary>;
  rows: EvalRow[];
}

function spellStats(
  cards: [CardRecord, number][],
  index: CardIndex,
  config: ReturnType<typeof loadConfigDir>,
) {
  const strengths: number[] = [];
  const ranks: number[] = [];
  for (const [card, qty] of cards) {
    const f = factsFor(index, config, card);
    if (!f.spell) continue;
    for (let i = 0; i < qty; i++) {
      strengths.push(f.strength);
      ranks.push(card.rank ?? 40000);
    }
  }
  return { strength: round(mean(strengths)), rank: median(ranks) };
}

function deckColors(
  cards: [CardRecord, number][],
  index: CardIndex,
  config: ReturnType<typeof loadConfigDir>,
): Color[] {
  const set = new Set<Color>();
  for (const [card] of cards)
    if (factsFor(index, config, card).spell) for (const c of card.colors) set.add(c);
  return normalizeColors([...set]);
}

function summarize(rows: EvalRow[]): SizeSummary {
  const built = rows.filter((r) => r.ok);
  const both = built.filter((r) => r.selfOk);
  const avg = (f: (r: EvalRow) => number, list = built) => round(mean(list.map(f)));
  const roleIds = new Set<string>();
  for (const r of built)
    for (const k of [...Object.keys(r.ref.roles), ...Object.keys(r.ours!.roles)]) roleIds.add(k);
  const roleDelta: Record<string, number> = {};
  for (const id of [...roleIds].sort())
    roleDelta[id] = avg((r) => (r.ours!.roles[id] ?? 0) - (r.ref.roles[id] ?? 0));
  return {
    decks: rows.length,
    failed: rows.length - built.length,
    selfFailed: rows.filter((r) => !r.selfOk).length,
    recall: avg((r) => r.recall!),
    themed: avg((r) => (r.refStyles.length ? 1 : 0), rows),
    styleMatch: avg(
      (r) => (r.styleMatch ? 1 : 0),
      built.filter((r) => r.styleMatch !== undefined),
    ),
    landRecall: avg((r) => r.landRecall!),
    score: avg((r) => r.score!),
    selfScore: avg((r) => r.selfScore!, both),
    refAhead: avg((r) => (r.selfScore! >= r.score! ? 1 : 0), both),
    lands: avg((r) => r.ours!.lands),
    refLands: avg((r) => r.ref.lands),
    avgMv: avg((r) => r.ours!.avgMv),
    refAvgMv: avg((r) => r.ref.avgMv),
    creatureShare: avg((r) => r.ours!.creatures / Math.max(1, r.ours!.spells)),
    refCreatureShare: avg((r) => r.ref.creatures / Math.max(1, r.ref.spells)),
    strength: avg((r) => r.strength!),
    refStrength: avg((r) => r.refStrength),
    rank: Math.round(median(built.map((r) => r.rank!))),
    refRank: Math.round(median(built.map((r) => r.refRank))),
    roleDelta,
    ms: Math.round(mean(rows.map((r) => r.ms))),
  };
}

function previous(options: string): Results | undefined {
  if (!existsSync(CORPUS_RESULTS)) return undefined;
  let best: Results | undefined;
  for (const f of readdirSync(CORPUS_RESULTS).filter((x) => x.endsWith('.json'))) {
    try {
      const r = JSON.parse(readFileSync(path.join(CORPUS_RESULTS, f), 'utf8')) as Results;
      if (r.options === options && (!best || r.runAt > best.runAt)) best = r;
    } catch {
      // A broken or partial file is not a baseline.
    }
  }
  return best;
}

const COLUMNS: [string, (s: SizeSummary) => number | string][] = [
  ['decks', (s) => s.decks],
  ['fail', (s) => s.failed],
  ['self fail', (s) => s.selfFailed],
  ['recall', (s) => s.recall],
  ['land recall', (s) => s.landRecall],
  ['themed', (s) => s.themed],
  ['style match', (s) => s.styleMatch],
  ['score', (s) => s.score],
  ['ref score', (s) => s.selfScore],
  ['ref ahead', (s) => s.refAhead],
  ['lands', (s) => `${s.lands}/${s.refLands}`],
  ['avg mv', (s) => `${s.avgMv}/${s.refAvgMv}`],
  ['creatures', (s) => `${s.creatureShare}/${s.refCreatureShare}`],
  ['strength', (s) => `${s.strength}/${s.refStrength}`],
  ['rank', (s) => `${s.rank}/${s.refRank}`],
  ['ms', (s) => s.ms],
];

function printSummary(summary: Record<string, SizeSummary>, prev?: Results): void {
  console.log(
    "\nOurs/reference where a cell has two numbers. Recall: share of the deck's spells our build used.",
  );
  console.log(`| rows | ${COLUMNS.map(([h]) => h).join(' | ')} |`);
  console.log(`| --- | ${COLUMNS.map(() => '---:').join(' | ')} |`);
  for (const [key, s] of Object.entries(summary))
    console.log(`| ${key} | ${COLUMNS.map(([, f]) => f(s)).join(' | ')} |`);
  for (const [key, s] of Object.entries(summary)) {
    const deltas = Object.entries(s.roleDelta)
      .filter(([, d]) => Math.abs(d) >= 0.5)
      .map(([id, d]) => `${id} ${d > 0 ? '+' : ''}${d}`);
    if (deltas.length) console.log(`  ${key} roles, ours minus reference: ${deltas.join(', ')}`);
  }
  if (!prev) return;
  console.log(`\ndeltas against ${prev.runAt} (${prev.sha}${prev.dirty ? ', dirty' : ''}):`);
  for (const [key, s] of Object.entries(summary)) {
    const p = prev.summary[key];
    if (!p) continue;
    const d = (a: number, b: number) => `${a - b >= 0 ? '+' : ''}${round(a - b)}`;
    console.log(
      `  ${key}: recall ${d(s.recall, p.recall)}, style match ${d(s.styleMatch, p.styleMatch)}, self fail ${d(s.selfFailed, p.selfFailed)}, score ${d(s.score, p.score)}, ref ahead ${d(s.refAhead, p.refAhead)}, avg mv ${d(s.avgMv, p.avgMv)}, lands ${d(s.lands, p.lands)}`,
    );
  }
}

function main(): number {
  if (!existsSync(CORPUS_FILE)) {
    console.error('no corpus at data/corpus/decks.json; run npm run corpus:fetch first');
    return 1;
  }
  const sizes = (arg('sizes') ?? SIZES.join(',')).split(',').map(Number) as DeckSize[];
  const sources = new Set((arg('sources') ?? 'precon,draft,local').split(','));
  const since = arg('since') ?? '2015';
  const split = arg('split') ?? 'all';
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  const noiseCount = Number(arg('noise') ?? DEFAULT_NOISE);
  const noiseDir = arg('noise-dir');
  const options = JSON.stringify({
    sizes,
    sources: [...sources].sort(),
    since,
    split,
    limit,
    noiseCount,
    noiseDir,
  });

  const t0 = Date.now();
  const index = new CardIndex(
    parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8')),
  );
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const problems = validateConfig(config);
  if (problems.length) {
    console.error('config problems:', problems);
    return 1;
  }
  const settings = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  const corpus = loadCorpus();
  const source = noiseSource(index);
  let fixedNoise: [string, number][] | undefined;
  if (noiseDir) {
    const qty = new Map<string, number>();
    for (const f of readdirSync(noiseDir).filter(
      (x) => x.endsWith('.txt') && !x.startsWith('test_deck-'),
    )) {
      const rep = resolveLines(
        parseDecklist(readFileSync(path.join(noiseDir, f), 'utf8')).lines,
        index,
        { suggest: false },
      );
      for (const r of rep.resolved) qty.set(r.card.id, (qty.get(r.card.id) ?? 0) + r.line.qty);
    }
    fixedNoise = [...qty.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  console.log(
    `corpus ${corpus.decks.length} decks (data ${corpus.dataVersion}), config ${configVersion(config)}, loaded in ${Date.now() - t0} ms`,
  );

  const rows: EvalRow[] = [];
  const skipped = new Map<string, number>();
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);
  for (const size of sizes) {
    let decks = corpus.decks.filter(
      (d) =>
        d.size === size &&
        sources.has(d.source) &&
        (!d.released || d.released.slice(0, 4) >= since) &&
        (split === 'all' || splitOf(d.id) === split),
    );
    decks.sort((a, b) => hash32(a.id) - hash32(b.id) || (a.id < b.id ? -1 : 1));
    const cap =
      limit ?? (decks.some((d) => d.source === 'draft') ? DEFAULT_DRAFT_LIMIT : undefined);
    if (cap !== undefined) decks = decks.slice(0, cap);
    const tSize = Date.now();
    decks.forEach((deck, i) => {
      const row = evalDeck(deck, size);
      if (typeof row === 'string') skip(`${size}: ${row}`);
      else rows.push(row);
      if ((i + 1) % 25 === 0 || i === decks.length - 1) {
        const per = (Date.now() - tSize) / (i + 1);
        console.log(
          `  ${size}: ${i + 1}/${decks.length} decks, ${(per / 1000).toFixed(1)} s each, about ${Math.ceil((per * (decks.length - i - 1)) / 60000)} min left`,
        );
      }
    });
  }

  function evalDeck(deck: CorpusDeck, size: DeckSize): EvalRow | string {
    const refCards = recordsOf(index, deck.cards);
    let commander: CardRecord | undefined;
    if (size === 100) {
      if (deck.commander?.length !== 1) return 'partner or missing commander';
      commander = index.get(deck.commander[0]!);
      if (!commander || !canBeCommander(commander)) return 'commander not supported';
      if (commander.identity.length === 0) return 'colorless commander';
    }
    const colors = commander ? commander.identity : deckColors(refCards, index, config);
    if (colors.length === 0) return 'colorless deck';
    const lead: [string, number][] = commander ? [[commander.id, 1]] : [];
    const noise = fixedNoise ?? noisePool(source, hash32(`noise:${deck.id}`), noiseCount);
    const request: BuildRequest = {
      size,
      colors,
      settings,
      id: deck.id,
      createdAt: 'corpus',
      ...(commander ? { commander: commander.id } : {}),
    };
    const t = Date.now();
    const attempt = (lists: [string, number][][]): BuildResult | string => {
      try {
        return buildDeck(request, poolOf(...lists), index, config);
      } catch (err) {
        if (err instanceof BuildError) return err.message;
        throw err;
      }
    };
    const mixed = attempt([noise, deck.cards, lead]);
    const self = attempt([deck.cards, lead]);
    const ref = shapeOf(refCards, index, config);
    const refS = spellStats(refCards, index, config);
    const row: EvalRow = {
      id: deck.id,
      size,
      kind: deck.kind,
      split: splitOf(deck.id),
      ok: typeof mixed !== 'string',
      selfOk: typeof self !== 'string',
      ref,
      refStyles: stylesMet(refCards, size, index, config),
      refStrength: refS.strength,
      refRank: refS.rank,
      ms: Date.now() - t,
    };
    if (typeof self === 'string') row.selfError = self;
    else row.selfScore = self.explanation.score?.total ?? NaN;
    if (typeof mixed === 'string') {
      row.error = mixed;
      return row;
    }
    const built: [CardRecord, number][] = [];
    for (const dc of mixed.deck.cards) {
      const card = index.get(dc.cardId);
      if (card && dc.cardId !== commander?.id) built.push([card, dc.qty]);
    }
    for (const [name, qty] of Object.entries(mixed.deck.basics)) {
      const card = index.find(BASIC_NAMES[name] ?? name);
      if (card && qty) built.push([card, qty]);
    }
    const builtIds = new Set(built.map(([c]) => c.id));
    const refSpells = refCards.filter(([c]) => factsFor(index, config, c).spell).map(([c]) => c.id);
    const refLands = refCards
      .filter(([c]) => {
        const f = factsFor(index, config, c);
        return !f.spell && !f.basic;
      })
      .map(([c]) => c.id);
    const share = (ids: string[]) =>
      ids.length ? round(ids.filter((id) => builtIds.has(id)).length / ids.length, 3) : 1;
    const ourS = spellStats(built, index, config);
    Object.assign(row, {
      style: mixed.deck.archetype,
      score: mixed.explanation.score?.total ?? NaN,
      styleMatch: row.refStyles.length ? row.refStyles.includes(mixed.deck.archetype) : undefined,
      recall: share(refSpells),
      landRecall: share(refLands),
      ours: shapeOf(built, index, config),
      strength: ourS.strength,
      rank: ourS.rank,
    });
    return row;
  }

  const summary: Record<string, SizeSummary> = {};
  for (const size of sizes) {
    const forSize = rows.filter((r) => r.size === size);
    if (forSize.length === 0) continue;
    summary[`${size} all`] = summarize(forSize);
    for (const s of ['train', 'test'] as const) {
      const part = forSize.filter((r) => r.split === s);
      if (part.length) summary[`${size} ${s}`] = summarize(part);
    }
  }
  const prev = previous(options);
  printSummary(summary, prev);
  if (skipped.size)
    console.log(`\nskipped: ${[...skipped.entries()].map(([k, v]) => `${k} (${v})`).join('; ')}`);

  const sha = git(['rev-parse', '--short', 'HEAD']) ?? 'nogit';
  const dirty = (git(['status', '--porcelain']) ?? '').length > 0;
  const results: Results = {
    runAt: new Date().toISOString(),
    sha,
    dirty,
    dataVersion: index.dataVersion,
    configVersion: configVersion(config),
    options,
    summary,
    rows,
  };
  mkdirSync(CORPUS_RESULTS, { recursive: true });
  const base = `${results.runAt.slice(0, 10)}-${sha}${dirty ? '-dirty' : ''}`;
  let file = path.join(CORPUS_RESULTS, `${base}.json`);
  for (let n = 2; existsSync(file); n++) file = path.join(CORPUS_RESULTS, `${base}-${n}.json`);
  writeFileSync(file, JSON.stringify(results));
  console.log(
    `\nwrote ${path.relative(ROOT, file)} (${rows.length} decks, ${Math.round((Date.now() - t0) / 60000)} min)`,
  );
  return 0;
}

/** Deck basics are keyed by color letter. */
const BASIC_NAMES: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
  C: 'Wastes',
};

process.exitCode = main();
