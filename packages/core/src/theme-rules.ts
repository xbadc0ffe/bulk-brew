// Theme rules (config/theme-rules.json): setup and payoff jobs per themed
// style, written from the theme guide (docs/review/themes.md). Each card
// counts once, as setup or as payoff, never both. Format and meaning:
// config/README.md and docs/review/theme-rules.md. Erasable TypeScript only.

import type { BulkBrewConfig } from './config.ts';
import { COLOR_CLASSES, type ColorClass } from './colors.ts';
import type { CardRecord, CardType } from './types.ts';

/** Deck sizes a rule or a minimum can name. */
export const THEME_SIZES = [20, 40, 60, 100] as const;
export type ThemeSize = (typeof THEME_SIZES)[number];

const CARD_TYPES: readonly CardType[] = [
  'creature',
  'instant',
  'sorcery',
  'enchantment',
  'artifact',
  'planeswalker',
  'battle',
  'land',
  'kindred',
];

export interface ThemeRule {
  /** A few words naming what the card does for the plan, such as "loots every turn". */
  job: string;
  /** About 1 for an ordinary piece, 2 for a strong repeatable one, 0.5 for a weak one-off. */
  weight: number;
  /** The card has at least one of these tags. */
  anyTags?: string[];
  /** The card has every one of these tags. */
  allTags?: string[];
  /** The card has none of these tags. */
  notTags?: string[];
  /** A regular expression the oracle text must match (case-insensitive, reminder text removed). */
  text?: string;
  /** A regular expression the oracle text must not match. */
  notText?: string;
  /** The card has at least one of these types (the core's matcher types). */
  types?: CardType[];
  /** The card has none of these types. */
  notTypes?: CardType[];
  /** A regular expression the type line must match (case-insensitive), such as "\\bEquipment\\b". */
  typeLine?: string;
  /** Mana value at least this. */
  minMv?: number;
  /** Mana value at most this. */
  maxMv?: number;
  /** Power at least this; a variable power such as "*" passes. Cards without power fail. */
  minPower?: number;
  /** Power at most this; a variable power fails. Cards without power fail. */
  maxPower?: number;
  /** The card has at least one of these keywords (any case). */
  keywords?: string[];
  /** The card has none of these keywords. */
  notKeywords?: string[];
  /** The rule applies only at these deck sizes. */
  sizes?: ThemeSize[];
  /**
   * Breaks ties between jobs: a card meeting setup and payoff counts for the
   * side whose matching rules reach the higher priority; equal priority falls
   * back to weight. Default 0.
   */
  priority?: number;
  /** The card does its job again and again (each turn, each creature), rather than once. */
  repeatable?: boolean;
}

/** An exclude rule has the same shape; its weight, if given, is not used. */
export type ExcludeRule = Omit<ThemeRule, 'weight'> & { weight?: number };

/**
 * Floors a deck must meet for its theme to show up in most games, from the
 * theme guide's "enough" tables. Every floor given must be met.
 */
export interface ThemeFloor {
  /** Setup units: copies, each counting its weight capped at 1, so a 0.5 job counts half. */
  setup?: number;
  /** Weighted setup: copies times weight. */
  setupWeight?: number;
  /** Copies of repeatable setup jobs. */
  repeatable?: number;
  /** Payoff units: copies, each counting its weight capped at 1. */
  payoff?: number;
  /** Weighted payoff: copies times weight. */
  payoffWeight?: number;
  /** Repeatable setup copies plus payoff units, for themes where either does the job. */
  repeatableOrPayoff?: number;
}

/** Per size, one set of floors, or a list of alternatives of which one must be met. */
export type ThemeMinimums = Partial<Record<`${ThemeSize}`, ThemeFloor | ThemeFloor[]>>;

/** For each floor, what the pool lacks when the floor is missed, in words a player understands. */
export type ThemeLacks = Partial<Record<keyof ThemeFloor, string>>;

export interface ThemeStyleRules {
  /** What the theme builds up and spends, such as "cards in your graveyard". */
  resource: string;
  setup: ThemeRule[];
  payoff: ThemeRule[];
  /** Cards matching any of these count as neither setup nor payoff (false friends). */
  exclude?: ExcludeRule[];
  /** What is enough for a decent bulk deck at each size. */
  minimums?: ThemeMinimums;
  /** Other styles that use the same resource, nearest first: the fallbacks for a request the pool cannot support. */
  kin?: string[];
  /**
   * The setup does nothing without this style's payoffs (opponent mill, gifts
   * to opponents, energy makers), so another theme's deck should not take it as setup.
   */
  setupNeedsPayoff?: boolean;
  /** A phrase for every floor the minimums use at any size. */
  lacks?: ThemeLacks;
}

