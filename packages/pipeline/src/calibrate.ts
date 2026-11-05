// Calibrate best fit's plan choice on the corpus train split: each train
// deck is shuffled into random bulk as corpus:eval does, its pool's plans are
// scored (plan.ts), and a weight per plan is fitted so that over all those
// pools each plan is picked about as often as real decks run it, without any
// style above the style-mix limits. The weights land in
// config/learned/plans.json as `bias`.

import {
  bestFitCandidates,
  canBeCommander,
  commanderPull,
  commanderTribes,
  listCandidates,
  planGroup,
  planScores,
  scanCandidates,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type DeckSize,
  type Rarity,
  type Settings,
  type SynergyArchetype,
} from '@bulk-brew/core';
import { deckColors, hash32, noisePool, poolOf, recordsOf, type CorpusDeck } from './corpus.ts';
import { planOf, SHAPE, type BulkShares } from './plans.ts';

const SHAPES = ['aggro', 'midrange', 'control'];

export interface CalibrationCase {
  /** The plan the reference deck runs: a style, a tribe, or a shape id. */
  ref: string;
  /** Whether the reference deck runs a theme. */
  themed: boolean;
  /** Plan scores without weights. */
  scores: { style: string; score: number }[];
}

/** One case per deck: its pool (deck plus seeded bulk, as corpus:eval builds it) and its plans. */
export function calibrationCases(
  decks: readonly CorpusDeck[],
  size: DeckSize,
  index: CardIndex,
  config: BulkBrewConfig,
  yard: BulkBrewConfig,
  bulk: BulkShares,
  source: Map<Rarity, CardRecord[]>,
  settings: Settings,
): CalibrationCase[] {
  // Scores without weights: the weights are what this fits.
  const block = config.learned!.plans.sizes[String(size) as '100'];
  const raw: BulkBrewConfig = {
    ...config,
    learned: {
      ...config.learned!,
      plans: {
        ...config.learned!.plans,
        sizes: {
          ...config.learned!.plans.sizes,
          [String(size)]: { ...block!, bias: {}, biasNoCommander: {} },
        },
      },
    },
  };
  const out: CalibrationCase[] = [];
  for (const deck of decks) {
    const refCards = recordsOf(index, deck.cards);
    let commander: CardRecord | undefined;
    if (size === 100) {
      if (deck.commander?.length !== 1) continue;
      commander = index.get(deck.commander[0]!);
      if (!commander || !canBeCommander(commander) || commander.identity.length === 0) continue;
    }
    const colors = commander ? commander.identity : deckColors(refCards, index, yard);
    if (colors.length === 0) continue;
    const ref = planOf(refCards, size, index, yard, bulk, commander);
    const pool = poolOf(
      noisePool(source, hash32(`noise:${deck.id}`), 3000),
      deck.cards,
      commander ? [[commander.id, 1]] : [],
    );
    const cands = listCandidates(pool, index, raw, settings, colors, size).filter(
      (c) => c.facts.card.id !== commander?.id,
    );
    const scan = scanCandidates(cands, raw, settings, size, colors);
    if (!scan.possible) continue;
    const tribes = commander ? commanderTribes(commander, cands, raw, size) : [];
    const tryList = [
      ...tribes.filter((t) => t.viable).map((t) => t.archetype),
      ...bestFitCandidates(scan, raw),
    ];
    const pull = commander
      ? commanderPull(tryList, commander, cands, index, raw, size)
      : new Map<string, number>();
    const scores = planScores(
      tryList.filter((a): a is SynergyArchetype => a.kind === 'synergy'),
      tryList.filter((a) => a.kind === 'composition'),
      cands,
      raw,
      index,
      size,
      commander,
      pull,
    ).map((p) => ({ style: p.style, score: p.score }));
    if (scores.length === 0) continue;
    out.push({
      ref: ref.plan === SHAPE ? (ref.shape ?? 'midrange') : ref.plan,
      themed: ref.plan !== SHAPE,
      scores,
    });
  }
  return out;
}

/**
 * Limits a little inside corpus:eval's (25% of builds, 1.2 times as often,
 * 1.5 times the real share), so a sample of other decks does not cross them.
 */
