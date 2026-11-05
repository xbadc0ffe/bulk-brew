// Learned data: what real decks do, turned into numbers by the developer-side
// learning script (npm run learn:build). Two parts:
//
// - Tag and style level (config/learned/*.json): plan profiles per style and
//   size, and tag fit and tag pairs. Small, bundled with the config, and part
//   of the config version.
// - Card level (data/learned.json): per-card plan fit, commander plans and
//   card fit, card pairs, and combos. Loaded beside the card data and
//   attached to the card index. Optional: without it the builder falls back
//   to the tag level, so a missing or broken file never breaks a build.
//
// Platform-free like the rest of the core.

import type { BulkBrewConfig } from './config.ts';
import { COLOR_CLASSES, type ClassShares, type ColorClass } from './colors.ts';
import type { DeckSize } from './types.ts';

/** A feature's spread over a plan's real decks: [first quartile, median, third quartile]. */
export type Spread = [number, number, number];

/** What real decks of one plan at one size look like, as shares of their spells. */
export interface LearnedPlan {
  /** Real decks behind the profile. */
  decks: number;
  /** Decks that run the plan, decks that only meet the style, or EDHREC's theme decks. */
  source: 'plan' | 'met' | 'edhrec';
  /** One spread per feature of the size (see LearnedPlanSize.features); null when unscored. */
  q: (Spread | null)[];
  /** Land count spread. */
  lands: Spread;
}

export interface LearnedPlanSize {
  /** Feature names, in the order every plan's `q` lists them. */
  features: string[];
  /** Spread of each feature over every deck of the size, for scaling distances. */
  all: (Spread | null)[];
  /** By style id; "shape" for decks with no theme, "tribal" for every tribe. */
  plans: Record<string, LearnedPlan>;
  /**
   * Calibrated weight, in log form, of each plan when best fit picks one (a
   * style id, "tribal", or a plain shape id), so each is picked about as
   * often as real decks of the size run it (see plan.ts).
   */
  bias?: Record<string, number>;
  /** At 100, the weights for a commander the EDHREC data does not cover. */
  biasNoCommander?: Record<string, number>;
}

/** config/learned/plans.json */
export interface LearnedPlansConfig {
  version: string;
  /** Per style, the share of random bulk spell copies of each color class that are its theme cards. */
  bulkShare: Record<string, ClassShares>;
  /** The same for tribes, by creature type: members and cards that reward the type. */
  tribeShare: Record<string, ClassShares>;
  sizes: Partial<Record<'100' | '60' | '40' | '20', LearnedPlanSize>>;
}

/** config/learned/tags.json */
export interface LearnedTagsConfig {
  version: string;
  /** Per style: how much more often its real decks' spells carry a tag than random bulk does. */
  fit: Record<string, Record<string, number>>;
  /** Tags real decks play together more often than chance: [tag, tag, lift]. */
  pairs: [string, string, number][];
}

export interface LearnedConfig {
  plans: LearnedPlansConfig;
  tags: LearnedTagsConfig;
}

/** The shape of data/learned.json this core reads; a file of another shape is not used. */
export const LEARNED_SCHEMA = 1;

/** data/learned.json, as written by the learning script. Cards are indexes into `ids`. */
export interface LearnedDataFile {
  schema: number;
  version: string;
  /** Where the numbers came from: corpus data version, EDHREC fetch date, Spellbook timestamp. */
  sources: Record<string, string>;
  /** Oracle ids the lists refer to by position. */
  ids: string[];
  /** Per style: [card, lift] for cards the data covers well. */
  fit: Record<string, [number, number][]>;
  /** Per commander: [card, plan shares by style, [card, fit][]]. */
  commanders: [number, Record<string, number>, [number, number][]][];
  /** Card pairs real decks play together more often than chance: [card, card, lift]. */
  pairs: [number, number, number][];
  /**
   * Combos: [Spellbook variant id, cards, the card that must be the commander
   * or -1, result ids, bracket tag, legality bits (1 Commander, 2 Vintage)].
   */
  combos: [string, number[], number, number[], string, number][];
  /** Result names by id. */
  results: Record<string, string>;
}