/** The theme-rules.json file. */
export interface ThemeRulesFile {
  version: string;
  styles: Record<string, ThemeStyleRules>;
}

export interface CompiledRule<R extends ExcludeRule = ThemeRule> {
  rule: R;
  text?: RegExp;
  notText?: RegExp;
  typeLine?: RegExp;
}

export interface CompiledStyle {
  id: string;
  resource: string;
  setup: CompiledRule[];
  payoff: CompiledRule[];
  exclude: CompiledRule<ExcludeRule>[];
  minimums?: ThemeMinimums;
  kin: string[];
  setupNeedsPayoff: boolean;
  lacks: ThemeLacks;
}

export interface ThemeRules {
  version: string;
  styles: Map<string, CompiledStyle>;
}

const RULE_KEYS = new Set([
  'job',
  'weight',
  'anyTags',
  'allTags',
  'notTags',
  'text',
  'notText',
  'types',
  'notTypes',
  'typeLine',
  'minMv',
  'maxMv',
  'minPower',
  'maxPower',
  'keywords',
  'notKeywords',
  'sizes',
  'priority',
  'repeatable',
]);
const STYLE_KEYS = new Set([
  'resource',
  'setup',
  'payoff',
  'exclude',
  'minimums',
  'kin',
  'setupNeedsPayoff',
  'lacks',
]);
const FILE_KEYS = new Set(['version', 'styles']);
const FLOOR_KEYS = new Set<string>([
  'setup',
  'setupWeight',
  'repeatable',
  'payoff',
  'payoffWeight',
  'repeatableOrPayoff',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x !== '');
}

function compileRegExp(source: string, where: string, problems: string[]): RegExp | undefined {
  try {
    // Multiline, so ^ and $ can anchor one line of a card's text.
    return new RegExp(source, 'im');
  } catch (err) {
    problems.push(`${where}: bad regular expression: ${(err as Error).message}`);
    return undefined;
  }
}

function compileRule(
  raw: unknown,
  where: string,
  needsWeight: boolean,
  problems: string[],
): CompiledRule<ExcludeRule> | undefined {
  if (!isObject(raw)) {
    problems.push(`${where}: a rule must be an object`);
    return undefined;
  }
  const r = raw;
  const before = problems.length;
  for (const key of Object.keys(r))
    if (!RULE_KEYS.has(key)) problems.push(`${where}: unknown key "${key}"`);
  if (typeof r.job !== 'string' || r.job === '')
    problems.push(`${where}: "job" must be a non-empty string`);
  if (r.weight !== undefined || needsWeight) {
    if (typeof r.weight !== 'number' || !Number.isFinite(r.weight) || r.weight < 0)
      problems.push(`${where}: "weight" must be a number of 0 or more`);
  }
  for (const key of ['anyTags', 'allTags', 'notTags', 'keywords', 'notKeywords'] as const) {
    if (r[key] !== undefined && !isStringList(r[key]))
      problems.push(`${where}: "${key}" must be a non-empty list of strings`);
  }
  for (const key of ['types', 'notTypes'] as const) {
    const v = r[key];
    if (v !== undefined && !(isStringList(v) && v.every((t) => CARD_TYPES.includes(t as CardType))))
      problems.push(`${where}: "${key}" must be a non-empty list of ${CARD_TYPES.join(', ')}`);
  }
  for (const key of ['text', 'notText', 'typeLine'] as const) {
    if (r[key] !== undefined && (typeof r[key] !== 'string' || r[key] === ''))
      problems.push(`${where}: "${key}" must be a non-empty string`);
  }
  for (const key of ['minMv', 'maxMv', 'minPower', 'maxPower', 'priority'] as const) {
    if (r[key] !== undefined && (typeof r[key] !== 'number' || !Number.isFinite(r[key])))
      problems.push(`${where}: "${key}" must be a number`);
  }
  if (
    r.sizes !== undefined &&
    !(
      Array.isArray(r.sizes) &&
      r.sizes.length > 0 &&
      r.sizes.every((n) => THEME_SIZES.includes(n as ThemeSize))
    )
  )
    problems.push(`${where}: "sizes" must be a non-empty list of ${THEME_SIZES.join(', ')}`);
  if (r.repeatable !== undefined && typeof r.repeatable !== 'boolean')
    problems.push(`${where}: "repeatable" must be true or false`);
  // Negative conditions alone would match nearly every card.
  if (
    r.anyTags === undefined &&
    r.allTags === undefined &&
    r.text === undefined &&
    r.types === undefined &&
    r.typeLine === undefined &&
    r.keywords === undefined
  )
    problems.push(
      `${where}: give at least one of "anyTags", "allTags", "text", "types", "typeLine", or "keywords"`,
    );
  if (problems.length > before) return undefined;
  const rule = raw as unknown as ExcludeRule;
  const out: CompiledRule<ExcludeRule> = { rule };
  for (const key of ['text', 'notText', 'typeLine'] as const) {
    const source = rule[key];
    if (source === undefined) continue;
    const re = compileRegExp(source, `${where} ${key}`, problems);
    if (re) out[key] = re;
  }
  return problems.length > before ? undefined : out;
}

