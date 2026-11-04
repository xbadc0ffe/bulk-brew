// Typed schema for the config files in config/, plus validation.
// Logic lives in the builder; every number and rule it uses lives here.
// Keep erasable TypeScript only: this runs under Node without a build step.

import type { CardType, Color, DeckSize } from './types.ts';

/** Facts tags cannot express. Implemented in matchers.ts. */
export type DerivedPredicate =
  | 'finisher'
  | 'commanderFinisher'
  | 'cheapManaSource'
  | 'evasiveCreature'
  | 'mdfcLand'
  | 'basicLand'
  | 'nonbasicLand';

export const DERIVED_PREDICATES: readonly DerivedPredicate[] = [
  'finisher',
  'commanderFinisher',
  'cheapManaSource',
  'evasiveCreature',
  'mdfcLand',
  'basicLand',
  'nonbasicLand',
];

/**
 * Tag slugs the derived predicates in matchers.ts read directly. Listed here
 * so config:check verifies them against the pack like every other slug.
 */
export const DERIVED_TAGS: readonly string[] = [
  'unblockable',
  'mana-dork',
  'mana-rock',
  'mana-producer',
  'tutor-land-to-battlefield',
];

/**
 * One way a card can match. Every listed condition must hold.
 * A Matcher is a list of clauses; a card matches when any clause matches.
 */
export interface MatcherClause {
  /** Card has at least one of these Tagger slugs. */
  anyTags?: string[];
  /** Card has all of these slugs. */
  allTags?: string[];
  /** Card has none of these slugs. */
  excludeTags?: string[];
  /** Card has at least one of these Scryfall keywords (as printed, e.g. "Flying"). */
  anyKeywords?: string[];
  /** Card has all of these normalized types. */
  types?: CardType[];
  /** Card has at least one of these normalized types. */
  anyTypes?: CardType[];
  /** Card has none of these normalized types. */
  excludeTypes?: CardType[];
  /** Type line contains at least one of these words (subtypes such as "Aura"). */
  typeLineAny?: string[];
  derived?: DerivedPredicate;
  minMv?: number;
  maxMv?: number;
}

export type Matcher = MatcherClause[];

export interface RoleDef {
  id: string;
  label: string;
  description: string;
  match: Matcher;
}

export interface RolesConfig {
  version: string;
  roles: RoleDef[];
}

export interface CurveProfile {
  id: string;
  label: string;
  description: string;
  /** Share of nonland spells at mana value 1, 2, 3, 4, 5, 6, and 7 or more. Sums to 1. */
  shape: number[];
}

export interface CurveProfilesConfig {
  version: string;
  profiles: CurveProfile[];
}

/**
 * lands = baseLands + slopePerMv * (averageMv - referenceMv) - sum of credits,
 * rounded and clamped. Credits are per card of each kind in the deck.
 */
export interface LandFormula {
  referenceMv: number;
  slopePerMv: number;
  credits: {
    /** Mana rock costing 2 or less. */
    rockCheap: number;
    /** Mana rock costing 3. */
    rockThree: number;
    /** Mana creature costing 2 or less. */
    dorkCheap: number;
    /** Mana creature costing 3. */
    dorkThree: number;
    /** Spell that fetches a land to the battlefield, costing 3 or less. */
    landRamp: number;
    /** Modal double-faced card with a land face. */
    mdfcLand: number;
  };
  min: number;
  max: number;
}

export interface RoleQuota {
  min: number;
  target: number;
}

/** Bounds as shares of nonland spells. */
export interface TypeMix {
  creatureMin: number;
  creatureMax: number;
  instantSorceryMin: number;
  noncreaturePermanentMax: number;
}

export interface DeckTemplate {
  size: DeckSize;
  label: string;
  description: string;
  baseLands: number;
  landFormula: LandFormula;
  /** Default curve profile when the archetype does not set one. */
  curveProfile: string;
  typeMix: TypeMix;
  roles: Record<string, RoleQuota>;
  maxCopies: number;
  /**
   * Lower copy limits for cards that are bad in multiples: legendary cards
   * (the legend rule) and cards costing expensiveMv or more (clunky draws).
   */
  copyCaps: { legendary: number; expensiveMv: number; expensive: number };
  tolerances: {
    /** Cards per curve bucket that count as "on target". */
    curve: number;
    /** Share of spells the type mix may miss by before it costs anything. */
    typeMix: number;
  };
}

export interface DeckTemplatesConfig {
  version: string;
  templates: Record<string, DeckTemplate>;
}

export type SizeKey = '60' | '40' | '20';
export const SIZE_KEYS: readonly SizeKey[] = ['60', '40', '20'];

