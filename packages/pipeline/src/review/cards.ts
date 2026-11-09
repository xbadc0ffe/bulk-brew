// Review tool: print card facts from the data pack and what the builder's
// matchers make of each card. Offline and deterministic.
// Usage: npm run -s review:cards -- [names or oracle ids] [--file list.txt]
//   [--tag slug [--limit n]] [--style id] [--json] [--compact]

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { suggestNames, type CardRecord, type SynergyArchetype } from '@bulk-brew/core';
import {
  cardFacts,
  cardsFromDecklist,
  cardsWithTag,
  findCard,
  formatCardFacts,
  loadReviewContext,
  similarTags,
  synergyStyle,
  type ReviewContext,
} from './card-facts.ts';

const USAGE = `usage: npm run review:cards -- [name or oracle id ...] [options]
  --file <list.txt>  every card in a decklist file, with quantities
  --tag <slug>       every card with this tag, sorted by name
  --limit <n>        cards shown for --tag (default 50, 0 for all)
  --style <id>       also show which of this style's matcher clauses each card meets
  --json             one JSON array instead of text (run npm run -s to keep npm's header off stdout)
  --compact          one line per card`;

interface Args {
  names: string[];
  file?: string;
  tag?: string;
  limit: number;
  style?: string;
  json: boolean;
  compact: boolean;
}

function parseArgs(argv: string[]): Args | string {
  const args: Args = { names: [], limit: 50, json: false, compact: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = (): string | undefined => {
      const v = argv[++i];
      return v === undefined || v.startsWith('--') ? undefined : v;
    };
    if (a === '--json') args.json = true;
    else if (a === '--compact') args.compact = true;
    else if (a === '--file' || a === '--tag' || a === '--style' || a === '--limit') {
      const v = value();
      if (v === undefined) return `${a} needs a value\n${USAGE}`;
      if (a === '--file') args.file = v;
      else if (a === '--tag') args.tag = v;
      else if (a === '--style') args.style = v;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) return `--limit must be a whole number, got "${v}"`;
        args.limit = n;
      }
    } else if (a.startsWith('--')) return `unknown option ${a}\n${USAGE}`;
    else args.names.push(a);
  }
  if (!args.names.length && !args.file && !args.tag) return USAGE;
  return args;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    console.error(args);
    return 2;
  }
  if (args.file && !existsSync(args.file)) {
    console.error(`no file ${args.file}`);
    return 2;
  }
  let ctx: ReviewContext;
  try {
    ctx = loadReviewContext();
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
  const { index, config } = ctx;

  let style: SynergyArchetype | undefined;
  if (args.style) {
    const found = synergyStyle(config, args.style);
    if (typeof found === 'string') {
      console.error(found);
      return 2;
    }
    style = found;
  }

  let failed = false;
  const list: { card: CardRecord; qty?: number }[] = [];
  for (const name of args.names) {
    const card = findCard(index, name);
    if (card) list.push({ card });
    else {
      const hint = suggestNames(index, name);
      console.error(`no card "${name}"${hint.length ? `; did you mean ${hint.join(', ')}?` : ''}`);
      failed = true;
    }
  }
  if (args.file) {
    const { cards, unresolved } = cardsFromDecklist(index, readFileSync(args.file, 'utf8'));
    list.push(...cards);
    const copies = cards.reduce((s, c) => s + c.qty, 0);
    console.error(`${path.basename(args.file)}: ${cards.length} cards, ${copies} copies`);
    for (const line of unresolved) console.error(`  no card for line: ${line}`);
    if (unresolved.length) failed = true;
  }
  if (args.tag) {
    const tagged = cardsWithTag(index, args.tag);
    if (!tagged.length) {
      const near = similarTags(index, args.tag);
      console.error(
        `no card has the tag "${args.tag}"${near.length ? `; tags containing it: ${near.join(', ')}` : ''}`,
      );
      failed = true;
    } else {
      const shown = args.limit ? tagged.slice(0, args.limit) : tagged;
      console.error(`${args.tag}: ${tagged.length} cards, showing ${shown.length} by name`);
      for (const card of shown) list.push({ card });
    }
  }

  const sheets = list.map(({ card, qty }) => {
    const opts: { style?: SynergyArchetype; qty?: number } = {};
    if (style) opts.style = style;
    if (qty !== undefined) opts.qty = qty;
    return cardFacts(card, config, index, opts);
  });
  if (args.json) console.log(JSON.stringify(sheets, null, 2));
  else if (sheets.length) {
    const text = sheets.map((s) => formatCardFacts(s, { compact: args.compact }));
    console.log(text.join(args.compact ? '\n' : '\n\n'));
  }
  return failed ? 1 : 0;
}

// Piping into head closes stdout early; that is not an error.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

process.exitCode = main();
