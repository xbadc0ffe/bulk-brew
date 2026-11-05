// Score the builder against the reference corpus. Each reference deck is
// shuffled into a seeded random bulk list and built at its own size (under
// its commander at 100, in the colors its pips ask for otherwise); the run measures how much
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
//        --rescore <file>       measure an earlier results file's builds again with the current
//                               styles (after a style change, so before and after compare fairly)
//
// Results go to data/corpus/results/<date>-<sha>.json; the summary shows
// deltas against the latest earlier run with the same options.
//
// Besides recall and shape, every run reports how the builder's plans compare
// with real decks: the style mix (share of builds per style next to the share
// of reference decks running it, with blockers flagged), profile distance
// (how far each build's makeup sits from real decks of its style), plan
// recall (share of the reference deck's theme cards the build used), and
// style match as decks gained and lost against the previous run.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BuildError,
  buildDeck,
  canBeCommander,
  CardIndex,
  configVersion,
  factsFor,
  manaCostsOf,
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
import { attachLearned } from './learned-data.ts';
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
import {
  bulkThemeShares,
  featuresOf,
  planKey,
  planOf,
  PlanProfiles,
  SHAPE,
  themeTests,
  type RefDeck,
} from './plans.ts';

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
  /** The style the reference deck runs most strongly over bulk, or "shape". */
  refPlan: string;
  /** Our build's style for the mix, with plain shapes folded into "shape". */
  mixStyle?: string;
  /** For a reference deck with no theme, the plain shape its curve is closest to. */
  refShape?: string;
  /** The plan our build runs by the same test as the reference decks. */
  builtPlan?: string;
  /** Share of the reference deck's distinct theme cards for its plan that our build used. */
  planRecall?: number;
  /** Profile distance of our build from real decks of its style, and of the reference deck from its plan's. */
  dist?: number;
  refDist?: number;
  coreDist?: number;
  refCoreDist?: number;
  /** Our build's cards, commander left out, basics included. */
  deck?: [string, number][];
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
  /** Mean share of the reference plan's theme cards our builds used (decks with a plan). */
  planRecall: number;
  /** Mean profile distance: our builds from their style's real decks, reference decks from their plan's. */
  dist: number;
  refDist: number;
  /** Distance over the features every plan shares (roles, curve, types), leaving the theme out. */
  coreDist: number;
  refCoreDist: number;
  /** Builds per style next to reference decks per plan (shapes folded into "shape"). */
  mix: Record<string, { builds: number; refs: number }>;
  /** The shape group split by shape. */
  shapes: Record<string, { builds: number; refs: number }>;
  /** Styles built far more often than real decks run them. */
  blockers: string[];
  ms: number;
}

interface Results {
  runAt: string;
  sha: string;
  dirty: boolean;
  dataVersion: string;
  configVersion: string;
  /** The earlier results file whose builds this run measured again. */
  rescoredFrom?: string;
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

/**
 * The colors a deck's spells must pay: every plain colored pip in their
 * costs, then one color of a hybrid card (the first in WUBRG order) only
 * when none of its colors is in yet. Counting a hybrid card as both colors
 * made mono decks two-colored.
 */
function deckColors(
  cards: [CardRecord, number][],
  index: CardIndex,
  config: ReturnType<typeof loadConfigDir>,
): Color[] {
  const spells = cards.map(([c]) => c).filter((c) => factsFor(index, config, c).spell);
  const set = new Set<Color>();
  for (const card of spells)
    for (const cost of manaCostsOf(card))
      for (const m of cost.matchAll(/\{([WUBRG])\}/g)) set.add(m[1] as Color);
  for (const card of spells) {
    if (card.colors.length > 0 && !card.colors.some((c) => set.has(c)))
      set.add(normalizeColors(card.colors)[0]!);
  }
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
    planRecall: avg(
      (r) => r.planRecall!,
      built.filter((r) => r.planRecall !== undefined),
    ),
    dist: avg(
      (r) => r.dist!,
      built.filter((r) => r.dist !== undefined && !Number.isNaN(r.dist)),
    ),
    refDist: avg(
      (r) => r.refDist!,
      rows.filter((r) => r.refDist !== undefined && !Number.isNaN(r.refDist)),
    ),
    coreDist: avg(
      (r) => r.coreDist!,
      built.filter((r) => r.coreDist !== undefined && !Number.isNaN(r.coreDist)),
    ),
    refCoreDist: avg(
      (r) => r.refCoreDist!,
      rows.filter((r) => r.refCoreDist !== undefined && !Number.isNaN(r.refCoreDist)),
    ),
    ...styleMix(rows),
    ms: Math.round(mean(rows.map((r) => r.ms))),
  };
}

