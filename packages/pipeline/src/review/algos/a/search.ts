// The a-search variant of prototype A' (docs/review/proto-a.md): the same
// honest objective, searched differently. Decks compare tier by tier (plan
// health, then curve, type mix, and roles, then strength and learned terms),
// so no amount of card strength buys a plan or a role. Moves: single swaps
// that try the same mana value or the same job first; a package move that
// takes a payoff out with the setup only it needed and refills; and, when
// nothing improves, a few sideways moves that tabu memory keeps from undoing.
// Every loop runs in card id order; there is no randomness.

import type { Candidate } from '@bulk-brew/core';
import {
  addCand,
  addOne,
  canAdd,
  colorsAtMinimum,
  colorsOk,
  describeWhy,
  fillAll,
  gateOk,
  guardOk,
  jobFor,
  learnedGain,
  planParts,
  remaining,
  removeOne,
  tally,
  tiersOf,
  type Chosen,
  type Ctx,
  type PickKind,
  type State,
  type Tiers,
} from './builder.ts';
import { copyThemeTally, addJob } from './theme.ts';

/** Fixed caps, so a build costs about as much on every pool and never depends on the clock. */
export const SEARCH_CAPS = {
  /** Moves of any kind. */
  moves: 200,
  /** Candidate decks scored, summed over every move tried. */
  evaluations: 10_000,
  /** Payoffs a package move tries each time single swaps stall. */
  packageTries: 2,
  /** Sideways moves, when nothing improves. */
  sideways: 2,
  /** Cards swapped in or out most recently, which no move may touch. */
  tabu: 8,
};

const EPS = 1e-9;

/** Positive when a beats b: plan, then shape, then value. */
export function compareTiers(a: Tiers, b: Tiers): number {
  if (Math.abs(a.plan - b.plan) > EPS) return a.plan - b.plan;
  if (Math.abs(a.shape - b.shape) > EPS) return a.shape - b.shape;
  if (Math.abs(a.value - b.value) > EPS) return a.value - b.value;
  return 0;
}

function tiersNow(state: State, ctx: Ctx): Tiers {
  return tiersOf(tally(state, ctx), state.slots, ctx);
}

interface Snapshot {
  slots: number;
  chosen: [string, Chosen][];
  order: State['order'];
}

function snapshot(state: State): Snapshot {
  return {
    slots: state.slots,
    chosen: [...state.chosen].map(([id, c]) => [id, { ...c }]),
    order: state.order.map((p) => ({ ...p })),
  };
}

function restore(state: State, s: Snapshot): void {
  state.slots = s.slots;
  state.chosen = new Map(s.chosen.map(([id, c]) => [id, { ...c }]));
  state.order = s.order.map((p) => ({ ...p }));
}

class Tabu {
  private list: string[] = [];
  private size: number;
  constructor(size: number) {
    this.size = size;
  }
  has(id: string): boolean {
    return this.list.includes(id);
  }
  push(...ids: string[]): void {
    for (const id of ids) {
      this.list.push(id);
      if (this.list.length > this.size) this.list.shift();
    }
  }
}

/** Whether two cards share a job: a theme side, or a role. */
function sameJob(ctx: Ctx, a: Candidate, b: Candidate): boolean {
  const ja = jobFor(ctx, a.facts.card.id);
  const jb = jobFor(ctx, b.facts.card.id);
  if (ja && jb && ja.as === jb.as) return true;
  return a.facts.roles.some((r) => b.facts.roles.includes(r));
}

type Hood = { near: Candidate[]; far: Candidate[] };

/** Candidates for one outgoing card: same mana value or same job first, each part in id order. */
function neighbourhood(ctx: Ctx, out: Candidate, cache: Map<string, Hood>): Hood {
  const id = out.facts.card.id;
  let hood = cache.get(id);
  if (hood) return hood;
  const bucket = Math.max(1, out.facts.bucket);
  hood = { near: [], far: [] };
  for (const c of ctx.spells) {
    if (Math.max(1, c.facts.bucket) === bucket || sameJob(ctx, out, c)) hood.near.push(c);
    else hood.far.push(c);
  }
  cache.set(id, hood);
  return hood;
}