export interface Combo {
  /** Spellbook variant id; https://commanderspellbook.com/combo/<id> has the steps. */
  id: string;
  cards: string[];
  /** A card that only works as the commander. */
  commander?: string;
  results: string[];
  /** R Ruthless, S Spicy, P Powerful, O Oddball, C Core, E Exhibition, B Banned. */
  bracket: string;
  commanderLegal: boolean;
  /** Legal in Vintage: usable at 60, 40, and 20. */
  vintageLegal: boolean;
}

export interface CommanderFit {
  /** Share of the commander's decks that run each style. */
  plans: Record<string, number>;
  /** How much more the commander's decks play a card than decks of its colors do. */
  cards: Map<string, number>;
}

/** Card-level learned data in lookup form. */
export class LearnedCards {
  /** The file as loaded, to hand to a worker. */
  readonly file: LearnedDataFile;
  readonly version: string;
  readonly sources: Record<string, string>;
  /** Style -> card id -> lift. */
  readonly fit = new Map<string, Map<string, number>>();
  readonly commanders = new Map<string, CommanderFit>();
  /** Card id -> partner id -> lift, both directions. */
  readonly pairs = new Map<string, Map<string, number>>();
  readonly combos: Combo[] = [];
  /** Card id -> combos it is part of. */
  readonly combosByCard = new Map<string, Combo[]>();

  constructor(file: LearnedDataFile) {
    this.file = file;
    this.version = file.version;
    this.sources = file.sources;
    const id = (i: number) => file.ids[i]!;
    for (const [style, list] of Object.entries(file.fit)) {
      const m = new Map<string, number>();
      for (const [c, lift] of list) m.set(id(c), lift);
      this.fit.set(style, m);
    }
    for (const [c, plans, cards] of file.commanders)
      this.commanders.set(id(c), { plans, cards: new Map(cards.map(([x, v]) => [id(x), v])) });
    const pair = (a: string, b: string, v: number) => {
      let m = this.pairs.get(a);
      if (!m) this.pairs.set(a, (m = new Map()));
      m.set(b, v);
    };
    for (const [a, b, v] of file.pairs) {
      pair(id(a), id(b), v);
      pair(id(b), id(a), v);
    }
    for (const [cid, cards, cmd, results, bracket, legal] of file.combos) {
      const combo: Combo = {
        id: cid,
        cards: cards.map(id),
        results: results.map((r) => file.results[String(r)] ?? String(r)),
        bracket,
        commanderLegal: (legal & 1) !== 0,
        vintageLegal: (legal & 2) !== 0,
      };
      if (cmd >= 0) combo.commander = id(cmd);
      this.combos.push(combo);
      for (const c of combo.cards) {
        let list = this.combosByCard.get(c);
        if (!list) this.combosByCard.set(c, (list = []));
        list.push(combo);
      }
    }
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSpread = (v: unknown): v is Spread => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) return false;
  const [a, b, c] = v as Spread;
  return a <= b && b <= c;
};