/** A style built above this share of a size's decks is a blocker, unless real decks run it as often. */
const MAX_STYLE_SHARE = 0.25;
/** "As often": real decks run the style at least the build share over this. */
const AS_OFTEN = 1.2;
/** Nor may any style go above this multiple of its reference share, by more than noise. */
const MAX_REF_MULTIPLE = 1.5;

/**
 * Builds per style against reference decks per plan, over decks that built.
 * A blocker is any style, each plain shape on its own, above MAX_STYLE_SHARE
 * of builds, unless real decks run it about as often (a plain midrange deck
 * is a third of real 60-card decks), or any style (shapes as one group, since a deck with no theme
 * could be any of them) above MAX_REF_MULTIPLE times its reference share by
 * at least three decks and 2% of the size, so one or two decks of noise do
 * not count. `shapes` splits the shape group: builds by their shape, real
 * decks by the shape their curve is closest to.
 */
function styleMix(rows: EvalRow[]): Pick<SizeSummary, 'mix' | 'shapes' | 'blockers'> {
  const mix: Record<string, { builds: number; refs: number }> = {};
  const shapes: Record<string, { builds: number; refs: number }> = {};
  const slot = (t: typeof mix, k: string) => (t[k] ??= { builds: 0, refs: 0 });
  const built = rows.filter((r) => r.ok);
  for (const r of built) {
    slot(mix, r.refPlan).refs++;
    slot(mix, r.mixStyle ?? SHAPE).builds++;
    if (r.refShape) slot(shapes, r.refShape).refs++;
    if (r.mixStyle === SHAPE && r.style) slot(shapes, r.style).builds++;
  }
  const blockers: string[] = [];
  const n = Math.max(1, built.length);
  const own = new Map<string, number>();
  for (const r of built) own.set(r.style ?? SHAPE, (own.get(r.style ?? SHAPE) ?? 0) + 1);
  const realShare = (style: string) => ((shapes[style] ?? mix[style])?.refs ?? 0) / n;
  for (const [style, count] of [...own.entries()].sort())
    if (count / n > MAX_STYLE_SHARE && realShare(style) * AS_OFTEN < count / n)
      blockers.push(`${style} ${pct(count / n)} of builds, ${pct(realShare(style))} of real decks`);
  for (const [style, m] of Object.entries(mix).sort()) {
    const share = m.builds / n;
    const refShare = m.refs / n;
    const excess = m.builds - MAX_REF_MULTIPLE * m.refs;
    if (share > MAX_REF_MULTIPLE * refShare && excess >= Math.max(3, 0.02 * n))
      blockers.push(`${style} ${pct(share)} of builds, ${pct(refShare)} of real decks`);
  }
  return { mix, shapes, blockers };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
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
  ['plan recall', (s) => s.planRecall],
  ['distance', (s) => `${s.dist}/${s.refDist}`],
  ['core distance', (s) => `${s.coreDist}/${s.refCoreDist}`],
  ['blockers', (s) => s.blockers.length],
  ['strength', (s) => `${s.strength}/${s.refStrength}`],
  ['rank', (s) => `${s.rank}/${s.refRank}`],
  ['ms', (s) => s.ms],
];