const MAX_SHARE = 0.22;
const AS_OFTEN = 1.1;
const MAX_MULTIPLE = 1.3;
/** How much matching the real shares counts against picking themed decks' own plans. */
const GAP_WEIGHT = 0.1;

interface Outcome {
  /** Builds beyond the style-mix limits, in decks. */
  over: number;
  /** Sum over plans of the gap between pick and real shares. */
  gap: number;
  /** Share of themed decks whose plan was picked. */
  themedHit: number;
  picks: Map<string, number>;
  refs: Map<string, number>;
}

/** Pick each case's plan with the given weights and count it the way corpus:eval's style mix does. */
function outcome(cases: readonly CalibrationCase[], bias: ReadonlyMap<string, number>): Outcome {
  const picks = new Map<string, number>();
  const refs = new Map<string, number>();
  let themed = 0;
  let hit = 0;
  for (const c of cases) {
    let best = c.scores[0]!.style;
    let bestScore = -Infinity;
    for (const s of c.scores) {
      const v = s.score + (bias.get(planGroup(s.style)) ?? 0);
      if (v > bestScore + 1e-12) {
        best = s.style;
        bestScore = v;
      }
    }
    picks.set(planGroup(best), (picks.get(planGroup(best)) ?? 0) + 1);
    refs.set(planGroup(c.ref), (refs.get(planGroup(c.ref)) ?? 0) + 1);
    if (c.themed) {
      themed++;
      if (best === c.ref) hit++;
    }
  }
  const n = cases.length;
  let over = 0;
  for (const [k, b] of picks) {
    const r = refs.get(k) ?? 0;
    if (b > MAX_SHARE * n && b > AS_OFTEN * r) over += b - Math.max(MAX_SHARE * n, AS_OFTEN * r);
  }
  let gap = 0;
  for (const k of new Set([...picks.keys(), ...refs.keys()]))
    gap += Math.abs((picks.get(k) ?? 0) - (refs.get(k) ?? 0)) / Math.max(1, n);
  const fold = (k: string) => (SHAPES.includes(k) ? SHAPE : k);
  const fp = new Map<string, number>();
  const fr = new Map<string, number>();
  for (const [k, b] of picks) fp.set(fold(k), (fp.get(fold(k)) ?? 0) + b);
  for (const [k, r] of refs) fr.set(fold(k), (fr.get(fold(k)) ?? 0) + r);
  for (const [k, b] of fp) {
    const r = fr.get(k) ?? 0;
    if (b > MAX_MULTIPLE * r && b - MAX_MULTIPLE * r >= Math.max(3, 0.02 * n))
      over += b - MAX_MULTIPLE * r;
  }
  return { over, gap, themedHit: hit / Math.max(1, themed), picks, refs };
}

/**
 * Weights that make each plan's share of picks close to its share of real
 * decks: damped steps toward matching the shares, keeping the round with the
 * fewest builds over the style-mix limits, then the best mix of themed decks
 * whose plan was picked and shares close to the real ones. Weights are
 * rounded and sorted so the file is stable.
 */
export function calibrate(cases: readonly CalibrationCase[]): {
  bias: Record<string, number>;
  over: number;
  themedHit: number;
} {
  let bias = new Map<string, number>();
  const value = (x: Outcome) => x.themedHit - GAP_WEIGHT * x.gap;
  let best = { ...outcome(cases, bias), bias };
  for (let round = 0; round < 150; round++) {
    const o = outcome(cases, bias);
    if (
      o.over < best.over - 1e-9 ||
      (Math.abs(o.over - best.over) < 1e-9 && value(o) > value(best) + 1e-9)
    )
      best = { ...o, bias: new Map(bias) };
    const next = new Map(bias);
    for (const k of [...new Set([...o.picks.keys(), ...o.refs.keys()])].sort()) {
      const want = Math.max(0.5, o.refs.get(k) ?? 0);
      const got = Math.max(0.5, o.picks.get(k) ?? 0);
      next.set(k, (bias.get(k) ?? 0) + 0.3 * Math.log(want / got));
    }
    bias = next;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of [...best.bias.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    out[k] = Math.round(v * 100) / 100;
  // Rounding can move a pick; report the rounded weights' own outcome.
  const final = outcome(cases, new Map(Object.entries(out)));
  return { bias: out, over: final.over, themedHit: final.themedHit };
}
