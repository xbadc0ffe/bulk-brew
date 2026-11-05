// Learn from the reference corpus: what real decks of each size look like
// next to our templates, which themes appear under which commanders, which
// card traits curated decks favor over random bulk, and, for draft decks,
// which shapes and traits go with winning. Writes data/corpus/report.md and
// report.json as suggestions for config changes; it never edits config.
//
// Usage: npm run corpus:learn                 (--since 2015 for products, as corpus:eval)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CardIndex,
  cardStrength,
  configVersion,
  curveProfileFor,
  factsFor,
  parsePack,
  templateFor,
  type BulkBrewConfig,
  type CardRecord,
  type DeckSize,
  type Matcher,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { loadConfigDir } from './check-config.ts';
import {
  arg,
  CORPUS_DIR,
  CORPUS_FILE,
  CORPUS_RESULTS,
  loadCorpus,
  mean,
  median,
  noisePool,
  noiseSource,
  quantile,
  recordsOf,
  ROOT,
  round,
  shapeOf,
  stylesMet,
  type CorpusDeck,
  type DeckShape,
} from './corpus.ts';

const REPORT_MD = path.join(CORPUS_DIR, 'report.md');
const REPORT_JSON = path.join(CORPUS_DIR, 'report.json');
const MIN_COMMANDERS = 4;
const MIN_LIFT = 2;
const MIN_SHARE = 0.06;
const MIN_PRODUCTS = 3;

type Stat = { label: string; get: (s: DeckShape) => number };

function stats(config: BulkBrewConfig, size: DeckSize): Stat[] {
  const share = (n: number, s: DeckShape) => (s.spells > 0 ? n / s.spells : 0);
  const out: Stat[] = [
    { label: 'lands', get: (s) => s.lands },
    { label: 'nonbasic lands', get: (s) => s.nonbasics },
    { label: 'average mana value', get: (s) => s.avgMv },
    { label: 'creature share', get: (s) => share(s.creatures, s) },
    { label: 'instant and sorcery share', get: (s) => share(s.instSorc, s) },
    { label: 'noncreature permanent share', get: (s) => share(s.ncPerm, s) },
    { label: 'distinct spells', get: (s) => s.distinct },
  ];
  for (let b = 1; b <= 7; b++)
    out.push({
      label: `curve share ${b === 7 ? '7+' : b}${b === 1 ? ' (with 0)' : ''}`,
      get: (s) => share(s.curve[b]! + (b === 1 ? s.curve[0]! : 0), s),
    });
  for (const id of Object.keys(templateFor(config, size).roles))
    out.push({ label: `role ${id}`, get: (s) => s.roles[id] ?? 0 });
  return out;
}

interface TemplateValue {
  text: string;
  /** A point should sit inside the middle half; a floor or ceiling should not cut into it. */
  min?: number;
  max?: number;
  point?: number;
}

/** What our template says for a stat. */
function templateValue(
  config: BulkBrewConfig,
  size: DeckSize,
  label: string,
): TemplateValue | undefined {
  const t = templateFor(config, size);
  const m = t.typeMix;
  if (label === 'lands')
    return {
      text: `${t.baseLands} (${t.landFormula.min} to ${t.landFormula.max})`,
      point: t.baseLands,
    };
  if (label === 'creature share')
    return { text: `${m.creatureMin} to ${m.creatureMax}`, min: m.creatureMin, max: m.creatureMax };
  if (label === 'instant and sorcery share')
    return { text: `at least ${m.instantSorceryMin}`, min: m.instantSorceryMin };
  if (label === 'noncreature permanent share')
    return { text: `at most ${m.noncreaturePermanentMax}`, max: m.noncreaturePermanentMax };
  const curve = /^curve share (\d)/.exec(label);
  if (curve) {
    const v = curveProfileFor(config, t.curveProfile).shape[Number(curve[1]) - 1] ?? 0;
    return { text: `${v} (${t.curveProfile})`, point: v };
  }
  const role = /^role (\w+)$/.exec(label);
  if (role) {
    const q = t.roles[role[1]!];
    if (q) return { text: `${q.min} min, ${q.target} target`, point: q.target };
  }
  return undefined;
}