/** Shape checks for the bundled learned config. Empty means valid. */
export function validateLearnedConfig(c: LearnedConfig, styleIds: Set<string>): string[] {
  const problems: string[] = [];
  const { plans, tags } = c;
  if (typeof plans?.version !== 'string' || !plans.version)
    return ['learned.plans: version must be a non-empty string'];
  if (typeof tags?.version !== 'string' || !tags.version)
    return ['learned.tags: version must be a non-empty string'];
  for (const [key, table] of [
    ['bulkShare', plans.bulkShare],
    ['tribeShare', plans.tribeShare],
  ] as const)
    for (const [style, shares] of Object.entries(table ?? {}))
      for (const [c, v] of Object.entries(shares ?? {}))
        if (!COLOR_CLASSES.includes(c as ColorClass) || !isNum(v) || v <= 0 || v > 1)
          problems.push(
            `learned.plans.${key}.${style}.${c}: must be a share above 0 for a color class`,
          );
  const known = (s: string) => s === 'shape' || s === 'tribal' || styleIds.has(s);
  for (const [size, block] of Object.entries(plans.sizes ?? {})) {
    const w = `learned.plans.sizes.${size}`;
    if (!block || !Array.isArray(block.features) || !Array.isArray(block.all)) {
      problems.push(`${w}: features and all must be lists`);
      continue;
    }
    const n = block.features.length;
    if (block.all.length !== n) problems.push(`${w}.all: needs one entry per feature`);
    for (const [k, v] of Object.entries({ ...block.bias, ...block.biasNoCommander }))
      if (!isNum(v)) problems.push(`${w}.bias.${k}: must be a number`);
    for (const [style, p] of Object.entries(block.plans ?? {})) {
      if (!known(style)) problems.push(`${w}.plans.${style}: unknown style`);
      if (!isNum(p.decks) || p.decks < 1)
        problems.push(`${w}.plans.${style}.decks: must be at least 1`);
      if (!Array.isArray(p.q) || p.q.length !== n)
        problems.push(`${w}.plans.${style}.q: needs one entry per feature`);
      else if (p.q.some((s) => s !== null && !isSpread(s)))
        problems.push(`${w}.plans.${style}.q: each entry is null or [q1, median, q3]`);
      if (!isSpread(p.lands)) problems.push(`${w}.plans.${style}.lands: must be [q1, median, q3]`);
    }
  }
  for (const [style, fit] of Object.entries(tags.fit ?? {})) {
    if (!known(style)) problems.push(`learned.tags.fit.${style}: unknown style`);
    for (const [tag, v] of Object.entries(fit))
      if (!isNum(v) || v <= 0) problems.push(`learned.tags.fit.${style}.${tag}: must be positive`);
  }
  if (!Array.isArray(tags.pairs)) problems.push('learned.tags.pairs: must be a list');
  else if (tags.pairs.some((p) => !Array.isArray(p) || p.length !== 3 || !isNum(p[2])))
    problems.push('learned.tags.pairs: each entry is [tag, tag, lift]');
  return problems;
}

/** Parse and check data/learned.json. Returns undefined, with the reason, when it cannot be used. */
export function parseLearnedData(
  json: string,
): { data: LearnedCards; problems: [] } | { data: undefined; problems: string[] } {
  let file: LearnedDataFile;
  try {
    file = JSON.parse(json) as LearnedDataFile;
  } catch (err) {
    return { data: undefined, problems: [`not JSON: ${String(err)}`] };
  }
  const problems: string[] = [];
  // A cached file from an older or newer release may have another shape.
  if (file?.schema !== LEARNED_SCHEMA)
    return {
      data: undefined,
      problems: [`schema ${String(file?.schema)}, want ${LEARNED_SCHEMA}`],
    };
  if (typeof file.version !== 'string') problems.push('version missing');
  if (!Array.isArray(file.ids)) problems.push('ids missing');
  const n = Array.isArray(file.ids) ? file.ids.length : 0;
  const ok = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n;
  if (problems.length === 0) {
    try {
      checkEntries(file, ok, problems);
    } catch (err) {
      problems.push(`malformed entry: ${String(err)}`);
    }
  }
  if (problems.length) return { data: undefined, problems };
  return { data: new LearnedCards(file), problems: [] };
}

/** Entry checks; throws on entries that are not even lists, which the caller reports. */
function checkEntries(
  file: LearnedDataFile,
  ok: (i: unknown) => boolean,
  problems: string[],
): void {
  for (const [style, list] of Object.entries(file.fit ?? {}))
    if (!Array.isArray(list) || list.some(([c, v]) => !ok(c) || !isNum(v)))
      problems.push(`fit.${style}: bad entry`);
  if (!Array.isArray(file.commanders) || file.commanders.some(([c]) => !ok(c)))
    problems.push('commanders: bad entry');
  if (!Array.isArray(file.pairs) || file.pairs.some(([a, b, v]) => !ok(a) || !ok(b) || !isNum(v)))
    problems.push('pairs: bad entry');
  if (
    !Array.isArray(file.combos) ||
    file.combos.some(
      ([, cards, cmd]) => !Array.isArray(cards) || !cards.every(ok) || (cmd !== -1 && !ok(cmd)),
    )
  )
    problems.push('combos: bad entry');
}

