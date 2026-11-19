// Entry point for `npm run review:agree`: the agreement check over pool files
// (docs/evaluation.md). For each pool it checks best fit's requests (each
// color at 60, 40, and 20, the top commanders at 100): the scan, the Analyze pane's
// plan, the Build page's plan, and the builder name the same viable styles,
// every one of them can be built, and every deck built shows the setup and payoff counts its builder counted
// (checkAgreement in the core). It prints counts and style ids only, never
// card or commander names, so it can run on held-out judging pools.
//
// Usage: npm run review:agree -- [--dev] [--sizes 60,40,20,100] [--commanders 2] [pool files...]
// --dev adds the development pools: eval/pools, plain-01 to plain-10, and the
// theme pools without an hN- prefix. Exits 1 on any disagreement.

import {
  checkAgreement,
  COLORS,
  commanderCandidates,
  scanPool,
  type AgreementKind,
  type AgreementRequest,
  type DeckSize,
} from '@bulk-brew/core';
import { arg, flag } from '../corpus.ts';
import { createContext, devPools, loadPool } from './build.ts';

const VALUE_FLAGS = new Set(['--sizes', '--commanders']);

function positional(): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (VALUE_FLAGS.has(a)) i++;
    else if (!a.startsWith('--')) out.push(a);
  }
  return out;
}

function main(): number {
  const files = [...(flag('dev') ? devPools() : []), ...positional()];
  if (files.length === 0) {
    console.error('usage: npm run review:agree -- [--dev] [--sizes 60,40,20,100] [pool files...]');
    return 2;
  }
  const sizes = (arg('sizes') ?? '60,40,20,100').split(',').map(Number) as DeckSize[];
  const commanders = Number(arg('commanders') ?? 2);
  const ctx = createContext();
  const { index, config, settings } = ctx;
  const kinds = new Map<AgreementKind, number>();
  const unbuiltByStyle = new Map<string, number>();
  const lines: string[] = [];
  let requests = 0;
  let plans = 0;
  let decks = 0;
  let unbuilt = 0;
  const t0 = performance.now();
  for (const file of files) {
    const { pool, info } = loadPool(file, index);
    const jobs: { label: string; req: AgreementRequest }[] = [];
    for (const size of sizes.filter((s) => s !== 100) as (60 | 40 | 20)[])
      for (const c of COLORS)
        if (scanPool(pool, index, config, settings, size, [c]).possible)
          jobs.push({ label: `${size} ${c}`, req: { size, colors: [c] } });
    if (sizes.includes(100))
      commanderCandidates(pool, index, config, settings)
        .filter((c) => c.tier !== 'possible')
        .slice(0, commanders)
        .forEach((c, i) =>
          jobs.push({
            label: `100 commander ${i + 1}`,
            req: { size: 100, colors: c.colors, commander: c.id },
          }),
        );
    let found = 0;
    for (const { label, req } of jobs) {
      const r = checkAgreement(req, pool, index, config, settings);
      requests += 1;
      plans += r.plans.length;
      decks += r.decks;
      unbuilt += r.unbuilt.length;
      for (const s of r.unbuilt) unbuiltByStyle.set(s, (unbuiltByStyle.get(s) ?? 0) + 1);
      for (const d of r.issues) {
        kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1);
        lines.push(`  ${info.id} ${label} ${d.kind}${d.style ? ` ${d.style}` : ''}: ${d.detail}`);
        found += 1;
      }
    }
    console.log(`${info.id}: ${jobs.length} requests, ${found} disagreements`);
  }
  const total = [...kinds.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\n${files.length} pools, ${requests} requests, ${plans} planned styles, ${decks} decks checked in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  console.log(
    `planned but not built (counted below as unbuilt): ${unbuilt}${
      unbuilt
        ? ` (${[...unbuiltByStyle]
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${s} ${n}`)
            .join(', ')})`
        : ''
    }`,
  );
  console.log(`disagreements: ${total}`);
  for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
  if (lines.length) console.log(lines.slice(0, 200).join('\n'));
  return total > 0 ? 1 : 0;
}

process.exitCode = main();