interface Counter {
  evaluations: number;
  hoods: Map<string, Hood>;
}

interface Move {
  inCand: Candidate;
  outId: string;
  tiers: Tiers;
}

/** Chosen card ids in id order, starting just after `after` and wrapping round. */
function cycleFrom(state: State, after: string | undefined): string[] {
  const ids = [...state.chosen.keys()].sort();
  const at = after === undefined ? 0 : ids.findIndex((id) => id > after);
  return at <= 0 ? ids : [...ids.slice(at), ...ids.slice(0, at)];
}

/**
 * One single swap. 'improve' takes the first swap that beats `cur`, nearby
 * candidates first, going round the deck from just after the last card moved
 * as the copy's passes do. 'sideways' looks only nearby and takes the best
 * swap that keeps plan and shape and loses the least value.
 */
function swapMove(
  state: State,
  ctx: Ctx,
  cur: Tiers,
  tabu: Tabu,
  count: Counter,
  mode: 'improve' | 'sideways',
  after: string | undefined,
): Move | undefined {
  const h = ctx.honest;
  let sideways: Move | undefined;
  for (const outId of cycleFrom(state, after)) {
    if (tabu.has(outId) || !state.chosen.has(outId)) continue;
    if (count.evaluations >= SEARCH_CAPS.evaluations) break;
    const out = state.chosen.get(outId)!;
    const { cand: outCand, why: outWhy } = out;
    const outKind: PickKind = removeOne(state, outId)?.kind ?? 'swap';
    const base = tally(state, ctx);
    const held = colorsAtMinimum(state, ctx);
    let before;
    if (h) {
      const full = copyThemeTally(base.th);
      addJob(full, h.jobs.get(outId), 1);
      before = planParts(full, h.spec);
    }
    const { near, far } = neighbourhood(ctx, outCand, count.hoods);
    const lists = mode === 'improve' ? [near, far] : [near];
    let found: Move | undefined;
    for (const list of lists) {
      for (const cand of list) {
        const inId = cand.facts.card.id;
        if (inId === outId || tabu.has(inId) || remaining(state, cand) <= 0) continue;
        if (!canAdd(state, ctx, cand, base) || !gateOk(ctx, base, cand)) continue;
        if (!colorsOk(held, outCand, cand)) continue;
        if (count.evaluations >= SEARCH_CAPS.evaluations) break;
        count.evaluations++;
        addCand(base, ctx, cand, 1);
        const keep = !h || guardOk(before!, planParts(base.th, h.spec));
        let tiers: Tiers | undefined;
        if (keep) {
          tiers = tiersOf(base, state.slots, ctx);
          tiers.value += learnedGain(ctx, base, inId, state.slots);
        }
        addCand(base, ctx, cand, -1);
        if (!tiers) continue;
        if (mode === 'improve') {
          if (compareTiers(tiers, cur) > 0) {
            found = { inCand: cand, outId, tiers };
            break;
          }
        } else if (
          tiers.plan >= cur.plan - EPS &&
          tiers.shape >= cur.shape - EPS &&
          (!sideways || compareTiers(tiers, sideways.tiers) > 0)
        ) {
          sideways = { inCand: cand, outId, tiers };
        }
      }
      if (found) break;
    }
    if (found) {
      addOne(state, found.inCand, describeWhy(found.inCand, ctx), 'swap');
      return found;
    }
    // Nothing taken from this card: it goes back, at the end of the pick order as before.
    addOne(state, outCand, outWhy, outKind);
  }
  if (sideways) {
    removeOne(state, sideways.outId);
    addOne(state, sideways.inCand, describeWhy(sideways.inCand, ctx), 'swap');
  }
  return sideways;
}

/**
 * Take one payoff out with the setup only it needed (the setup the rest of
 * the payoffs and the floors do not), refill through the gated passes with
 * those cards held out, and keep the result when it beats `cur`.
 */
