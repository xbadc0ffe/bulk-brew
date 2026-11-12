import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/corpus.ts';
import {
  buildReviewDeck,
  createContext,
  deckDifferences,
  deckFileName,
  parseColors,
  planJob,
  poolHash,
  runJob,
  type ReviewJob,
} from '../src/review/build.ts';
import type { ReviewDeck } from '../src/review/version.ts';

describe('deckFileName', () => {
  it('names a best fit deck by pool, colors, size, and seed', () => {
    expect(deckFileName('bulk-black', { size: 60, colors: ['B'], seed: 1 })).toBe(
      'bulk-black-B-60-bestfit-s1.json',
    );
  });

  it('adds the style and the secondary style, safe for Windows file names', () => {
    expect(
      deckFileName('p', {
        size: 40,
        colors: ['W', 'U'],
        style: 'graveyard',
        secondary: 'tribal:Elf',
        seed: 7,
      }),
    ).toBe('p-WU-40-graveyard+tribal-Elf-s7.json');
  });

  it('adds the commander at 100 cards, by name or by id', () => {
    const request = {
      size: 100 as const,
      colors: ['B' as const, 'G' as const],
      commander: '0e2a4a3e-1234-4321-8888-000000000000',
      seed: 3,
    };
    expect(deckFileName('elf-tribe', request, 'Lathril, Blade of the Elves')).toBe(
      'elf-tribe-BG-100-bestfit-lathril-blade-of-the-elves-s3.json',
    );
    expect(deckFileName('elf-tribe', request)).toBe('elf-tribe-BG-100-bestfit-0e2a4a3e-s3.json');
  });

  it('reads colors in any order as WUBRG', () => {
    expect(parseColors('gw')).toEqual(['W', 'G']);
    expect(() => parseColors('X')).toThrow(/WUBRG/);
  });
});

describe('poolHash', () => {
  it('ignores order and empty entries', () => {
    expect(
      poolHash([
        ['b', 2],
        ['a', 1],
      ]),
    ).toBe(
      poolHash([
        ['a', 1],
        ['b', 2],
        ['c', 0],
      ]),
    );
  });

  it('changes with a quantity', () => {
    expect(
      poolHash([
        ['a', 1],
        ['b', 3],
      ]),
    ).not.toBe(
      poolHash([
        ['a', 1],
        ['b', 2],
      ]),
    );
  });

  it('stays the same across runs', () => {
    expect(
      poolHash([
        ['a', 1],
        ['b', 2],
      ]),
    ).toBe('edda3d8f');
  });
});

// CI has no data pack (npm run check runs without data:pull), so these run only locally.
const PACK = path.join(ROOT, 'data', 'packs', 'cards.json');

describe.skipIf(!existsSync(PACK))('review:build with head on a public pool', () => {
  it('writes a deck, repeats it exactly, and records a style the pool cannot build', async () => {
    const out = mkdtempSync(path.join(os.tmpdir(), 'bulk-brew-review-'));
    try {
      const ctx = createContext({ outDir: out, force: true });
      const job: ReviewJob = {
        version: 'head',
        pool: 'eval/pools/tiny-blue.txt',
        colors: 'U',
        size: 40,
      };
      const r = await runJob(job, ctx);
      expect(r.file).toBe(path.join(out, 'head', 'tiny-blue-U-40-bestfit-s1.json'));
      expect(r.deck.error).toBeUndefined();
      expect(r.deck.pool).toMatchObject({ id: 'tiny-blue', source: 'eval/pools/tiny-blue.txt' });
      let count = 0;
      for (const c of r.deck.deck.cards) {
        expect(ctx.index.get(c.id)?.name).toBe(c.name);
        count += c.qty;
      }
      for (const n of Object.values(r.deck.deck.basics)) count += n ?? 0;
      expect(count).toBe(40);
      const saved = JSON.parse(readFileSync(r.file, 'utf8')) as ReviewDeck;
      expect(saved.deck).toEqual(r.deck.deck);

      const { pool, request } = planJob(job, ctx);
      const again = await buildReviewDeck('head', pool, request, ctx);
      expect(deckDifferences(r.deck, again)).toEqual([]);

      // 20-card packets keep the classic builder, which declines a style it cannot build.
      const fail = await runJob({ ...job, size: 20, style: 'energy' }, ctx);
      expect(fail.file).toBe(path.join(out, 'head', 'tiny-blue-U-20-energy-s1.json'));
      expect(fail.deck.error).toMatch(/Energy/);
      expect(fail.deck.deck.cards).toEqual([]);
      expect(existsSync(fail.file)).toBe(true);
      // At 40 the grow builder answers it with the nearest deck and a note instead.
      const near = await runJob({ ...job, style: 'energy' }, ctx);
      expect(near.deck.error).toBeUndefined();
      expect(near.deck.deck.archetype).not.toBe('energy');
      const e = near.deck.explanation as { nearest?: { requested: string } };
      expect(e.nearest?.requested).toBe('energy');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it('skips only the same build, names JSON pools by id, and checks commanders', async () => {
    const out = mkdtempSync(path.join(os.tmpdir(), 'bulk-brew-review-'));
    try {
      const ctx = createContext({ outDir: out });
      const job: ReviewJob = {
        version: 'head',
        pool: 'eval/pools/tiny-blue.txt',
        colors: 'U',
        size: 20,
      };
      expect((await runJob(job, ctx)).skipped).toBe(false);
      expect((await runJob(job, ctx)).skipped).toBe(true);

      // Same cards from another file: without an id it would share the deck file, so it is refused.
      const { pool } = planJob(job, ctx);
      const cards = Object.values(pool.pool.entries).map((e) => [e.cardId, e.qty]);
      const plain = path.join(out, 'tiny-blue.json');
      writeFileSync(plain, JSON.stringify({ cards }));
      await expect(runJob({ ...job, pool: plain }, ctx)).rejects.toThrow(/holds a build of/);
      const named = path.join(out, 'named.json');
      writeFileSync(named, JSON.stringify({ id: 'public-tiny-blue', cards }));
      const r = await runJob({ ...job, pool: named }, ctx);
      expect(r.file).toBe(path.join(out, 'head', 'public-tiny-blue-U-20-bestfit-s1.json'));
      expect(r.deck.pool.hash).toBe(pool.info.hash);

      const lathril = { version: 'head', size: 100, commander: 'Lathril, Blade of the Elves' };
      expect(planJob({ ...lathril, pool: 'eval/pools/elf-tribe.txt' }, ctx).request.colors).toEqual(
        ['B', 'G'],
      );
      expect(() => planJob({ ...lathril, pool: 'eval/pools/tiny-blue.txt' }, ctx)).toThrow(
        /no possible commander in the pool/,
      );
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
