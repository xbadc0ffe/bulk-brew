// Deck plans for measuring the builder against real decks: which style a
// reference deck runs, what real decks of a style look like (a plan
// profile), and how far a build sits from that profile. Shared by
// corpus-eval, corpus-panel, and learn-build.

import {
  colorClassOf,
  commanderTribes,
  COLOR_CLASSES,
  creatureTypes,
  curveProfileFor,
  expectedThemeCopies,
  factsFor,
  inTribe,
  minimumsFor,
  templateFor,
  type BulkBrewConfig,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type ClassShares,
  type ColorClass,
  type DeckSize,
  type Rarity,
} from '@bulk-brew/core';
import { median, noisePool, quantile } from './corpus.ts';

/** Reference decks with no theme; builds with a plain shape fold into it when compared with them. */
export const SHAPE = 'shape';
const TRIBAL = 'tribal:';
/** Plans with fewer reference decks than this borrow decks that only meet the style. */
export const MIN_PLAN_DECKS = 6;
/** Below this many decks, a reference deck is measured against its plan without itself. */
const LEAVE_ONE_OUT = 30;
const SHAPES = ['aggro', 'midrange', 'control'];

export function isComposition(config: BulkBrewConfig, style: string): boolean {
  return config.archetypes.archetypes.some((a) => a.id === style && a.kind === 'composition');
}

/** The style id profiles and the reference comparison use: shapes fold into one group. */
export function planKey(config: BulkBrewConfig, style: string | undefined): string {
  if (!style || style === SHAPE || isComposition(config, style)) return SHAPE;
  return style;
}

/** Theme tests for a style id: a config theme by its matchers, a tribe by type and tag. */
export function themeTests(
  style: string,
): { enabler: (f: CardFacts) => boolean; payoff: (f: CardFacts) => boolean } | undefined {
  if (style === SHAPE) return undefined;
  if (style.startsWith(TRIBAL)) {
    const type = style.slice(TRIBAL.length);
    const tag = `typal-${type.toLowerCase()}`;
    return { enabler: (f) => inTribe(f.card, type), payoff: (f) => f.card.tags.includes(tag) };
  }
  return { enabler: (f) => f.enablerOf.includes(style), payoff: (f) => f.payoffOf.includes(style) };
}

export interface BulkShares {
  /** Per style, the share of bulk spell copies of each color class that are its theme cards. */
  styles: Map<string, ClassShares>;
  /** Per creature type, the same for members and cards that reward the type. */
  tribes: Map<string, ClassShares>;
}

/** A small share for themes a color class never shows in the sample. */
const FLOOR_SHARE = 0.002;