/** A per-size table: every listed size, plus Commander (100) when given. */
export type PerSize<T> = Record<SizeKey, T> & { '100'?: T };

export interface SynergyArchetype {
  kind: 'synergy';
  id: string;
  label: string;
  description: string;
  curveProfile: string;
  enablers: Matcher;
  payoffs: Matcher;
  /** Pool minimums per size; Commander scales the 60-card ones unless it has its own. */
  minimums: PerSize<{ enablers: number; payoffs: number }>;
  /** Scales how much synergy density this archetype earns in the objective. */
  synergyWeight: number;
  roleOverrides?: Record<SizeKey, Record<string, RoleQuota>>;
  typeMixOverrides?: Partial<TypeMix>;
  /** Colors the theme can work in. Omitted means all five. */
  colors?: Color[];
}

export interface CompositionArchetype {
  kind: 'composition';
  id: string;
  label: string;
  description: string;
  curveProfile: string;
  roleOverrides?: Record<SizeKey, Record<string, RoleQuota>>;
  typeMixOverrides?: Partial<TypeMix>;
}

export type Archetype = SynergyArchetype | CompositionArchetype;

export interface ArchetypesConfig {
  version: string;
  archetypes: Archetype[];
}

export interface SynergyRule {
  id: string;
  note: string;
  enabler: Matcher;
  payoff: Matcher;
  weight: number;
}

export interface SynergyRulesConfig {
  version: string;
  rules: SynergyRule[];
}

export interface LandRulesConfig {
  version: string;
  basics: {
    names: Record<Color, string>;
  };
  nonbasic: {
    producesDeckColor: number;
    colorlessOnly: number;
    entersTapped: number;
    utility: number;
    /** Nonbasics scoring below this stay out. */
    minScore: number;
    /** Largest share of the land count nonbasics may take. */
    maxShare: number;
    /** Lands that make only colorless mana allowed per deck size. */
    maxColorlessOnly: PerSize<number>;
  };
  mdfc: {
    landFaceCountsAsLand: boolean;
  };
  /** Multi-color decks: how sure each color role must be to cast on curve, and land rules. */
  colors: {
    /** Target chance to cast a spell on curve, by the role of the color it asks for. */
    castChance: { main: number; secondary: number; splash: number };
    /** A non-main color carrying less than this share of the main color's weight is a splash. */
    splashShare: number;
    /** Each color of a multi-color deck holds at least this many spells. */
    minCardsPerColor: PerSize<number>;
    /** Largest share of the land count nonbasics may take, by number of deck colors (2 to 5). */
    nonbasicMaxShare: Record<string, number>;
    /** Added per deck color a land makes beyond the first. */
    producesExtraDeckColor: number;
    /** Tapped lands cost less in multi-color decks, where fixing is worth a slow turn. */
    entersTappedMulticolor: number;
    /** Largest share of the land count that may enter tapped (fetch lands included), by number of deck colors. */
    tappedMaxShare: Record<string, number>;
  };
}

export interface BuilderWeightsConfig {
  version: string;
  objective: {
    curveDeviation: number;
    typeMixDeviation: number;
    roleShortfall: number;
    synergyDensity: number;
    themeHit: number;
    /** Per strength point per copy, so swaps prefer stronger cards when the shape allows. */
    cardStrength: number;
  };
  tiebreaks: ('themeTagHits' | 'strength' | 'statsPerMana' | 'lowerMv' | 'name')[];
  localSearch: {
    maxPasses: number;
    maxSwapsPerPass: number;
  };
  /** Weights of the deck score parts and how each part is scaled. */
  deckScore: {
    weights: {
      strength: number;
      roles: number;
      curve: number;
      typeMix: number;
      synergy: number;
      castability: number;
    };
    /** Average card strength mapped to 0 and 1. */
    strengthRange: [number, number];
    /** Curve or type-mix misses, as a share of spell slots, that score zero. */
    shapeSlack: number;
    /** Weighted synergy pairs per spell that score one. */
    synergyReference: number;
  };
  /** How many viable archetypes best fit builds and compares. */
  bestFit: { synergyCandidates: number; compositionCandidates: number };
  /** Commander decks. */
  commander: {
    /** Pool minimums of a style for 100 cards, as a multiple of its 60-card minimums. */
    minimumScale: number;
    /** Each role the commander fills needs this many fewer cards in the 99. */
    roleCredit: number;
    /** Deck score points for a style the commander itself enables or rewards. */
    styleBonus: number;
    /** Distinct cards in the commander's colors that make a deep pool. */
    deepPool: number;
  };
  /** Secondary styles: a second theme at a share of its minimums, a shape, or a tribe. */
  secondary: {
    /** Share of a synergy style's minimums a secondary style must reach. */
    minimumShare: number;
    /** Weight of a secondary theme card against a primary theme card. */
    themeHitShare: number;
    /** Cards short, in total, that still show a secondary style as a near miss. */
    nearMiss: number;
    /** Tribe members and type payoffs a tribal secondary style needs, per size. */
    tribal: PerSize<{ enablers: number; payoffs: number }>;
  };
  /** Deck options on the Build page. */
  buildOptions: {
    /** Most builds planned for one set of settings. */
    maxBuilds: number;
    /** Most options shown. */
    maxOptions: number;
    /** Rank points for an option that uses every picked color. */
    allColorsBonus: number;
    /** Rank points for an option that also meets the picked secondary style. */
    secondaryBonus: number;
    /** An option sharing at least this share of its spells with a stronger one is dropped. */
    duplicateShare: number;
    /** Without a picked primary style, at most this many options of any one style. */
    maxPerStyle: number;
  };
  /**
   * Pick penalties, in card strength points, for spells that strain a
   * multi-color mana base: pips of a secondary or splash color, double pips,
   * and early plays that need the color on turn one or two.
   */
  castability: {
    secondaryPip: number;
    doubleSecondary: number;
    earlySecondary: number;
    splashPip: number;
    splashDouble: number;
    splashEarly: number;
  };
}

