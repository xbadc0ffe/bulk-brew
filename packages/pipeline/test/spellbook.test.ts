import { describe, expect, it } from 'vitest';
import { readTopLevel, type TopLevelPart } from '../src/spellbook.ts';

const FIXTURE = JSON.stringify(
  {
    timestamp: '2026-11-05T06:12:06Z',
    version: 7,
    variants: [
      {
        id: '1-2',
        uses: [{ card: { oracleId: 'a', name: 'Say "hi" {braces} [and] brackets' } }],
        produces: [{ feature: { id: 2, name: 'Infinite mana' } }],
        nested: { deep: [[1, 2], { x: '\\"}' }] },
      },
      { id: '3', uses: [], produces: [], note: 'comma, colon: "quoted"' },
    ],
    aliases: [{ alias: '9', variant: '3' }, 'plain', 4],
    tail: null,
  },
  null,
  1,
);

async function parts(text: string, size: number): Promise<TopLevelPart[]> {
  async function* chunks() {
    for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
  }
  const out: TopLevelPart[] = [];
  for await (const p of readTopLevel(chunks())) out.push(p);
  return out;
}

describe('readTopLevel', () => {
  it('yields top-level scalars and each array element, whatever the chunk size', async () => {
    const want = JSON.parse(FIXTURE) as Record<string, unknown>;
    for (const size of [1, 3, 17, 64, FIXTURE.length]) {
      const got = await parts(FIXTURE, size);
      expect(got.filter((p) => !p.item).map((p) => [p.key, p.value])).toEqual([
        ['timestamp', want.timestamp],
        ['version', 7],
        ['tail', null],
      ]);
      expect(got.filter((p) => p.key === 'variants').map((p) => p.value)).toEqual(want.variants);
      expect(got.filter((p) => p.key === 'aliases').map((p) => p.value)).toEqual(want.aliases);
    }
  });

  it('reads compact JSON with escaped quotes in keys and strings', async () => {
    const text = '{"a\\"b":"x\\\\","list":[{"k":"]"},"}"],"n":-1.5e3}';
    const got = await parts(text, 5);
    expect(got.map((p) => [p.key, p.item, p.value])).toEqual([
      ['a"b', false, 'x\\'],
      ['list', true, { k: ']' }],
      ['list', true, '}'],
      ['n', false, -1500],
    ]);
  });
});
