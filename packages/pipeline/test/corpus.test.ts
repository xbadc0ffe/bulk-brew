import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { CardRecord, Rarity } from '@bulk-brew/core';
import { noisePool, readTar, splitCsvLine, splitOf } from '../src/corpus.ts';

/** A minimal ustar archive: one 512-byte header per file, data padded to 512. */
function tar(files: { name: string; body: string; type?: string }[]): Buffer {
  const parts: Buffer[] = [];
  for (const f of files) {
    const body = Buffer.from(f.body, 'utf8');
    const h = Buffer.alloc(512);
    h.write(f.name, 0, 'utf8');
    h.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
    h.write(f.type ?? '0', 156, 'ascii');
    h.write('ustar\0', 257, 'ascii');
    parts.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

async function entries(buf: Buffer, chunk: number) {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += chunk) chunks.push(buf.subarray(i, i + chunk));
  const out: { name: string; body: string }[] = [];
  for await (const e of readTar(Readable.from(chunks)))
    out.push({ name: e.name, body: e.data.toString('utf8') });
  return out;
}

describe('readTar', () => {
  it('reads files whatever the chunk size', async () => {
    const buf = tar([
      { name: 'decks/A.json', body: '{"a":1}' },
      { name: 'decks/B.json', body: 'x'.repeat(1300) },
    ]);
    for (const size of [7, 512, 4096, buf.length]) {
      const got = await entries(buf, size);
      expect(got.map((e) => e.name)).toEqual(['decks/A.json', 'decks/B.json']);
      expect(got[1]!.body).toHaveLength(1300);
    }
  });

  it('applies a GNU long name to the next file and skips directories', async () => {
    const long = `decks/${'n'.repeat(120)}.json`;
    const got = await entries(
      tar([
        { name: 'decks/', body: '', type: '5' },
        { name: '././@LongLink', body: long + '\0', type: 'L' },
        { name: 'short', body: '{}' },
      ]),
      100,
    );
    expect(got).toEqual([{ name: long, body: '{}' }]);
  });
});

describe('splitCsvLine', () => {
  it('splits on commas outside quotes', () => {
    expect(splitCsvLine('a,"deck_Ajani, Caller",3,"say ""hi"""')).toEqual([
      'a',
      'deck_Ajani, Caller',
      '3',
      'say "hi"',
    ]);
    expect(splitCsvLine('x,,y')).toEqual(['x', '', 'y']);
  });
});

describe('noisePool', () => {
  const source = new Map<Rarity, CardRecord[]>(
    (['common', 'uncommon', 'rare', 'mythic'] as Rarity[]).map((r) => [
      r,
      Array.from({ length: 20 }, (_, i) => ({ id: `${r}-${i}` }) as CardRecord),
    ]),
  );

  it('is the same for the same seed and holds the asked count', () => {
    const a = noisePool(source, 7, 300);
    expect(noisePool(source, 7, 300)).toEqual(a);
    expect(noisePool(source, 8, 300)).not.toEqual(a);
    expect(a.reduce((n, [, q]) => n + q, 0)).toBe(300);
  });

  it('is mostly commons', () => {
    const pool = noisePool(source, 1, 2000);
    const commons = pool.filter(([id]) => id.startsWith('common')).reduce((n, [, q]) => n + q, 0);
    expect(commons / 2000).toBeGreaterThan(0.5);
  });
});

describe('splitOf', () => {
  it('holds out about one deck in five, the same way every time', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `precon:deck${i}`);
    const test = ids.filter((id) => splitOf(id) === 'test').length;
    expect(test / ids.length).toBeGreaterThan(0.15);
    expect(test / ids.length).toBeLessThan(0.25);
    expect(ids.map(splitOf)).toEqual(ids.map(splitOf));
  });
});