export interface StrengthEffect {
  label: string;
  value: number;
  match: Matcher;
}

/** Weights for the card strength score; see packages/core/src/strength.ts. */
export interface CardStrengthConfig {
  version: string;
  base: number;
  min: number;
  max: number;
  /** Popularity: 1 minus rank over maxRank, times weight; unranked cards get the unranked share. */
  rank: { weight: number; maxRank: number; unranked: number };
  /** Creature stats against expectedPerMv times mana value (at least expectedMin). */
  body: { expectedPerMv: number; expectedMin: number; perPoint: number; min: number; max: number };
  /** Creature keyword values, summed and capped. */
  keywords: Record<string, number>;
  keywordCap: number;
  effects: StrengthEffect[];
  effectCap: number;
  instantSpeed: number;
  /** Noncreature spells: perMv times (pivotMv minus mana value), clamped. */
  cheapSpell: { pivotMv: number; perMv: number; min: number; max: number };
  /** Per colored pip beyond the first. */
  extraPipPenalty: number;
  planeswalker: number;
  /** Theme cards below this strength do not count toward a theme's viability. */
  themeMinStrength: number;
}

export interface BulkBrewConfig {
  deckTemplates: DeckTemplatesConfig;
  curveProfiles: CurveProfilesConfig;
  roles: RolesConfig;
  archetypes: ArchetypesConfig;
  synergyRules: SynergyRulesConfig;
  landRules: LandRulesConfig;
  builderWeights: BuilderWeightsConfig;
  cardStrength: CardStrengthConfig;
}

/** File name in config/ for each bundle key. */
export const CONFIG_FILES: Record<keyof BulkBrewConfig, string> = {
  deckTemplates: 'deck-templates.json',
  curveProfiles: 'curve-profiles.json',
  roles: 'roles.json',
  archetypes: 'archetypes.json',
  synergyRules: 'synergy-rules.json',
  landRules: 'land-rules.json',
  builderWeights: 'builder-weights.json',
  cardStrength: 'card-strength.json',
};

/** One string a deck records so a rebuild can be traced to the config that made it. */
export function configVersion(c: BulkBrewConfig): string {
  return [
    `t${c.deckTemplates.version}`,
    `c${c.curveProfiles.version}`,
    `r${c.roles.version}`,
    `a${c.archetypes.version}`,
    `s${c.synergyRules.version}`,
    `l${c.landRules.version}`,
    `w${c.builderWeights.version}`,
    `k${c.cardStrength.version}`,
  ].join('.');
}

/** A per-size value; Commander falls back to the 60-card value. */
export function forSize<T>(table: PerSize<T>, size: number): T {
  if (size === 100) return table['100'] ?? table['60'];
  return table[String(size) as SizeKey];
}

/** A synergy style's pool minimums for a size; Commander scales the 60-card ones unless given. */
export function minimumsFor(
  c: BulkBrewConfig,
  a: SynergyArchetype,
  size: number,
): { enablers: number; payoffs: number } {
  if (size !== 100) return a.minimums[String(size) as SizeKey];
  if (a.minimums['100']) return a.minimums['100'];
  const k = c.builderWeights.commander.minimumScale;
  return {
    enablers: Math.ceil(a.minimums['60'].enablers * k),
    payoffs: Math.ceil(a.minimums['60'].payoffs * k),
  };
}