function compileList(
  raw: unknown,
  where: string,
  required: boolean,
  needsWeight: boolean,
  problems: string[],
): CompiledRule<ExcludeRule>[] {
  if (raw === undefined && !required) return [];
  if (!Array.isArray(raw)) {
    problems.push(`${where}: must be a list of rules`);
    return [];
  }
  const out: CompiledRule<ExcludeRule>[] = [];
  raw.forEach((r, i) => {
    const c = compileRule(r, `${where}[${i}]`, needsWeight, problems);
    if (c) out.push(c);
  });
  return out;
}

/** The minimums, when valid, and every floor key they use at any size. */
function compileMinimums(
  raw: unknown,
  where: string,
  problems: string[],
): { minimums?: ThemeMinimums; used: Set<string> } {
  const used = new Set<string>();
  if (raw === undefined) return { used };
  if (!isObject(raw)) {
    problems.push(`${where}: must be an object keyed by deck size`);
    return { used };
  }
  const before = problems.length;
  for (const [size, v] of Object.entries(raw)) {
    const at = `${where}.${size}`;
    if (!THEME_SIZES.map(String).includes(size)) {
      problems.push(`${at}: the size must be one of ${THEME_SIZES.join(', ')}`);
      continue;
    }
    const floors: unknown[] = Array.isArray(v) ? v : [v];
    if (floors.length === 0) problems.push(`${at}: give at least one set of floors`);
    for (const f of floors) {
      if (!isObject(f)) {
        problems.push(`${at}: floors must be an object`);
        continue;
      }
      const keys = Object.keys(f);
      if (keys.length === 0) problems.push(`${at}: give at least one floor`);
      for (const key of keys) {
        const n = f[key];
        if (!FLOOR_KEYS.has(key)) problems.push(`${at}: unknown floor "${key}"`);
        else if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
          problems.push(`${at}: "${key}" must be a number of 0 or more`);
        else used.add(key);
      }
    }
  }
  return problems.length > before ? { used } : { minimums: raw as ThemeMinimums, used };
}

/** Phrases a player reads: one per floor the minimums use, plain words, no em-dash. */
function compileLacks(
  raw: unknown,
  used: Set<string>,
  where: string,
  problems: string[],
): ThemeLacks {
  if (raw !== undefined && !isObject(raw)) {
    problems.push(`${where}: must be an object keyed by floor`);
    return {};
  }
  const lacks = (raw ?? {}) as Record<string, unknown>;
  for (const [key, v] of Object.entries(lacks)) {
    if (!FLOOR_KEYS.has(key)) problems.push(`${where}: unknown floor "${key}"`);
    else if (typeof v !== 'string' || v.trim() === '')
      problems.push(`${where}.${key}: must be a non-empty phrase`);
    else if (v.includes('—')) problems.push(`${where}.${key}: no em-dashes in a phrase`);
  }
  for (const key of [...used].sort())
    if (lacks[key] === undefined)
      problems.push(`${where}: give a phrase for the floor "${key}" the minimums use`);
  return lacks as ThemeLacks;
}

