// Generates deterministic fixture pools for the evaluation harness from the
// real data pack. Usage: npm run eval:pools [-- --force]
// Existing files are kept unless --force is passed, so results stay
// comparable across runs; bump SEED to roll new pools on purpose.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePack, type CardRecord, type Color } from '@bulk-brew/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const POOLS_DIR = path.join(ROOT, 'eval', 'pools');
const SEED = 20261103;

/** mulberry32: small, fast, and good enough for sampling fixtures. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted sample without replacement: smallest exponential keys win. */
function sample<T>(items: T[], weight: (t: T) => number, n: number, rand: () => number): T[] {
  const keyed = items
    .map((item) => {
      const w = weight(item);
      return { item, key: w > 0 ? -Math.log(1 - rand()) / w : Infinity };
    })
    .filter((k) => Number.isFinite(k.key))
    .sort((a, b) => a.key - b.key);
  return keyed.slice(0, n).map((k) => k.item);
}

/** Copies per card, biased toward singletons like real bulk. */
function copies(rand: () => number, max = 4): number {
  const r = rand();
  if (r < 0.4) return 1;
  if (r < 0.7) return Math.min(2, max);
  if (r < 0.9) return Math.min(3, max);
  return max;
}

const isCreature = (c: CardRecord) => c.types.includes('creature');
const isLand = (c: CardRecord) => c.types.includes('land');
const isBasic = (c: CardRecord) => /^Basic (Snow )?Land\b/.test(c.typeLine);
const isSpell = (c: CardRecord) => !isLand(c) || c.layout === 'modal_dfc';

/** Bulk weighting: cheap creatures and plain cards dominate; big rares are rare. */
function bulkWeight(c: CardRecord): number {
  let w = c.mv <= 3 ? (isCreature(c) ? 3 : 2) : c.mv <= 5 ? 1 : 0.5;
  if (c.tags.length <= 5) w *= 1.5;
  if (/^Legendary/.test(c.typeLine)) w *= 0.4;
  return w;
}

interface PoolSpec {
  file: string;
  header: string[];
  lines: () => string[];
}