/** An archetype's role overrides for a size; Commander uses the template's roles. */
export function roleOverridesFor(
  a: Archetype | undefined,
  size: number,
): Record<string, RoleQuota> | undefined {
  if (size === 100) return undefined;
  return a?.roleOverrides?.[String(size) as SizeKey];
}

export function templateFor(c: BulkBrewConfig, size: DeckSize): DeckTemplate {
  const t = c.deckTemplates.templates[String(size)];
  if (!t) throw new Error(`no deck template for size ${size}`);
  return t;
}

export function curveProfileFor(c: BulkBrewConfig, id: string): CurveProfile {
  const p = c.curveProfiles.profiles.find((x) => x.id === id);
  if (!p) throw new Error(`no curve profile "${id}"`);
  return p;
}

export function roleById(c: BulkBrewConfig, id: string): RoleDef {
  const r = c.roles.roles.find((x) => x.id === id);
  if (!r) throw new Error(`no role "${id}"`);
  return r;
}

export function archetypeById(c: BulkBrewConfig, id: string): Archetype {
  const a = c.archetypes.archetypes.find((x) => x.id === id);
  if (!a) throw new Error(`no archetype "${id}"`);
  return a;
}

/** Every tag slug referenced anywhere in the bundle, for checking against the pack. */
export function collectTagReferences(c: BulkBrewConfig): Set<string> {
  const out = new Set<string>();
  const take = (m: Matcher | undefined) => {
    for (const clause of m ?? []) {
      for (const t of clause.anyTags ?? []) out.add(t);
      for (const t of clause.allTags ?? []) out.add(t);
      for (const t of clause.excludeTags ?? []) out.add(t);
    }
  };
  for (const r of c.roles.roles) take(r.match);
  for (const a of c.archetypes.archetypes) {
    if (a.kind === 'synergy') {
      take(a.enablers);
      take(a.payoffs);
    }
  }
  for (const s of c.synergyRules.rules) {
    take(s.enabler);
    take(s.payoff);
  }
  for (const e of c.cardStrength.effects) take(e.match);
  for (const t of DERIVED_TAGS) out.add(t);
  return out;
}

const CARD_TYPES = new Set<string>([
  'creature',
  'instant',
  'sorcery',
  'enchantment',
  'artifact',
  'planeswalker',
  'battle',
  'land',
  'kindred',
]);

const COLORS = new Set<string>(['W', 'U', 'B', 'R', 'G']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function checkMatcher(where: string, m: unknown, problems: string[]): void {
  if (!Array.isArray(m) || m.length === 0) {
    problems.push(`${where}: matcher must be a non-empty list of clauses`);
    return;
  }
  m.forEach((clause: unknown, i) => {
    const w = `${where}[${i}]`;
    if (!clause || typeof clause !== 'object') {
      problems.push(`${w}: clause must be an object`);
      return;
    }
    const c = clause as MatcherClause;
    const keys = Object.keys(c);
    if (keys.length === 0) problems.push(`${w}: empty clause would match every card`);
    const listKeys: (keyof MatcherClause)[] = [
      'anyTags',
      'allTags',
      'excludeTags',
      'anyKeywords',
      'types',
      'anyTypes',
      'excludeTypes',
      'typeLineAny',
    ];
    const knownKeys = new Set<string>([...listKeys, 'derived', 'minMv', 'maxMv']);
    for (const k of keys) {
      if (!knownKeys.has(k))
        problems.push(`${w}: unknown key "${k}" (a typo here would match every card)`);
    }
    for (const k of listKeys) {
      const v = c[k];
      if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) {
        problems.push(`${w}.${k}: must be a list of strings`);
      }
    }
    for (const k of ['types', 'anyTypes', 'excludeTypes'] as const) {
      for (const t of c[k] ?? []) {
        if (!CARD_TYPES.has(t)) problems.push(`${w}.${k}: unknown card type "${t}"`);
      }
    }
    if (c.derived !== undefined && !DERIVED_PREDICATES.includes(c.derived)) {
      problems.push(`${w}.derived: unknown predicate "${String(c.derived)}"`);
    }
    if (c.minMv !== undefined && !isNum(c.minMv)) problems.push(`${w}.minMv: must be a number`);
    if (c.maxMv !== undefined && !isNum(c.maxMv)) problems.push(`${w}.maxMv: must be a number`);
    const onlyExclusions = keys.every((k) => k === 'excludeTags' || k === 'excludeTypes');
    if (onlyExclusions) problems.push(`${w}: clause needs a positive condition`);
  });
}

function checkQuotas(
  where: string,
  quotas: Record<string, RoleQuota> | undefined,
  roleIds: Set<string>,
  problems: string[],
): void {
  for (const [id, q] of Object.entries(quotas ?? {})) {
    if (!roleIds.has(id)) problems.push(`${where}: unknown role "${id}"`);
    if (!q || !isNum(q.min) || !isNum(q.target)) {
      problems.push(`${where}.${id}: min and target must be numbers`);
    } else if (q.min > q.target) {
      problems.push(`${where}.${id}: min ${q.min} exceeds target ${q.target}`);
    }
  }
}

