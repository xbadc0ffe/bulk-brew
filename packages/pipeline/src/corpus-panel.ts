// Blind review panel: pair builds of the same reference decks from two
// corpus:eval results files (an earlier version A and a later version B),
// write them as review packets with the order hidden, and later tally the
// reviewers' verdicts. Reviewers are fresh agents that read a packet, rate
// each build against eval/rubric.md and the profile of real decks of its
// plan, and write a verdicts file next to it. A sanity check beside the
// numbers, not a target.
//
// The answer key (which build is which) is written to data/corpus/panel-keys/,
// never into the packet folder, and the folder's name says nothing about
// the versions.
//
// Usage: npm run corpus:panel -- --a <results.json> --b <results.json> [--per 10] [--pairs 5]
//        npm run corpus:panel -- --tally <panel dir>

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CardIndex,
  factsFor,
  parsePack,
  type BulkBrewConfig,
  type CardRecord,
  type DeckSize,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { loadConfigDir } from './check-config.ts';
import { arg, CORPUS_DIR, hash32, loadCorpus, recordsOf, ROOT, SIZES } from './corpus.ts';
import type { EvalRow } from './corpus-eval.ts';
import { featureNames, planKey, PlanProfiles, SHAPE, type RefDeck } from './plans.ts';

const KEY_DIR = path.join(CORPUS_DIR, 'panel-keys');

interface ResultsFile {
  sha: string;
  runAt: string;
  rows: EvalRow[];
}

interface KeyEntry {
  packet: string;
  pair: number;
  size: DeckSize;
  id: string;
  /** Which label, X or Y, is version A. */
  a: 'X' | 'Y';
}

interface Verdict {
  pair: number;
  winner: 'X' | 'Y' | 'even';
}

function styleLabel(config: BulkBrewConfig, style: string | undefined): string {
  if (!style) return 'Unknown';
  if (style.startsWith('tribal:')) return `${style.slice(7)} tribe`;
  return config.archetypes.archetypes.find((a) => a.id === style)?.label ?? style;
}

function cardLine(card: CardRecord, qty: number): string {
  const text = card.text.replace(/\s*\n\s*/g, ' / ');
  const short = text.length > 150 ? `${text.slice(0, 147)}...` : text;
  const cost = card.manaCost ?? card.faces?.[0]?.manaCost ?? '';
  return `- ${qty} ${card.name} ${cost} | ${card.typeLine}${short ? ` | ${short}` : ''}`;
}

const GROUPS: [string, (c: CardRecord) => boolean][] = [
  ['Creatures', (c) => c.types.includes('creature')],
  ['Planeswalkers', (c) => c.types.includes('planeswalker')],
  ['Instants', (c) => c.types.includes('instant')],
  ['Sorceries', (c) => c.types.includes('sorcery')],
  ['Artifacts', (c) => c.types.includes('artifact')],
  ['Enchantments', (c) => c.types.includes('enchantment')],
  ['Other spells', () => true],
];

function deckText(deck: [string, number][], index: CardIndex, config: BulkBrewConfig): string {
  const cards = recordsOf(index, deck).sort((a, b) => (a[0].name < b[0].name ? -1 : 1));
  const spells = cards.filter(([c]) => factsFor(index, config, c).spell);
  const lands = cards.filter(([c]) => !factsFor(index, config, c).spell);
  const out: string[] = [];
  const used = new Set<string>();
  for (const [label, test] of GROUPS) {
    const group = spells.filter(([c]) => !used.has(c.id) && test(c));
    if (!group.length) continue;
    for (const [c] of group) used.add(c.id);
    out.push(`${label} (${group.reduce((n, [, q]) => n + q, 0)}):`);
    for (const [c, q] of group) out.push(cardLine(c, q));
  }
  const landCount = lands.reduce((n, [, q]) => n + q, 0);
  out.push(`Lands (${landCount}): ${lands.map(([c, q]) => `${q} ${c.name}`).join(', ')}`);
  return out.join('\n');
}