function compile(data: unknown): { problems: string[]; rules: ThemeRules } {
  const problems: string[] = [];
  const d = isObject(data) ? data : {};
  for (const key of Object.keys(d))
    if (!FILE_KEYS.has(key)) problems.push(`unknown top-level key "${key}"`);
  if (typeof d.version !== 'string' || d.version === '')
    problems.push('"version" must be a non-empty string');
  const styles = new Map<string, CompiledStyle>();
  if (!isObject(d.styles)) {
    problems.push('"styles" must be an object keyed by style id');
  } else {
    const ids = Object.keys(d.styles).sort();
    for (const id of ids) {
      const s = d.styles[id];
      const at = `styles.${id}`;
      if (!isObject(s)) {
        problems.push(`${at}: must be an object`);
        continue;
      }
      for (const key of Object.keys(s))
        if (!STYLE_KEYS.has(key)) problems.push(`${at}: unknown key "${key}"`);
      if (typeof s.resource !== 'string' || s.resource === '')
        problems.push(`${at}: "resource" must be a non-empty string`);
      // Setup and payoff rules were checked for a weight above.
      const compiled: CompiledStyle = {
        id,
        resource: typeof s.resource === 'string' ? s.resource : '',
        setup: compileList(s.setup, `${at}.setup`, true, true, problems) as CompiledRule[],
        payoff: compileList(s.payoff, `${at}.payoff`, true, true, problems) as CompiledRule[],
        exclude: compileList(s.exclude, `${at}.exclude`, false, false, problems),
        kin: [],
        setupNeedsPayoff: s.setupNeedsPayoff === true,
        lacks: {},
      };
      const { minimums, used } = compileMinimums(s.minimums, `${at}.minimums`, problems);
      if (minimums) compiled.minimums = minimums;
      if (s.kin !== undefined) {
        if (!isStringList(s.kin)) problems.push(`${at}.kin: must be a non-empty list of style ids`);
        else {
          for (const k of s.kin)
            if (k === id || !ids.includes(k))
              problems.push(`${at}.kin: "${k}" must be another style in the file`);
          if (new Set(s.kin).size !== s.kin.length) problems.push(`${at}.kin: lists a style twice`);
          compiled.kin = [...s.kin];
        }
      }
      if (s.setupNeedsPayoff !== undefined && typeof s.setupNeedsPayoff !== 'boolean')
        problems.push(`${at}: "setupNeedsPayoff" must be true or false`);
      compiled.lacks = compileLacks(s.lacks, used, `${at}.lacks`, problems);
      styles.set(id, compiled);
    }
  }
  return { problems, rules: { version: d.version as string, styles } };
}

/** Every problem in a parsed theme-rules file; empty when it is valid. */
export function checkThemeRules(data: unknown): string[] {
  return compile(data).problems;
}

/** Check and compile a parsed theme-rules file; throws one error listing every problem. */
export function compileThemeRules(data: unknown, source = 'theme rules'): ThemeRules {
  const { problems, rules } = compile(data);
  if (problems.length) throw new Error(`${source}: ${problems.join('; ')}`);
  return rules;
}

const compiledRules = new WeakMap<ThemeRulesFile, ThemeRules>();

/** The config's theme rules, compiled once per rules file object (configs that share one share it). */
export function themeRulesFor(config: BulkBrewConfig): ThemeRules {
  let rules = compiledRules.get(config.themeRules);
  if (!rules) {
    rules = compileThemeRules(config.themeRules, 'config/theme-rules.json');
    compiledRules.set(config.themeRules, rules);
  }
  return rules;
}

/**
 * Oracle text the rules read: reminder text names jobs a card does not do.
 * Spaces it leaves at line ends are trimmed, so `$` anchors a line's end.
 */
export function ruleText(card: CardRecord): string {
  return card.text.replace(/\([^)]*\)/g, '').replace(/[ \t]+$/gm, '');
}