function main(): number {
  const force = process.argv.includes('--force');
  const packPath = path.join(ROOT, 'data', 'packs', 'cards.v1.json');
  if (!existsSync(packPath)) {
    console.error('no data pack at data/packs/cards.v1.json; run npm run data:pull first');
    return 1;
  }
  const pack = parsePack(readFileSync(packPath, 'utf8'));
  const usable = pack.cards.filter((c) => !c.unset && !isBasic(c));
  const mono = (color: Color) =>
    usable.filter((c) => c.identity.length === 1 && c.identity[0] === color && isSpell(c));
  const colorless = usable.filter((c) => c.identity.length === 0 && isSpell(c));
  const gold = (color: Color) =>
    usable.filter((c) => c.identity.length >= 2 && c.identity.includes(color) && isSpell(c));
  const nonbasicsFor = (color: Color) =>
    usable.filter(
      (c) =>
        isLand(c) &&
        c.layout !== 'modal_dfc' &&
        c.identity.every((x) => x === color) &&
        (c.produces ?? []).length > 0,
    );

  const toLines = (cards: CardRecord[], rand: () => number, max = 4): string[] =>
    cards
      .map((c) => `${copies(rand, max)} ${c.name}`)
      .sort((a, b) => a.slice(2).localeCompare(b.slice(2)));

  const bulk = (color: Color, name: string): PoolSpec => ({
    file: `bulk-${name}.txt`,
    header: [
      `// Synthetic ${name} bulk pool: 140 distinct mono-${name} cards plus 10 colorless cards, biased toward cheap creatures and plain commons-like cards.`,
    ],
    lines: () => {
      const rand = prng(SEED + color.charCodeAt(0));
      const picks = sample(mono(color), bulkWeight, 140, rand);
      const extras = sample(colorless, bulkWeight, 10, rand);
      return toLines([...picks, ...extras], rand);
    },
  });

  const specs: PoolSpec[] = [
    bulk('U', 'blue'),
    bulk('B', 'black'),
    bulk('R', 'red'),
    bulk('G', 'green'),
    {
      file: 'thin-red.txt',
      header: [
        '// Thin red pool: about 60 copies across 40 cards, barely more than a 60-card deck needs in spells. Exercises builds with little choice at every size.',
      ],
      lines: () => {
        const rand = prng(SEED + 100);
        return toLines(sample(mono('R'), bulkWeight, 40, rand), rand, 2);
      },
    },
    {
      file: 'tiny-blue.txt',
      header: [
        '// Tiny blue pool: about 34 copies across 20 cards. Only 40 and 20-card decks are possible; 60 must be reported as not possible, never as a build failure.',
      ],
      lines: () => {
        const rand = prng(SEED + 150);
        return toLines(sample(mono('U'), bulkWeight, 20, rand), rand, 2);
      },
    },
    {
      file: 'creatures-only-green.txt',
      header: [
        '// Creature-only green pool: no instants, sorceries, or noncreature permanents. Exercises the type caps and the all-creature note.',
      ],
      lines: () => {
        const rand = prng(SEED + 200);
        const creatures = mono('G').filter((c) => isCreature(c) && c.types.length === 1);
        return toLines(sample(creatures, bulkWeight, 120, rand), rand);
      },
    },
    {
      file: 'gold-heavy-black.txt',
      header: [
        '// Black pool padded with gold and off-color cards: 120 mono-black, 80 multicolor including black, 40 mono-red. Only the mono-black and colorless cards may be used.',
      ],
      lines: () => {
        const rand = prng(SEED + 300);
        return toLines(
          [
            ...sample(mono('B'), bulkWeight, 120, rand),
            ...sample(gold('B'), bulkWeight, 80, rand),
            ...sample(mono('R'), bulkWeight, 40, rand),
          ],
          rand,
        );
      },
    },
    {
      file: 'lands-blue.txt',
      header: [
        '// Blue pool with a dozen nonbasic lands, some entering tapped and some colorless-only. Exercises nonbasic scoring, the nonbasic share cap, and the colorless cap.',
      ],
      lines: () => {
        const rand = prng(SEED + 400);
        const lands = nonbasicsFor('U');
        const blueUntapped = lands.filter(
          (c) => (c.produces ?? []).includes('U') && !c.entersTapped,
        );
        const blueTapped = lands.filter((c) => (c.produces ?? []).includes('U') && c.entersTapped);
        const colorlessOnly = lands.filter((c) => (c.produces ?? []).every((m) => m === 'C'));
        const picked = [
          ...sample(blueUntapped, () => 1, 5, rand),
          ...sample(blueTapped, () => 1, 4, rand),
          ...sample(colorlessOnly, () => 1, 3, rand),
        ];
        return [
          ...toLines(sample(mono('U'), bulkWeight, 140, rand), rand),
          ...picked.map((c) => `${1 + Math.floor(rand() * 2)} ${c.name}`),
        ];
      },
    },
  ];

  let written = 0;
  for (const spec of specs) {
    const file = path.join(POOLS_DIR, spec.file);
    if (existsSync(file) && !force) {
      console.log(`${spec.file}: exists, kept (use --force to regenerate)`);
      continue;
    }
    const lines = spec.lines();
    const copiesTotal = lines.reduce((n, l) => n + Number(l.split(' ')[0]), 0);
    const text = [
      ...spec.header,
      `// Generated by npm run eval:pools with seed ${SEED}. Card names only.`,
      ...lines,
    ].join('\n');
    writeFileSync(file, text + '\n');
    console.log(`${spec.file}: ${lines.length} lines, ${copiesTotal} copies`);
    written++;
  }
  console.log(`${written} pool file${written === 1 ? '' : 's'} written`);
  return 0;
}

process.exitCode = main();