function profileText(
  profiles: PlanProfiles,
  style: string,
  size: DeckSize,
  spells: number,
  config: BulkBrewConfig,
): string {
  const p = profiles.get(style);
  const names = featureNames(config, size);
  const parts = names
    .map((n, i) => [n, p.median[i]!] as const)
    .filter(([, m]) => !Number.isNaN(m))
    .map(([n, m]) => `${n} ${Math.round(m * spells * 10) / 10}`);
  const whose =
    p.source === 'plan'
      ? `${p.decks} real decks running this plan`
      : p.source === 'met'
        ? `${p.decks} real decks that meet this style`
        : `all ${p.decks} real decks of this size (none run this plan)`;
  return `Real decks of this plan, median copies scaled to ${spells} spells (${whose}): ${parts.join(', ')}.`;
}

function prepare(): number {
  const fileA = arg('a');
  const fileB = arg('b');
  if (!fileA || !fileB) {
    console.error('usage: corpus:panel -- --a <results.json> --b <results.json>');
    return 1;
  }
  const per = Number(arg('per') ?? 10);
  const pairsPer = Number(arg('pairs') ?? 5);
  const sizes = (arg('sizes') ?? SIZES.join(',')).split(',').map(Number) as DeckSize[];
  const A = JSON.parse(readFileSync(fileA, 'utf8')) as ResultsFile;
  const B = JSON.parse(readFileSync(fileB, 'utf8')) as ResultsFile;
  const name = `panel-${(hash32(`${fileA}|${fileB}|${Date.now()}`) % 1e6).toString(36)}`;
  const out = path.join(CORPUS_DIR, 'panel', name);
  mkdirSync(out, { recursive: true });
  mkdirSync(KEY_DIR, { recursive: true });
  const index = new CardIndex(
    parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8')),
  );
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const corpus = new Map(loadCorpus().decks.map((d) => [`${d.size}:${d.id}`, d]));
  const byA = new Map(A.rows.map((r) => [`${r.size}:${r.id}`, r]));
  const key: KeyEntry[] = [];
  for (const size of sizes) {
    const rowsB = B.rows.filter((r) => r.size === size);
    const refs: RefDeck[] = rowsB.map((r) => ({
      cards: recordsOf(index, corpus.get(`${size}:${r.id}`)?.cards ?? []),
      plan: { plan: r.refPlan ?? SHAPE, met: r.refStyles },
    }));
    const profiles = new PlanProfiles(refs, size, index, config);
    const spellKey = (d: [string, number][]) =>
      d
        .filter(([id]) => factsFor(index, config, index.get(id)!).spell)
        .map(([id, q]) => `${id}x${q}`)
        .sort()
        .join(',');
    const candidates = rowsB
      .filter((b) => {
        const a = byA.get(`${size}:${b.id}`);
        return b.ok && a?.ok && a.deck && b.deck && spellKey(a.deck) !== spellKey(b.deck);
      })
      .sort((x, y) => hash32(`panel:${x.id}`) - hash32(`panel:${y.id}`));
    const same =
      rowsB.filter((b) => {
        const a = byA.get(`${size}:${b.id}`);
        return b.ok && a?.ok && a.deck && b.deck;
      }).length - candidates.length;
    const picked = candidates.slice(0, per);
    console.log(`${size}: ${picked.length} pairs (${candidates.length} differ, ${same} identical)`);
    for (let start = 0; start < picked.length; start += pairsPer) {
      const name = `${size}-${start / pairsPer + 1}`;
      const lines: string[] = [
        `# Review packet ${name}`,
        '',
        `Each pair below is two ${size}-card decks built by two versions of a deck builder from the same pool: a real deck shuffled into about 3,000 random bulk cards. The order is random. Judge each deck on its own and against the real decks of its plan, using eval/rubric.md: is the plan clear, is it deep enough, and does the deck play (curve, mana, interaction, threats). Then pick the better deck, or "even".`,
        '',
      ];
      picked.slice(start, start + pairsPer).forEach((b, i) => {
        const a = byA.get(`${size}:${b.id}`)!;
        const aFirst = hash32(`order:${b.id}`) % 2 === 0;
        const [x, y] = aFirst ? [a, b] : [b, a];
        const pair = start + i + 1;
        key.push({ packet: name, pair, size, id: b.id, a: aFirst ? 'X' : 'Y' });
        const deck = corpus.get(`${size}:${b.id}`);
        lines.push(`## Pair ${pair}`, '');
        if (deck?.commander?.[0]) {
          const c = index.get(deck.commander[0]);
          if (c)
            lines.push(
              `Commander: ${c.name} ${c.manaCost ?? ''} | ${c.typeLine} | ${c.text.replace(/\s*\n\s*/g, ' / ')}`,
              '',
            );
        }
        for (const [label, row] of [
          ['X', x],
          ['Y', y],
        ] as const) {
          const spells = recordsOf(index, row.deck!)
            .filter(([c]) => factsFor(index, config, c).spell)
            .reduce((n, [, q]) => n + q, 0);
          const style = planKey(config, row.style);
          lines.push(
            `### Build ${label}: ${styleLabel(config, row.style)}`,
            '',
            profileText(profiles, style, size, spells, config),
            '',
            deckText(row.deck!, index, config),
            '',
          );
        }
      });
      lines.push(
        '## Your answer',
        '',
        `Write a JSON file named verdicts-${name}.json in this folder: a list with one entry per pair, {"pair": <number>, "winner": "X" | "Y" | "even", "X": {"plan": 1-5, "depth": 1-5, "plays": 1-5}, "Y": {...}, "why": "<one sentence>"}.`,
      );
      writeFileSync(path.join(out, `packet-${name}.md`), lines.join('\n'));
    }
  }
  writeFileSync(
    path.join(KEY_DIR, `${name}.json`),
    JSON.stringify({ a: fileA, b: fileB, key }, null, 1),
  );
  console.log(`wrote packets to ${path.relative(ROOT, out)}`);
  return 0;
}