function checkTypeMix(where: string, t: Partial<TypeMix> | undefined, problems: string[]): void {
  if (!t) return;
  for (const [k, v] of Object.entries(t)) {
    if (!isNum(v) || v < 0 || v > 1)
      problems.push(`${where}.${k}: must be a share between 0 and 1`);
  }
  if (isNum(t.creatureMin) && isNum(t.creatureMax) && t.creatureMin > t.creatureMax) {
    problems.push(`${where}: creatureMin exceeds creatureMax`);
  }
}

/** Shape and cross-reference checks. Returns human-readable problems; empty means valid. */
export function validateConfig(c: BulkBrewConfig): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(CONFIG_FILES) as (keyof BulkBrewConfig)[]) {
    const file = c[key] as { version?: unknown } | undefined;
    if (!file || typeof file !== 'object') problems.push(`${key}: missing`);
    else if (typeof file.version !== 'string' || !file.version) {
      problems.push(`${key}: version must be a non-empty string`);
    }
  }
  if (problems.length) return problems;

  const roleIds = new Set<string>();
  for (const r of c.roles.roles) {
    if (roleIds.has(r.id)) problems.push(`roles: duplicate id "${r.id}"`);
    roleIds.add(r.id);
    if (!r.label) problems.push(`roles.${r.id}: label missing`);
    checkMatcher(`roles.${r.id}.match`, r.match, problems);
  }

  const profileIds = new Set<string>();
  for (const p of c.curveProfiles.profiles) {
    if (profileIds.has(p.id)) problems.push(`curveProfiles: duplicate id "${p.id}"`);
    profileIds.add(p.id);
    if (!Array.isArray(p.shape) || p.shape.length !== 7 || !p.shape.every(isNum)) {
      problems.push(`curveProfiles.${p.id}: shape needs 7 numbers (mana value 1 to 7+)`);
    } else {
      const sum = p.shape.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.01)
        problems.push(`curveProfiles.${p.id}: shape sums to ${sum.toFixed(3)}, not 1`);
      if (p.shape.some((v) => v < 0))
        problems.push(`curveProfiles.${p.id}: shares cannot be negative`);
    }
  }

  for (const key of [...SIZE_KEYS, '100'] as const) {
    const t = c.deckTemplates.templates[key];
    if (!t) {
      problems.push(`deckTemplates: missing template for ${key}`);
      continue;
    }
    const w = `deckTemplates.${key}`;
    if (t.size !== Number(key)) problems.push(`${w}: size ${t.size} does not match key`);
    if (!isNum(t.baseLands) || t.baseLands <= 0) problems.push(`${w}: baseLands must be positive`);
    const f = t.landFormula;
    if (!f || !isNum(f.referenceMv) || !isNum(f.slopePerMv) || !isNum(f.min) || !isNum(f.max)) {
      problems.push(`${w}.landFormula: referenceMv, slopePerMv, min, max must be numbers`);
    } else {
      if (f.min > t.baseLands || t.baseLands > f.max) {
        problems.push(`${w}.landFormula: baseLands ${t.baseLands} outside [${f.min}, ${f.max}]`);
      }
      if (f.max >= t.size) problems.push(`${w}.landFormula: max lands must leave room for spells`);
      for (const [k, v] of Object.entries(f.credits ?? {})) {
        if (!isNum(v) || v < 0)
          problems.push(`${w}.landFormula.credits.${k}: must be a non-negative number`);
      }
      for (const k of [
        'rockCheap',
        'rockThree',
        'dorkCheap',
        'dorkThree',
        'landRamp',
        'mdfcLand',
      ]) {
        if (!(k in (f.credits ?? {}))) problems.push(`${w}.landFormula.credits: missing ${k}`);
      }
    }
    if (!profileIds.has(t.curveProfile))
      problems.push(`${w}: unknown curve profile "${t.curveProfile}"`);
    checkTypeMix(`${w}.typeMix`, t.typeMix, problems);
    for (const k of [
      'creatureMin',
      'creatureMax',
      'instantSorceryMin',
      'noncreaturePermanentMax',
    ]) {
      if (!(k in (t.typeMix ?? {}))) problems.push(`${w}.typeMix: missing ${k}`);
    }
    checkQuotas(`${w}.roles`, t.roles, roleIds, problems);
    if (!isNum(t.maxCopies) || t.maxCopies < 1) problems.push(`${w}: maxCopies must be at least 1`);
    const cc = t.copyCaps;
    if (!cc || !isNum(cc.legendary) || !isNum(cc.expensiveMv) || !isNum(cc.expensive))
      problems.push(`${w}.copyCaps: legendary, expensiveMv, and expensive must be numbers`);
    else if (cc.legendary < 1 || cc.expensive < 1)
      problems.push(`${w}.copyCaps: limits must be at least 1`);
    if (!t.tolerances || !isNum(t.tolerances.curve) || !isNum(t.tolerances.typeMix)) {
      problems.push(`${w}.tolerances: curve and typeMix must be numbers`);
    }
  }

  const archetypeIds = new Set<string>();
  for (const a of c.archetypes.archetypes) {
    const w = `archetypes.${a.id}`;
    if (archetypeIds.has(a.id)) problems.push(`archetypes: duplicate id "${a.id}"`);
    archetypeIds.add(a.id);
    if (a.kind !== 'synergy' && a.kind !== 'composition') {
      problems.push(`${w}: kind must be synergy or composition`);
      continue;
    }
    if (!a.label || !a.description) problems.push(`${w}: label and description required`);
    if (!profileIds.has(a.curveProfile))
      problems.push(`${w}: unknown curve profile "${a.curveProfile}"`);
    for (const key of SIZE_KEYS)
      checkQuotas(`${w}.roleOverrides.${key}`, a.roleOverrides?.[key], roleIds, problems);
    checkTypeMix(`${w}.typeMixOverrides`, a.typeMixOverrides, problems);
    // Overrides replace template values one key at a time, so check the merged result.
    for (const key of SIZE_KEYS) {
      const t = c.deckTemplates.templates[key];
      if (!t?.typeMix || !a.typeMixOverrides) continue;
      const merged = { ...t.typeMix, ...a.typeMixOverrides };
      if (merged.creatureMin > merged.creatureMax)
        problems.push(`${w}.typeMixOverrides: creatureMin exceeds creatureMax for size ${key}`);
      if (merged.creatureMin + merged.instantSorceryMin > 1)
        problems.push(
          `${w}.typeMixOverrides: creature and spell minimums exceed 1 for size ${key}`,
        );
    }
    if (a.kind === 'synergy') {
      checkMatcher(`${w}.enablers`, a.enablers, problems);
      checkMatcher(`${w}.payoffs`, a.payoffs, problems);
      for (const key of [...SIZE_KEYS, '100'] as const) {
        const m = a.minimums?.[key];
        if (key === '100' && m === undefined) continue;
        if (!m || !isNum(m.enablers) || !isNum(m.payoffs)) {
          problems.push(`${w}.minimums.${key}: enablers and payoffs must be numbers`);
        }
      }
      if (!isNum(a.synergyWeight) || a.synergyWeight <= 0)
        problems.push(`${w}: synergyWeight must be positive`);
      for (const col of a.colors ?? [])
        if (!COLORS.has(col)) problems.push(`${w}.colors: unknown color "${col}"`);
    }
  }
  if (!c.archetypes.archetypes.some((a) => a.kind === 'composition')) {
    problems.push('archetypes: at least one composition archetype is needed as a fallback');
  }

  const ruleIds = new Set<string>();
  for (const s of c.synergyRules.rules) {
    const w = `synergyRules.${s.id}`;
    if (ruleIds.has(s.id)) problems.push(`synergyRules: duplicate id "${s.id}"`);
    ruleIds.add(s.id);
    checkMatcher(`${w}.enabler`, s.enabler, problems);
    checkMatcher(`${w}.payoff`, s.payoff, problems);
    if (!isNum(s.weight) || s.weight <= 0) problems.push(`${w}: weight must be positive`);
  }

  const lr = c.landRules;
  for (const col of ['W', 'U', 'B', 'R', 'G'] as Color[]) {
    if (!lr.basics?.names?.[col]) problems.push(`landRules.basics.names: missing ${col}`);
  }
  const nb = lr.nonbasic;
  if (!nb) problems.push('landRules.nonbasic: missing');
  else {
    for (const k of [
      'producesDeckColor',
      'colorlessOnly',
      'entersTapped',
      'utility',
      'minScore',
      'maxShare',
    ] as const) {
      if (!isNum(nb[k])) problems.push(`landRules.nonbasic.${k}: must be a number`);
    }
    if (isNum(nb.maxShare) && (nb.maxShare < 0 || nb.maxShare > 1))
      problems.push('landRules.nonbasic.maxShare: must be a share between 0 and 1');
    for (const key of [...SIZE_KEYS, '100'] as const) {
      if (key === '100' && nb.maxColorlessOnly?.[key] === undefined) continue;
      if (!isNum(nb.maxColorlessOnly?.[key]))
        problems.push(`landRules.nonbasic.maxColorlessOnly.${key}: must be a number`);
    }
  }
  if (typeof lr.mdfc?.landFaceCountsAsLand !== 'boolean')
    problems.push('landRules.mdfc.landFaceCountsAsLand: must be true or false');

  const bw = c.builderWeights;
  for (const k of [
    'curveDeviation',
    'typeMixDeviation',
    'roleShortfall',
    'synergyDensity',
    'themeHit',
    'cardStrength',
  ] as const) {
    const v = bw.objective?.[k];
    if (!isNum(v) || v < 0)
      problems.push(`builderWeights.objective.${k}: must be a non-negative number`);
  }
  const tiebreaks = new Set(['themeTagHits', 'strength', 'statsPerMana', 'lowerMv', 'name']);
  if (!Array.isArray(bw.tiebreaks) || bw.tiebreaks.length === 0)
    problems.push('builderWeights.tiebreaks: must be a non-empty list');
  else
    for (const t of bw.tiebreaks)
      if (!tiebreaks.has(t)) problems.push(`builderWeights.tiebreaks: unknown "${t}"`);
  if (
    !bw.localSearch ||
    !isNum(bw.localSearch.maxPasses) ||
    !isNum(bw.localSearch.maxSwapsPerPass)
  ) {
    problems.push('builderWeights.localSearch: maxPasses and maxSwapsPerPass must be numbers');
  }

  const ds = bw.deckScore;
  for (const k of ['strength', 'roles', 'curve', 'typeMix', 'synergy', 'castability'] as const) {
    const v = ds?.weights?.[k];
    if (!isNum(v) || v < 0)
      problems.push(`builderWeights.deckScore.weights.${k}: must be a non-negative number`);
  }
  const weightSum = Object.values(ds?.weights ?? {}).reduce<number>(
    (s, v) => s + (isNum(v) ? v : 0),
    0,
  );
  if (weightSum <= 0) problems.push('builderWeights.deckScore.weights: must not all be zero');
  if (
    !Array.isArray(ds?.strengthRange) ||
    ds.strengthRange.length !== 2 ||
    !ds.strengthRange.every(isNum) ||
    ds.strengthRange[0] >= ds.strengthRange[1]
  )
    problems.push('builderWeights.deckScore.strengthRange: needs two increasing numbers');
  if (!isNum(ds?.shapeSlack) || ds.shapeSlack <= 0)
    problems.push('builderWeights.deckScore.shapeSlack: must be a positive number');
  if (!isNum(ds?.synergyReference) || ds.synergyReference <= 0)
    problems.push('builderWeights.deckScore.synergyReference: must be a positive number');
  const bf = bw.bestFit;
  const count = (v: unknown) => isNum(v) && Number.isInteger(v) && v >= 0;
  if (
    !count(bf?.synergyCandidates) ||
    !count(bf?.compositionCandidates) ||
    bf.synergyCandidates + bf.compositionCandidates < 1
  )
    problems.push(
      'builderWeights.bestFit: synergyCandidates and compositionCandidates must be whole numbers, at least one in total',
    );

  const sec = bw.secondary;
  for (const k of ['minimumShare', 'themeHitShare'] as const) {
    if (!isNum(sec?.[k]) || sec[k] < 0 || sec[k] > 1)
      problems.push(`builderWeights.secondary.${k}: must be between 0 and 1`);
  }
  if (!isNum(sec?.nearMiss) || sec.nearMiss < 0)
    problems.push('builderWeights.secondary.nearMiss: must be a non-negative number');
  for (const key of ['60', '40', '20', '100'] as const) {
    const t = sec?.tribal?.[key];
    if (key === '100' && t === undefined) continue;
    const whole = (v: unknown) => isNum(v) && Number.isInteger(v) && v >= 0;
    if (!t || !whole(t.enablers) || !whole(t.payoffs))
      problems.push(
        `builderWeights.secondary.tribal.${key}: enablers and payoffs must be whole numbers`,
      );
  }

  const cmd = bw.commander;
  for (const k of ['minimumScale', 'roleCredit', 'styleBonus', 'deepPool'] as const) {
    if (!isNum(cmd?.[k]) || cmd[k] < 0)
      problems.push(`builderWeights.commander.${k}: must be a non-negative number`);
  }

  const bo = bw.buildOptions;
  for (const k of ['maxBuilds', 'maxOptions', 'maxPerStyle'] as const) {
    const v = bo?.[k];
    if (!isNum(v) || !Number.isInteger(v) || v < 1)
      problems.push(`builderWeights.buildOptions.${k}: must be a whole number of at least 1`);
  }
  for (const k of ['allColorsBonus', 'secondaryBonus'] as const) {
    if (!isNum(bo?.[k]) || bo[k] < 0)
      problems.push(`builderWeights.buildOptions.${k}: must be a non-negative number`);
  }
  if (!isNum(bo?.duplicateShare) || bo.duplicateShare <= 0 || bo.duplicateShare > 1)
    problems.push('builderWeights.buildOptions.duplicateShare: must be above 0 and at most 1');

  const cast = bw.castability;
  for (const k of [
    'secondaryPip',
    'doubleSecondary',
    'earlySecondary',
    'splashPip',
    'splashDouble',
    'splashEarly',
  ] as const) {
    if (!isNum(cast?.[k]) || cast[k] < 0)
      problems.push(`builderWeights.castability.${k}: must be a non-negative number`);
  }
  const lc = c.landRules.colors;
  for (const k of ['main', 'secondary', 'splash'] as const) {
    const v = lc?.castChance?.[k];
    if (!isNum(v) || v <= 0 || v >= 1)
      problems.push(`landRules.colors.castChance.${k}: must be between 0 and 1`);
  }
  if (!isNum(lc?.splashShare) || lc.splashShare < 0 || lc.splashShare > 1)
    problems.push('landRules.colors.splashShare: must be between 0 and 1');
  for (const key of ['60', '40', '20', '100'] as const) {
    if (key === '100' && lc?.minCardsPerColor?.[key] === undefined) continue;
    if (!isNum(lc?.minCardsPerColor?.[key]) || lc.minCardsPerColor[key]! < 0)
      problems.push(`landRules.colors.minCardsPerColor.${key}: must be a non-negative number`);
  }
  for (const n of ['2', '3', '4', '5']) {
    const v = lc?.nonbasicMaxShare?.[n];
    if (!isNum(v) || v < 0 || v > 1)
      problems.push(`landRules.colors.nonbasicMaxShare.${n}: must be between 0 and 1`);
  }
  if (!isNum(lc?.producesExtraDeckColor))
    problems.push('landRules.colors.producesExtraDeckColor: must be a number');
  if (!isNum(lc?.entersTappedMulticolor))
    problems.push('landRules.colors.entersTappedMulticolor: must be a number');
  for (const n of ['2', '3', '4', '5']) {
    const v = lc?.tappedMaxShare?.[n];
    if (!isNum(v) || v < 0 || v > 1)
      problems.push(`landRules.colors.tappedMaxShare.${n}: must be between 0 and 1`);
  }

  const cs = c.cardStrength;
  for (const k of [
    'base',
    'min',
    'max',
    'keywordCap',
    'effectCap',
    'instantSpeed',
    'extraPipPenalty',
    'planeswalker',
    'themeMinStrength',
  ] as const) {
    if (!isNum(cs[k])) problems.push(`cardStrength.${k}: must be a number`);
  }
  if (isNum(cs.min) && isNum(cs.max) && cs.min >= cs.max)
    problems.push('cardStrength: min must be below max');
  const numbersIn = (where: string, o: Record<string, unknown> | undefined, keys: string[]) => {
    for (const k of keys)
      if (!isNum(o?.[k])) problems.push(`cardStrength.${where}.${k}: must be a number`);
  };
  numbersIn('rank', cs.rank, ['weight', 'maxRank', 'unranked']);
  if (isNum(cs.rank?.maxRank) && cs.rank.maxRank <= 0)
    problems.push('cardStrength.rank.maxRank: must be positive');
  numbersIn('body', cs.body, ['expectedPerMv', 'expectedMin', 'perPoint', 'min', 'max']);
  numbersIn('cheapSpell', cs.cheapSpell, ['pivotMv', 'perMv', 'min', 'max']);
  for (const [where, o] of [
    ['body', cs.body],
    ['cheapSpell', cs.cheapSpell],
  ] as const)
    if (isNum(o?.min) && isNum(o?.max) && o.min > o.max)
      problems.push(`cardStrength.${where}: min must not be above max`);
  if (!cs.keywords || typeof cs.keywords !== 'object' || Array.isArray(cs.keywords))
    problems.push('cardStrength.keywords: must be an object of keyword values');
  else
    for (const [k, v] of Object.entries(cs.keywords))
      if (!isNum(v)) problems.push(`cardStrength.keywords.${k}: must be a number`);
  if (!Array.isArray(cs.effects)) problems.push('cardStrength.effects: must be a list');
  else
    cs.effects.forEach((e, i) => {
      if (!e.label) problems.push(`cardStrength.effects[${i}]: label missing`);
      if (!isNum(e.value)) problems.push(`cardStrength.effects[${i}].value: must be a number`);
      checkMatcher(`cardStrength.effects[${i}].match`, e.match, problems);
    });

  return problems;
}