/** Theme shares in a large seeded sample of random bulk, by color class. */
export function bulkThemeShares(
  index: CardIndex,
  config: BulkBrewConfig,
  source: Map<Rarity, CardRecord[]>,
): BulkShares {
  const sample = noisePool(source, 0x5eed, 60000);
  const spells = new Map<ColorClass, number>();
  const styleCounts = new Map<string, Map<ColorClass, number>>();
  const tribeCounts = new Map<string, Map<ColorClass, number>>();
  const bump = (m: Map<string, Map<ColorClass, number>>, k: string, c: ColorClass, q: number) => {
    let inner = m.get(k);
    if (!inner) m.set(k, (inner = new Map()));
    inner.set(c, (inner.get(c) ?? 0) + q);
  };
  for (const [id, qty] of sample) {
    const f = factsFor(index, config, index.get(id)!);
    if (!f.spell) continue;
    const c = colorClassOf(f.card);
    spells.set(c, (spells.get(c) ?? 0) + qty);
    for (const s of new Set([...f.enablerOf, ...f.payoffOf])) bump(styleCounts, s, c, qty);
    const types = new Set(creatureTypes(f.card));
    for (const t of f.card.tags)
      if (t.startsWith('typal-') && t.length > 6) types.add(capitalize(t.slice(6)));
    for (const t of types) bump(tribeCounts, t, c, qty);
  }
  const toShares = (counts: Map<ColorClass, number> | undefined): ClassShares => {
    const out: ClassShares = {};
    for (const c of COLOR_CLASSES) {
      const n = spells.get(c) ?? 0;
      if (n > 0) out[c] = Math.max(FLOOR_SHARE, (counts?.get(c) ?? 0) / n);
    }
    return out;
  };
  const styles = new Map<string, ClassShares>();
  for (const a of config.archetypes.archetypes)
    if (a.kind === 'synergy') styles.set(a.id, toShares(styleCounts.get(a.id)));
  const tribes = new Map<string, ClassShares>();
  for (const [t, m] of [...tribeCounts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total >= 30) tribes.set(t, toShares(m));
  }
  return { styles, tribes };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Share used for a tribe the sample barely holds. */
const RARE_TRIBE_SHARE = 0.005;

export interface DeckPlan {
  /** The style the deck runs most strongly over bulk, or "shape" when it meets none. */
  plan: string;
  /** Every style whose minimums the deck meets. */
  met: string[];
  /** For a deck with no theme, the plain shape its curve and creatures are closest to. */
  shape?: string;
}

/**
 * The plan a deck runs: among the styles whose minimums it meets (and, under
 * a commander, the tribes the commander names), the one whose theme cards
 * stand out most over what random bulk of the same colors would hold. A
 * style made of common cards, such as Graveyard, meets its minimums in many
 * decks without being their plan, and a color's natural themes (tokens in
 * white, burn in red) do not read as a plan by color alone.
 */
export function planOf(
  cards: readonly [CardRecord, number][],
  size: DeckSize,
  index: CardIndex,
  config: BulkBrewConfig,
  bulk: BulkShares,
  commander?: CardRecord,
): DeckPlan {
  const spells: [CardFacts, number][] = [];
  const classes: Partial<Record<ColorClass, number>> = {};
  let total = 0;
  for (const [card, qty] of cards) {
    const f = factsFor(index, config, card);
    if (!f.spell) continue;
    spells.push([f, qty]);
    total += qty;
    const c = colorClassOf(card);
    classes[c] = (classes[c] ?? 0) + qty;
  }
  const met: string[] = [];
  let best = SHAPE;
  let bestLift = 0;
  const consider = (style: string, theme: number, shares: ClassShares | undefined) => {
    met.push(style);
    const expected = shares
      ? expectedThemeCopies(shares, classes)
      : RARE_TRIBE_SHARE * Math.max(1, total);
    const lift = theme / Math.max(0.5, expected);
    if (lift > bestLift + 1e-9 || (Math.abs(lift - bestLift) <= 1e-9 && style < best)) {
      best = style;
      bestLift = lift;
    }
  };
  if (commander) {
    const cands = spells.map(([facts, qty]) => ({ facts, available: qty, preferred: qty }));
    for (const t of commanderTribes(commander, cands, config, size)) {
      if (!t.viable) continue;
      const tests = themeTests(t.archetype.id)!;
      let n = 0;
      for (const [f, q] of spells) if (tests.enabler(f) || tests.payoff(f)) n += q;
      consider(t.archetype.id, n, bulk.tribes.get(t.archetype.id.slice(TRIBAL.length)));
    }
  }
  for (const a of config.archetypes.archetypes) {
    if (a.kind !== 'synergy') continue;
    let e = 0;
    let p = 0;
    let n = 0;
    for (const [f, q] of spells) {
      const isE = f.enablerOf.includes(a.id);
      const isP = f.payoffOf.includes(a.id);
      if (isE) e += q;
      if (isP) p += q;
      if (isE || isP) n += q;
    }
    const want = minimumsFor(config, a, size);
    if (e >= want.enablers && p >= want.payoffs) consider(a.id, n, bulk.styles.get(a.id));
  }
  const out: DeckPlan = { plan: best, met: met.sort() };
  if (best === SHAPE) out.shape = shapeOf(spells, config);
  return out;
}

/** The plain shape whose curve profile sits closest to a deck's curve. */
function shapeOf(spells: [CardFacts, number][], config: BulkBrewConfig): string {
  const curve = new Array<number>(7).fill(0);
  let n = 0;
  for (const [f, q] of spells) {
    curve[Math.max(1, f.bucket) - 1]! += q;
    n += q;
  }
  let best = 'midrange';
  let bestD = Infinity;
  for (const id of SHAPES) {
    const shape = curveProfileFor(config, id).shape;
    const d = shape.reduce((a, s, i) => a + Math.abs(s - curve[i]! / Math.max(1, n)), 0);
    if (d < bestD - 1e-9) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** Feature names for a size, in the order featuresOf returns them. The first two are the theme. */
export function featureNames(config: BulkBrewConfig, size: DeckSize): string[] {
  return [
    'theme enablers',
    'theme payoffs',
    ...Object.keys(templateFor(config, size).roles).map((r) => `role ${r}`),
    ...['1', '2', '3', '4', '5', '6', '7+'].map((b) => `curve ${b}`),
    'creatures',
    'instants and sorceries',
    'other permanents',
  ];
}
const THEME_FEATURES = 2;

/**
 * A deck's makeup as shares of its spells: the style's enablers and payoffs
 * (NaN for a shape), each role of the size's template, the curve, and the
 * card types. The commander is not one of the cards.
 */
export function featuresOf(
  cards: readonly [CardRecord, number][],
  size: DeckSize,
  style: string,
  index: CardIndex,
  config: BulkBrewConfig,
): number[] {
  const roles = Object.keys(templateFor(config, size).roles);
  const tests = themeTests(style);
  let spells = 0;
  let e = 0;
  let p = 0;
  const role = new Array<number>(roles.length).fill(0);
  const curve = new Array<number>(7).fill(0);
  let creatures = 0;
  let instSorc = 0;
  let other = 0;
  for (const [card, qty] of cards) {
    const f = factsFor(index, config, card);
    if (!f.spell) continue;
    spells += qty;
    if (tests?.enabler(f)) e += qty;
    if (tests?.payoff(f)) p += qty;
    roles.forEach((r, i) => {
      if (f.roles.includes(r)) role[i]! += qty;
    });
    curve[Math.max(1, f.bucket) - 1]! += qty;
    if (f.creature) creatures += qty;
    if (f.instantOrSorcery) instSorc += qty;
    if (f.noncreaturePermanent) other += qty;
  }
  const s = Math.max(1, spells);
  return [
    tests ? e / s : NaN,
    tests ? p / s : NaN,
    ...role.map((n) => n / s),
    ...curve.map((n) => n / s),
    creatures / s,
    instSorc / s,
    other / s,
  ];
}

/** Median and middle-half spread of each feature over a plan's real decks. */
export interface PlanProfile {
  style: string;
  /** Reference decks behind it, and whether they run the plan or only meet it. */
  decks: number;
  source: 'plan' | 'met' | 'size';
  median: number[];
  q1: number[];
  q3: number[];
}

function profileOf(style: string, rows: number[][], source: PlanProfile['source']): PlanProfile {
  const n = rows[0]?.length ?? 0;
  const col = (i: number) => rows.map((r) => r[i]!).filter((v) => !Number.isNaN(v));
  const pick = (f: (xs: number[]) => number) =>
    Array.from({ length: n }, (_, i) => {
      const xs = col(i);
      return xs.length ? f(xs) : NaN;
    });
  return {
    style,
    decks: rows.length,
    source,
    median: pick(median),
    q1: pick((xs) => quantile(xs, 0.25)),
    q3: pick((xs) => quantile(xs, 0.75)),
  };
}

/** A reference deck as the profiles see it. */
export interface RefDeck {
  cards: [CardRecord, number][];
  plan: DeckPlan;
}

interface Group {
  profile: PlanProfile;
  /** Rows behind the profile, by position in the refs list, for leaving one out. */
  members: Map<number, number[]>;
}

/**
 * Plan profiles for one size, built lazily per style: the decks that run the
 * plan, or when fewer than MIN_PLAN_DECKS do, the decks that meet it, or
 * when none do, every deck of the size (theme features then stay unscored).
 * Tribes share one profile, each deck measured against its own tribe.
 */
export class PlanProfiles {
  private cache = new Map<string, Group>();
  private refs: RefDeck[];
  private size: DeckSize;
  private index: CardIndex;
  private config: BulkBrewConfig;
  /** Every deck of the size, theme features unscored. */
  readonly all: PlanProfile;
  /** Every themed deck against its own plan: the spread theme features fall back to. */
  readonly themed: PlanProfile;
  constructor(refs: RefDeck[], size: DeckSize, index: CardIndex, config: BulkBrewConfig) {
    this.refs = refs;
    this.size = size;
    this.index = index;
    this.config = config;
    this.all = profileOf(
      SHAPE,
      refs.map((r) => this.feats(r, SHAPE)),
      'size',
    );
    const themed = refs.filter((r) => r.plan.plan !== SHAPE);
    this.themed = profileOf(
      'themed',
      themed.map((r) => this.feats(r, r.plan.plan)),
      'plan',
    );
  }

  private feats(r: RefDeck, style: string): number[] {
    return featuresOf(r.cards, this.size, style, this.index, this.config);
  }

  private group(styleIn: string): Group {
    const style = planKey(this.config, styleIn);
    const key = style.startsWith(TRIBAL) ? TRIBAL : style;
    let g = this.cache.get(key);
    if (g) return g;
    const pick = (keep: (r: RefDeck) => boolean, own: boolean) => {
      const members = new Map<number, number[]>();
      this.refs.forEach((r, i) => {
        if (keep(r)) members.set(i, this.feats(r, own ? r.plan.plan : style));
      });
      return members;
    };
    let members: Map<number, number[]>;
    let source: PlanProfile['source'] = 'plan';
    if (key === TRIBAL) members = pick((r) => r.plan.plan.startsWith(TRIBAL), true);
    else {
      members = pick((r) => r.plan.plan === style, false);
      if (members.size < MIN_PLAN_DECKS && style !== SHAPE) {
        const meeting = pick((r) => r.plan.met.includes(style), false);
        if (meeting.size > 0) {
          members = meeting;
          source = 'met';
        } else {
          members = pick(() => true, false);
          source = 'size';
        }
      }
    }
    g = { profile: profileOf(key, [...members.values()], source), members };
    if (g.profile.decks === 0) g = { profile: { ...this.all, style: key }, members };
    this.cache.set(key, g);
    return g;
  }

  get(style: string): PlanProfile {
    return this.group(style).profile;
  }

  /**
   * Mean distance of a deck's features from a plan's median, each in units of
   * the plan's middle-half spread (at least half the spread over every deck
   * of the size, or over every themed deck for the theme features), capped at
   * 3 so one odd count cannot dominate. Unscored features are skipped.
   * `core` leaves the theme features out, so shapes and themes compare on
   * the same features. `leaveOut`, a reference deck's position, measures it
   * against its plan without itself when the plan has few decks.
   */
  distance(
    features: number[],
    style: string,
    opts: { core?: boolean; leaveOut?: number } = {},
  ): number {
    const g = this.group(style);
    let p = g.profile;
    if (
      opts.leaveOut !== undefined &&
      g.members.has(opts.leaveOut) &&
      g.members.size < LEAVE_ONE_OUT
    ) {
      const rest = [...g.members.entries()].filter(([i]) => i !== opts.leaveOut).map(([, f]) => f);
      if (rest.length > 0) p = profileOf(p.style, rest, p.source);
    }
    let sum = 0;
    let n = 0;
    features.forEach((x, i) => {
      if (opts.core && i < THEME_FEATURES) return;
      const m = p.median[i]!;
      if (Number.isNaN(x) || Number.isNaN(m)) return;
      const wide = i < THEME_FEATURES ? this.themed : this.all;
      const floor = Number.isNaN(wide.q3[i]!) ? 0 : 0.5 * (wide.q3[i]! - wide.q1[i]!);
      const spread = Math.max(p.q3[i]! - p.q1[i]!, floor, 0.01);
      sum += Math.min(3, Math.abs(x - m) / spread);
      n++;
    });
    return n ? sum / n : NaN;
  }
}
