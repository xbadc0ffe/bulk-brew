import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

/** Stream a .jsonl or .jsonl.gz file one parsed object at a time. */
export async function* readJsonl<T>(path: string): AsyncGenerator<T> {
  const raw = createReadStream(path);
  const input = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === '') continue;
    yield JSON.parse(line) as T;
  }
}

export async function readAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for await (const item of readJsonl<T>(path)) out.push(item);
  return out;
}
