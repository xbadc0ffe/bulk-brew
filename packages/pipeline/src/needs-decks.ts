// Unsupported cards in built decks (docs/evaluation.md): over the eval pools
// and the development pools plain-01 to plain-10, build every mono
// color the scan allows at 60 and 40, and every pool's two most promising
// commanders at 100 (as npm run eval picks them): best fit, each style the
// theme rules call viable, and Aggro, Midrange, and Control by name. For each
// deck count the cards the deck does not support (unsupportedCards in the
// core) and the roles below their minimum, by the builder that ran. Held-out
// judging pools are never read.
//
// Usage: npm run needs:decks [-- --label <name>] [--pools <substring>]
// Writes data/review/needs/decks-<label>.json (gitignored).

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BuildError,
  buildDeck,
  COLORS,
  commanderCandidates,
  configVersion,
  deckCredits,
  effectiveQuotas,
  factsFor,
  scanPool,
  templateFor,
  unsupportedCards,
  type BuildRequest,
  type CardIndex,
  type BulkBrewConfig,
  type Color,
  type Deck,
  type DeckSize,
  type Pool,
  type Settings,
  type UnsupportedCard,
} from '@bulk-brew/core';
import { arg, ROOT } from './corpus.ts';
import { createContext, loadPool } from './review/build.ts';

const PLAIN_SHAPES = ['aggro', 'midrange', 'control'];
// Development pools only: plain-11 to plain-30 and every hN- pool are held out for judging.
const DEV_POOLS = Array.from(
  { length: 10 },
  (_, i) => `data/review/pools/plain/plain-${String(i + 1).padStart(2, '0')}.json`,
);
const OUT_DIR = path.join(ROOT, 'data', 'review', 'needs');

interface DeckRow {
  pool: string;
  size: DeckSize;
  colors: string;
  commander?: string;
  /** "best" for best fit, else the style asked for by name. */
  asked: string;
  ok: boolean;
  error?: string;
  builder?: string;
  archetype?: string;
  ms: number;
  unsupported?: UnsupportedCard[];
  unsupportedCopies?: number;
  /** Roles below their minimum, counting only the copies that earn the role in this deck. */
  rolesBelowMin?: number;
  /** The same, counting every copy the tags give the role (the old count). */
  rolesBelowMinTags?: number;
  roleShort?: string[];
}

function roleCoverage(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): { earned: number; tags: number; short: string[] } {
  const archetype = config.archetypes.archetypes.find((a) => a.id === deck.archetype);
  const quotas = effectiveQuotas(templateFor(config, deck.size), archetype);
  const credits = deckCredits(deck, index, config);
  const earned = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || dc.cardId === deck.commander) continue;
    const f = factsFor(index, config, card);
    if (!f.spell) continue;
    for (const r of f.roles) {
      tags.set(r, (tags.get(r) ?? 0) + dc.qty);
      if (credits.earned(card, r)) earned.set(r, (earned.get(r) ?? 0) + dc.qty);
    }
  }
  let e = 0;
  let t = 0;
  const short: string[] = [];
  for (const [id, q] of Object.entries(quotas)) {
    if ((earned.get(id) ?? 0) < q.min) {
      e++;
      short.push(`${id} ${earned.get(id) ?? 0}/${q.min}`);
    }
    if ((tags.get(id) ?? 0) < q.min) t++;
  }
  return { earned: e, tags: t, short };
}

function build(
  rows: DeckRow[],
  base: Omit<DeckRow, 'ok' | 'ms'>,
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): void {
  const t0 = performance.now();
  try {
    const { deck } = buildDeck(request, pool, index, config);
    const ms = Math.round(performance.now() - t0);
    const unsupported = unsupportedCards(deck, index, config);
    const roles = roleCoverage(deck, index, config);
    rows.push({
      ...base,
      ok: true,
      builder: deck.explanation?.builder ?? 'classic',
      archetype: deck.archetype,
      ms,
      unsupported,
      unsupportedCopies: unsupported.reduce((n, u) => n + u.qty, 0),
      rolesBelowMin: roles.earned,
      rolesBelowMinTags: roles.tags,
      roleShort: roles.short,
    });
  } catch (err) {
    rows.push({
      ...base,
      ok: false,
      error: err instanceof BuildError ? err.message : String(err),
      ms: Math.round(performance.now() - t0),
    });
  }
}

/** The styles a request builds: best fit, the rules' viable themes, then the plain shapes. */
function styles(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colors: Color[],
): string[] | undefined {
  const scan = scanPool(pool, index, config, settings, size, colors);
  if (!scan.possible) return undefined;
  const viable = scan.archetypes.filter((a) => a.rules?.viable).map((a) => a.archetype);
  return ['best', ...viable, ...PLAIN_SHAPES];
}

