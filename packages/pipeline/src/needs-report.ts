// Coverage of the card needs reader (docs/builder-phase2.md, step 2) over the
// whole pack: how many abilities it reads cleanly and why the rest are left
// unparsed, how role and theme credits come out (need, bonus, drawback,
// unconditional, untied), and a cross-check against the pack's tags. Writes
// the short summary to docs/review/needs-coverage.md and the full unparsed
// work list, by shape and rarity, to data/review/needs/unparsed.md.
//
// Usage: npm run needs:report

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  cardMatches,
  cardNeeds,
  configVersion,
  creditNeeds,
  landEntry,
  matchCard,
  parsePack,
  themeCredit,
  themeRulesFor,
  validateConfig,
  type BulkBrewConfig,
  type CardNeeds,
  type CardRecord,
  type NeedKind,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { loadConfigDir } from './check-config.ts';
import { ROOT } from './corpus.ts';

const PACK_PATH = path.join(ROOT, 'data', 'packs', PACK_FILE);
const SUMMARY = path.join(ROOT, 'docs', 'review', 'needs-coverage.md');
const WORK_LIST = path.join(ROOT, 'data', 'review', 'needs', 'unparsed.md');

type CreditKind = NeedKind | 'untied';
const CREDIT_KINDS: CreditKind[] = ['need', 'bonus', 'drawback', 'unconditional', 'untied'];
const KINDS: NeedKind[] = ['need', 'bonus', 'drawback', 'unconditional'];

const isBulk = (c: CardRecord) => c.rarity === 'common' || c.rarity === 'uncommon';
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');

/** Tags that hint at a dependency: the cross-check's side of the comparison. */
function dependencyTags(card: CardRecord): string[] {
  return card.tags.filter(
    (t) =>
      t === 'lifegain-matters' ||
      t === 'counters-matter' ||
      t.startsWith('typal-') ||
      t.startsWith('synergy-') ||
      /-matters?$/.test(t),
  );
}

function tagFamily(t: string): string {
  if (t.startsWith('typal-')) return 'typal-*';
  if (t.startsWith('synergy-')) return 'synergy-*';
  if (t === 'lifegain-matters' || t === 'counters-matter') return t;
  return '*-matter(s)';
}

interface Shape {
  count: number;
  bulk: number;
  examples: string[];
}

function addShape(map: Map<string, Shape>, key: string, card: CardRecord): void {
  let s = map.get(key);
  if (!s) map.set(key, (s = { count: 0, bulk: 0, examples: [] }));
  s.count++;
  if (isBulk(card)) s.bulk++;
  if (s.examples.length < 3 && !s.examples.includes(card.name)) s.examples.push(card.name);
}

function topShapes(map: Map<string, Shape>, n: number): [string, Shape][] {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].bulk - a[1].bulk || (a[0] < b[0] ? -1 : 1))
    .slice(0, n);
}