function packageMove(
  state: State,
  ctx: Ctx,
  cur: Tiers,
  tabu: Tabu,
  count: Counter,
): { tiers: Tiers; touched: string[] } | undefined {
  const h = ctx.honest;
  if (!h) return undefined;
  // The weakest payoffs first, and only a few: each try is a full gated refill.
  const payoffs = [...state.chosen.values()]
    .map(({ cand }) => cand)
    .filter((c) => h.jobs.get(c.facts.card.id)?.as === 'payoff' && !tabu.has(c.facts.card.id))
    .sort(
      (a, b) => a.facts.strength - b.facts.strength || (a.facts.card.id < b.facts.card.id ? -1 : 1),
    )
    .slice(0, SEARCH_CAPS.packageTries)
    .map((c) => c.facts.card.id);
  for (const pid of payoffs) {
    if (count.evaluations >= SEARCH_CAPS.evaluations) break;
    const saved = snapshot(state);
    const shortBefore = colorsAtMinimum(state, ctx);
    removeOne(state, pid);
    const removed = [pid];
    // Setup worth least goes first; each must leave the floors and the balance where they were.
    const job = h.jobs.get(pid)!;
    let freed = h.spec.ratio * job.weight;
    const setup = [...state.chosen.values()]
      .filter(({ cand }) => h.jobs.get(cand.facts.card.id)?.as === 'setup')
      .map(({ cand }) => cand)
      .filter((c) => !tabu.has(c.facts.card.id))
      .sort(
        (a, b) =>
          a.facts.strength - b.facts.strength || (a.facts.card.id < b.facts.card.id ? -1 : 1),
      );
    for (const c of setup) {
      const w = h.jobs.get(c.facts.card.id)!.weight;
      if (w > freed + EPS) continue;
      const t = tally(state, ctx);
      const before = planParts(t.th, h.spec);
      addCand(t, ctx, c, -1);
      if (!guardOk(before, planParts(t.th, h.spec))) continue;
      removeOne(state, c.facts.card.id);
      removed.push(c.facts.card.id);
      freed -= w;
    }
    ctx.exclude = new Set(removed);
    fillAll(state, ctx);
    ctx.exclude = undefined;
    count.evaluations += ctx.spells.length;
    const tiers = tiersNow(state, ctx);
    // The refill must leave every color at the minimum it had.
    const lost = colorsAtMinimum(state, ctx).some((c) => !shortBefore.includes(c));
    if (!lost && compareTiers(tiers, cur) > 0) {
      const added = [...state.chosen.keys()].filter(
        (id) =>
          (state.chosen.get(id)?.qty ?? 0) > (saved.chosen.find(([x]) => x === id)?.[1].qty ?? 0),
      );
      return { tiers, touched: [...removed, ...added] };
    }
    restore(state, saved);
  }
  return undefined;
}

/** a-search: improve the deck in place; returns the moves kept. */
export function lexiSearch(state: State, ctx: Ctx): number {
  const tabu = new Tabu(SEARCH_CAPS.tabu);
  const count: Counter = { evaluations: 0, hoods: new Map() };
  let cur = tiersNow(state, ctx);
  let best = snapshot(state);
  let bestTiers = cur;
  let moves = 0;
  let sideways = 0;
  // The swap scan picks up after the last card it moved, so a move does not restart the round.
  let after: string | undefined;
  while (moves < SEARCH_CAPS.moves && count.evaluations < SEARCH_CAPS.evaluations) {
    const swap = swapMove(state, ctx, cur, tabu, count, 'improve', after);
    if (swap) {
      tabu.push(swap.outId, swap.inCand.facts.card.id);
      cur = swap.tiers;
      after = swap.outId;
    } else {
      const pack = packageMove(state, ctx, cur, tabu, count);
      if (pack) {
        tabu.push(...pack.touched);
        cur = pack.tiers;
      } else {
        if (sideways >= SEARCH_CAPS.sideways) break;
        const side = swapMove(state, ctx, cur, tabu, count, 'sideways', undefined);
        if (!side) break;
        sideways++;
        tabu.push(side.outId, side.inCand.facts.card.id);
        cur = side.tiers;
      }
    }
    moves++;
    if (compareTiers(cur, bestTiers) > 0) {
      best = snapshot(state);
      bestTiers = cur;
    }
  }
  // A sideways move that led nowhere is undone.
  if (compareTiers(bestTiers, cur) > 0) restore(state, best);
  return moves;
}