function tally(dir: string): number {
  const keyFile = path.join(KEY_DIR, `${path.basename(dir)}.json`);
  if (!existsSync(keyFile)) {
    console.error(`no answer key at ${path.relative(ROOT, keyFile)}`);
    return 1;
  }
  const { key } = JSON.parse(readFileSync(keyFile, 'utf8')) as { key: KeyEntry[] };
  const verdicts = new Map<string, Verdict>();
  for (const f of readdirSync(dir).filter((x) => /^verdicts-.*\.json$/.test(x))) {
    const packet = f.slice('verdicts-'.length, -'.json'.length);
    for (const v of JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Verdict[])
      verdicts.set(`${packet}:${v.pair}`, v);
  }
  const bySize = new Map<number, { a: number; b: number; even: number; missing: number }>();
  for (const k of key) {
    const t = bySize.get(k.size) ?? { a: 0, b: 0, even: 0, missing: 0 };
    bySize.set(k.size, t);
    const w = verdicts.get(`${k.packet}:${k.pair}`)?.winner;
    // Only X, Y, or even count; anything else is no answer.
    if (w !== 'X' && w !== 'Y' && w !== 'even') t.missing++;
    else if (w === 'even') t.even++;
    else if (w === k.a) t.a++;
    else t.b++;
  }
  console.log('| size | new wins | old wins | even | no answer | new win share |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const [size, t] of [...bySize.entries()].sort((x, y) => y[0] - x[0])) {
    const judged = t.a + t.b + t.even;
    console.log(
      `| ${size} | ${t.b} | ${t.a} | ${t.even} | ${t.missing} | ${judged ? Math.round((100 * t.b) / judged) : 0}% |`,
    );
  }
  return 0;
}

const tallyDir = arg('tally');
process.exitCode = tallyDir ? (existsSync(tallyDir) ? tally(tallyDir) : 1) : prepare();
