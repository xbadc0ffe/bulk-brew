// Runs the best-deck search for the Analyze pane off the main thread, so
// builds that take up to a second each never stall the Bulk List. One step
// at a time, giving each deck size equal time, until every size is done or
// the page pauses it.

import {
  BEST_DECK_SIZES,
  bestDeckSearch,
  CardIndex,
  type BestDeckSearch,
  type DeckSize,
} from '@bulk-brew/core';
import type { DepthUpdate, FromWorker, SizeUpdate, ToWorker } from './bestDecksProtocol.ts';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  postMessage(msg: FromWorker): void;
};

/** Progress goes out at most this often; new best decks at most every OPTIONS_EVERY_MS. */
const POST_EVERY_MS = 200;
const OPTIONS_EVERY_MS = 100;

interface Run {
  job: number;
  shown: number;
  searches: BestDeckSearch[];
  spent: Map<DeckSize, number>;
  errors: Map<DeckSize, string>;
  /** Sizes with news since the last post, and those whose best decks changed. */
  dirty: Set<DeckSize>;
  optionsDirty: Set<DeckSize>;
  /** The keys of the decks last sent per size, to skip changes below the ones shown. */
  sent: Map<DeckSize, string>;
  depth: DepthUpdate[];
  urgent: boolean;
  lastPost: number;
}

let run: Run | undefined;
let paused = true;
let timer: ReturnType<typeof setTimeout> | undefined;

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'start') {
    const { id, pack, pool, settings, config, shown } = msg.job;
    const index = new CardIndex(pack);
    run = {
      job: id,
      shown,
      searches: BEST_DECK_SIZES.map((size) => bestDeckSearch(size, pool, index, config, settings)),
      spent: new Map(),
      errors: new Map(),
      dirty: new Set(),
      optionsDirty: new Set(),
      sent: new Map(),
      depth: [],
      urgent: false,
      lastPost: 0,
    };
    paused = false;
  } else {
    paused = msg.type === 'pause';
    // Send what is pending, so a pause never holds back a change.
    if (paused && run && run.dirty.size > 0) flush(run, true);
  }
  schedule();
};

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  // A timer between steps lets pause and new jobs arrive.
  if (!paused && run) timer = setTimeout(tick, 0);
}

function tick(): void {
  timer = undefined;
  const r = run;
  if (!r || paused) return;
  const live = r.searches.filter((s) => !s.state().done && !r.errors.has(s.size));
  if (live.length === 0) return;
  // Equal time per size: the one that has had the least goes next.
  const spent = (s: BestDeckSearch) => r.spent.get(s.size) ?? 0;
  const next = live.reduce((a, b) => (spent(b) < spent(a) ? b : a));
  const t0 = performance.now();
  try {
    const step = next.step();
    if (!step || step.kind === 'planned') r.urgent = true;
    else if (step.kind === 'built' && step.changed) {
      const keys = shownKeys(next, r.shown);
      if (keys !== r.sent.get(next.size)) r.optionsDirty.add(next.size);
    } else if (step.kind === 'scan' && step.colors.length <= 2) {
      r.depth.push({
        key: step.colors.join(''),
        size: next.size,
        spells: step.scan.candidates,
        possible: step.scan.possible,
      });
    }
  } catch (err) {
    r.errors.set(next.size, String(err));
    r.urgent = true;
  }
  r.spent.set(next.size, spent(next) + performance.now() - t0);
  r.dirty.add(next.size);
  flush(r, false);
  schedule();
}

/** The keys of the decks shown for every color limit, as one string. */
function shownKeys(s: BestDeckSearch, shown: number): string {
  return s
    .state()
    .options.map((list) =>
      list
        .slice(0, shown)
        .map((o) => o.key)
        .join(','),
    )
    .join('|');
}

function flush(r: Run, force: boolean): void {
  const now = performance.now();
  const since = now - r.lastPost;
  const finished = r.searches.every((s) => s.state().done || r.errors.has(s.size));
  const due =
    force ||
    finished ||
    r.urgent ||
    since >= POST_EVERY_MS ||
    (r.optionsDirty.size > 0 && since >= OPTIONS_EVERY_MS);
  if (!due) return;
  const sizes: Partial<Record<DeckSize, SizeUpdate>> = {};
  for (const s of r.searches) {
    if (!r.dirty.has(s.size)) continue;
    const st = s.state();
    const error = r.errors.get(s.size);
    sizes[s.size] = {
      planned: st.planned,
      built: st.built,
      done: st.done || error !== undefined,
      ...(st.commanders !== undefined ? { commanders: st.commanders } : {}),
      ...(r.optionsDirty.has(s.size)
        ? { options: st.options.map((list) => list.slice(0, r.shown)) }
        : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }
  for (const size of r.optionsDirty) {
    const s = r.searches.find((x) => x.size === size);
    if (s) r.sent.set(size, shownKeys(s, r.shown));
  }
  ctx.postMessage({ type: 'update', job: r.job, sizes, depth: r.depth });
  r.dirty.clear();
  r.optionsDirty.clear();
  r.depth = [];
  r.urgent = false;
  r.lastPost = now;
}
