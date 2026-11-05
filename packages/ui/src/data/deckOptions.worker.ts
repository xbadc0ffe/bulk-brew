// Builds the Build page's deck options off the main thread, as the Analyze
// pane's worker builds its best decks, so a build that takes up to a second
// never stalls the page. One scan or build per step, until the options are
// done, a new job arrives, or the page pauses it.

import {
  CardIndex,
  deckOptionSearch,
  LearnedCards,
  type BulkBrewConfig,
  type DeckOptionSearch,
  type Pool,
  type ScanReport,
} from '@bulk-brew/core';
import type { FromWorker, ToWorker } from './deckOptionsProtocol.ts';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  postMessage(msg: FromWorker): void;
};

let data: { index: CardIndex; pool: Pool; config: BulkBrewConfig } | undefined;
/** Scans by color letters for one scan key, kept across jobs so a style or color change does not rescan. */
let cache: { key: string; scans: Map<string, ScanReport> } | undefined;
let run: { job: number; search: DeckOptionSearch } | undefined;
let paused = true;
let timer: ReturnType<typeof setTimeout> | undefined;

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'data') {
    const { pack, learned, pool, config } = msg.data;
    const index = new CardIndex(pack);
    if (learned) index.learned = new LearnedCards(learned);
    data = { index, pool, config };
    cache = undefined;
    run = undefined;
  } else if (msg.type === 'start') {
    if (!data) return;
    const { id, request, scanKey } = msg.job;
    if (cache?.key !== scanKey) cache = { key: scanKey, scans: new Map() };
    run = {
      job: id,
      search: deckOptionSearch(request, data.pool, data.index, data.config, cache.scans),
    };
    paused = false;
  } else {
    paused = msg.type === 'pause';
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
  const st = r.search.state();
  try {
    const step = r.search.step();
    if (!step) {
      run = undefined;
      return;
    }
    if (step.kind === 'planned') {
      ctx.postMessage({
        type: 'update',
        job: r.job,
        plan: {
          scans: st.scans!,
          planned: step.planned,
          primaryUnavailable: st.primaryUnavailable,
        },
        built: 0,
      });
    } else if (step.kind === 'built') {
      ctx.postMessage({
        type: 'update',
        job: r.job,
        built: st.built,
        ...(step.changed ? { options: st.options } : {}),
        ...(st.failure !== undefined ? { failure: st.failure } : {}),
      });
    }
  } catch (err) {
    ctx.postMessage({ type: 'update', job: r.job, built: st.built, error: String(err) });
    run = undefined;
    return;
  }
  schedule();
}