function printSummary(summary: Record<string, SizeSummary>, rows: EvalRow[], prev?: Results): void {
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
  console.log('\nStyle mix: share of builds per style, then share of reference decks running it.');
  for (const [key, s] of Object.entries(summary)) {
    const built = Object.values(s.mix).reduce((a, m) => a + m.builds, 0) || 1;
    const refs = Object.values(s.mix).reduce((a, m) => a + m.refs, 0) || 1;
    const cells = Object.entries(s.mix)
      .sort((a, b) => b[1].builds - a[1].builds || b[1].refs - a[1].refs)
      .map(([k, m]) => `${k} ${pct(m.builds / built)}/${pct(m.refs / refs)}`);
    console.log(`  ${key}: ${cells.join(', ')}`);
    const sh = Object.entries(s.shapes ?? {})
      .sort()
      .map(([k, m]) => `${k} ${pct(m.builds / built)}/${pct(m.refs / refs)}`);
    if (sh.length) console.log(`    shapes: ${sh.join(', ')}`);
    if (s.blockers.length) console.log(`    BLOCKERS: ${s.blockers.join('; ')}`);
  }
  if (!prev) return;
  // Style match as a paired count: decks whose build gained or lost a style the deck meets.
  const before = new Map(prev.rows.map((r) => [`${r.size}:${r.id}`, r]));
  console.log(`\ndeltas against ${prev.runAt} (${prev.sha}${prev.dirty ? ', dirty' : ''}):`);
  for (const [key, s] of Object.entries(summary)) {
    const p = prev.summary[key];
    if (!p) continue;
    const d = (a: number, b: number) => `${a - b >= 0 ? '+' : ''}${round(a - b)}`;
    const [size, part] = key.split(' ');
    let gained = 0;
    let lost = 0;
    for (const r of rows) {
      if (String(r.size) !== size || (part !== 'all' && r.split !== part)) continue;
      const o = before.get(`${r.size}:${r.id}`);
      if (!o || o.styleMatch === undefined || r.styleMatch === undefined) continue;
      if (r.styleMatch && !o.styleMatch) gained++;
      if (!r.styleMatch && o.styleMatch) lost++;
    }
    console.log(
      `  ${key}: recall ${d(s.recall, p.recall)}, plan recall ${d(s.planRecall, p.planRecall ?? NaN)}, distance ${d(s.dist, p.dist ?? NaN)}, style match ${d(s.styleMatch, p.styleMatch)} (+${gained} -${lost} decks), self fail ${d(s.selfFailed, p.selfFailed)}, score ${d(s.score, p.score)}, avg mv ${d(s.avgMv, p.avgMv)}, lands ${d(s.lands, p.lands)}`,
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
  // The test split's commanders get no EDHREC commander data, so test decks stay unseen.
  const heldOut = new Set(
    corpus.decks
      .filter((d) => d.size === 100 && splitOf(d.id) === 'test')
      .flatMap((d) => d.commander ?? []),
  );
  const learnedVersion = attachLearned(index, heldOut);
  const source = noiseSource(index);
  const bulk = bulkThemeShares(index, config, source);
  const refCardsOf = new Map<string, [CardRecord, number][]>();
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
    `corpus ${corpus.decks.length} decks (data ${corpus.dataVersion}), config ${configVersion(config)}, learned ${learnedVersion ?? 'none'}, loaded in ${Date.now() - t0} ms`,
  );

  const rows: EvalRow[] = [];
  const skipped = new Map<string, number>();
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);
  // --rescore <results.json>: measure an earlier run's builds again with the current styles.
  const rescoreFile = arg('rescore');
  let rescored: Results | undefined;
  if (rescoreFile) {
    rescored = JSON.parse(readFileSync(rescoreFile, 'utf8')) as Results;
    const byKey = new Map(corpus.decks.map((d) => [`${d.size}:${d.id}`, d]));
    sizes.splice(0, sizes.length, ...SIZES.filter((s) => rescored!.rows.some((r) => r.size === s)));
    for (const r of rescored.rows) {
      const deck = byKey.get(`${r.size}:${r.id}`);
      if (!deck) continue;
      const refCards = recordsOf(index, deck.cards);
      const commander =
        r.size === 100 && deck.commander ? index.get(deck.commander[0]!) : undefined;
      refCardsOf.set(`${r.size}:${r.id}`, refCards);
      r.refStyles = stylesMet(refCards, r.size, index, config, commander);
      const plan = planOf(refCards, r.size, index, config, bulk, commander);
      r.refPlan = plan.plan;
      if (plan.shape) r.refShape = plan.shape;
      else delete r.refShape;
      delete r.planRecall;
      delete r.styleMatch;
      if (r.ok && r.style) {
        r.mixStyle = planKey(config, r.style);
        if (r.refStyles.length) r.styleMatch = r.refStyles.includes(r.style);
        const tests = themeTests(r.refPlan);
        const ids = tests
          ? refCards
              .filter(([c]) => {
                const f = factsFor(index, config, c);
                return f.spell && (tests.enabler(f) || tests.payoff(f));
              })
              .map(([c]) => c.id)
          : [];
        const built = new Set((r.deck ?? []).map(([id]) => id));
        if (ids.length)
          r.planRecall = round(ids.filter((id) => built.has(id)).length / ids.length, 3);
      }
      rows.push(r);
    }
  }
  for (const size of rescored ? [] : sizes) {
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
    const refPlan = planOf(refCards, size, index, config, bulk, commander);
    refCardsOf.set(`${size}:${deck.id}`, refCards);
    const row: EvalRow = {
      id: deck.id,
      size,
      kind: deck.kind,
      split: splitOf(deck.id),
      ok: typeof mixed !== 'string',
      selfOk: typeof self !== 'string',
      ref,
      refStyles: stylesMet(refCards, size, index, config, commander),
      refPlan: refPlan.plan,
      ...(refPlan.shape ? { refShape: refPlan.shape } : {}),
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
    const tests = themeTests(refPlan.plan);
    const planCards = tests
      ? refCards
          .filter(([c]) => {
            const f = factsFor(index, config, c);
            return f.spell && (tests.enabler(f) || tests.payoff(f));
          })
          .map(([c]) => c.id)
      : [];
    if (planCards.length) row.planRecall = share(planCards);
    row.deck = built.map(([c, q]) => [c.id, q]);
    row.mixStyle = planKey(config, mixed.deck.archetype);
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

  // Profile distance: each build against real decks of its style, each reference deck against its plan's.
  for (const size of sizes) {
    const forSize = rows.filter((r) => r.size === size);
    if (forSize.length === 0) continue;
    const refs: RefDeck[] = forSize.map((r) => ({
      cards: refCardsOf.get(`${size}:${r.id}`)!,
      plan: { plan: r.refPlan, met: r.refStyles },
    }));
    const profiles = new PlanProfiles(refs, size, index, config);
    const byKey = new Map(corpus.decks.map((d) => [`${d.size}:${d.id}`, d]));
    forSize.forEach((r, i) => {
      const own = featuresOf(refs[i]!.cards, size, r.refPlan, index, config);
      r.refDist = round(profiles.distance(own, r.refPlan, { leaveOut: i }), 3);
      r.refCoreDist = round(profiles.distance(own, r.refPlan, { leaveOut: i, core: true }), 3);
      if (!r.ok || !r.deck || !r.mixStyle) return;
      const ours = recordsOf(index, r.deck);
      const f = featuresOf(ours, size, r.mixStyle, index, config);
      r.dist = round(profiles.distance(f, r.mixStyle), 3);
      r.coreDist = round(profiles.distance(f, r.mixStyle, { core: true }), 3);
      const deck = byKey.get(`${size}:${r.id}`);
      const commander = size === 100 && deck?.commander ? index.get(deck.commander[0]!) : undefined;
      r.builtPlan = planOf(ours, size, index, config, bulk, commander).plan;
    });
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
  const runOptions = rescored ? rescored.options : options;
  // A rescore compares with the run it measured again; a new run with the latest earlier one.
  const prev = rescored ? undefined : previous(runOptions);
  printSummary(summary, rows, prev);
  if (skipped.size)
    console.log(`\nskipped: ${[...skipped.entries()].map(([k, v]) => `${k} (${v})`).join('; ')}`);

  const sha = git(['rev-parse', '--short', 'HEAD']) ?? 'nogit';
  const dirty = (git(['status', '--porcelain']) ?? '').length > 0;
  const results: Results = {
    runAt: new Date().toISOString(),
    sha: rescored ? rescored.sha : sha,
    dirty: rescored ? rescored.dirty : dirty,
    dataVersion: index.dataVersion,
    configVersion: configVersion(config),
    ...(rescoreFile ? { rescoredFrom: path.basename(rescoreFile) } : {}),
    options: runOptions,
    summary,
    rows,
  };
  mkdirSync(CORPUS_RESULTS, { recursive: true });
  const base = rescoreFile
    ? `${path.basename(rescoreFile, '.json')}-rescored`
    : `${results.runAt.slice(0, 10)}-${sha}${dirty ? '-dirty' : ''}`;
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