function outsideMiddle(tv: TemplateValue | undefined, lo: number, hi: number): string {
  if (!tv) return '';
  const e = 1e-9;
  if (tv.point !== undefined) return tv.point < lo - e ? 'below' : tv.point > hi + e ? 'above' : '';
  if (tv.min !== undefined && tv.min > lo + e) return 'floor too high';
  if (tv.max !== undefined && tv.max < hi - e) return 'ceiling too low';
  return '';
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Tags any synergy style or synergy rule reads, mapped to who reads them. */
function coveredTags(config: BulkBrewConfig): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (m: Matcher, who: string) => {
    for (const c of m)
      for (const t of [...(c.anyTags ?? []), ...(c.allTags ?? [])]) {
        const list = out.get(t) ?? [];
        if (!list.includes(who)) list.push(who);
        out.set(t, list);
      }
  };
  for (const a of config.archetypes.archetypes) {
    if (a.kind !== 'synergy') continue;
    add(a.enablers, a.id);
    add(a.payoffs, a.id);
  }
  for (const r of config.roles.roles) add(r.match, `role:${r.id}`);
  return out;
}

function spellTags(
  cards: [CardRecord, number][],
  index: CardIndex,
  config: BulkBrewConfig,
): { tags: Map<string, number>; spells: number } {
  const tags = new Map<string, number>();
  let spells = 0;
  for (const [card, qty] of cards) {
    if (!factsFor(index, config, card).spell) continue;
    spells += qty;
    for (const t of card.tags) tags.set(t, (tags.get(t) ?? 0) + qty);
  }
  return { tags, spells };
}

const partCache = new Map<string, string[]>();
/** Labels of the card strength parts a card scores, positive or negative. */
function partsOf(card: CardRecord, config: BulkBrewConfig): string[] {
  let out = partCache.get(card.id);
  if (!out)
    partCache.set(
      card.id,
      (out = cardStrength(card, config.cardStrength).parts.map((x) => x.label)),
    );
  return out;
}