/** A card's power as a number, 'variable' for "*" and the like, or undefined without one. */
function powerOf(card: CardRecord): number | 'variable' | undefined {
  if (card.power === undefined || card.power === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(card.power) ? Number(card.power) : 'variable';
}

function hasKeyword(card: CardRecord, list: string[]): boolean {
  const have = card.keywords.map((k) => k.toLowerCase());
  return list.some((k) => have.includes(k.toLowerCase()));
}

/**
 * Whether a card meets every condition the rule gives. A rule with `sizes`
 * applies only when the deck size is given and listed.
 */
export function ruleMatches(
  card: CardRecord,
  c: CompiledRule<ExcludeRule>,
  text = ruleText(card),
  size?: ThemeSize,
): boolean {
  const r = c.rule;
  if (r.sizes && (size === undefined || !r.sizes.includes(size))) return false;
  if (r.anyTags && !r.anyTags.some((t) => card.tags.includes(t))) return false;
  if (r.allTags && !r.allTags.every((t) => card.tags.includes(t))) return false;
  if (r.notTags && r.notTags.some((t) => card.tags.includes(t))) return false;
  if (r.types && !r.types.some((t) => card.types.includes(t))) return false;
  if (r.notTypes && r.notTypes.some((t) => card.types.includes(t))) return false;
  if (r.minMv !== undefined && card.mv < r.minMv) return false;
  if (r.maxMv !== undefined && card.mv > r.maxMv) return false;
  if (r.minPower !== undefined || r.maxPower !== undefined) {
    const p = powerOf(card);
    if (p === undefined) return false;
    if (r.minPower !== undefined && p !== 'variable' && p < r.minPower) return false;
    if (r.maxPower !== undefined && (p === 'variable' || p > r.maxPower)) return false;
  }
  if (r.keywords && !hasKeyword(card, r.keywords)) return false;
  if (r.notKeywords && hasKeyword(card, r.notKeywords)) return false;
  if (c.typeLine && !c.typeLine.test(card.typeLine)) return false;
  if (c.text && !c.text.test(text)) return false;
  if (c.notText && c.notText.test(text)) return false;
  return true;
}

export interface ThemeMatch {
  as: 'setup' | 'payoff';
  job: string;
  weight: number;
  repeatable: boolean;
  /** It met a setup and a payoff job and was counted once, by priority, then weight. */
  dual: boolean;
}

export type CardTheme = ThemeMatch | { as: 'excluded'; job: string } | undefined;

interface Best {
  /** The matching rule with the highest weight; the first one listed wins a tie. */
  rule: ThemeRule;
  /** The highest priority among the matching rules. */
  priority: number;
}

function best(
  card: CardRecord,
  rules: CompiledRule[],
  text: string,
  size: ThemeSize | undefined,
): Best | undefined {
  let top: Best | undefined;
  for (const c of rules) {
    if (!ruleMatches(card, c, text, size)) continue;
    const priority = c.rule.priority ?? 0;
    if (!top) top = { rule: c.rule, priority };
    else {
      if (c.rule.weight > top.rule.weight) top.rule = c.rule;
      if (priority > top.priority) top.priority = priority;
    }
  }
  return top;
}

/**
 * What one card is to a style: setup, payoff, excluded (it met setup or payoff
 * but also an exclude rule), or nothing. A card meeting both jobs counts for
 * the side whose matching rules reach the higher priority; at equal priority
 * as setup when its best setup weight is higher, else as payoff.
 */
export function matchCard(card: CardRecord, style: CompiledStyle, size?: ThemeSize): CardTheme {
  const text = ruleText(card);
  const setup = best(card, style.setup, text, size);
  const payoff = best(card, style.payoff, text, size);
  if (!setup && !payoff) return undefined;
  const ex = style.exclude.find((c) => ruleMatches(card, c, text, size));
  if (ex) return { as: 'excluded', job: ex.rule.job };
  const dual = !!setup && !!payoff;
  const setupWins =
    !!setup &&
    (!payoff ||
      setup.priority > payoff.priority ||
      (setup.priority === payoff.priority && setup.rule.weight > payoff.rule.weight));
  const pick = setupWins ? setup.rule : payoff!.rule;
  return {
    as: setupWins ? 'setup' : 'payoff',
    job: pick.job,
    weight: pick.weight,
    repeatable: pick.repeatable === true,
    dual,
  };
}

export interface ThemeCardLine {
  name: string;
  qty: number;
  job: string;
  weight: number;
}

export interface ThemeMinimumsCheck {
  size: ThemeSize;
  met: boolean;
  /** Each floor missed, for the alternative that missed the fewest. Empty when met. */
  short: { floor: keyof ThemeFloor; have: number; need: number }[];
}

export interface ThemeCount {
  style: string;
  resource: string;
  /** The deck size the rules were read at: given, or the size nearest the copies counted. */
  size: ThemeSize;
  setupCopies: number;
  /** Copies times their job weight. */
  setupWeighted: number;
  /** Copies, each counting its weight capped at 1 (a 0.5 job counts half). */
  setupUnits: number;
  payoffCopies: number;
  payoffWeighted: number;
  payoffUnits: number;
  /** Copies that met both jobs and were counted once. */
  dualResolved: number;
  /** Copies an exclude rule removed. */
  excludedCopies: number;
  /** Setup copies whose job is repeatable. */
  repeatableSetupCopies: number;
  /** Weighted setup per payoff copy; null without payoffs. */
  ratio: number | null;
  /** Whether the style's minimums for this size are met; absent when the rules give none. */
  minimums?: ThemeMinimumsCheck;
  setup: ThemeCardLine[];
  payoff: ThemeCardLine[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The deck size nearest a copy count (basics and commander included); a tie goes to the larger. */
export function nearestThemeSize(copies: number): ThemeSize {
  let pick: ThemeSize = THEME_SIZES[0];
  for (const s of THEME_SIZES) if (Math.abs(copies - s) <= Math.abs(copies - pick)) pick = s;
  return pick;
}

function floorValue(count: ThemeCount, floor: keyof ThemeFloor): number {
  switch (floor) {
    case 'setup':
      return count.setupUnits;
    case 'setupWeight':
      return count.setupWeighted;
    case 'repeatable':
      return count.repeatableSetupCopies;
    case 'payoff':
      return count.payoffUnits;
    case 'payoffWeight':
      return count.payoffWeighted;
    case 'repeatableOrPayoff':
      return round2(count.repeatableSetupCopies + count.payoffUnits);
  }
}

/** Check a count against a style's minimums for a size; undefined when none are given. */
export function checkMinimums(
  count: ThemeCount,
  minimums: ThemeMinimums | undefined,
  size: ThemeSize = count.size,
): ThemeMinimumsCheck | undefined {
  const entry = minimums?.[`${size}`];
  if (!entry) return undefined;
  let closest: ThemeMinimumsCheck['short'] | undefined;
  for (const floors of Array.isArray(entry) ? entry : [entry]) {
    const short: ThemeMinimumsCheck['short'] = [];
    for (const [k, need] of Object.entries(floors) as [keyof ThemeFloor, number][]) {
      const have = floorValue(count, k);
      if (have < need) short.push({ floor: k, have, need });
    }
    if (short.length === 0) return { size, met: true, short: [] };
    if (!closest || short.length < closest.length) closest = short;
  }
  return { size, met: false, short: closest ?? [] };
}

/**
 * Setup and payoff in a list of cards, each card once. Pass the deck size when
 * known; otherwise it is the size nearest the copies counted, so pass every
 * card of the deck, basics and commander included.
 */
export function countTheme(
  cards: readonly { card: CardRecord; qty: number }[],
  style: CompiledStyle,
  size?: ThemeSize,
): ThemeCount {
  const at = size ?? nearestThemeSize(cards.reduce((n, c) => n + Math.max(0, c.qty), 0));
  const out: ThemeCount = {
    style: style.id,
    resource: style.resource,
    size: at,
    setupCopies: 0,
    setupWeighted: 0,
    setupUnits: 0,
    payoffCopies: 0,
    payoffWeighted: 0,
    payoffUnits: 0,
    dualResolved: 0,
    excludedCopies: 0,
    repeatableSetupCopies: 0,
    ratio: null,
    setup: [],
    payoff: [],
  };
  for (const { card, qty } of cards) {
    const m = matchCard(card, style, at);
    if (!m || qty <= 0) continue;
    if (m.as === 'excluded') {
      out.excludedCopies += qty;
      continue;
    }
    if (m.dual) out.dualResolved += qty;
    const line = { name: card.name, qty, job: m.job, weight: m.weight };
    const units = Math.min(m.weight, 1) * qty;
    if (m.as === 'setup') {
      out.setupCopies += qty;
      out.setupWeighted += m.weight * qty;
      out.setupUnits += units;
      if (m.repeatable) out.repeatableSetupCopies += qty;
      out.setup.push(line);
    } else {
      out.payoffCopies += qty;
      out.payoffWeighted += m.weight * qty;
      out.payoffUnits += units;
      out.payoff.push(line);
    }
  }
  out.setupWeighted = round2(out.setupWeighted);
  out.setupUnits = round2(out.setupUnits);
  out.payoffWeighted = round2(out.payoffWeighted);
  out.payoffUnits = round2(out.payoffUnits);
  out.ratio = out.payoffCopies > 0 ? round2(out.setupWeighted / out.payoffCopies) : null;
  const minimums = checkMinimums(out, style.minimums, at);
  if (minimums) out.minimums = minimums;
  return out;
}

/** Setup and payoff in a set of cards, each card once, in every unit a floor can name. */
export interface ThemeTally {
  setupUnits: number;
  setupWeight: number;
  repeatable: number;
  payoffUnits: number;
  payoffWeight: number;
}

export const THEME_TALLY_KEYS: readonly (keyof ThemeTally)[] = [
  'setupUnits',
  'setupWeight',
  'repeatable',
  'payoffUnits',
  'payoffWeight',
];

/**
 * config/theme-bulk.json, written by `npm run theme:bulk`: per style and
 * color class, the mean tally of one common or uncommon card of the pack, so a
 * pool's richness in a theme can be read against plain bulk of its colors.
 */
export interface ThemeBulkConfig {
  /** A hash of the content. */
  version: string;
  /** The data pack it was computed from. */
  dataVersion: string;
  /** The theme rules version it was computed with; must equal the bundled rules' version. */
  rulesVersion: string;
  styles: Record<string, Record<ColorClass, ThemeTally>>;
}

/** Problems in a bulk baseline read against the rules it must match; empty when valid. */
export function checkThemeBulk(bulk: unknown, rules: ThemeRulesFile): string[] {
  const problems: string[] = [];
  if (!isObject(bulk)) return ['must be an object'];
  for (const key of ['version', 'dataVersion', 'rulesVersion'] as const)
    if (typeof bulk[key] !== 'string' || bulk[key] === '')
      problems.push(`"${key}" must be a non-empty string`);
  if (typeof bulk.rulesVersion === 'string' && bulk.rulesVersion !== rules.version)
    problems.push(
      `computed for theme rules version "${bulk.rulesVersion}", but the rules are version "${rules.version}": run npm run theme:bulk`,
    );
  if (!isObject(bulk.styles)) {
    problems.push('"styles" must be an object keyed by style id');
    return problems;
  }
  const styles = bulk.styles;
  const ruleStyles = isObject(rules.styles) ? Object.keys(rules.styles) : [];
  for (const id of Object.keys(styles))
    if (!ruleStyles.includes(id)) problems.push(`styles.${id}: not a style in the theme rules`);
  for (const id of ruleStyles) {
    const per = styles[id];
    if (!isObject(per)) {
      problems.push(`styles.${id}: missing: run npm run theme:bulk`);
      continue;
    }
    for (const k of COLOR_CLASSES) {
      const t = per[k];
      if (!isObject(t)) {
        problems.push(`styles.${id}.${k}: missing`);
        continue;
      }
      for (const key of THEME_TALLY_KEYS) {
        const v = t[key];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
          problems.push(`styles.${id}.${k}.${key}: must be a number of 0 or more`);
      }
    }
  }
  return problems;
}

/** A tiny rules file for tests and the format's example; not a judgment on any theme. */
export const EXAMPLE_THEME_RULES: ThemeRulesFile = {
  version: 'example-1',
  styles: {
    graveyard: {
      resource: 'cards in your graveyard',
      setup: [
        {
          job: 'loots every turn',
          weight: 2,
          anyTags: ['loot'],
          text: '\\{T\\}',
          repeatable: true,
        },
        { job: 'mills itself', weight: 1, anyTags: ['mill-self'] },
      ],
      payoff: [
        { job: 'returns a creature card', weight: 1, anyTags: ['reanimate'] },
        { job: 'counts the graveyard', weight: 1.5, text: 'for each card in your graveyard' },
      ],
      exclude: [{ job: 'one-off surveil rider', anyTags: ['mill-self'], text: '^surveil 1\\.$' }],
      // Phrases for the floors tests give this style.
      lacks: {
        setup: 'few cards that fill your graveyard',
        setupWeight: 'few cards that fill your graveyard',
        repeatable: 'no repeatable way to fill the graveyard',
        payoff: 'few cards that use a full graveyard',
        payoffWeight: 'few cards that use a full graveyard',
      },
    },
  },
};
