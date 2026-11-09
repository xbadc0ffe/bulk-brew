import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Settings } from '@bulk-brew/core';
import { ROOT } from '../src/corpus.ts';
import { toOptionsRequest } from '../src/review/algos/head-web.ts';
import {
  buildReviewDeck,
  createContext,
  planJob,
  type ReviewJob,
  type RunContext,
} from '../src/review/build.ts';

describe('toOptionsRequest', () => {
  const settings: Settings = {
    maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
    unlimitedBasics: true,
    includeUnsets: false,
    showArt: false,
  };

  it('sends what the Build page sends: a secondary only with a primary', () => {
    expect(
      toOptionsRequest({ size: 60, colors: ['B'], secondary: 'tokens', seed: 2 }, settings),
    ).toEqual({ size: 60, colors: ['B'], settings });
    expect(
      toOptionsRequest(
        {
          size: 100,
          colors: ['B', 'G'],
          style: 'tribal:Elf',
          secondary: 'tokens',
          commander: 'lathril',
          seed: 1,
        },
        settings,
      ),
    ).toEqual({
      size: 100,
      colors: ['B', 'G'],
      settings,
      primary: 'tribal:Elf',
      secondary: 'tokens',
      commander: 'lathril',
    });
  });
});

// CI has no data pack (npm run check runs without data:pull), so these run only locally.
const PACK = path.join(ROOT, 'data', 'packs', 'cards.json');

describe.skipIf(!existsSync(PACK))('head-web on a public pool', () => {
  // In beforeAll, since a skipped suite's body still runs and the pack is missing in CI.
  let ctx: RunContext;
  beforeAll(() => {
    ctx = createContext({ force: true });
  });
  const job: ReviewJob = {
    version: 'head-web',
    pool: 'eval/pools/bulk-red.txt',
    colors: 'R',
    size: 60,
  };

  it('records the first web option as a 60-card deck', async () => {
    const { pool, request } = planJob(job, ctx);
    const r = await buildReviewDeck('head-web', pool, request, ctx);
    expect(r.error).toBeUndefined();
    let count = 0;
    for (const c of r.deck.cards) count += c.qty;
    for (const n of Object.values(r.deck.basics)) count += n ?? 0;
    expect(count).toBe(60);
    const web = (r.explanation as { web: { style: string; optionCount: number } }).web;
    expect(web.style).toBe(r.deck.archetype);
    expect(web.optionCount).toBeGreaterThan(0);
  }, 60_000);

  it('builds a requested style as head does', async () => {
    const styled = { ...job, style: 'artifacts' };
    const { pool, request } = planJob(styled, ctx);
    const web = await buildReviewDeck('head-web', pool, request, ctx);
    const head = await buildReviewDeck('head', pool, request, ctx);
    expect(web.error).toBeUndefined();
    expect(web.deck).toEqual(head.deck);
  }, 60_000);
});