function main(): number {
  if (!existsSync(CORPUS_FILE)) {
    console.error('no corpus at data/corpus/decks.json; run npm run corpus:fetch first');
    return 1;
  }
  const since = arg('since') ?? '2015';
  const index = new CardIndex(
    parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8')),
  );
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const corpus = loadCorpus();
  const covered = coveredTags(config);
  const coverText = (t: string) => covered.get(t)?.join(', ') ?? 'not covered';
  const md: string[] = [];
  const json: Record<string, unknown> = {
    builtAt: new Date().toISOString(),
    configVersion: configVersion(config),
    since,
  };
  const p = (s = '') => md.push(s);

  // Which decks speak for each size: products since the cutoff, drafts and local lists always.
  const recent = (d: CorpusDeck) => !d.released || d.released.slice(0, 4) >= since;
  const groups: { key: string; size: DeckSize; decks: CorpusDeck[] }[] = [
    {
      key: '100 Commander precons and local lists',
      size: 100,
      decks: corpus.decks.filter((d) => d.size === 100 && recent(d)),
    },
    {
      key: '60 preconstructed decks',
      size: 60,
      decks: corpus.decks.filter((d) => d.size === 60 && recent(d)),
    },
    {
      key: '40 draft decks',
      size: 40,
      decks: corpus.decks.filter((d) => d.size === 40 && d.source === 'draft'),
    },
    {
      key: '20 Jumpstart packets',
      size: 20,
      decks: corpus.decks.filter((d) => d.size === 20 && recent(d)),
    },
  ];
  const cards = new Map<string, [CardRecord, number][]>();
  const shapes = new Map<string, DeckShape>();
  for (const g of groups)
    for (const d of g.decks) {
      const c = recordsOf(index, d.cards);
      cards.set(d.id, c);
      shapes.set(d.id, shapeOf(c, index, config));
    }

  p('# Corpus report');
  p();
  p(
    `Built ${json.builtAt} with config ${json.configVersion}. Products released ${since} or later; draft and local decks always. Suggestions only: nothing here changes config.`,
  );
  p();
  for (const g of groups) p(`- ${g.key}: ${g.decks.length}`);

  // 1. Shape against the templates.
  p();
  p('## 1. Deck shape next to our templates');
  p();
  p(
    'Median with the middle half of decks in brackets. The flag says where our template sits against that middle half: a target below or above it, or a floor or ceiling that cuts into it.',
  );
  const shapeJson: Record<string, unknown> = {};
  for (const g of groups) {
    if (g.decks.length === 0) continue;
    p();
    p(`### ${g.key}`);
    p();
    p('| stat | corpus median [middle half] | our template | |');
    p('| --- | --- | --- | --- |');
    const rows: Record<string, unknown> = {};
    for (const st of stats(config, g.size)) {
      const xs = g.decks.map((d) => st.get(shapes.get(d.id)!));
      const lo = quantile(xs, 0.25);
      const hi = quantile(xs, 0.75);
      const tv = templateValue(config, g.size, st.label);
      const flagText = outsideMiddle(tv, lo, hi);
      p(
        `| ${st.label} | ${round(median(xs))} [${round(lo)} to ${round(hi)}] | ${tv?.text ?? ''} | ${flagText} |`,
      );
      rows[st.label] = {
        median: round(median(xs), 3),
        lo: round(lo, 3),
        hi: round(hi, 3),
        template: tv?.text,
        flag: flagText,
      };
    }
    shapeJson[g.key] = rows;
  }
  json.shape = shapeJson;

  // 2. Draft decks: what goes with winning.
  const drafts = groups[2]!.decks.filter((d) => (d.games ?? 0) >= 5);
  if (drafts.length >= 100) {
    p();
    p('## 2. Draft decks: what goes with winning');
    p();
    p(
      `${drafts.length} decks with five or more games. Correlation with win rate (positive means more of it goes with winning), and the means of the best and worst quarter by win rate.`,
    );
    p();
    const wr = drafts.map((d) => d.wins! / d.games!);
    const q1 = quantile(wr, 0.25);
    const q3 = quantile(wr, 0.75);
    const top = drafts.filter((_, i) => wr[i]! >= q3);
    const bottom = drafts.filter((_, i) => wr[i]! <= q1);
    const strengthOf = (d: CorpusDeck) => {
      const s: number[] = [];
      for (const [card, qty] of cards.get(d.id)!) {
        const f = factsFor(index, config, card);
        if (f.spell) for (let i = 0; i < qty; i++) s.push(f.strength);
      }
      return mean(s);
    };
    p('| stat | correlation | best quarter | worst quarter |');
    p('| --- | ---: | ---: | ---: |');
    const rows: Record<string, unknown> = {};
    const all = stats(config, 40);
    for (const st of all) {
      const xs = drafts.map((d) => st.get(shapes.get(d.id)!));
      const r = pearson(xs, wr);
      const t = mean(top.map((d) => st.get(shapes.get(d.id)!)));
      const b = mean(bottom.map((d) => st.get(shapes.get(d.id)!)));
      p(`| ${st.label} | ${round(r, 3)} | ${round(t)} | ${round(b)} |`);
      rows[st.label] = { r: round(r, 3), best: round(t, 3), worst: round(b, 3) };
    }
    const sx = drafts.map(strengthOf);
    p(
      `| our average card strength | ${round(pearson(sx, wr), 3)} | ${round(mean(top.map(strengthOf)))} | ${round(mean(bottom.map(strengthOf)))} |`,
    );
    rows['card strength'] = { r: round(pearson(sx, wr), 3) };
    // Each strength part: copies per deck carrying it.
    const partCount = (d: CorpusDeck, label: string) => {
      let n = 0;
      for (const [card, qty] of cards.get(d.id)!) {
        if (!factsFor(index, config, card).spell) continue;
        if (partsOf(card, config).includes(label)) n += qty;
      }
      return n;
    };
    const labels = new Set<string>();
    for (const d of drafts.slice(0, 500))
      for (const [card] of cards.get(d.id)!)
        for (const label of partsOf(card, config)) labels.add(label);
    p();
    p('Copies per deck of cards that score each part of our card strength, against win rate:');
    p();
    p('| strength part | correlation | best quarter | worst quarter |');
    p('| --- | ---: | ---: | ---: |');
    const parts: Record<string, unknown> = {};
    for (const label of [...labels].sort()) {
      const xs = drafts.map((d) => partCount(d, label));
      const r = pearson(xs, wr);
      p(
        `| ${label} | ${round(r, 3)} | ${round(mean(top.map((d) => partCount(d, label))))} | ${round(mean(bottom.map((d) => partCount(d, label))))} |`,
      );
      parts[label] = round(r, 3);
    }
    json.drafts = { decks: drafts.length, stats: rows, strengthParts: parts };
  }

  // 3. Commander plans: card tags that crowd around a commander tag.
  const cmdDecks = groups[0]!.decks.filter((d) => d.commander?.length);
  const base = new Map<string, number>();
  const perDeck = new Map<string, { tags: Map<string, number>; spells: number }>();
  for (const d of cmdDecks) {
    const t = spellTags(cards.get(d.id)!, index, config);
    perDeck.set(d.id, t);
    for (const [tag, n] of t.tags)
      base.set(tag, (base.get(tag) ?? 0) + n / t.spells / cmdDecks.length);
  }
  const byCmdTag = new Map<string, CorpusDeck[]>();
  for (const d of cmdDecks)
    for (const id of d.commander!)
      for (const t of index.get(id)?.tags ?? []) {
        const list = byCmdTag.get(t) ?? [];
        if (!list.includes(d)) list.push(d);
        byCmdTag.set(t, list);
      }
  const plans: {
    commanderTag: string;
    commanders: number;
    tags: { tag: string; share: number; lift: number; covered: string }[];
  }[] = [];
  // Commander tags that pick out the same decks say the same thing: one row for them.
  const seenSets = new Map<string, number>();
  const productOf = (d: CorpusDeck) => d.id.split('_').at(-1) ?? d.id;
  for (const [ct, decks] of [...byCmdTag.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (decks.length < MIN_COMMANDERS || decks.length > cmdDecks.length / 3) continue;
    // Several products, so one product's mechanic does not pass for a commander plan.
    if (new Set(decks.map(productOf)).size < MIN_PRODUCTS) continue;
    const key = decks
      .map((d) => d.id)
      .sort()
      .join('|');
    const at = seenSets.get(key);
    if (at !== undefined) {
      plans[at]!.commanderTag += `, ${ct}`;
      continue;
    }
    const share = new Map<string, number>();
    const support = new Map<string, CorpusDeck[]>();
    for (const d of decks) {
      const t = perDeck.get(d.id)!;
      for (const [tag, n] of t.tags) {
        share.set(tag, (share.get(tag) ?? 0) + n / t.spells / decks.length);
        if (n / t.spells >= MIN_SHARE) support.set(tag, [...(support.get(tag) ?? []), d]);
      }
    }
    // Common in most of the decks, and in decks from more than one product.
    const backed = (tag: string) => {
      const list = support.get(tag) ?? [];
      return list.length >= decks.length / 2 && new Set(list.map(productOf)).size >= 2;
    };
    const tags = [...share.entries()]
      .filter(([tag]) => backed(tag))
      .map(([tag, s]) => ({
        tag,
        share: round(s, 3),
        lift: round(s / (base.get(tag) ?? 1), 1),
        covered: coverText(tag),
      }))
      .filter((x) => x.share >= MIN_SHARE && x.lift >= MIN_LIFT)
      .sort((a, b) => b.lift * b.share - a.lift * a.share)
      .slice(0, 6);
    if (tags.length) {
      seenSets.set(key, plans.length);
      plans.push({ commanderTag: ct, commanders: decks.length, tags });
    }
  }
  plans.sort((a, b) => b.tags[0]!.lift * b.tags[0]!.share - a.tags[0]!.lift * a.tags[0]!.share);
  p();
  p('## 3. Commander plans');
  p();
  p(
    `Card tags over-represented in the 99 of commanders that carry a tag: ${MIN_COMMANDERS}+ commanders from ${MIN_PRODUCTS}+ products, the tag on at most a third of all commanders; the card tag makes up ${MIN_SHARE}+ of the spells in at least half of those decks, at ${MIN_LIFT}+ times its share across all Commander decks. "Not covered" means no style or role reads the tag: a candidate for a new style.`,
  );
  p();
  p('| commander tag | commanders | card tags: share of spells, lift, read by |');
  p('| --- | ---: | --- |');
  for (const pl of plans.slice(0, 60))
    p(
      `| ${pl.commanderTag} | ${pl.commanders} | ${pl.tags.map((t) => `${t.tag} ${t.share} x${t.lift} (${t.covered})`).join('; ')} |`,
    );
  json.commanderPlans = plans;

  // 4. Theme coverage: decks our styles describe, and what the rest share.
  p();
  p('## 4. Theme coverage');
  p();
  p(
    'Share of decks that meet at least one of our synergy styles at their size, the styles met most, and, among decks that meet none, the tags over-represented in the most of them (lift 3+ over the size, share 8%+).',
  );
  const coverage: Record<string, unknown> = {};
  for (const g of groups) {
    if (g.decks.length === 0) continue;
    const met = new Map<string, number>();
    const none: CorpusDeck[] = [];
    const sizeBase = new Map<string, number>();
    const tagsOf = new Map<string, { tags: Map<string, number>; spells: number }>();
    for (const d of g.decks) {
      const lead =
        d.size === 100 && d.commander?.length === 1 ? index.get(d.commander[0]!) : undefined;
      const s = stylesMet(cards.get(d.id)!, g.size, index, config, lead);
      for (const id of s) met.set(id, (met.get(id) ?? 0) + 1);
      if (s.length === 0) none.push(d);
      const t = spellTags(cards.get(d.id)!, index, config);
      tagsOf.set(d.id, t);
      for (const [tag, n] of t.tags)
        sizeBase.set(tag, (sizeBase.get(tag) ?? 0) + n / t.spells / g.decks.length);
    }
    const common = new Map<string, number>();
    for (const d of none) {
      const t = tagsOf.get(d.id)!;
      for (const [tag, n] of t.tags) {
        const s = n / t.spells;
        if (s >= 0.08 && s / (sizeBase.get(tag) ?? 1) >= 3)
          common.set(tag, (common.get(tag) ?? 0) + 1);
      }
    }
    const topCommon = [...common.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const themed = 1 - none.length / g.decks.length;
    p();
    p(
      `- **${g.key}**: ${round(themed * 100, 0)}% meet a style. Most met: ${
        [...met.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ') || 'none'
      }.`,
    );
    if (topCommon.length)
      p(
        `  Unthemed decks share: ${topCommon.map(([t, n]) => `${t} (${n} decks, ${coverText(t)})`).join('; ')}.`,
      );
    coverage[g.key] = {
      themed: round(themed, 3),
      met: Object.fromEntries(met),
      unthemedTags: Object.fromEntries(topCommon),
    };
  }
  json.coverage = coverage;

  // 5. Card traits: curated decks against random bulk.
  p();
  p('## 5. Card traits: reference decks against random bulk');
  p();
  p(
    'Share of spell copies carrying each part of our card strength, in the reference decks and in a random bulk sample, the ratio, and the average points the part adds per spell. A ratio well above 1 is a trait curated decks seek; well below 1, one they avoid. Popularity is a Commander signal, and products hold newer cards than bulk does, so read it with care.',
  );
  const noise = recordsOf(index, noisePool(noiseSource(index), 12345, 20000));
  const partShares = (list: [CardRecord, number][]) => {
    const counts = new Map<string, number>();
    const points = new Map<string, number>();
    let total = 0;
    for (const [card, qty] of list) {
      if (!factsFor(index, config, card).spell) continue;
      total += qty;
      for (const part of cardStrength(card, config.cardStrength).parts) {
        counts.set(part.label, (counts.get(part.label) ?? 0) + qty);
        points.set(part.label, (points.get(part.label) ?? 0) + part.value * qty);
      }
    }
    const per = (m: Map<string, number>) =>
      new Map([...m.entries()].map(([k, v]) => [k, v / total]));
    return { shares: per(counts), points: per(points), total };
  };
  const bulk = partShares(noise);
  const traits: Record<string, unknown> = {};
  for (const g of groups) {
    if (g.decks.length === 0) continue;
    const all: [CardRecord, number][] = g.decks.flatMap((d) => cards.get(d.id)!);
    const ref = partShares(all);
    const labels = [...new Set([...ref.shares.keys(), ...bulk.shares.keys()])].sort();
    p();
    p(`### ${g.key}`);
    p();
    p('| trait | share: reference | share: bulk | ratio | points per spell: reference | bulk |');
    p('| --- | ---: | ---: | ---: | ---: | ---: |');
    const rows: Record<string, unknown> = {};
    for (const l of labels) {
      const r = ref.shares.get(l) ?? 0;
      const b = bulk.shares.get(l) ?? 0;
      const rp = ref.points.get(l) ?? 0;
      const bp = bulk.points.get(l) ?? 0;
      p(
        `| ${l} | ${round(r, 3)} | ${round(b, 3)} | ${b > 0 ? round(r / b) : '-'} | ${round(rp, 3)} | ${round(bp, 3)} |`,
      );
      rows[l] = {
        ref: round(r, 3),
        bulk: round(b, 3),
        refPoints: round(rp, 3),
        bulkPoints: round(bp, 3),
      };
    }
    traits[g.key] = rows;
  }
  json.traits = traits;

  // 6. The latest evaluation run, if any.
  if (existsSync(CORPUS_RESULTS)) {
    // The newest run by its own timestamp; file names with a -2 suffix sort before the first.
    let last: string | undefined;
    let lastRun = '';
    for (const f of readdirSync(CORPUS_RESULTS).filter((x) => x.endsWith('.json'))) {
      const head = readFileSync(path.join(CORPUS_RESULTS, f), 'utf8').slice(0, 200);
      const runAt = /"runAt":"([^"]+)"/.exec(head)?.[1] ?? '';
      if (runAt > lastRun) {
        lastRun = runAt;
        last = f;
      }
    }
    if (last) {
      const r = JSON.parse(readFileSync(path.join(CORPUS_RESULTS, last), 'utf8')) as {
        runAt: string;
        summary: Record<string, Record<string, unknown>>;
        rows: { size: number; selfError?: string; error?: string }[];
      };
      p();
      p(`## 6. Latest evaluation (${last})`);
      p();
      p('| rows | decks | recall | style match | score | ref score | ref ahead | self fail |');
      p('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
      for (const [k, s] of Object.entries(r.summary))
        if (k.endsWith(' all'))
          p(
            `| ${k} | ${s.decks} | ${s.recall} | ${s.styleMatch} | ${s.score} | ${s.selfScore} | ${s.refAhead} | ${s.selfFailed} |`,
          );
      const reasons = new Map<string, number>();
      for (const row of r.rows) {
        const why = row.selfError
          ?.replace(/^Not enough [^:]+: /, '')
          .replace(/\d+/g, 'N')
          .replace(/spells?\b/, 'spells')
          .replace(/(White|Blue|Black|Red|Green) cards? for an? .+$/, 'cards of one color');
        if (why) reasons.set(`${row.size}: ${why}`, (reasons.get(`${row.size}: ${why}`) ?? 0) + 1);
      }
      if (reasons.size) {
        p();
        p('Why reference decks fail to build from their own cards:');
        p();
        for (const [k, v] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
          p(`- ${k} (${v})`);
      }
    }
  }

  writeFileSync(REPORT_MD, md.join('\n') + '\n');
  writeFileSync(REPORT_JSON, JSON.stringify(json, null, 1));
  console.log(`wrote ${path.relative(ROOT, REPORT_MD)} and ${path.relative(ROOT, REPORT_JSON)}`);
  return 0;
}

process.exitCode = main();