/** A markdown table padded as Prettier writes it, so the summary passes the format check. */
function table(head: string[], rows: (string | number)[][]): string {
  const cells = [head, ...rows].map((r) => r.map((c) => String(c)));
  const width = head.map((_, i) => Math.max(3, ...cells.map((r) => [...(r[i] ?? '')].length)));
  const line = (r: string[]) =>
    `| ${r.map((c, i) => c + ' '.repeat(width[i]! - [...c].length)).join(' | ')} |`;
  return [
    line(cells[0]!),
    `| ${width.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...cells.slice(1).map(line),
  ].join('\n');
}

function kindRow(counts: Record<string, number>, kinds: readonly string[]): (string | number)[] {
  const total = kinds.reduce((s, k) => s + (counts[k] ?? 0), 0);
  return [total, ...kinds.map((k) => counts[k] ?? 0)];
}

function familyOf(r: string): string {
  const i = r.indexOf(':');
  if (i < 0) return r;
  const fam = r.slice(0, i);
  if (fam === 'graveyard' || fam === 'cast') {
    const inner = r.slice(i + 1);
    const j = inner.indexOf(':');
    return `${fam}:${j < 0 ? inner : inner.slice(0, j)}`;
  }
  return fam;
}

function main(): number {
  const config: BulkBrewConfig = loadConfigDir(path.join(ROOT, 'config'));
  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`config has ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  const pack = parsePack(readFileSync(PACK_PATH, 'utf8'));
  const cards = pack.cards;

  // Reading every card once, timed.
  const t0 = performance.now();
  const read = new Map<CardRecord, CardNeeds>();
  for (const card of cards) read.set(card, cardNeeds(card, config));
  const readMs = performance.now() - t0;

  // "Read" excludes the clean abilities that leaned on the game-state fallback.
  const abilities = {
    all: 0,
    clean: 0,
    read: 0,
    bulk: 0,
    bulkClean: 0,
    bulkRead: 0,
    real: 0,
    realClean: 0,
    realRead: 0,
  };
  const reasons = new Map<string, number>();
  const unparsedShapes = new Map<string, Shape>();
  const cardKinds: Record<string, number> = {};
  let cardsUnparsed = 0;
  const refFamilies = new Map<string, Record<string, number>>();
  let selfSupplied = 0;
  let gameStateParts = 0;
  const gameStateShapes = new Map<string, Shape>();
  for (const card of cards) {
    const r = read.get(card)!;
    cardKinds[r.kind] = (cardKinds[r.kind] ?? 0) + 1;
    if (r.abilities.some((a) => a.unparsed)) cardsUnparsed++;
    if (r.selfSupplies.length) selfSupplied++;
    for (const a of r.abilities) {
      abilities.all++;
      for (const g of a.gameState ?? []) {
        gameStateParts++;
        addShape(gameStateShapes, g, card);
      }
      if (!card.unset) abilities.real++;
      if (isBulk(card) && !card.unset) abilities.bulk++;
      if (!a.unparsed) {
        abilities.clean++;
        if (!card.unset) abilities.realClean++;
        if (isBulk(card) && !card.unset) abilities.bulkClean++;
        if (!a.gameState?.length) {
          abilities.read++;
          if (!card.unset) abilities.realRead++;
          if (isBulk(card) && !card.unset) abilities.bulkRead++;
        }
      } else {
        const why = a.unparsed.split(':')[0]!;
        reasons.set(why, (reasons.get(why) ?? 0) + 1);
        addShape(unparsedShapes, a.unparsed, card);
      }
      for (const ref of a.refs) {
        if (ref.place === 'unparsed') continue;
        for (const res of ref.anyOf) {
          const fam = familyOf(res);
          let row = refFamilies.get(fam);
          if (!row) refFamilies.set(fam, (row = {}));
          row[ref.kind] = (row[ref.kind] ?? 0) + 1;
        }
      }
    }
  }

  // Credits: roles by the roles.json matchers, themes by the rules at 60 cards.
  const t1 = performance.now();
  const roleRows = new Map<string, Record<string, number>>();
  for (const role of config.roles.roles) roleRows.set(role.id, {});
  const themeRows = new Map<string, Record<string, number>>();
  const styles = [...themeRulesFor(config).styles.values()];
  let creditCount = 0;
  for (const card of cards) {
    if (card.unset) continue;
    for (const role of config.roles.roles) {
      if (!cardMatches(card, role.match)) continue;
      const k = creditNeeds(card, role.id, config, 60).kind;
      const row = roleRows.get(role.id)!;
      row[k] = (row[k] ?? 0) + 1;
      creditCount++;
    }
    for (const style of styles) {
      const m = matchCard(card, style, 60);
      if (!m || m.as === 'excluded' || m.weight <= 0) continue;
      const id = themeCredit(style.id, m.as);
      const k = creditNeeds(card, id, config, 60).kind;
      let row = themeRows.get(id);
      if (!row) themeRows.set(id, (row = {}));
      row[k] = (row[k] ?? 0) + 1;
      creditCount++;
    }
  }
  const creditMs = performance.now() - t1;

  // Tag cross-check.
  const tagUnconditional = new Map<string, number>();
  const tagUncondShapes = new Map<string, Shape>();
  let tagUncondCards = 0;
  const untaggedNeeds = new Map<string, number>();
  const untaggedShapes = new Map<string, Shape>();
  let untaggedNeedCards = 0;
  for (const card of cards) {
    if (card.unset) continue;
    const r = read.get(card)!;
    const tags = dependencyTags(card);
    const refs = r.abilities.flatMap((a) => a.refs.filter((x) => x.place !== 'unparsed'));
    const unparsed = r.abilities.some((a) => a.unparsed);
    if (tags.length && refs.length === 0 && !unparsed) {
      tagUncondCards++;
      for (const fam of new Set(tags.map(tagFamily)))
        tagUnconditional.set(fam, (tagUnconditional.get(fam) ?? 0) + 1);
      for (const t of tags.slice(0, 2)) addShape(tagUncondShapes, t, card);
    }
    const needs = refs.filter((x) => x.kind === 'need' && !x.self);
    if (needs.length && tags.length === 0) {
      untaggedNeedCards++;
      const fams = new Set(needs.flatMap((x) => x.anyOf.map(familyOf)));
      for (const f of fams) untaggedNeeds.set(f, (untaggedNeeds.get(f) ?? 0) + 1);
      addShape(untaggedShapes, `${needs[0]!.place}: ${needs[0]!.anyOf.join(' | ')}`, card);
    }
  }

  // Lands the pack marks tapped: the reader against landEntry (lands.ts), which a later step folds in.
  const landTab = new Map<string, number>();
  for (const card of cards) {
    if (!card.entersTapped || card.unset) continue;
    const colors = card.identity.length ? card.identity : (['B'] as const);
    const conditional =
      landEntry(card, { colors, size: 60 }, config).tapped < 1 ||
      landEntry(card, { colors, size: 100 }, config).tapped < 1;
    const line = read
      .get(card)!
      .abilities.find((a) => /\benters? (?:the battlefield )?tapped\b/i.test(a.text));
    let reader = 'no tapped line';
    if (line?.unparsed) reader = 'unparsed';
    else if (
      line &&
      /\bunless\b|\bif you (?:control|don't)\b|\byou may (?:pay|reveal|behold)\b/i.test(line.text)
    )
      reader = line.refs.length ? 'a condition naming a resource' : 'a condition on game state';
    else if (line) reader = 'always tapped';
    const key = `${conditional ? 'conditional' : 'always tapped'}|${reader}`;
    landTab.set(key, (landTab.get(key) ?? 0) + 1);
  }

  // ------------------------------------------------------------ output
  const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const famRows = [...refFamilies.entries()].sort(
    (a, b) =>
      Object.values(b[1]).reduce((s, x) => s + x, 0) -
      Object.values(a[1]).reduce((s, x) => s + x, 0),
  );
  const perK = (ms: number) => ((1000 * ms) / cards.length).toFixed(0);
  const lines: string[] = [];
  lines.push('# Card needs: coverage over the pack');
  lines.push('');
  lines.push(
    `Written by \`npm run needs:report\` (packages/pipeline/src/needs-report.ts). Pack ${pack.version}, ${cards.length} cards; config ${configVersion(config)}. The full unparsed work list is in \`data/review/needs/unparsed.md\` (not committed).`,
  );
  lines.push('');
  lines.push('## Abilities');
  lines.push('');
  lines.push(
    table(
      ['Cards', 'Abilities', 'Parsed cleanly', 'Share', 'No game-state fallback', 'Share'],
      [
        [
          'Whole pack',
          abilities.all,
          abilities.clean,
          pct(abilities.clean, abilities.all),
          abilities.read,
          pct(abilities.read, abilities.all),
        ],
        [
          'Without Un-sets',
          abilities.real,
          abilities.realClean,
          pct(abilities.realClean, abilities.real),
          abilities.realRead,
          pct(abilities.realRead, abilities.real),
        ],
        [
          'Commons and uncommons (no Un-sets)',
          abilities.bulk,
          abilities.bulkClean,
          pct(abilities.bulkClean, abilities.bulk),
          abilities.bulkRead,
          pct(abilities.bulkRead, abilities.bulk),
        ],
      ],
    ),
  );
  lines.push('');
  lines.push(
    'Parsed cleanly: every part of the ability was read, by a template or by the game-state fallback. No game-state fallback: every part was read by a template that names what it reads.',
  );
  lines.push('');
  lines.push(
    `${cardsUnparsed} cards have an unparsed ability. Why abilities were left unparsed (the first reason in each):`,
  );
  lines.push('');
  lines.push(
    table(
      ['Reason', 'Abilities'],
      reasonRows.map(([k, v]) => [k, v]),
    ),
  );
  lines.push('');
  lines.push(
    `${gameStateParts} conditions, trigger events, and cost parts no template reads name no resource word or type, so the reader takes them as game state (\`resourceWords\` in config/card-needs.json). The most common:`,
  );
  lines.push('');
  lines.push(
    table(
      ['Read as game state', 'Cards', 'Commons and uncommons'],
      topShapes(gameStateShapes, 8).map(([k, s]) => [
        `\`${k.replace(/\|/g, '\\|')}\``,
        s.count,
        s.bulk,
      ]),
    ),
  );
  lines.push('');
  lines.push('Top unparsed shapes (names, numbers, types, and mana symbols normalized):');
  lines.push('');
  lines.push(
    table(
      ['Shape', 'Cards', 'Commons and uncommons', 'Examples'],
      topShapes(unparsedShapes, 15).map(([k, s]) => [
        `\`${k.replace(/\|/g, '\\|')}\``,
        s.count,
        s.bulk,
        s.examples.join('; '),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Cards');
  lines.push('');
  lines.push(
    `The most severe kind among a card's abilities (an unparsed ability counts as a need). ${selfSupplied} cards supply some need of their own.`,
  );
  lines.push('');
  lines.push(table(['Cards', ...KINDS], [kindRow(cardKinds, KINDS)]));
  lines.push('');
  lines.push('Resource references by family and kind (an alternative counts once per resource):');
  lines.push('');
  lines.push(
    table(
      ['Family', 'Refs', 'need', 'bonus', 'drawback'],
      famRows.map(([f, row]) => [f, ...kindRow(row, ['need', 'bonus', 'drawback'])]),
    ),
  );
  lines.push('');
  lines.push('## Credits');
  lines.push('');
  lines.push(
    'Role credits (cards the roles.json matchers give the role, Un-sets left out) by the kind of the clause that earns them; untied means no clause matched the role pattern, so the credit depends on every need the card has:',
  );
  lines.push('');
  lines.push(
    table(
      ['Role', 'Cards', ...CREDIT_KINDS],
      [...roleRows.entries()].map(([id, row]) => [id, ...kindRow(row, CREDIT_KINDS)]),
    ),
  );
  lines.push('');
  lines.push('Theme credits (the theme rules at 60 cards, each card once per style):');
  lines.push('');
  lines.push(
    table(
      ['Credit', 'Cards', ...CREDIT_KINDS],
      [...themeRows.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([id, row]) => [id.replace(/^theme:/, ''), ...kindRow(row, CREDIT_KINDS)]),
    ),
  );
  lines.push('');
  lines.push('## Tag cross-check');
  lines.push('');
  lines.push(
    `- ${tagUncondCards} cards carry a dependency tag (\`lifegain-matters\`, \`counters-matter\`, \`typal-*\`, \`synergy-*\`, \`*-matter(s)\`) but the reader finds no reference at all: ${[
      ...tagUnconditional.entries(),
    ]
      .map(([k, v]) => `\`${k}\` ${v}`)
      .join(', ')}.`,
  );
  lines.push(
    `- ${untaggedNeedCards} cards have a need the reader finds (not self-supplied) and carry no such tag; by family: ${[
      ...untaggedNeeds.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}.`,
  );
  lines.push('');
  lines.push('Top tags on cards the reader calls unconditional:');
  lines.push('');
  lines.push(
    table(
      ['Tag', 'Cards', 'Commons and uncommons', 'Examples'],
      topShapes(tagUncondShapes, 10).map(([k, s]) => [k, s.count, s.bulk, s.examples.join('; ')]),
    ),
  );
  lines.push('');
  lines.push('Top needs on cards with no dependency tag:');
  lines.push('');
  lines.push(
    table(
      ['First need', 'Cards', 'Commons and uncommons', 'Examples'],
      topShapes(untaggedShapes, 10).map(([k, s]) => [
        k.replace(/\|/g, '/'),
        s.count,
        s.bulk,
        s.examples.join('; '),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Lands that enter tapped');
  lines.push('');
  lines.push(
    "Lands the pack marks `entersTapped` (Un-sets left out): how `landEntry` in lands.ts reads them in a deck of the land's own colors (conditional when its chance to enter tapped is below 1 at 60 or 100 cards) against how the reader reads the tapped line.",
  );
  lines.push('');
  lines.push(
    table(
      ['landEntry', 'Reader', 'Lands'],
      [...landTab.entries()].sort().map(([k, v]) => [...k.split('|'), v]),
    ),
  );
  lines.push('');
  lines.push('## Speed');
  lines.push('');
  lines.push(
    `Reading: ${perK(readMs)} ms per 1,000 cards (${(readMs / 1000).toFixed(1)} s for the pack, fresh cache). Credits: ${creditCount} role and theme credits in ${(creditMs / 1000).toFixed(1)} s.`,
  );
  lines.push('');
  const summary = lines.join('\n');
  mkdirSync(path.dirname(SUMMARY), { recursive: true });
  writeFileSync(SUMMARY, summary);

  const work: string[] = ['# Card needs: the unparsed work list', ''];
  work.push(
    `Pack ${pack.version}. Every unparsed ability by shape (names, numbers, types, and mana symbols normalized), most cards first, then most commons and uncommons. ${unparsedShapes.size} shapes.`,
  );
  work.push('');
  work.push(
    table(
      ['Shape', 'Cards', 'Commons and uncommons', 'Examples'],
      topShapes(unparsedShapes, unparsedShapes.size).map(([k, s]) => [
        `\`${k.replace(/\|/g, '\\|')}\``,
        s.count,
        s.bulk,
        s.examples.join('; '),
      ]),
    ),
  );
  work.push('');
  mkdirSync(path.dirname(WORK_LIST), { recursive: true });
  writeFileSync(WORK_LIST, work.join('\n'));

  console.log(summary);
  console.log(
    `\nwrote ${path.relative(ROOT, SUMMARY).replace(/\\/g, '/')} and ${path.relative(ROOT, WORK_LIST).replace(/\\/g, '/')}`,
  );
  return 0;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/needs-report.ts')) {
  process.exitCode = main();
}