function main(): number {
  const label = arg('label') ?? 'run';
  const filter = arg('pools');
  const ctx = createContext();
  const { index, config, settings } = ctx;
  const evalPools = readdirSync(path.join(ROOT, 'eval', 'pools'))
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .map((f) => `eval/pools/${f}`);
  const files = [...evalPools, ...DEV_POOLS].filter((f) => !filter || f.includes(filter));
  const rows: DeckRow[] = [];
  const t0 = performance.now();
  for (const file of files) {
    const { pool, info } = loadPool(file, index);
    const name = info.id;
    for (const size of [60, 40] as DeckSize[]) {
      for (const color of COLORS) {
        const list = styles(pool, index, config, settings, size, [color]);
        if (!list) continue;
        for (const asked of list) {
          const request: BuildRequest = {
            size,
            colors: [color],
            settings,
            id: `${name}-${size}-${color}-${asked}`,
            createdAt: 'needs',
            ...(asked === 'best' ? {} : { style: asked, requireStyle: true }),
          };
          build(rows, { pool: name, size, colors: color, asked }, request, pool, index, config);
        }
      }
    }
    const leaders = commanderCandidates(pool, index, config, settings)
      .filter((c) => c.tier !== 'possible')
      .slice(0, 2);
    for (const lead of leaders) {
      const list = styles(pool, index, config, settings, 100, lead.colors) ?? ['best'];
      for (const asked of list) {
        const request: BuildRequest = {
          size: 100,
          colors: lead.colors,
          commander: lead.id,
          settings,
          id: `${name}-100-${lead.id}-${asked}`,
          createdAt: 'needs',
          ...(asked === 'best' ? {} : { style: asked, requireStyle: true }),
        };
        build(
          rows,
          { pool: name, size: 100, colors: lead.colors.join(''), commander: lead.name, asked },
          request,
          pool,
          index,
          config,
        );
      }
    }
    console.log(`${name}: ${rows.filter((r) => r.pool === name).length} builds`);
  }

  // Per size and builder: decks, decks with an unsupported card, copies per deck, roles short.
  const lines = [
    '| size | builder | decks | with unsupported | unsupported per deck | roles < min | roles < min (tags) | build ms |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0;
  for (const size of [60, 40, 100]) {
    for (const builder of ['grow', 'classic']) {
      const ok = rows.filter((r) => r.ok && r.size === size && r.builder === builder);
      if (!ok.length) continue;
      lines.push(
        `| ${size} | ${builder} | ${ok.length} | ${ok.filter((r) => r.unsupportedCopies! > 0).length} | ${avg(ok.map((r) => r.unsupportedCopies!))} | ${avg(ok.map((r) => r.rolesBelowMin!))} | ${avg(ok.map((r) => r.rolesBelowMinTags!))} | ${avg(ok.map((r) => r.ms))} |`,
      );
    }
  }
  const failed = rows.filter((r) => !r.ok);
  console.log('');
  console.log(lines.join('\n'));
  console.log(`\n${rows.length} builds, ${failed.length} failed`);
  for (const f of failed.slice(0, 20))
    console.log(`  ${f.pool} ${f.size} ${f.colors} ${f.commander ?? ''} ${f.asked}: ${f.error}`);

  // The cards most often left unsupported in grow decks, by kind.
  const top = new Map<string, { copies: number; decks: number; kind: string; detail: string }>();
  for (const r of rows)
    if (r.ok && r.builder === 'grow')
      for (const u of r.unsupported!) {
        const key = `${u.name}|${u.kind}`;
        const t = top.get(key) ?? { copies: 0, decks: 0, kind: u.kind, detail: u.detail };
        t.copies += u.qty;
        t.decks += 1;
        top.set(key, t);
      }
  const topRows = [...top.entries()].sort((a, b) => b[1].copies - a[1].copies).slice(0, 25);
  if (topRows.length) {
    console.log('\ntop unsupported cards in grow decks:');
    for (const [key, t] of topRows)
      console.log(
        `  ${key.split('|')[0]}: ${t.kind}, ${t.copies} copies in ${t.decks} decks (${t.detail})`,
      );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `decks-${label}.json`);
  writeFileSync(
    out,
    JSON.stringify(
      {
        label,
        configVersion: configVersion(config),
        dataVersion: index.dataVersion,
        seconds: Math.round((performance.now() - t0) / 100) / 10,
        summary: lines,
        rows,
      },
      null,
      1,
    ) + '\n',
  );
  console.log(
    `\nwrote ${path.relative(ROOT, out)} in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  return 0;
}

process.exitCode = main();