/**
 * The learned data a pool can use: only entries whose cards are all in
 * `keep` (a commander's plans and fit when the commander is), so a worker
 * that builds from one pool is not sent the whole file.
 */
export function trimLearned(file: LearnedDataFile, keep: ReadonlySet<string>): LearnedDataFile {
  const ids: string[] = [];
  const map = new Map<number, number>();
  const at = (i: number) => {
    let j = map.get(i);
    if (j === undefined) {
      j = ids.length;
      ids.push(file.ids[i]!);
      map.set(i, j);
    }
    return j;
  };
  const has = (i: number) => keep.has(file.ids[i]!);
  const fit: LearnedDataFile['fit'] = {};
  for (const [style, list] of Object.entries(file.fit))
    fit[style] = list.filter(([c]) => has(c)).map(([c, v]) => [at(c), v]);
  return {
    ...file,
    ids,
    fit,
    commanders: file.commanders
      .filter(([c]) => has(c))
      .map(([c, plans, cards]) => [
        at(c),
        plans,
        cards.filter(([x]) => has(x)).map(([x, v]) => [at(x), v]),
      ]),
    pairs: file.pairs.filter(([a, b]) => has(a) && has(b)).map(([a, b, v]) => [at(a), at(b), v]),
    combos: file.combos
      .filter(([, cards]) => cards.every(has))
      .map(([id, cards, cmd, results, bracket, legal]) => [
        id,
        cards.map(at),
        cmd >= 0 ? at(cmd) : -1,
        results,
        bracket,
        legal,
      ]),
  };
}

/** The size key learned plans use. */
export function learnedSizeKey(size: DeckSize): '100' | '60' | '40' | '20' {
  return String(size) as '100' | '60' | '40' | '20';
}

/** Whether a size builds with the learned plans (builderWeights.learned.plan[size].use). */
export function learnedAt(config: BulkBrewConfig, size: DeckSize): boolean {
  const plan = config.builderWeights.learned?.plan;
  if (!plan || !config.learned) return false;
  return (size === 100 ? (plan['100'] ?? plan['60']) : plan[learnedSizeKey(size) as '60']).use;
}

/** The learned profile of a style at a size: tribes share one, shapes are "shape". */
export function learnedPlanFor(
  config: BulkBrewConfig,
  style: string,
  size: DeckSize,
): LearnedPlan | undefined {
  const block = config.learned?.plans.sizes[learnedSizeKey(size)];
  if (!block) return undefined;
  return block.plans[style.startsWith('tribal:') ? 'tribal' : style];
}

/** Position of a named feature in a size's learned profiles, or -1. */
export function learnedFeature(config: BulkBrewConfig, size: DeckSize, name: string): number {
  return config.learned?.plans.sizes[learnedSizeKey(size)]?.features.indexOf(name) ?? -1;
}

/** Spell slots at a template's base land count; the commander takes one of the 100. */
export function baseSpellSlots(config: BulkBrewConfig, size: DeckSize): number {
  const t = config.deckTemplates.templates[String(size)];
  return (t?.size ?? size) - (size === 100 ? 1 : 0) - (t?.baseLands ?? 0);
}

/**
 * Theme copies real decks running a style hold, scaled to a slot count
 * (the size's base spell slots by default): the lower quarter as the
 * minimum and the median as the target. Only for styles enough real decks
 * run (source "plan"); undefined otherwise.
 */
export function learnedTheme(
  config: BulkBrewConfig,
  style: string,
  size: DeckSize,
  slots = baseSpellSlots(config, size),
):
  | { min: { enablers: number; payoffs: number }; target: { enablers: number; payoffs: number } }
  | undefined {
  const plan = learnedPlanFor(config, style, size);
  if (!plan || plan.source !== 'plan') return undefined;
  const e = plan.q[learnedFeature(config, size, 'theme enablers')];
  const p = plan.q[learnedFeature(config, size, 'theme payoffs')];
  if (!e || !p) return undefined;
  return {
    min: { enablers: Math.round(e[0] * slots), payoffs: Math.round(p[0] * slots) },
    target: { enablers: Math.round(e[1] * slots), payoffs: Math.round(p[1] * slots) },
  };
}
