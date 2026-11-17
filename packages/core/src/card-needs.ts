// Card needs (docs/builder-phase2.md, step 2): what each ability of a card
// depends on, read from its rules text, and whether a deck supplies it. Rules
// text is templated, so the same words always mean the same thing: the
// vocabulary and the templates live in config/card-needs.json, the reading
// lives here. Pure and deterministic: no DOM, Node, or network. Format and
// meaning: config/README.md.

import type { BulkBrewConfig } from './config.ts';
import { cardMatches, creatureTypes, isCreature } from './matchers.ts';
import {
  matchCard,
  ruleMatches,
  ruleText,
  themeRulesFor,
  type CompiledRule,
  type ThemeSize,
} from './theme-rules.ts';
import type { CardRecord, CardType, Color, DeckSize } from './types.ts';

// ---------------------------------------------------------------- the model

/** How an ability depends on a resource (the brief's templates). */
export type NeedKind = 'need' | 'bonus' | 'drawback' | 'unconditional';
export type RefKind = Exclude<NeedKind, 'unconditional'>;

/** Where in an ability a resource appears. */
export type NeedPlace =
  | 'condition'
  | 'trigger'
  | 'cost'
  | 'selection'
  | 'count'
  | 'replacement'
  | 'additionalCost'
  | 'unparsed';

export const NEED_KINDS: readonly NeedKind[] = ['need', 'bonus', 'drawback', 'unconditional'];
const SEVERITY: Record<NeedKind, number> = { unconditional: 0, bonus: 1, drawback: 2, need: 3 };

/** One resource reference: any resource in `anyOf` meets it. */
export interface NeedRef {
  kind: RefKind;
  place: NeedPlace;
  anyOf: string[];
  /** "three or more artifacts": the number of the resource it asks for. */
  count?: number;
  /** "another" or "other": the card itself does not count. */
  other?: boolean;
  /** The card supplies it itself (makes its own Food, is the type it asks for). */
  self: boolean;
  /** The words read, normalized ("~" is the card itself). */
  text: string;
  /** A drawback: what happens to its owner when the resource is missing. */
  harm?: string;
  /** The card cannot be the object (a spell it reduces, a card it searches for), so its own types do not meet it. */
  notSelf?: boolean;
  /** "A legendary creature": the card type a supertype applies to, for self-supply and counting. */
  head?: string;
  /** An additional cost payable with mana instead ("or pay {1}"): the mana it costs when unmet. */
  orPay?: number;
  /**
   * Self-supplied only through another ability that has needs of its own (the
   * counters a "whenever you gain life" trigger puts): met when those are.
   */
  selfVia?: NeedRef[];
}

/** One sentence of an ability, with every ref that governs it. */
export interface NeedClause {
  /** Offsets in `ruleText(card)`, so theme rules' text matches map onto clauses. */
  start: number;
  end: number;
  text: string;
  refs: NeedRef[];
  kind: NeedKind;
}

export type AbilityShape =
  | 'keyword'
  | 'activated'
  | 'triggered'
  | 'static'
  | 'spell'
  | 'chapter'
  | 'level'
  | 'mode'
  | 'modal'
  | 'additionalCost';

export interface CardAbility {
  /** 0 for the front face (or the only one), 1 for the back or second half. */
  face: number;
  /** The ability's text as printed, reminder text removed. */
  text: string;
  /** The first words as printed, as the expectation format names abilities. */
  starts: string;
  shape: AbilityShape;
  /** Class or leveler level the ability belongs to. */
  level?: number;
  /** A modal bullet's header ability (index in `abilities`). */
  parent?: number;
  start: number;
  end: number;
  /** Every ref in the ability. */
  refs: NeedRef[];
  clauses: NeedClause[];
  kind: NeedKind;
  /** Resources the ability's text supplies (tokens it makes, life it gains, ...). */
  supplies: string[];
  /** Set when some part could not be read: the reason, normalized. */
  unparsed?: string;
  /** Conditions, triggers, or costs read as game state because they name no resource. */
  gameState?: string[];
}

export interface CardNeeds {
  abilities: CardAbility[];
  /** Resources the card supplies: its types and type line, and what its text makes. */
  supplies: string[];
  /** Resources the card supplies to the extent of meeting its own need. */
  selfSupplies: string[];
  /** The most severe kind among the abilities. */
  kind: NeedKind;
}

// ---------------------------------------------------------------- config

export type ObjMode = 'yours' | 'graveyard' | 'cast' | 'card' | 'token';

/**
 * One template. `re` is a regular expression (case-insensitive) with the
 * placeholders listed in config/README.md; trigger templates match the start
 * of a trigger, condition and cost templates a whole condition or cost part,
 * effect templates anywhere in a sentence.
 */
export interface NeedTemplate {
  re: string;
  /** Fixed resources the phrase names; any one meets it. */
  res?: string[];
  /** How the {obj} capture is read. */
  obj?: ObjMode;
  /** Resources a mine-owned but ubiquitous object stands for ("a creature you control dies": death). */
  ubiquitous?: string[];
  /** Also needed beside the object ("you sacrifice an artifact": sacrifice). */
  also?: string[];
  /** The phrase is read and names nothing the deck must supply. */
  ignore?: boolean;
  /** The phrase supplies these resources instead of needing them; with `obj`, what the object names. */
  supplies?: string[];
  supply?: boolean;
  /** Effect templates: where the ref sits (selection by default). */
  place?: NeedPlace;
  /** A forced kind. */
  kind?: RefKind;
  /** A condition met by the absence of the resource ("you control no Islands"). */
  negated?: boolean;
  /** A condition that is the event itself ("if you would gain life"): "instead" does not make it a bonus. */
  event?: boolean;
  /** A counter kind read from {counter}. */
  counter?: boolean;
  /** An optional action ("you may sacrifice an artifact") a following "If you do" depends on. */
  optional?: boolean;
  /** Match only when the object names a resource ("Goblin creatures get", not "Those creatures are"). */
  typed?: boolean;
  /**
   * A broad reading of game state ("it's ...", "~ is ..."): taken only when the
   * words name no resource, and then noted as game state rather than read.
   */
  catchAll?: boolean;
  /** The card itself cannot be the object ("artifact spells you cast cost less", a library search). */
  notSelf?: boolean;
  /** Case-sensitive, for templates that need a capitalized type word. */
  case?: boolean;
  /** {counter} names what the phrase puts, while {obj} names what it needs ("put a counter on target artifact"). */
  counterSupplies?: boolean;
  /** Adds alternatives to the sentence's previous ref ("for each Assassin you control and each Assassin card in your graveyard"). */
  join?: boolean;
}

/** A keyword ability with a dependency ("Affinity for artifacts", "Champion a Faerie"). */
export interface KeywordNeed {
  kind: RefKind;
  place: NeedPlace;
  res?: string[];
  /** Read the words after the keyword as an object. */
  obj?: ObjMode;
}

/** How a credit is tied to the clause that earns it. */
export interface CreditPattern {
  /** The card's body earns it (stats, keywords): unconditional. */
  body?: boolean;
  /** The body earns it only with one of these keywords. */
  bodyKeywords?: string[];
  /** A regular expression for the clause that earns it. */
  clause?: string;
  /** A weaker clause, used only when no clause matches `clause` (surveil for card advantage). */
  weakClause?: string;
  /** Use another role's pattern. */
  role?: string;
  /** Not tied to a clause and never gated (a penalty, not a credit). */
  always?: boolean;
}

/** Where a resource's deck supply comes from. */
export interface SupplyRule {
  /** Count the cards that are this theme's setup (theme-rules.json). */
  theme?: string;
  /** Also count what the reader finds in the text. */
  text?: boolean;
  /** A count up to this is met by any deck ("a card in your graveyard"). */
  freeCount?: number;
}

export type SizeTable = Record<'20' | '40' | '60' | '100', number>;

export interface CardNeedsConfig {
  version: string;
  vocabulary: {
    creatureTypes: string[];
    artifactTypes: string[];
    enchantmentTypes: string[];
    landTypes: string[];
    spellTypes: string[];
    planeswalkerTypes: string[];
    battleTypes: string[];
    /** Plurals that are not the word plus s or es, and words whose plural is the word. */
    plurals: Record<string, string>;
    /** Words that stand for several creature types ("outlaw"). */
    groups: Record<string, string[]>;
    /** "this creature", "this land", ...: nouns the card uses for itself. */
    selfNouns: string[];
    /** Number words. */
    numbers: Record<string, number>;
    /** Subtypes with their own sacrifice ability (Food, Clue): sacrificing them needs no outlet. */
    builtInSacrifice: string[];
    /** Keywords a creature can be selected by ("creatures you control with flying"). */
    creatureKeywords: string[];
  };
  /** Keyword abilities with a dependency; every other keyword is unconditional. */
  keywords: Record<string, KeywordNeed>;
  /** What a keyword's reminder text makes ("Adapt" puts +1/+1 counters on the creature). */
  keywordSupplies: Record<string, string[]>;
  /** Keyword actions: a line of one is an effect, not a keyword ability ("Proliferate."). */
  keywordActions: string[];
  /** Effects that harm the card's owner: an "unless" over one is a drawback. */
  harmful: string[];
  /** A clause that only changes power and toughness. */
  statOnly: string;
  /** Sentences whose refs are bonuses: cost reductions and alternative costs. */
  bonusSentence: string;
  /**
   * Words that name a resource. A condition, trigger event, or cost part no
   * template reads and that has none of these words (nor a type) is game state:
   * it asks nothing of the deck.
   */
  resourceWords: string;
  templates: {
    trigger: NeedTemplate[];
    condition: NeedTemplate[];
    cost: NeedTemplate[];
    effect: NeedTemplate[];
  };
  /** Words that name a resource; one left unread marks its ability unparsed. */
  mentions: Record<string, string>;
  credits: {
    roles: Record<string, CreditPattern>;
    strength: Record<string, CreditPattern>;
    /** Clause patterns for theme rules that read tags only, by tag. */
    themeTags: Record<string, string>;
  };
  /** Supply rules by resource id, or by family (the part before the first colon). */
  supply: Record<string, SupplyRule>;
  thresholds: {
    /** Copies a deck needs to supply a resource. */
    base: SizeTable;
    /** By family or resource id. */
    families: Record<string, SizeTable>;
    /** Added for each counted item beyond the first ("three or more"). */
    perCount: SizeTable;
    /** `perCount` by family, where a count grows from play rather than from cards (graveyard). */
    perCountFamilies: Record<string, SizeTable>;
    /** Unparsed abilities need this many times the supply. */
    unparsedScale: number;
  };
}

// ---------------------------------------------------------------- compile

const NUM_WORDS =
  'an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|x|\\d+';

const PLACEHOLDERS: [string, string][] = [
  ['{obj}', '(?<obj>[^,.;:"¤•]+?)'],
  ['{tok}', '(?<obj>[^.;:"¤•]*?)'],
  ['{n}', `(?<n>${NUM_WORDS})`],
  ['{num}', `(?:${NUM_WORDS})`],
  ['{counter}', '(?<counter>[+-]\\d+/[+-]\\d+|[a-z]+)'],
  ['{color}', '(?<color>white|blue|black|red|green)'],
  ['{mana}', '(?:\\{[^}]+\\})+'],
];

function expand(src: string): string {
  let out = src;
  for (const [k, v] of PLACEHOLDERS) out = out.split(k).join(v);
  return out;
}

interface Template {
  t: NeedTemplate;
  re: RegExp;
}

interface Compiled {
  cfg: CardNeedsConfig;
  trigger: Template[];
  condition: Template[];
  cost: Template[];
  effect: Template[];
  /** Every subtype word, singular and plural: group 1 "non" prefix, group 2 the word. */
  typeRe: RegExp;
  typeRes: Map<string, string>;
  groupRe: RegExp | undefined;
  mentions: { id: string; re: RegExp }[];
  harmful: RegExp[];
  statOnly: RegExp;
  bonusSentence: RegExp;
  resourceWords: RegExp;
  selfNoun: RegExp;
  keywordNames: string[];
  creatureKeywordRe: RegExp;
  roleClauses: Map<string, CompiledPattern>;
  strengthClauses: Map<string, CompiledPattern>;
  themeTags: Map<string, RegExp>;
  keywordActions: Set<string>;
}

type CompiledPattern = CreditPattern & { re?: RegExp; weak?: RegExp };

const PLACES: readonly NeedPlace[] = [
  'condition',
  'trigger',
  'cost',
  'selection',
  'count',
  'replacement',
  'additionalCost',
  'unparsed',
];

const COLOR_WORDS: Record<string, Color> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A word's plural: the config's, else English rules (the pack's words follow them). */
export function pluralOf(word: string, plurals: Record<string, string>): string {
  if (plurals[word] !== undefined) return plurals[word]!;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function compileRe(src: string, flags: string, where: string, problems: string[]): RegExp {
  const unknown = src.match(/\{[a-z]+\}/g)?.filter((p) => !PLACEHOLDERS.some(([k]) => k === p));
  if (unknown?.length) problems.push(`${where}: unknown placeholder ${unknown.join(', ')}`);
  try {
    return new RegExp(expand(src), flags);
  } catch (err) {
    problems.push(`${where}: bad regular expression: ${(err as Error).message}`);
    return /$^/;
  }
}

function compileTemplates(
  list: unknown,
  where: string,
  anchor: 'start' | 'whole' | 'none',
  problems: string[],
): Template[] {
  if (!Array.isArray(list)) {
    problems.push(`${where}: must be a list of templates`);
    return [];
  }
  const out: Template[] = [];
  list.forEach((raw: unknown, i) => {
    const at = `${where}[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(`${at}: a template must be an object`);
      return;
    }
    const t = raw as NeedTemplate;
    const known = new Set([
      're',
      'res',
      'obj',
      'ubiquitous',
      'also',
      'ignore',
      'supplies',
      'supply',
      'place',
      'kind',
      'negated',
      'event',
      'counter',
      'optional',
      'typed',
      'catchAll',
      'notSelf',
      'case',
      'counterSupplies',
      'join',
      'note',
    ]);
    for (const k of Object.keys(t)) if (!known.has(k)) problems.push(`${at}: unknown key "${k}"`);
    if (typeof t.re !== 'string' || t.re === '') {
      problems.push(`${at}: "re" must be a non-empty string`);
      return;
    }
    if (t.obj !== undefined && !['yours', 'graveyard', 'cast', 'card', 'token'].includes(t.obj))
      problems.push(`${at}: unknown obj mode "${String(t.obj)}"`);
    if (t.obj !== undefined && !/\{obj\}|\{tok\}|\(\?<obj>/.test(t.re))
      problems.push(`${at}: "obj" needs {obj}, {tok}, or a group named obj in "re"`);
    if (t.kind !== undefined && !['need', 'bonus', 'drawback'].includes(t.kind))
      problems.push(`${at}: kind must be need, bonus, or drawback`);
    if (t.place !== undefined && !PLACES.includes(t.place))
      problems.push(`${at}: place must be one of ${PLACES.join(', ')}`);
    for (const k of [
      'ignore',
      'supply',
      'negated',
      'event',
      'counter',
      'optional',
      'typed',
      'catchAll',
      'notSelf',
      'case',
      'counterSupplies',
    ] as const)
      if (t[k] !== undefined && typeof t[k] !== 'boolean')
        problems.push(`${at}: "${k}" must be true or false`);
    for (const k of ['res', 'ubiquitous', 'also', 'supplies'] as const) {
      const v = t[k];
      if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x)))
        problems.push(`${at}: "${k}" must be a list of resource ids`);
      for (const r of v ?? [])
        if (!RESOURCE_RE.test(r)) problems.push(`${at}: bad resource "${r}"`);
    }
    if (
      !t.ignore &&
      !t.supply &&
      !t.supplies &&
      t.res === undefined &&
      t.obj === undefined &&
      !t.counter
    )
      problems.push(`${at}: give "res", "obj", "counter", "supplies", or "ignore"`);
    const src =
      anchor === 'start' ? `^(?:${t.re})(?=, |$)` : anchor === 'whole' ? `^(?:${t.re})$` : t.re;
    const flags = (anchor === 'none' ? 'g' : '') + (t.case ? '' : 'i');
    out.push({ t, re: compileRe(src, flags, at, problems) });
  });
  return out;
}

const RESOURCE_RE = /^[a-z][a-z-]*(?::[^:\s][^:]*)*$/i;

function compileNeeds(cfg: CardNeedsConfig, problems: string[]): Compiled {
  const v = cfg.vocabulary;
  const typeRes = new Map<string, string>();
  const addType = (word: string, res: string) => {
    if (!typeRes.has(word)) typeRes.set(word, res);
    const pl = pluralOf(word, v.plurals ?? {});
    if (!typeRes.has(pl)) typeRes.set(pl, res);
  };
  for (const t of v.creatureTypes ?? []) addType(t, `tribe:${t}`);
  for (const list of [
    v.artifactTypes,
    v.enchantmentTypes,
    v.spellTypes,
    v.planeswalkerTypes,
    v.battleTypes,
  ])
    for (const t of list ?? []) addType(t, `subtype:${t}`);
  for (const t of v.landTypes ?? []) addType(t, `land:${t}`);
  const words = [...typeRes.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const typeRe = new RegExp(`\\b([Nn]on-?)?(${words.map(escapeRe).join('|')})(?![\\w'-])`, 'g');
  const groups = Object.keys(v.groups ?? {});
  const groupRe = groups.length
    ? new RegExp(`\\b(non-?)?(${groups.map(escapeRe).join('|')})s?\\b`, 'gi')
    : undefined;
  const mentions: { id: string; re: RegExp }[] = [];
  for (const [id, src] of Object.entries(cfg.mentions ?? {}))
    mentions.push({ id, re: compileRe(src, 'gi', `mentions.${id}`, problems) });
  const clauses = (table: Record<string, CreditPattern> | undefined, where: string) => {
    const out = new Map<string, CompiledPattern>();
    for (const [id, p] of Object.entries(table ?? {})) {
      const known = new Set(['body', 'bodyKeywords', 'clause', 'weakClause', 'role', 'always']);
      for (const k of Object.keys(p ?? {}))
        if (!known.has(k)) problems.push(`${where}.${id}: unknown key "${k}"`);
      if (
        p.bodyKeywords !== undefined &&
        (!Array.isArray(p.bodyKeywords) || p.bodyKeywords.some((k) => typeof k !== 'string'))
      )
        problems.push(`${where}.${id}.bodyKeywords: must be a list of keywords`);
      const re = p.clause ? compileRe(p.clause, 'i', `${where}.${id}.clause`, problems) : undefined;
      const weak = p.weakClause
        ? compileRe(p.weakClause, 'i', `${where}.${id}.weakClause`, problems)
        : undefined;
      if (!p.body && !p.bodyKeywords && !p.clause && !p.role && !p.always)
        problems.push(`${where}.${id}: give "body", "bodyKeywords", "clause", "role", or "always"`);
      out.set(id, { ...p, ...(re ? { re } : {}), ...(weak ? { weak } : {}) });
    }
    return out;
  };
  const themeTags = new Map<string, RegExp>();
  for (const [tag, src] of Object.entries(cfg.credits?.themeTags ?? {})) {
    if (!/^[a-z0-9-]+$/.test(tag)) problems.push(`credits.themeTags: "${tag}" is not a tag slug`);
    themeTags.set(tag, compileRe(src, 'i', `credits.themeTags.${tag}`, problems));
  }
  const selfNouns = (v.selfNouns ?? []).map(escapeRe).join('|');
  const kw = (v.creatureKeywords ?? []).map((k) => escapeRe(k.toLowerCase())).join('|');
  return {
    cfg,
    trigger: compileTemplates(cfg.templates?.trigger, 'templates.trigger', 'start', problems),
    condition: compileTemplates(cfg.templates?.condition, 'templates.condition', 'whole', problems),
    cost: compileTemplates(cfg.templates?.cost, 'templates.cost', 'whole', problems),
    effect: compileTemplates(cfg.templates?.effect, 'templates.effect', 'none', problems),
    typeRe,
    typeRes,
    groupRe,
    mentions,
    harmful: (cfg.harmful ?? []).map((s, i) => compileRe(s, 'i', `harmful[${i}]`, problems)),
    statOnly: compileRe(cfg.statOnly ?? '$^', 'i', 'statOnly', problems),
    bonusSentence: compileRe(cfg.bonusSentence ?? '$^', 'i', 'bonusSentence', problems),
    resourceWords: compileRe(cfg.resourceWords ?? '', 'i', 'resourceWords', problems),
    selfNoun: new RegExp(`\\b[Tt]his (?:${selfNouns || 'creature'})\\b`, 'g'),
    keywordNames: Object.keys(cfg.keywords ?? {}).sort((a, b) => b.length - a.length),
    creatureKeywordRe: new RegExp(`\\bwith (${kw || 'flying'})\\b`, 'i'),
    roleClauses: clauses(cfg.credits?.roles, 'credits.roles'),
    strengthClauses: clauses(cfg.credits?.strength, 'credits.strength'),
    themeTags,
    keywordActions: new Set((cfg.keywordActions ?? []).map((k) => k.toLowerCase())),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const SIZE_KEYS = ['20', '40', '60', '100'] as const;

function checkSizeTable(where: string, t: unknown, problems: string[]): void {
  if (!isObject(t)) {
    problems.push(`${where}: must give 20, 40, 60, and 100`);
    return;
  }
  for (const k of SIZE_KEYS) {
    const n = t[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
      problems.push(`${where}.${k}: must be a number of 0 or more`);
  }
}

/** Every problem in a parsed card-needs file, cross-checked against the rest of the config. */
export function checkCardNeeds(data: unknown, config?: BulkBrewConfig): string[] {
  const problems: string[] = [];
  if (!isObject(data)) return ['must be an object'];
  const cfg = data as unknown as CardNeedsConfig;
  if (typeof cfg.version !== 'string' || cfg.version === '')
    problems.push('"version" must be a non-empty string');
  const v = cfg.vocabulary;
  if (!isObject(v)) problems.push('"vocabulary" must be an object');
  else {
    for (const k of [
      'creatureTypes',
      'artifactTypes',
      'enchantmentTypes',
      'landTypes',
      'spellTypes',
      'planeswalkerTypes',
      'battleTypes',
      'selfNouns',
      'builtInSacrifice',
      'creatureKeywords',
    ] as const) {
      const list = v[k];
      if (!Array.isArray(list) || list.some((x) => typeof x !== 'string' || x === ''))
        problems.push(`vocabulary.${k}: must be a list of words`);
    }
    for (const k of ['plurals', 'groups', 'numbers'] as const)
      if (!isObject(v[k])) problems.push(`vocabulary.${k}: must be an object`);
    for (const [g, list] of Object.entries(v.groups ?? {})) {
      if (!Array.isArray(list)) {
        problems.push(`vocabulary.groups.${g}: must be a list of creature types`);
        continue;
      }
      for (const t of list)
        if (!v.creatureTypes?.includes(t))
          problems.push(`vocabulary.groups.${g}: "${t}" is not a creature type`);
    }
  }
  if (
    !Array.isArray(cfg.keywordActions) ||
    cfg.keywordActions.some((k) => typeof k !== 'string' || !k)
  )
    problems.push('"keywordActions" must be a list of keywords');
  if (!isObject(cfg.keywordSupplies)) problems.push('"keywordSupplies" must be an object');
  for (const [kw, list] of Object.entries(cfg.keywordSupplies ?? {}))
    if (!Array.isArray(list) || list.some((r) => typeof r !== 'string' || !RESOURCE_RE.test(r)))
      problems.push(`keywordSupplies.${kw}: must be a list of resource ids`);
  if (!isObject(cfg.templates)) problems.push('"templates" must be an object');
  if (!Array.isArray(cfg.harmful)) problems.push('"harmful" must be a list of expressions');
  for (const [kw, k] of Object.entries(cfg.keywords ?? {})) {
    if (!/^[A-Z][\w' -]*$/.test(kw)) problems.push(`keywords: "${kw}" is not a keyword as printed`);
    for (const key of Object.keys(k ?? {}))
      if (!['kind', 'place', 'res', 'obj'].includes(key))
        problems.push(`keywords.${kw}: unknown key "${key}"`);
    if (!['need', 'bonus', 'drawback'].includes(k?.kind))
      problems.push(`keywords.${kw}: kind must be need, bonus, or drawback`);
    if (!PLACES.includes(k?.place))
      problems.push(`keywords.${kw}: unknown place "${String(k?.place)}"`);
    if (!k?.res && !k?.obj) problems.push(`keywords.${kw}: give "res" or "obj"`);
    for (const r of k?.res ?? [])
      if (!RESOURCE_RE.test(r)) problems.push(`keywords.${kw}: bad resource "${r}"`);
  }
  const t = cfg.thresholds;
  if (!isObject(t)) problems.push('"thresholds" must be an object');
  else {
    checkSizeTable('thresholds.base', t.base, problems);
    checkSizeTable('thresholds.perCount', t.perCount, problems);
    for (const key of ['families', 'perCountFamilies'] as const) {
      if (!isObject(t[key])) problems.push(`thresholds.${key}: must be an object`);
      for (const [k, table] of Object.entries(t[key] ?? {})) {
        if (!RESOURCE_RE.test(k))
          problems.push(`thresholds.${key}: "${k}" is not a family or resource id`);
        checkSizeTable(`thresholds.${key}.${k}`, table, problems);
      }
    }
    if (typeof t.unparsedScale !== 'number' || !(t.unparsedScale >= 1))
      problems.push('thresholds.unparsedScale: must be a number of 1 or more');
  }
  const styles = config ? Object.keys(config.themeRules?.styles ?? {}) : undefined;
  for (const [r, rule] of Object.entries(cfg.supply ?? {})) {
    if (!RESOURCE_RE.test(r)) problems.push(`supply: "${r}" is not a resource id`);
    for (const k of Object.keys(rule ?? {}))
      if (!['theme', 'text', 'freeCount'].includes(k))
        problems.push(`supply.${r}: unknown key "${k}"`);
    if (rule.freeCount !== undefined && !(Number.isInteger(rule.freeCount) && rule.freeCount >= 0))
      problems.push(`supply.${r}.freeCount: must be a whole number of 0 or more`);
    if (rule.text !== undefined && typeof rule.text !== 'boolean')
      problems.push(`supply.${r}.text: must be true or false`);
    if (rule.theme !== undefined && styles && !styles.includes(rule.theme))
      problems.push(`supply.${r}: "${rule.theme}" is not a style in the theme rules`);
  }
  if (config) {
    for (const id of Object.keys(cfg.credits?.roles ?? {}))
      if (!config.roles.roles.some((r) => r.id === id))
        problems.push(`credits.roles.${id}: not a role in roles.json`);
    for (const r of config.roles.roles)
      if (!cfg.credits?.roles?.[r.id])
        problems.push(`credits.roles: no clause pattern for the role "${r.id}"`);
    const labels = config.cardStrength.effects.map((e) => e.label);
    for (const label of labels)
      if (!cfg.credits?.strength?.[label])
        problems.push(`credits.strength: no clause pattern for the effect "${label}"`);
    for (const [label, p] of Object.entries(cfg.credits?.strength ?? {})) {
      if (!labels.includes(label))
        problems.push(`credits.strength.${label}: not an effect in card-strength.json`);
      if (p.role && !cfg.credits.roles?.[p.role])
        problems.push(`credits.strength.${label}: unknown role "${p.role}"`);
    }
  }
  // Templates compile once the shapes they are built from are there.
  if (isObject(cfg.vocabulary) && isObject(cfg.templates) && Array.isArray(cfg.harmful))
    compileNeeds(cfg, problems);
  return problems;
}

const compiledCache = new WeakMap<CardNeedsConfig, Compiled>();

function compiledFor(config: BulkBrewConfig): Compiled {
  const cfg = config.cardNeeds;
  let c = compiledCache.get(cfg);
  if (!c) {
    const problems: string[] = [];
    c = compileNeeds(cfg, problems);
    if (problems.length) throw new Error(`config/card-needs.json: ${problems.join('; ')}`);
    compiledCache.set(cfg, c);
  }
  return c;
}

// ---------------------------------------------------------------- objects

/** What an object phrase ("another Elf you control", "a Lesson or Noble card") names. */
interface ObjReading {
  res: string[];
  owner: 'you' | 'opp' | 'any';
  other: boolean;
  count?: number;
  /** "A legendary creature": the card type the supertype applies to. */
  head?: string;
  /** A qualifier the vocabulary does not read; the part is left unparsed. */
  unread?: string;
}

const OPP_RE =
  /\b(?:an opponent controls|opponents control|you don't control|target opponent controls|that player controls|defending player controls|target player controls|its controller controls|each opponent controls|your opponents control|they control|an opponent owns|you don't own|opponent's|opponents'|that player's|target player's|their owner's|its owner's|attacks you|attack you)\b/i;
const YOURS_RE = /\b(?:you control|you own|your|under your control|you've)\b/i;

function numberOf(word: string | undefined, c: Compiled): number | undefined {
  if (!word) return undefined;
  const w = word.toLowerCase();
  if (/^\d+$/.test(w)) return Number(w);
  return c.cfg.vocabulary.numbers[w];
}

const ARTIFACT_RES = 'type:artifact';
const CARD_TYPE_WORDS = 'creature|artifact|enchantment|land|planeswalker|battle';
const COLOR_RE =
  /\b(non-?)?(white|blue|black|red|green)\b((?:,? (?:and\/or|or|and) (?:white|blue|black|red|green)\b)*)(?= (?:and\/or |or |and )?(?:\w+ )?(?:creatures?|permanents?|spells?|cards?|sources?|artifacts?|enchantments?)\b)/i;

function lowerTypes(p: string, mode: ObjMode, out: string[]): void {
  const push = (r: string) => {
    if (!out.includes(r)) out.push(r);
  };
  for (const m of p.matchAll(
    /\b(non-?)?(artifacts?|enchantments?|planeswalkers?|battles?|instants?|sorcery|sorceries|legendary|snow|historic|creature|creatures)\b/gi,
  )) {
    const neg = !!m[1];
    const w = m[2]!.toLowerCase();
    if (w.startsWith('creature')) {
      if (neg && mode === 'cast' && !/\bnonland\b/i.test(p)) push('type:noncreature');
      continue;
    }
    if (neg) continue;
    if (w.startsWith('artifact')) push(ARTIFACT_RES);
    else if (w.startsWith('enchantment')) push('type:enchantment');
    else if (w.startsWith('planeswalker')) push('type:planeswalker');
    else if (w.startsWith('battle')) push('type:battle');
    else if (w.startsWith('instant') || w.startsWith('sorcer')) push('type:instant-sorcery');
    else push(`type:${w}`);
  }
}

/** Whether a phrase lets every deck's creatures, lands, or permanents count ("a creature or Vehicle"). */
function ubiquitousAlternative(p: string, c: Compiled): boolean {
  const qualified = (word: string | undefined) => {
    if (!word) return false;
    if (
      /^(?:artifact|enchantment|legendary|snow|historic|basic|nonbasic|token|attacking|blocking|tapped|untapped)$/i.test(
        word,
      )
    )
      return true;
    c.typeRe.lastIndex = 0;
    return c.typeRe.test(word) || COLOR_RE.test(`${word} creature`);
  };
  for (const m of p.matchAll(/(\S+) (?:creature|land|permanent)s?(?: cards?)? (?:or|and\/or)\b/gi))
    if (!qualified(m[1])) return true;
  if (
    /^(?:an? |another |target |other )*(?:creature|land|permanent)s?(?: cards?)? (?:or|and\/or)\b/i.test(
      p,
    )
  )
    return true;
  for (const m of p.matchAll(
    /\b(?:or|and\/or) (?:an? |other )?(?:(\S+) )?(creature|land|permanent)s?\b/gi,
  ))
    if (!qualified(m[1]) || m[1] === undefined) return true;
  return false;
}

function resolveObj(phrase: string, given: ObjMode, c: Compiled): ObjReading {
  // A card named by name is one card, not a resource; "~" is the card itself.
  const p = phrase
    .trim()
    .replace(/\s+named\s.*$/i, '')
    .replace(/,$/, '');
  let mode = given;
  // "Spells you've cast" and "cards in your graveyard" say where they are themselves.
  if (
    mode === 'yours' &&
    /\bspells?\b/i.test(p) &&
    /\b(?:you(?:'ve)? cast|cast this turn)\b/i.test(p)
  )
    mode = 'cast';
  else if (mode === 'yours' && /\b(?:in|from) your graveyard\b/i.test(p)) mode = 'graveyard';
  const owner: ObjReading['owner'] = OPP_RE.test(p) ? 'opp' : YOURS_RE.test(p) ? 'you' : 'any';
  const other = /\b(?:another|other)\b/i.test(p) && !/\bother than\b/i.test(p);
  const lead = /^(?:at least |exactly )?(\w+)(?: or more)?\b/i.exec(p);
  const count = /^(?:another|other)\b/i.test(p) ? 1 : numberOf(lead?.[1], c);
  const base = { owner, other, ...(count !== undefined ? { count } : {}) };
  if (/^(?:~|it|them|that card|this card|~'s)$/i.test(p)) return { res: [], ...base };
  const typed: string[] = [];
  const push = (r: string) => {
    if (!typed.includes(r)) typed.push(r);
  };
  const dropTypes = new Set<string>();
  for (const m of p.matchAll(c.typeRe)) {
    if (m[1]) continue;
    push(c.typeRes.get(m[2]!)!);
    // "A Basri planeswalker", "an Equipment artifact": the subtype says it all.
    const after = new RegExp(`^ (${CARD_TYPE_WORDS})s?\\b`, 'i').exec(
      p.slice(m.index! + m[0].length),
    );
    if (after) dropTypes.add(`type:${after[1]!.toLowerCase()}`);
  }
  if (c.groupRe)
    for (const m of p.matchAll(c.groupRe)) {
      if (m[1]) continue;
      for (const t of c.cfg.vocabulary.groups[m[2]!.toLowerCase()] ?? []) push(`tribe:${t}`);
    }
  lowerTypes(p, mode, typed);
  for (const t of dropTypes) {
    const i = typed.indexOf(t);
    if (i >= 0 && typed.length > 1) typed.splice(i, 1);
  }
  // A supertype applies to the card type after it: "a legendary creature".
  let head: string | undefined;
  const sup = new RegExp(
    `\\b(?:legendary|snow|historic)(?: (?:${CARD_TYPE_WORDS}))?(?: or (?:${CARD_TYPE_WORDS}))? (${CARD_TYPE_WORDS})s?\\b`,
    'i',
  ).exec(p);
  if (sup) {
    head = sup[1]!.toLowerCase();
    const t = `type:${head}`;
    if (typed.includes(t) && t !== 'type:creature') typed.splice(typed.indexOf(t), 1);
  }
  // Qualifiers that name a resource.
  let m: RegExpExecArray | null;
  if (/\+1\/\+1 counters? on (?:it|them|~)/i.test(p)) push('counters:+1/+1');
  else if (/-1\/-1 counters? on (?:it|them|~)/i.test(p)) push('counters:-1/-1');
  else if (/\bexperience counters?\b/i.test(p)) push('experience');
  else if (
    (m =
      /(?:with (?:(?:a|an|one or more|\w+ or more) )?|\b)([a-z]+) counters? on (?:it|them|~)/i.exec(
        p,
      )) &&
    !/^(?:a|an|or|more|the|of|no)$/i.test(m[1]!)
  )
    push(`counters:${m[1]!.toLowerCase()}`);
  else if (
    /with (?:a|one or more|\w+ or more)? ?counters? on (?:it|them)|\bcounters? on ~/i.test(p)
  )
    push('counters:any');
  if (/\bpower (?:\d+|x) or greater\b/i.test(p)) push('power');
  if (/\bmodified\b/i.test(p)) {
    push('counters:any');
    push('subtype:Equipment');
    push('subtype:Aura');
  }
  if (/\bequipped (?:creatures?|permanents?)\b/i.test(p) && YOURS_RE.test(p))
    push('subtype:Equipment');
  if (/\benchanted (?:creatures?|permanents?)\b/i.test(p) && YOURS_RE.test(p)) push('subtype:Aura');
  if ((m = c.creatureKeywordRe.exec(p))) push(`keyword:${m[1]!.toLowerCase()}`);
  if (/\bcommanders?\b/i.test(p)) push('commander');
  // Colors of permanents and spells, and the qualifiers of spells cast.
  if ((m = COLOR_RE.exec(p)) && !m[1])
    for (const w of `${m[2]} ${m[3] ?? ''}`.match(/white|blue|black|red|green/gi) ?? [])
      push(`colored:${COLOR_WORDS[w.toLowerCase()]}`);
  if (/\bmulticolored\b/i.test(p) && !/\bnon-?multicolored\b/i.test(p)) push('colored:multi');
  let unread: string | undefined;
  if (/\bkicked\b/i.test(p)) {
    if (mode === 'cast') push('kicked');
    else unread = 'kicked';
  }
  if ((m = /\bmana value (\d+) or greater\b/i.exec(p)) && mode === 'cast') push(`mv:${m[1]}`);
  const token = /\btokens?\b/i.test(p) && !/\bnontoken\b/i.test(p);
  const extra = { ...(head ? { head } : {}), ...(unread ? { unread } : {}) };
  const anyAlt = ubiquitousAlternative(p, c);
  if (anyAlt && mode !== 'graveyard' && mode !== 'cast' && mode !== 'token')
    return { res: [], ...base, ...extra };
  const noun = /\b(creature|land|permanent|card|spell)s?\b/i.exec(p)?.[1]?.toLowerCase();
  let res: string[];
  switch (mode) {
    case 'graveyard': {
      res = typed.map((r) =>
        r.startsWith('type:')
          ? `graveyard:${r.slice(5)}`
          : r.startsWith('land:')
            ? 'graveyard:land'
            : `graveyard:${r}`,
      );
      // "A creature or Lesson card": the creature card is an alternative too.
      if (res.length === 0 || (anyAlt && /\bcreature\b/i.test(p)))
        res.push(
          noun === 'creature' || /\bcreature\b/i.test(p)
            ? 'graveyard:creature'
            : noun === 'land'
              ? 'graveyard:land'
              : 'graveyard:any',
        );
      break;
    }
    case 'cast':
      res = typed.map((r) =>
        r === 'type:instant-sorcery'
          ? 'spells'
          : r.startsWith('type:')
            ? `cast:${r.slice(5)}`
            : r.startsWith('colored:')
              ? r
              : `cast:${r}`,
      );
      break;
    case 'card':
      res = typed.filter((r) => r !== 'land:basic');
      if (/\bbasic land\b/i.test(p)) res = res.filter((r) => !r.startsWith('land:'));
      break;
    case 'token':
      res = [...typed];
      if (token || res.length) res.push('tokens');
      break;
    default:
      res = typed;
      if (/\bbasic lands?\b/i.test(p) && !/\bnonbasic\b/i.test(p)) res.push('land:basic');
      if (res.length === 0 && token) res.push('tokens');
      if (res.length === 0 && noun === 'creature' && (count ?? 1) >= 2) res.push('creatures');
  }
  return { res: [...new Set(res)], ...base, ...extra };
}

// ---------------------------------------------------------------- reading

interface Ctx {
  c: Compiled;
  card: CardRecord;
  names: RegExp[];
  hasBody: boolean;
  /** The card's color identity: mana outside it is a need. */
  identity: Set<string>;
  /** How many lines of text the card has ("gets +N/+N as long as" alone is a need). */
  lines: number;
}

/** The card's own names (full, faces, short "Lo and Li" before a comma) as "~", longest first. */
function selfNames(card: CardRecord): RegExp[] {
  const names = new Set<string>();
  for (const n of [card.name, ...(card.faces ?? []).map((f) => f.name)]) {
    for (const part of n.split(' // ')) {
      names.add(part);
      const short = part.split(', ')[0]!;
      if (short.length >= 3) names.add(short);
      const the = / the /.exec(part);
      if (the && the.index >= 3) names.add(part.slice(0, the.index));
    }
  }
  return [...names]
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map((n) => new RegExp(`(?<![\\w'])${escapeRe(n)}(?![\\w])`, 'g'));
}

function normalize(text: string, ctx: Ctx): string {
  let s = text.replace(/[’‘]/g, "'").replace(/−/g, '-').replace(/\s+/g, ' ').trim();
  for (const re of ctx.names) s = s.replace(re, '~');
  return s.replace(ctx.c.selfNoun, '~');
}

/** Split at sentence ends outside quotes; offsets are into `text`. */
function sentences(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let quote = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '“' || ch === '”') quote = !quote;
    if (
      ch === '.' &&
      !quote &&
      (i + 1 === text.length || text[i + 1] === ' ') &&
      !/(?:^|[\s.])(?:[A-WYZ]|Lt|Dr|Mr|Mrs|Ms|St|Jr|Sr|Capt|Cmdr|Gen|Sgt|Col|vs)$/.test(
        text.slice(start, i),
      )
    ) {
      const s = text.slice(start, i + 1);
      if (s.trim()) out.push({ text: s, start });
      start = i + 2;
    }
  }
  if (start < text.length && text.slice(start).trim()) out.push({ text: text.slice(start), start });
  return out;
}

/** Split at a separator outside quotes and braces. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let quote = false;
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') quote = !quote;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (!quote && depth === 0 && text.startsWith(sep, i)) {
      out.push(text.slice(last, i));
      last = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(text.slice(last));
  return out;
}

const BLANK = '¤';
const blank = (s: string) => BLANK.repeat(s.length);

interface Found {
  refs: NeedRef[];
  supplies: string[];
  optional: NeedRef[];
  unparsed: string[];
  /** Parts read as game state by the fallback (no resource word in them). */
  gameState: string[];
  /** Where in the sentence each supply and ref was read, so an earlier supply feeds a later need. */
  supplyAt: [number, string[]][];
  refAt: Map<NeedRef, number>;
}

function newFound(): Found {
  return {
    refs: [],
    supplies: [],
    optional: [],
    unparsed: [],
    gameState: [],
    supplyAt: [],
    refAt: new Map(),
  };
}

/** Whether words name no resource, so an unread part is game state. */
function gameState(text: string, c: Compiled): boolean {
  if (c.resourceWords.test(text)) return false;
  c.typeRe.lastIndex = 0;
  return !c.typeRe.test(text);
}

function addRef(
  f: Found,
  kind: RefKind,
  place: NeedPlace,
  anyOf: string[],
  text: string,
  extra: Partial<NeedRef> = {},
): NeedRef | undefined {
  const list = [...new Set(anyOf)];
  if (list.length === 0) return undefined;
  const ref: NeedRef = { kind, place, anyOf: list, self: false, text: text.trim(), ...extra };
  f.refs.push(ref);
  return ref;
}

function harmOf(main: string, c: Compiled): string | undefined {
  for (const re of c.harmful) {
    const m = re.exec(main);
    if (m) return m[0];
  }
  return undefined;
}

/** What a matched template names: its resources and how the card relates to them. */
interface TemplateRead {
  res: string[];
  other: boolean;
  count?: number;
  owner?: ObjReading['owner'];
  head?: string;
  notSelf?: boolean;
  unread?: string;
}

/** Player counters are not counters on permanents. */
const PLAYER_COUNTERS = /^(?:experience|poison|rad|energy|ticket)$/i;

function counterRes(kind: string | undefined): string {
  const k = (kind ?? '').toLowerCase();
  if (k === '' || k === 'a' || k === 'one' || k === 'an') return 'counters:any';
  if (k === 'experience') return 'experience';
  return `counters:${k}`;
}

/** The resources a matched template names. */
function templateRefs(
  t: NeedTemplate,
  m: RegExpMatchArray,
  c: Compiled,
  mode: ObjMode,
): TemplateRead {
  const g = m.groups ?? {};
  let res: string[] = [...(t.res ?? [])];
  let other = false;
  let count: number | undefined = numberOf(g.n, c);
  let owner: ObjReading['owner'] | undefined;
  let head: string | undefined;
  let unread: string | undefined;
  const objMode = t.obj ?? mode;
  if (t.counter && !t.counterSupplies) res.push(counterRes(g.counter));
  if (t.obj && g.obj !== undefined) {
    const o = resolveObj(g.obj, objMode, c);
    owner = o.owner;
    other = o.other;
    head = o.head;
    unread = o.unread;
    if (count === undefined) count = o.count;
    // "You control" or "your" may sit outside the object ("a creature you control dies").
    if (owner === 'any' && (YOURS_RE.test(m[0]) || /^\s*(?:whenever |when )?you\b/i.test(m[0])))
      owner = 'you';
    if (o.owner === 'opp') return { res: [], other, owner };
    let objRes = o.res;
    if (objRes.length === 0 && t.ubiquitous && owner === 'you') objRes = [...t.ubiquitous];
    res.push(...objRes);
  }
  if (g.color) {
    const cols = [g.color, g.color2]
      .filter((x): x is string => !!x)
      .map((x) => COLOR_WORDS[x.toLowerCase()] ?? 'C')
      .sort()
      .join('');
    res = res.map((r) => r.replace('{C}', cols));
  }
  const notSelf = t.notSelf || objMode === 'card' || objMode === 'cast';
  return {
    res,
    other,
    ...(count !== undefined ? { count } : {}),
    ...(owner ? { owner } : {}),
    ...(head ? { head } : {}),
    ...(notSelf ? { notSelf } : {}),
    ...(unread ? { unread } : {}),
  };
}

/** The ref fields a template read carries. */
function refExtra(r: TemplateRead): Partial<NeedRef> {
  return {
    ...(r.count !== undefined && r.count > 1 ? { count: r.count } : {}),
    ...(r.other ? { other: true } : {}),
    ...(r.head ? { head: r.head } : {}),
    ...(r.notSelf ? { notSelf: true } : {}),
  };
}

function supplyOfTemplate(t: NeedTemplate, m: RegExpMatchArray, c: Compiled): string[] {
  const out = [...(t.supplies ?? [])];
  const g = m.groups ?? {};
  if (t.supply && g.obj !== undefined) {
    const o = resolveObj(g.obj, t.obj ?? 'token', c);
    out.push(...o.res);
    if ((t.obj ?? 'token') === 'token') {
      if (o.res.some((r) => r.startsWith('subtype:') && isArtifactSubtype(r, c)))
        out.push(ARTIFACT_RES);
    }
  }
  if ((t.counter && (t.supply || t.supplies)) || t.counterSupplies) {
    const k = (g.counter ?? '').toLowerCase();
    if (PLAYER_COUNTERS.test(k)) {
      if (k === 'experience') out.push('experience');
    } else {
      out.push('counters:any');
      if (k && k !== 'a' && k !== 'one') out.push(`counters:${k}`);
    }
  }
  // Milling three or more feeds the card's own graveyard needs of any kind.
  const milled = /\bmills? (\w+) cards?\b/i.exec(m[0]);
  if (milled && (numberOf(milled[1], c) ?? 0) >= 3) out.push('graveyard:*');
  return out;
}
function isArtifactSubtype(r: string, c: Compiled): boolean {
  return c.cfg.vocabulary.artifactTypes.includes(r.slice('subtype:'.length));
}

const COST_VERB =
  /^(?:pay|sacrifice|discard|exile|tap|untap|remove|return|reveal|behold|put|mill|collect evidence|forage|\{)/i;

/** Split a cost part at " or " or " and " only where a new cost starts ("behold a Dragon or pay {1}"). */
function splitCostVerbs(part: string, sep: string): string[] {
  const pieces = splitTop(part, sep);
  const out: string[] = [pieces[0]!];
  for (const p of pieces.slice(1)) {
    if (COST_VERB.test(p)) out.push(p);
    else out[out.length - 1] += sep + p;
  }
  return out;
}

/** Read a cost: each part must match a cost template. */
function readCost(cost: string, f: Found, ctx: Ctx, place: NeedPlace, alternative: boolean): void {
  const c = ctx.c;
  for (const sym of cost.matchAll(/\{([^}]+)\}/g)) {
    // Snow mana comes from snow permanents.
    if (sym[1] === 'S') addRef(f, 'need', 'cost', ['type:snow'], sym[0], { notSelf: true });
    // Mana outside the card's color identity, which no deck it can join holds.
    const parts = sym[1]!.split('/');
    const colored = parts.filter((p) => /^[WUBRG]$/.test(p));
    if (colored.length && !colored.some((p) => ctx.identity.has(p)) && !parts.includes('2'))
      addRef(
        f,
        'need',
        'cost',
        colored.map((p) => `color:${p}`),
        sym[0],
      );
  }
  const parts = splitTop(cost, ', ').flatMap((p) => splitCostVerbs(p, ' and '));
  const alts = parts.flatMap((p) => splitCostVerbs(p.replace(/^(?:and|or) /i, ''), ' or '));
  // "A, B, or C" and "A or B" are choices.
  const isAlt = alternative || alts.length > parts.length || /, or /.test(cost);
  // "Behold a Dragon or pay {1}": the mana the other choice costs.
  let orPay = 0;
  for (const a of alts) {
    const pay = /^pay ((?:\{\d+\})+)\.?$/i.exec(a.trim());
    if (pay) for (const d of pay[1]!.matchAll(/\d+/g)) orPay += Number(d[0]);
  }
  for (const raw of alts) {
    const part = raw.trim().replace(/\.$/, '');
    if (!part) continue;
    let hit = false;
    for (const tpl of c.cost) {
      const m = tpl.re.exec(part);
      if (!m) continue;
      hit = true;
      if (tpl.t.ignore) break;
      f.supplies.push(...supplyOfTemplate(tpl.t, m, c));
      if (tpl.t.supply || (tpl.t.supplies && !tpl.t.res && !tpl.t.obj && !tpl.t.counter)) break;
      const r = templateRefs(tpl.t, m, c, 'yours');
      if (r.unread) f.unparsed.push(`unread qualifier ${r.unread}: ${shape(part, ctx)}`);
      // Paying while casting: the card is not yet where it could count itself.
      const extra = refExtra(r);
      if (place === 'additionalCost') extra.notSelf = true;
      if (isAlt && orPay && place === 'additionalCost') extra.orPay = orPay;
      addRef(f, isAlt ? 'bonus' : (tpl.t.kind ?? 'need'), place, r.res, part, extra);
      break;
    }
    if (!hit) {
      if (gameState(part, c)) f.gameState.push(`cost: ${shape(part, ctx)}`);
      else f.unparsed.push(`cost: ${shape(part, ctx)}`);
    }
  }
}

/** A catch-all template reads only words that name no resource; those are noted as game state. */
function catchAllHit(tpl: Template, text: string, f: Found, what: string, ctx: Ctx): boolean {
  if (!tpl.t.catchAll) return false;
  if (gameState(text, ctx.c)) f.gameState.push(`${what}: ${shape(text, ctx)}`);
  return true;
}

/** Read a trigger event; returns the effect text after it. */
function readTrigger(sentence: string, f: Found, ctx: Ctx): string {
  const lead = /^(When|Whenever|At)\s+/i.exec(sentence)!;
  const pos = lead[0].length;
  const c = ctx.c;
  const rest = sentence.slice(pos);
  let hit: { tpl: Template; m: RegExpExecArray } | undefined;
  for (const tpl of c.trigger) {
    const m = tpl.re.exec(rest);
    if (!m) continue;
    // A catch-all takes only an event that names no resource.
    if (tpl.t.catchAll && !gameState(m[0], c)) continue;
    hit = { tpl, m };
    break;
  }
  if (!hit) {
    const end = rest.indexOf(', ');
    const event = end >= 0 ? rest.slice(0, end) : rest;
    if (gameState(event, c)) f.gameState.push(`trigger: ${shape(event, ctx)}`);
    else f.unparsed.push(`trigger: ${shape(event, ctx)}`);
    return end >= 0 ? rest.slice(end + 2) : '';
  }
  const { tpl, m } = hit;
  if (catchAllHit(tpl, m[0], f, 'trigger', ctx)) {
    // Noted as game state.
  } else if (!tpl.t.ignore) {
    f.supplies.push(...(tpl.t.supplies ?? []));
    const r = templateRefs(tpl.t, m, c, 'yours');
    if (r.unread) f.unparsed.push(`unread qualifier ${r.unread}: ${shape(m[0], ctx)}`);
    addRef(f, tpl.t.kind ?? 'need', 'trigger', r.res, m[0], refExtra(r));
    // "Whenever you discard a Spirit card": the discard as well as the Spirit.
    const also = (tpl.t.also ?? []).filter((x) => !r.res.includes(x));
    if (also.length) addRef(f, tpl.t.kind ?? 'need', 'trigger', also, m[0]);
  }
  return sentence.slice(pos + m[0].length).replace(/^, /, '');
}

/** Read one condition body; returns the refs' resources or reports it unparsed. */
function readCondition(
  body: string,
  marker: string,
  main: string,
  sentence: string,
  f: Found,
  ctx: Ctx,
): void {
  const c = ctx.c;
  const text = body.trim();
  // "It's blocking and you control a snow land": each part is its own condition.
  const parts = text.split(/ and (?=you control |there (?:is|are) |you have )/i);
  if (parts.length > 1) {
    for (const p of parts) readCondition(p, marker, main, sentence, f, ctx);
    return;
  }
  for (const tpl of c.condition) {
    const m = tpl.re.exec(text);
    if (!m) continue;
    if (tpl.t.catchAll && !gameState(text, c)) continue;
    if (catchAllHit(tpl, text, f, `condition: ${marker}`, ctx)) return;
    if (tpl.t.ignore) return;
    const r = templateRefs(tpl.t, m, c, 'yours');
    if (r.owner === 'opp') return;
    if (r.unread) f.unparsed.push(`unread qualifier ${r.unread}: ${shape(text, ctx)}`);
    const harm = harmOf(main, c);
    let kind: RefKind;
    const instead = /\binstead\b/i.test(sentence) && !tpl.t.event;
    const costCheck = c.bonusSentence.test(sentence);
    if (tpl.t.kind) kind = tpl.t.kind;
    else if (instead || costCheck) kind = 'bonus';
    else if (marker === 'unless') kind = harm ? 'drawback' : 'need';
    else if (tpl.t.negated) {
      // "If you don't control a Food, create a Food" asks for nothing.
      if (!harm) return;
      kind = 'drawback';
    } else if (marker === 'as long as') {
      if (harm) kind = 'drawback';
      else if (c.statOnly.test(main.trim()) && ctx.hasBody && ctx.lines > 1) kind = 'bonus';
      else kind = 'need';
    } else if (/\b(?:also|additionally|as well)\b/i.test(main)) kind = 'bonus';
    else kind = 'need';
    const place: NeedPlace = instead ? 'replacement' : 'condition';
    const extra = (read: { count?: number; other: boolean; head?: string }): Partial<NeedRef> => ({
      ...refExtra({ res: [], ...read }),
      ...(kind === 'drawback' && harm ? { harm } : {}),
      // A cost reduction is checked while the card is cast: it cannot count itself.
      ...(costCheck || r.notSelf ? { notSelf: true } : {}),
    });
    // "You control an artifact and an enchantment" asks for both: one ref each.
    const obj = m.groups?.obj;
    const both = obj && tpl.t.obj ? splitBoth(obj) : [];
    if (both.length > 1) {
      for (const part of both) {
        const o = resolveObj(part, tpl.t.obj!, c);
        addRef(f, kind, place, o.res, `${marker} ${text}`, extra(o));
      }
      return;
    }
    addRef(f, kind, place, r.res, `${marker} ${text}`, extra(r));
    return;
  }
  if (gameState(text, c)) f.gameState.push(`condition: ${marker} ${shape(text, ctx)}`);
  else f.unparsed.push(`condition: ${marker} ${shape(text, ctx)}`);
}

/** Parts of an object joined by "and" where each has its own article ("an artifact and an enchantment"). */
function splitBoth(obj: string): string[] {
  return obj.split(/,? and (?=(?:an?|another|one|two|three|four|five|\w+ or more) )/i);
}

const MARKER = /(^|[\s,—])(if|unless|as long as|only if)\s+/gi;

/** An effect on every deck's creatures before " and ": what follows it is extra ("and a loyalty counter on each planeswalker"). */
const UNCONDITIONAL_BEFORE =
  /\b(?:each creature you control|creatures you control|target creature(?: you control)?|each creature|~)\b[^.]*\band\b[^.]*$/i;

/** Read one sentence of effect text. */
function readSentence(raw: string, ctx: Ctx, prev: Found | undefined, abilityLevel: Found): Found {
  const c = ctx.c;
  const f = newFound();
  let s = raw.replace(/^(?:then|and),? /i, '').trim();
  // Quoted abilities a card grants are read as abilities of their own, except a
  // tax it puts on every player and the abilities of a token it makes (which
  // only make the token better).
  s = s.replace(/"([^"]*)"/g, (all, inner: string, at: number) => {
    const before = s.slice(0, at);
    if (/\bcosts? an additional $/i.test(before)) return `"${blank(inner)}"`;
    const sub = readAbilityText(inner, ctx, 'static');
    const onToken = /\bcreates?\b[^."]*\btokens?\b[^."]*$/i.test(before);
    const quiet =
      /\b(?:your opponents|an opponent|each opponent|each player|target opponent) (?:control|controls)\b[^."]*$/i.test(
        before,
      );
    if (!quiet)
      for (const ref of sub.refs)
        f.refs.push(onToken && ref.kind === 'need' ? { ...ref, kind: 'bonus' } : ref);
    f.supplies.push(...sub.supplies);
    f.unparsed.push(...sub.unparsed);
    f.gameState.push(...sub.gameState);
    void all;
    return `"${blank(inner)}"`;
  });
  // "If you do" depends on the optional action before it; "If you don't" on its absence.
  const link = /^(?:if|when) you (do|don't|can't|didn't|did)(?=,|\.|\s*$),? ?/i.exec(s);
  if (link && prev) {
    const negative = link[1]!.toLowerCase() !== 'do' && link[1]!.toLowerCase() !== 'did';
    const harm = harmOf(s.slice(link[0].length), c);
    for (const o of prev.optional) {
      if (!negative) f.refs.push({ ...o, kind: 'need' });
      else if (harm) f.refs.push({ ...o, kind: 'drawback', harm });
    }
  }
  if (link) s = blank(link[0]) + s.slice(link[0].length);
  if (/^otherwise\b/i.test(s)) s = s.replace(/^otherwise,?/i, (w) => blank(w));
  // "Activate only if ..." and kin govern the whole ability.
  const target =
    /^(?:activate|cast|this ability triggers|this spell can be cast|you may activate|~ can be cast)\b[^.]*?\bonly\b/i.test(
      s,
    )
      ? abilityLevel
      : f;
  // Conditions.
  let work = s;
  let conditions = link ? 1 : 0;
  const condRefs: NeedRef[] = [];
  for (const m of [...s.matchAll(MARKER)]) {
    const marker = m[2]!.toLowerCase();
    const at = m.index! + m[1]!.length;
    const bodyStart = m.index! + m[0].length;
    const rest = s.slice(bodyStart);
    // A comma ends the condition unless a list goes on ("an artifact, or an enchantment").
    let end = rest.search(
      /,(?! (?:or|and|and\/or) (?:an?|another|two|three|four|five|\w+ or more)\b)|\.|;|—| instead\b/,
    );
    if (end < 0) end = rest.length;
    const body = rest.slice(0, end);
    if (work.slice(at, bodyStart + end).includes(BLANK)) continue;
    const main = s.slice(0, at) + s.slice(bodyStart + end);
    const sub = newFound();
    readCondition(body, marker, main, s, sub, ctx);
    condRefs.push(...sub.refs);
    f.unparsed.push(...sub.unparsed);
    f.gameState.push(...sub.gameState);
    work = work.slice(0, at) + blank(work.slice(at, bodyStart + end)) + work.slice(bodyStart + end);
    conditions++;
  }
  // Parallel conditions on land types, each with its own effect ("from white if you
  // control a Plains, from blue if you control an Island"): any one does something.
  const lands = condRefs.filter((r) => r.anyOf.every((x) => x.startsWith('land:')));
  if (
    lands.length > 1 &&
    lands.length === condRefs.length &&
    new Set(lands.map((r) => r.kind)).size === 1
  )
    target.refs.push({ ...lands[0]!, anyOf: [...new Set(lands.flatMap((r) => r.anyOf))] });
  else target.refs.push(...condRefs);
  // "Instead" belongs to the condition that chose it.
  if (conditions > 0) work = work.replace(/\binstead\b/gi, (w) => blank(w));
  // Effect templates, in order; each match is blanked so later ones see the rest.
  const bonus = c.bonusSentence.test(s);
  const firstEffectRef = f.refs.length;
  for (const tpl of c.effect) {
    tpl.re.lastIndex = 0;
    const hits = [...work.matchAll(tpl.re)];
    for (const m of hits) {
      if (!m[0]) continue;
      // A match must start on text no earlier template read; a tail may run over read text.
      if (work[m.index!] === BLANK) continue;
      if (tpl.t.typed && templateRefs(tpl.t, m, c, tpl.t.obj ?? 'yours').res.length === 0) continue;
      work = work.slice(0, m.index!) + blank(m[0]) + work.slice(m.index! + m[0].length);
      if (tpl.t.ignore) continue;
      const made = supplyOfTemplate(tpl.t, m, c);
      f.supplies.push(...made);
      if (made.length) f.supplyAt.push([m.index!, made]);
      if (tpl.t.supply || (tpl.t.supplies && !tpl.t.res && !tpl.t.obj && !tpl.t.counter)) continue;
      const r = templateRefs(tpl.t, m, c, tpl.t.obj ?? 'yours');
      if (r.unread) f.unparsed.push(`unread qualifier ${r.unread}: ${shape(m[0], ctx)}`);
      const place = tpl.t.place ?? 'selection';
      let kind: RefKind = tpl.t.kind ?? 'need';
      if (bonus) kind = 'bonus';
      else if (place === 'count' && countHasBase(s, ctx)) kind = 'bonus';
      else if (kind === 'need' && UNCONDITIONAL_BEFORE.test(s.slice(0, m.index!))) kind = 'bonus';
      const last = f.refs.length > firstEffectRef ? f.refs[f.refs.length - 1] : undefined;
      if (tpl.t.join && last) {
        last.anyOf = [...new Set([...last.anyOf, ...r.res])];
        continue;
      }
      const ref = addRef(f, kind, place, r.res, m[0], refExtra(r));
      if (ref) f.refAt.set(ref, m.index!);
      if (ref && tpl.t.optional) {
        f.refs.pop();
        f.optional.push(ref);
      }
    }
  }
  // A resource word nothing above read leaves the sentence unparsed.
  for (const { id, re } of c.mentions) {
    re.lastIndex = 0;
    const m = re.exec(work);
    if (m) {
      f.unparsed.push(`unread ${id}: ${shape(sentenceAround(work, m.index), ctx)}`);
      break;
    }
  }
  c.typeRe.lastIndex = 0;
  for (const m of work.matchAll(c.typeRe)) {
    if (m[1]) continue;
    f.unparsed.push(`unread type: ${shape(sentenceAround(work, m.index!), ctx)}`);
    break;
  }
  return f;
}

function sentenceAround(work: string, _at: number): string {
  return work.replace(new RegExp(`${BLANK}+`, 'g'), '…');
}

/**
 * A count scales an effect above a base: "an additional" amount, the card's
 * own body ("~ gets +1/+1 for each", "enters with a +1/+1 counter for each"),
 * or another effect beside it ("for each Gate you control and have vigilance").
 */
function countHasBase(s: string, ctx: Ctx): boolean {
  if (/\b(?:additional|plus)\b[^.]*\b(?:for each|number of)\b/i.test(s)) return true;
  if (/\band (?:have|has|gains?|get|gets) \w+/i.test(s) && /\bfor each\b/i.test(s)) return true;
  if (!ctx.hasBody) return false;
  if (/^(?:~|it) gets [+-][\dX]+\/[+-][\dX]+[^.]*\b(?:for each|where x is|equal to)\b/i.test(s))
    return true;
  if (/(?:^|\s)~ enters with\b[^.]*\bcounters? on it\b[^.]*\b(?:for each|equal to)\b/i.test(s))
    return true;
  if (
    /\bput (?:a number of|x|that many) [^.]*\bcounters? on (?:it|~)\b[^.]*\b(?:for each|equal to)\b/i.test(
      s,
    )
  )
    return true;
  return false;
}

/** A shape for the work list: names, numbers, types, and mana symbols normalized. */
function shape(text: string, ctx: Ctx): string {
  ctx.c.typeRe.lastIndex = 0;
  return text
    .replace(/\{[^}]+\}/g, '{M}')
    .replace(ctx.c.typeRe, (_w, neg: string | undefined) => `${neg ?? ''}TYPE`)
    .replace(/\b\d+\b/g, 'N')
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (w) =>
      w[0] === w[0]!.toUpperCase() ? 'N' : 'N',
    )
    .replace(/[+-]N\/[+-]N/g, '+N/+N')
    .replace(/\s+/g, ' ')
    .trim();
}

interface AbilityRead {
  shape: AbilityShape;
  /** Refs that govern every clause: trigger, cost, intervening if, "activate only if". */
  level: Found;
  /** One per sentence. */
  sentences: { text: string; start: number; found: Found }[];
  refs: NeedRef[];
  supplies: string[];
  unparsed: string[];
  gameState: string[];
}

function isCostPrefix(prefix: string): boolean {
  // A trigger or a nested quote ("... and '{R}: ...'") is not a cost.
  if (prefix.includes('"') || prefix.includes("'{") || /^(?:When|Whenever|At)\b/i.test(prefix))
    return false;
  if (/\{/.test(prefix)) return true;
  if (/^[+-]?(?:\d+|X)$/.test(prefix)) return true;
  return /^(?:sacrifice|discard|exile|pay|tap|untap|remove|return|put|collect evidence|forage|reveal|mill|behold|exert|blight)\b/i.test(
    prefix,
  );
}

/** Read an ability's text (normalized): its shape, then each sentence. */
function readAbilityText(text: string, ctx: Ctx, fallback: AbilityShape): AbilityRead {
  const level = newFound();
  let shapeOf: AbilityShape = fallback;
  let body = text;
  const add = /^As an additional cost to cast (?:~|this spell|it), (.+?)\.?$/i.exec(body);
  if (add) {
    readCost(
      add[1]!.replace(/^you may /i, ''),
      level,
      ctx,
      'additionalCost',
      /^you may /i.test(add[1]!),
    );
    return {
      shape: 'additionalCost',
      level,
      sentences: [],
      refs: level.refs,
      supplies: level.supplies,
      unparsed: level.unparsed,
      gameState: level.gameState,
    };
  }
  const act = /^([^":]+?): (.+)$/.exec(body);
  if (act && isCostPrefix(act[1]!)) {
    shapeOf = 'activated';
    readCost(act[1]!, level, ctx, 'cost', false);
    body = act[2]!;
  } else if (/^(?:When|Whenever|At)\b/i.test(body) && fallback !== 'chapter') {
    shapeOf = 'triggered';
    const first = sentences(body)[0]?.text ?? body;
    const effect = readTrigger(first.replace(/\.$/, ''), level, ctx);
    let after = effect;
    // An intervening "if" governs the whole effect.
    const iff = /^if ([^,]+), (.+)$/i.exec(after);
    if (iff) {
      const sub = newFound();
      readCondition(iff[1]!, 'if', iff[2]!, after, sub, ctx);
      level.refs.push(...sub.refs);
      level.unparsed.push(...sub.unparsed);
      level.gameState.push(...sub.gameState);
      after = iff[2]!;
    }
    body = after + (first.endsWith('.') ? '.' : '') + body.slice(first.length);
  }
  const out: AbilityRead = {
    shape: shapeOf,
    level,
    sentences: [],
    refs: [],
    supplies: [...level.supplies],
    unparsed: [...level.unparsed],
    gameState: [...level.gameState],
  };
  let prev: Found | undefined;
  for (const s of sentences(body)) {
    const found = readSentence(s.text, ctx, prev, level);
    out.sentences.push({ text: s.text, start: s.start, found });
    out.supplies.push(...found.supplies);
    out.unparsed.push(...found.unparsed);
    out.gameState.push(...found.gameState);
    prev = found;
  }
  // A trigger whose effect only harms its owner ("whenever you lose life,
  // discard that many cards") rewards nothing: the event is no need.
  if (
    shapeOf === 'triggered' &&
    out.sentences.length > 0 &&
    out.sentences.every((x) => x.found.refs.length === 0 && purelyHarmful(x.text, ctx.c))
  )
    level.refs.splice(0, level.refs.length, ...level.refs.filter((r) => r.place !== 'trigger'));
  out.refs = [...level.refs, ...out.sentences.flatMap((x) => x.found.refs)];
  return out;
}

/** An effect that only harms its owner: a harmful clause and nothing a player wants. */
function purelyHarmful(text: string, c: Compiled): boolean {
  void c;
  // Harm to its owner, with nothing aimed at an opponent or a target and nothing gained.
  if (
    !/\b(?:you lose \w+ life|discard (?:a|that many|\w+) cards?|sacrifice (?:a|an|~|it|that many|\w+) ?\w*|you lose the game|deals? \w+ damage to you)\b/i.test(
      text,
    )
  )
    return false;
  return !/\b(?:draws?|create|creates|gains?|return|search|target|each opponent|an opponent|each player|deals? (?:\w+ )?damage to (?:any|target|each opponent|each creature)|put (?:a|an|\w+) \+1\/\+1)\b/i.test(
    text,
  );
}

const KEYWORD_PART =
  /^(?: ?\d+| ?X| ?N| ?(?:\{[^}]+\})+(?: plus .*|, .*)?| from .*| for .*| onto .*| with .*| (?:an?|another|target) .*| [a-z]+ (?:creature|permanent|land|artifact|planeswalker)s?(?: or (?:creature|permanent|land|artifact|planeswalker)s?)?(?: you control)?| creature.*| land.*| player| permanent.*| artifact.*| enchantment.*| planeswalker.*| [A-Z][\w'-]*(?: [A-Z][\w'-]*)*(?: \{.*)?| \d+—.*| \d+ \{.*)$/;

/** Keyword parts of a line: a keyword with "—" takes the rest of the line as its cost. */
function keywordParts(line: string): string[] {
  const out: string[] = [];
  for (const piece of splitTop(line.replace(/\.$/, ''), '; ')) {
    const dash = piece.indexOf('—');
    const head = dash >= 0 ? piece.slice(0, dash) : piece;
    const parts = splitTop(head, ', ');
    if (dash >= 0) parts[parts.length - 1] += piece.slice(dash);
    out.push(...parts);
  }
  return out.map((p) => p.trim());
}

/** Whether a line is a list of keyword abilities ("Flying, trample", "Ward—Discard a card."). */
function keywordLine(line: string, card: CardRecord, c: Compiled): boolean {
  const kws = card.keywords.map((k) => k.toLowerCase()).filter((k) => !c.keywordActions.has(k));
  if (kws.length === 0) return false;
  return keywordParts(line).every((part) => {
    const lower = part.toLowerCase();
    const kw = kws
      .filter((k) => lower === k || lower.startsWith(`${k} `) || lower.startsWith(`${k}—`))
      .sort((a, b) => b.length - a.length)[0];
    if (!kw) return /^[A-Z][\w'-]* offering$/.test(part);
    // A trailing cost ("Equip legendary creature {3}") does not change the keyword's shape.
    const rest = part.slice(kw.length).replace(/ ?(?:\{[^}]+\})+(?: plus .*|, .*)?$/, '');
    return rest === '' || rest.startsWith('—') || KEYWORD_PART.test(rest);
  });
}

const ROMAN = /^((?:I|II|III|IV|V|VI|VII)(?:, (?:I|II|III|IV|V|VI|VII))*) — (.+)$/;

/** A card's text as lines, with faces, in `ruleText` coordinates. */
function lines(card: CardRecord): { text: string; start: number; face: number }[] {
  const text = ruleText(card);
  const out: { text: string; start: number; face: number }[] = [];
  let face = 0;
  let at = 0;
  for (const line of text.split('\n')) {
    const lead = line.length - line.trimStart().length;
    const t = line.trim();
    if (t === '//') face++;
    else if (t) out.push({ text: t, start: at + lead, face });
    at += line.length + 1;
  }
  return out;
}

function keywordRefs(line: string, f: Found, ctx: Ctx): void {
  const c = ctx.c;
  for (const part of keywordParts(line)) {
    const lower = part.toLowerCase();
    const name = c.keywordNames.find((k) => {
      const kl = k.toLowerCase();
      return lower === kl || lower.startsWith(`${kl} `) || lower.startsWith(`${kl}—`);
    });
    if (!name) continue;
    const k = c.cfg.keywords[name]!;
    let res = [...(k.res ?? [])];
    if (k.obj) {
      const o = resolveObj(part.slice(name.length), k.obj, c);
      res = [...res, ...o.res];
    }
    addRef(f, k.kind, k.place, res, part);
  }
}

/** What the card's keywords make by their reminder text ("Adapt 2": +1/+1 counters; "Amass Zombies 2": a Zombie Army). */
function keywordSupply(text: string, card: CardRecord, c: Compiled): string[] {
  const out: string[] = [];
  const have = new Set(card.keywords.map((k) => k.toLowerCase()));
  for (const [kw, list] of Object.entries(c.cfg.keywordSupplies)) {
    if (!have.has(kw.toLowerCase())) continue;
    if (!new RegExp(`\\b${escapeRe(kw)}\\b`, 'i').test(text)) continue;
    out.push(...list);
  }
  const amass = /\bamass ([A-Z][\w'-]*) /.exec(text);
  const army = amass && c.typeRes.get(amass[1]!);
  if (army) out.push(army);
  return out;
}

const TRIGGERED_MODAL =
  /\bchoose (?:one|two|three|one or more|one or both|any number|up to \w+)(?: or both| or more)?(?: that hasn't been chosen(?: this turn)?)? —$/i;

function readCard(card: CardRecord, config: BulkBrewConfig): CardNeeds {
  const c = compiledFor(config);
  const all = lines(card);
  const ctx: Ctx = {
    c,
    card,
    names: selfNames(card),
    hasBody: card.power !== undefined || card.types.includes('planeswalker'),
    identity: new Set(card.identity),
    lines: all.length,
  };
  const abilities: CardAbility[] = [];
  /** What the earlier sentences of a ref's own ability make. */
  const earlier = new Map<NeedRef, Set<string>>();
  let level: number | undefined;
  let header: number | undefined;
  let headerRefs: NeedRef[] = [];
  for (const l of all) {
    let text = l.text;
    let shapeOf: AbilityShape | undefined;
    let parent: number | undefined;
    // Leveler and station headers and their stat lines are not abilities.
    if (/^(?:LEVEL|STATION) \d+(?:-\d+|\+)?$/.test(text)) {
      level = Number(/\d+/.exec(text)![0]);
      continue;
    }
    if (/^\d+\/\d+$/.test(text)) continue;
    const ch = ROMAN.exec(text);
    const lv = /^((?:\{[^}]+\})+): Level (\d+)$/.exec(text);
    if (ch) {
      shapeOf = 'chapter';
      text = ch[2]!;
    } else if (lv) {
      level = Number(lv[2]);
    } else if (/^• /.test(text)) {
      shapeOf = 'mode';
      text = text.slice(2);
      parent = header;
    } else if (/^\+ (?:\{[^}]+\})+ — /.test(text) || /^(?:\{P\})+ — /.test(text)) {
      // Spree and Season modes.
      shapeOf = 'mode';
      text = text.replace(/^(?:\+ )?(?:\{[^}]+\})+ — /, '');
      parent = header;
    } else header = undefined;
    // Ability words ("Infusion — ") name nothing; a braced prefix is a keyword line.
    const aw = /^([A-Z][^—{}:•]*?) — (.+)$/.exec(text);
    let keyword = false;
    if (aw && !shapeOf) {
      if (/^To solve$/i.test(aw[1]!)) text = `If ${aw[2]!.replace(/\.$/, '')}, ~ is solved.`;
      else text = aw[2]!;
    } else if (/^[A-Z][\w' -]* (?:\{[^}]+\})+ — /.test(text)) keyword = true;
    const n = normalize(text, ctx);
    const f = newFound();
    let read: AbilityRead | undefined;
    let isHeader = false;
    if (!shapeOf && !lv && (keyword || keywordLine(n, card, c))) {
      shapeOf = 'keyword';
      keywordRefs(n, f, ctx);
      // Keyword actions and lifelink on a keyword line still supply ("Investigate.").
      for (const tpl of c.effect)
        if (tpl.t.supply || tpl.t.supplies) {
          tpl.re.lastIndex = 0;
          for (const m of n.matchAll(tpl.re)) f.supplies.push(...supplyOfTemplate(tpl.t, m, c));
        }
    } else {
      const fallback: AbilityShape =
        shapeOf ??
        (lv
          ? 'level'
          : card.types.some((t) => t === 'instant' || t === 'sorcery')
            ? 'spell'
            : 'static');
      const modal =
        /^Choose (?:one|two|three|one or more|any number|up to \w+)\b[^.—]*(?:—|\.)\s*/i.exec(n);
      if (modal) {
        isHeader = true;
        shapeOf = 'modal';
        read = readAbilityText(n.slice(modal[0].length).trim() || '.', ctx, 'modal');
      } else {
        read = readAbilityText(n, ctx, fallback);
        // "Whenever you cast a spell, choose one —": the bullets share the trigger.
        isHeader = !shapeOf && TRIGGERED_MODAL.test(n);
      }
      shapeOf = shapeOf ?? read.shape;
    }
    // A bullet carries its header's trigger, cost, and conditions.
    const inherited = shapeOf === 'mode' && parent !== undefined ? headerRefs : [];
    const refs = [...inherited, ...(read ? read.refs : f.refs)];
    const levelRefs = [...inherited, ...(read?.level.refs ?? [])];
    // Clause offsets come from the printed line, sentence for sentence, so theme rules map onto them.
    const printed = sentences(l.text);
    const same = read !== undefined && printed.length === read.sentences.length;
    const clauses: NeedClause[] = read
      ? read.sentences.map((s, i) => {
          const crefs = [...levelRefs, ...s.found.refs];
          const p = same ? printed[i]! : { text: l.text, start: 0 };
          return {
            start: l.start + p.start,
            end: l.start + p.start + p.text.length,
            text: p.text,
            refs: crefs,
            kind: kindOf(crefs),
          };
        })
      : [];
    // "Return target multicolored card ... If that card was all colors, draw": the
    // later sentence acts on the earlier one's object, so it shares its needs.
    if (read && same)
      for (let i = 1; i < clauses.length; i++) {
        if (
          !/^If (?:that card|that creature|that permanent|it|they|those cards)\b/i.test(
            read.sentences[i]!.text,
          )
        )
          continue;
        const prev = clauses[i - 1]!.refs.filter(
          (r) => r.kind === 'need' && r.place === 'selection',
        );
        if (!prev.length) continue;
        const cl = clauses[i]!;
        cl.refs = [...new Set([...cl.refs, ...prev])];
        cl.kind = kindOf(cl.refs);
      }
    if (read && clauses.length === 0)
      clauses.push({
        start: l.start,
        end: l.start + l.text.length,
        text: l.text,
        refs: levelRefs,
        kind: kindOf(levelRefs),
      });
    if (!read)
      clauses.push({
        start: l.start,
        end: l.start + l.text.length,
        text: l.text,
        refs,
        kind: kindOf(refs),
      });
    // An earlier sentence feeds a later one ("You gain 2 life. ... X is the life you gained this turn").
    if (read) {
      const before = new Set<string>();
      for (const s of read.sentences) {
        for (const ref of s.found.refs) {
          const at = s.found.refAt.get(ref);
          const set = new Set(before);
          if (at !== undefined)
            for (const [where, made] of s.found.supplyAt)
              if (where < at) for (const x of made) set.add(x);
          earlier.set(ref, set);
        }
        for (const x of s.found.supplies) before.add(x);
      }
    }
    const unparsed = read ? read.unparsed : f.unparsed;
    const state = read ? read.gameState : f.gameState;
    const supplies = [
      ...new Set([...(read ? read.supplies : f.supplies), ...keywordSupply(n, card, c)]),
    ];
    const ab: CardAbility = {
      face: l.face,
      text: l.text,
      starts: l.text.split(/\s+/).slice(0, 6).join(' '),
      shape: shapeOf,
      start: l.start,
      end: l.start + l.text.length,
      refs,
      clauses,
      kind: kindOf(refs),
      supplies,
      ...(level !== undefined && (lv || card.layout === 'class' || card.layout === 'leveler')
        ? { level }
        : {}),
      ...(parent !== undefined ? { parent } : {}),
      ...(unparsed.length ? { unparsed: unparsed[0]! } : {}),
      ...(state.length ? { gameState: state } : {}),
    };
    // A clause in an unparsed ability needs what its words name, apart from what
    // the ability makes itself; when its words name nothing, only the report knows.
    if (ab.unparsed) {
      const named = namedResources(n, c).filter((r) => !supplies.includes(r));
      if (named.length) {
        const ref: NeedRef = {
          kind: 'need',
          place: 'unparsed',
          anyOf: named,
          self: false,
          text: ab.unparsed,
        };
        ab.refs = [...ab.refs, ref];
        for (const cl of ab.clauses) {
          cl.refs = [...cl.refs, ref];
          cl.kind = 'need';
        }
        ab.kind = 'need';
      }
    }
    if (isHeader) {
      header = abilities.length;
      headerRefs = read?.level.refs ?? [];
    }
    abilities.push(ab);
  }
  backReferences(abilities);
  // Self-supply: the card's types, what its other abilities make, and what an
  // earlier sentence of the same ability makes (a sentence that needs what it
  // makes itself would be circular). An ability supplies only once its own
  // needs are met, so the pass repeats until nothing changes.
  const typeSupplies = new Set(typesSupply(card, c));
  const supplies = new Set<string>(typeSupplies);
  for (const a of abilities) for (const s of a.supplies) supplies.add(s);
  const selfSupplies = new Set<string>();
  const pips = pipsOf(card);
  // What another ability makes counts once that ability's own needs are met:
  // a supplier with an open need supplies "via" that need (`selfVia`), which
  // needMet checks in the deck.
  const openNeeds = (a: CardAbility) => a.refs.filter((r) => r.kind === 'need' && !r.self);
  for (let pass = 0; pass < 2; pass++) {
    for (const a of abilities) {
      const textSupply = new Map<string, NeedRef[]>();
      for (const b of abilities) {
        if (b === a) continue;
        const via = openNeeds(b);
        for (const s of b.supplies) {
          const had = textSupply.get(s);
          if (!had || via.length < had.length) textSupply.set(s, via);
        }
      }
      for (const ref of a.refs) {
        if (ref.place === 'unparsed' || (ref.self && !ref.selfVia)) continue;
        // Being the object counts when the card can be it: not for "another", a
        // spell it reduces, a card it searches for, or a type it is not ("a legendary creature").
        const byType =
          !ref.other && !ref.notSelf && (!ref.head || card.types.includes(ref.head as CardType));
        const asType = (r: string) =>
          byType &&
          !r.startsWith('cast:') &&
          !r.startsWith('graveyard:') &&
          (typeSupplies.has(r) || (r.startsWith('tribe:') && typeSupplies.has('tribe:*')));
        // Milling three or more feeds a graveyard need of a card type.
        const milled = (r: string) =>
          /^graveyard:(?:any|creature|land|instant-sorcery|artifact|enchantment)$/.test(r);
        const sameAbility = (r: string) =>
          !!earlier.get(ref)?.has(r) || (milled(r) && !!earlier.get(ref)?.has('graveyard:*'));
        const fromOther = (r: string) =>
          textSupply.get(r) ?? (milled(r) ? textSupply.get('graveyard:*') : undefined);
        // "Five or more Vampires" is not met by the card's own one or its token maker alone.
        const one = (ref.count ?? 1) <= 1;
        let hit = ref.anyOf.find((r) => (sameAbility(r) || asType(r)) && one);
        let via: NeedRef[] = [];
        if (!hit && one) {
          let best: [string, NeedRef[]] | undefined;
          for (const r of ref.anyOf) {
            const v = fromOther(r);
            if (v && (!best || v.length < best[1].length)) best = [r, v];
          }
          if (best) [hit, via] = best;
        }
        if (hit) {
          ref.self = true;
          if (via.length) ref.selfVia = via.filter((v) => v !== ref);
          else delete ref.selfVia;
          selfSupplies.add(hit);
          continue;
        }
        // The card is one of the N it counts: it supplies part of the need.
        const part = ref.anyOf.find(
          (r) =>
            (asType(r) && r !== 'creatures') ||
            sameAbility(r) ||
            fromOther(r) !== undefined ||
            (r.startsWith('devotion:') &&
              byType &&
              [...r.slice(9)].some((col) => (pips.get(col) ?? 0) > 0)),
        );
        if (part) selfSupplies.add(part);
      }
    }
  }
  return {
    abilities,
    supplies: [...supplies].sort(),
    selfSupplies: [...selfSupplies].sort(),
    kind: abilities.reduce<NeedKind>(
      (k, a) => (SEVERITY[a.kind] > SEVERITY[k] ? a.kind : k),
      'unconditional',
    ),
  };
}

/**
 * Lines that refer back to another: "When this land enters untapped" needs
 * what lets the land enter untapped.
 */
function backReferences(abilities: CardAbility[]): void {
  const tapped = abilities.find((a) =>
    a.refs.some(
      (r) => r.kind === 'drawback' && /enters? (?:the battlefield )?tapped/i.test(r.harm ?? ''),
    ),
  );
  if (!tapped) return;
  const cond = tapped.refs.filter((r) => r.kind === 'drawback');
  for (const a of abilities) {
    if (a === tapped || !/\benters? untapped\b/i.test(a.text)) continue;
    const refs: NeedRef[] = cond.map(({ harm: _harm, ...r }) => ({
      ...r,
      kind: 'need',
      place: 'condition',
    }));
    a.refs = [...a.refs, ...refs];
    for (const cl of a.clauses) {
      cl.refs = [...cl.refs, ...refs];
      cl.kind = kindOf(cl.refs);
    }
    a.kind = kindOf(a.refs);
  }
}

function kindOf(refs: readonly NeedRef[]): NeedKind {
  let k: NeedKind = 'unconditional';
  for (const r of refs) if (SEVERITY[r.kind] > SEVERITY[k]) k = r.kind;
  return k;
}

/** Resources an unparsed ability's words name, for the safe default. */
function namedResources(text: string, c: Compiled): string[] {
  const out = new Set<string>();
  c.typeRe.lastIndex = 0;
  for (const m of text.matchAll(c.typeRe)) if (!m[1]) out.add(c.typeRes.get(m[2]!)!);
  const lower: [RegExp, string][] = [
    [/\bgain(?:s|ed)? (?:\w+ )?life\b/i, 'lifegain'],
    [/\blos(?:e|es|t) (?:\w+ )?life\b/i, 'lifeloss'],
    [/\+1\/\+1 counter/i, 'counters:+1/+1'],
    [/\bcounters? on\b/i, 'counters:any'],
    [/\bgraveyard\b/i, 'graveyard:any'],
    [/\btokens?\b/i, 'tokens'],
    [/\bartifacts?\b/i, ARTIFACT_RES],
    [/\benchantments?\b/i, 'type:enchantment'],
    [/\binstant or sorcery\b/i, 'spells'],
    [/\bsacrific/i, 'sacrifice'],
    [/\bdiscard/i, 'discard'],
    [/\{E\}/, 'energy'],
    [/\bcommander\b/i, 'commander'],
  ];
  for (const [re, r] of lower) if (re.test(text)) out.add(r);
  return [...out];
}

/** What a card supplies by being what it is: types, supertypes, subtypes, body. */
function typesSupply(card: CardRecord, c: Compiled): string[] {
  const out = new Set<string>();
  for (const t of card.types) {
    if (t === 'instant' || t === 'sorcery') out.add('type:instant-sorcery');
    else if (t !== 'kindred') out.add(`type:${t}`);
  }
  if (!card.types.includes('creature') && !card.types.includes('land')) out.add('type:noncreature');
  const front = card.typeLine.split('//')[0] ?? '';
  const supers: string[] = [];
  if (/\bLegendary\b/.test(front)) supers.push('legendary');
  if (/\bSnow\b/.test(front)) supers.push('snow');
  if (/\bLegendary\b/.test(front) || card.types.includes('artifact') || /\bSaga\b/.test(front))
    supers.push('historic');
  for (const s of supers) {
    out.add(`type:${s}`);
    // "A legendary creature" counts the cards that are both.
    for (const t of card.types) if (t !== 'kindred') out.add(`type:${s}&${t}`);
  }
  for (const t of creatureTypes(card)) out.add(`tribe:${t}`);
  if (card.keywords.includes('Changeling')) out.add('tribe:*');
  for (const line of [card.typeLine, ...(card.faces ?? []).map((f) => f.typeLine)]) {
    const sub = line.split('//')[0]!.split('—')[1];
    if (!sub) continue;
    for (const w of sub.trim().split(/\s+/)) {
      const r = c.typeRes.get(w);
      if (r && !r.startsWith('tribe:')) out.add(r);
    }
  }
  // A Saga puts lore counters on itself.
  if (/\bSaga\b/.test(front)) {
    out.add('counters:lore');
    out.add('counters:any');
  }
  if (isCreature(card) && Number.parseInt(card.power ?? '', 10) >= 4) out.add('power');
  if (card.colors.length > 1) out.add('colored:multi');
  if (!card.types.includes('land')) for (const col of card.colors) out.add(`colored:${col}`);
  if (card.keywords.some((k) => /^(?:multi)?kicker$/i.test(k))) out.add('kicked');
  if (!card.types.includes('land')) out.add(`mv:${Math.min(Math.floor(card.mv), 16)}`);
  if (isCreature(card)) {
    out.add('creatures');
    for (const k of card.keywords) {
      const kw = k.toLowerCase();
      if (c.cfg.vocabulary.creatureKeywords.some((x) => x.toLowerCase() === kw))
        out.add(`keyword:${kw}`);
    }
  }
  return [...out];
}

const needsCache = new WeakMap<CardRecord, WeakMap<CardNeedsConfig, CardNeeds>>();

/** What each ability of a card needs, cached per card record and card-needs config. */
export function cardNeeds(card: CardRecord, config: BulkBrewConfig): CardNeeds {
  let byConfig = needsCache.get(card);
  if (!byConfig) needsCache.set(card, (byConfig = new WeakMap()));
  let out = byConfig.get(config.cardNeeds);
  if (!out) {
    out = readCard(card, config);
    byConfig.set(config.cardNeeds, out);
  }
  return out;
}

// ---------------------------------------------------------------- credits

/** One way a card earns a credit: a clause and the refs it needs. */
export interface CreditClause {
  /** Index in `cardNeeds(card).abilities`; -1 for the card's body. */
  ability: number;
  kind: NeedKind;
  /** Needs that must all be met for this clause to earn the credit. */
  needs: NeedRef[];
  /** Theme credits: the job's weight. */
  weight?: number;
}

export interface CreditReading {
  credit: string;
  /**
   * The least severe kind among the clauses that earn it; untied when no clause
   * matched; absent when the config does not give the card this credit at all.
   */
  kind: NeedKind | 'untied' | 'absent';
  /** Alternatives: the credit is earned when one clause's needs are all met. */
  clauses: CreditClause[];
  /** Drawbacks and required additional costs that harm what earns it. */
  gates: NeedRef[];
  /** Every resource the credit depends on. */
  resources: string[];
}

/** Credit ids: a role id, `theme:<style>:<setup|payoff>`, or `strength:<effect label>`. */
export function themeCredit(style: string, side: 'setup' | 'payoff'): string {
  return `theme:${style}:${side}`;
}

export function strengthCredit(label: string): string {
  return `strength:${label}`;
}

function bodyClause(card: CardRecord, p: CreditPattern): boolean {
  if (p.body) return true;
  if (p.bodyKeywords) return card.keywords.some((k) => p.bodyKeywords!.includes(k));
  return false;
}

/**
 * The refs a clause's credit waits on: its needs, and a condition or
 * replacement in the clause itself that is only a bonus to the ability (the
 * draw that happens only "instead" is earned only when the condition holds).
 */
function creditNeedRefs(cl: NeedClause, sentenceRefs: ReadonlySet<NeedRef>): NeedRef[] {
  return cl.refs.filter(
    (r) =>
      r.kind === 'need' ||
      (r.kind === 'bonus' &&
        (r.place === 'condition' || r.place === 'replacement') &&
        sentenceRefs.has(r)),
  );
}

/** Refs that belong to a clause's own sentence, not its ability's trigger or cost. */
function ownRefs(needs: CardNeeds): Map<NeedClause, Set<NeedRef>> {
  const out = new Map<NeedClause, Set<NeedRef>>();
  for (const a of needs.abilities) {
    const shared =
      a.clauses.length > 1
        ? a.refs.filter((r) => a.clauses.every((cl) => cl.refs.includes(r)))
        : [];
    for (const cl of a.clauses) out.set(cl, new Set(cl.refs.filter((r) => !shared.includes(r))));
  }
  return out;
}

function clausesMatching(needs: CardNeeds, re: RegExp): CreditClause[] {
  const out: CreditClause[] = [];
  const own = ownRefs(needs);
  needs.abilities.forEach((a, i) => {
    for (const cl of a.clauses) {
      if (!re.test(cl.text)) continue;
      const refs = creditNeedRefs(cl, own.get(cl)!);
      out.push({
        ability: i,
        kind: refs.length && cl.kind !== 'need' ? 'need' : cl.kind,
        needs: refs,
      });
    }
  });
  return out;
}

function needRefs(refs: readonly NeedRef[]): NeedRef[] {
  return refs.filter((r) => r.kind === 'need');
}

function bodyCredit(): CreditClause {
  return { ability: -1, kind: 'unconditional', needs: [] };
}

function patternClauses(
  card: CardRecord,
  needs: CardNeeds,
  p: CompiledPattern | undefined,
  c: Compiled,
): CreditClause[] | 'always' {
  if (!p) return [];
  if (p.always) return 'always';
  if (p.role) return patternClauses(card, needs, c.roleClauses.get(p.role), c);
  const out: CreditClause[] = [];
  if (bodyClause(card, p)) out.push(bodyCredit());
  if (p.re) out.push(...clausesMatching(needs, p.re));
  // A weaker clause (surveil for card advantage) only when no strong one is there.
  if (p.weak && !out.some((cl) => cl.ability >= 0)) out.push(...clausesMatching(needs, p.weak));
  return out;
}

/** Clauses a theme rule's text names, from where its expression matches the card's text. */
function themeClauses(
  card: CardRecord,
  needs: CardNeeds,
  rule: CompiledRule,
  c: Compiled,
): CreditClause[] {
  const out: CreditClause[] = [];
  const weight = rule.rule.weight;
  const own = ownRefs(needs);
  if (rule.text) {
    const text = ruleText(card);
    const re = new RegExp(rule.text.source, 'gim');
    for (const m of text.matchAll(re)) {
      const from = m.index!;
      const to = from + Math.max(1, m[0].length);
      needs.abilities.forEach((a, i) => {
        for (const cl of a.clauses)
          if (cl.start < to && cl.end > from) {
            const refs = creditNeedRefs(cl, own.get(cl)!);
            out.push({
              ability: i,
              kind: refs.length && cl.kind !== 'need' ? 'need' : cl.kind,
              needs: refs,
              weight,
            });
          }
      });
    }
    if (out.length) return dedupe(out);
  }
  const tags = [...(rule.rule.anyTags ?? []), ...(rule.rule.allTags ?? [])];
  for (const t of tags) {
    const re = c.themeTags.get(t);
    if (re) for (const cl of clausesMatching(needs, re)) out.push({ ...cl, weight });
  }
  if (out.length) return dedupe(out);
  // Rules on types, keywords, and stats alone credit the card for what it is.
  if (
    !rule.text &&
    (rule.rule.types || rule.rule.keywords || rule.rule.typeLine) &&
    tags.length === 0
  )
    return [{ ...bodyCredit(), weight }];
  return [];
}

function dedupe(list: CreditClause[]): CreditClause[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.ability}:${c.kind}:${c.needs.map((n) => n.anyOf.join('|')).join(',')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const creditCache = new WeakMap<CardRecord, WeakMap<BulkBrewConfig, Map<string, CreditReading>>>();

/**
 * The clause a credit is tied to, its kind, and what it depends on. A credit
 * id is a role id (roles.json), `theme:<style>:<setup|payoff>` (theme rules,
 * read at `size` when given, else at 60), or `strength:<label>`
 * (card-strength.json effects). A credit the config does not give the card
 * reads as absent.
 */
export function creditNeeds(
  card: CardRecord,
  credit: string,
  config: BulkBrewConfig,
  size?: DeckSize,
): CreditReading {
  let byConfig = creditCache.get(card);
  if (!byConfig) creditCache.set(card, (byConfig = new WeakMap()));
  let byCredit = byConfig.get(config);
  if (!byCredit) byConfig.set(config, (byCredit = new Map()));
  const key = `${credit}@${size ?? ''}`;
  let out = byCredit.get(key);
  if (!out) {
    out = readCredit(card, credit, config, size);
    byCredit.set(key, out);
  }
  return out;
}

/** Whether the config gives the card a credit at all. */
function creditGiven(
  card: CardRecord,
  credit: string,
  config: BulkBrewConfig,
  size: DeckSize | undefined,
): boolean {
  const theme = /^theme:([^:]+):(setup|payoff)$/.exec(credit);
  if (theme) {
    const style = themeRulesFor(config).styles.get(theme[1]!);
    const m = style && matchCard(card, style, (size ?? 60) as ThemeSize);
    return !!m && m.as !== 'excluded' && m.as === theme[2] && m.weight > 0;
  }
  if (credit.startsWith('strength:')) {
    const e = config.cardStrength.effects.find((x) => x.label === credit.slice(9));
    return !!e && cardMatches(card, e.match);
  }
  const role = config.roles.roles.find((r) => r.id === credit);
  return !!role && cardMatches(card, role.match);
}

/** A drawback that only takes the body away ("isn't a creature", "can't block"). */
const BODY_HARM =
  /isn't a creature|can't (?:attack|block)|(?:doesn't|don't) untap|loses? (?:flying|all abilities|defender)/i;

function readCredit(
  card: CardRecord,
  credit: string,
  config: BulkBrewConfig,
  size: DeckSize | undefined,
): CreditReading {
  if (!creditGiven(card, credit, config, size))
    return { credit, kind: 'absent', clauses: [], gates: [], resources: [] };
  const c = compiledFor(config);
  const needs = cardNeeds(card, config);
  let clauses: CreditClause[] | 'always';
  const theme = /^theme:([^:]+):(setup|payoff)$/.exec(credit);
  if (theme) {
    const style = themeRulesFor(config).styles.get(theme[1]!);
    const rules = style ? (theme[2] === 'setup' ? style.setup : style.payoff) : [];
    const list: CreditClause[] = [];
    for (const r of rules) {
      if (r.rule.weight <= 0) continue;
      if (!ruleMatches(card, r, ruleText(card), (size ?? 60) as ThemeSize)) continue;
      list.push(...themeClauses(card, needs, r, c));
    }
    clauses = dedupe(list);
  } else if (credit.startsWith('strength:')) {
    clauses = patternClauses(card, needs, c.strengthClauses.get(credit.slice(9)), c);
  } else {
    clauses = patternClauses(card, needs, c.roleClauses.get(credit), c);
  }
  if (clauses === 'always')
    return { credit, kind: 'unconditional', clauses: [bodyCredit()], gates: [], resources: [] };
  const faces = new Set(
    clauses.map((cl) => (cl.ability < 0 ? 0 : (needs.abilities[cl.ability]?.face ?? 0))),
  );
  const abilitiesUsed = new Set(clauses.map((cl) => cl.ability));
  const body = abilitiesUsed.has(-1);
  // A drawback gates the credits it harms: a lost body only the body's credits.
  const gates = needs.abilities.flatMap((a, i) =>
    faces.has(a.face) || faces.size === 0
      ? a.refs.filter(
          (r) =>
            (r.kind === 'drawback' &&
              (!BODY_HARM.test(r.harm ?? '') || body || abilitiesUsed.has(i))) ||
            (a.shape === 'additionalCost' && r.kind === 'need'),
        )
      : [],
  );
  let kind: NeedKind | 'untied';
  if (clauses.length === 0) {
    // Untied: the credit depends on every need the card has, the safe reading;
    // modes and chapters are alternatives, each with what the rest needs.
    kind = 'untied';
    const branch = (a: CardAbility) => a.shape === 'mode' || a.shape === 'chapter';
    const shared = needs.abilities.filter((a) => !branch(a)).flatMap((a) => needRefs(a.refs));
    const branches = needs.abilities.filter(branch);
    const all = [...shared, ...branches.flatMap((a) => needRefs(a.refs))];
    const severity: NeedKind = all.length
      ? 'need'
      : needs.kind === 'bonus'
        ? 'bonus'
        : 'unconditional';
    clauses = branches.length
      ? branches.map((a) => {
          const own = [...shared, ...needRefs(a.refs)];
          return {
            ability: needs.abilities.indexOf(a),
            kind: own.length ? 'need' : 'unconditional',
            needs: own,
          };
        })
      : [{ ability: -1, kind: severity, needs: all }];
  } else
    kind = clauses.reduce<NeedKind>(
      (k, cl) => (SEVERITY[cl.kind] < SEVERITY[k] ? cl.kind : k),
      'need',
    );
  const resources = [
    ...new Set([...clauses.flatMap((cl) => cl.needs), ...gates].flatMap((r) => r.anyOf)),
  ].sort();
  return { credit, kind, clauses, gates, resources };
}

/** Role ids, theme credits, and strength credits a card has under the config, for reports. */
export function cardCredits(
  card: CardRecord,
  config: BulkBrewConfig,
  size: DeckSize = 60,
): string[] {
  const out: string[] = [];
  for (const r of config.roles.roles) if (cardMatches(card, r.match)) out.push(r.id);
  for (const style of themeRulesFor(config).styles.values()) {
    const m = matchCard(card, style, size as ThemeSize);
    if (m && m.as !== 'excluded' && m.weight > 0) out.push(themeCredit(style.id, m.as));
  }
  for (const e of config.cardStrength.effects)
    if (cardMatches(card, e.match)) out.push(strengthCredit(e.label));
  return out;
}

// ---------------------------------------------------------------- supply

/** A deck as the supply count sees it. */
export interface SupplyDeck {
  /** Spells and nonbasic lands with copies; the commander may be among them. */
  cards: readonly { card: CardRecord; qty: number }[];
  commander?: CardRecord;
  colors: readonly Color[];
  size: DeckSize;
}

/** What a deck supplies, per resource, in copies. Mutable so a builder can add and remove cards. */
export interface DeckSupply {
  size: DeckSize;
  colors: Color[];
  commander: boolean;
  counts: Map<string, number>;
  /** Devotion: colored pips among permanents, per color. */
  devotion: Map<string, number>;
}

const supplyCache = new WeakMap<CardRecord, WeakMap<BulkBrewConfig, Map<number, string[]>>>();

/** Resources one copy of a card supplies to a deck of a size, as the supply rules count them. */
export function cardSupply(card: CardRecord, config: BulkBrewConfig, size: DeckSize): string[] {
  let byConfig = supplyCache.get(card);
  if (!byConfig) supplyCache.set(card, (byConfig = new WeakMap()));
  let bySize = byConfig.get(config);
  if (!bySize) byConfig.set(config, (bySize = new Map()));
  let out = bySize.get(size);
  if (!out) {
    out = computeSupply(card, config, size);
    bySize.set(size, out);
  }
  return out;
}

function computeSupply(card: CardRecord, config: BulkBrewConfig, size: DeckSize): string[] {
  const rules = config.cardNeeds.supply;
  const needs = cardNeeds(card, config);
  const set = new Set(needs.supplies);
  const styles = themeRulesFor(config).styles;
  // Each style once, though several resources point at it.
  const setupOf = new Map<string, boolean>();
  for (const [r, rule] of Object.entries(rules)) {
    if (!rule.theme) continue;
    if (!rule.text) set.delete(r);
    let setup = setupOf.get(rule.theme);
    if (setup === undefined) {
      const style = styles.get(rule.theme);
      const m = style && matchCard(card, style, size as ThemeSize);
      setup = !!m && m.as !== 'excluded' && ((m.as === 'setup' && m.weight > 0) || m.dual);
      setupOf.set(rule.theme, setup);
    }
    if (setup) set.add(r);
  }
  return [...set].sort();
}

function pipsOf(card: CardRecord): Map<string, number> {
  const out = new Map<string, number>();
  if (
    !['creature', 'artifact', 'enchantment', 'planeswalker', 'battle'].some((t) =>
      card.types.includes(t as never),
    )
  )
    return out;
  for (const sym of (card.manaCost ?? '').matchAll(/\{([^}]+)\}/g))
    for (const ch of new Set(sym[1]!.split('/')))
      if (/^[WUBRG]$/.test(ch)) out.set(ch, (out.get(ch) ?? 0) + 1);
  return out;
}

/** Add copies of a card to a supply (negative copies remove them). */
export function addSupply(
  supply: DeckSupply,
  card: CardRecord,
  qty: number,
  config: BulkBrewConfig,
): void {
  for (const r of cardSupply(card, config, supply.size))
    supply.counts.set(r, (supply.counts.get(r) ?? 0) + qty);
  for (const [col, n] of pipsOf(card))
    supply.devotion.set(col, (supply.devotion.get(col) ?? 0) + n * qty);
}

/** What a deck supplies for each resource: its cards, copies, commander, colors, and size. */
export function deckSupply(deck: SupplyDeck, config: BulkBrewConfig): DeckSupply {
  const supply: DeckSupply = {
    size: deck.size,
    colors: [...deck.colors],
    commander: !!deck.commander,
    counts: new Map(),
    devotion: new Map(),
  };
  let commanderIn = false;
  for (const { card, qty } of deck.cards) {
    if (qty <= 0) continue;
    if (deck.commander && card.id === deck.commander.id) commanderIn = true;
    addSupply(supply, card, qty, config);
  }
  if (deck.commander && !commanderIn) addSupply(supply, deck.commander, 1, config);
  return supply;
}

function sizeKey(size: number): '20' | '40' | '60' | '100' {
  return size === 100 ? '100' : size === 20 ? '20' : size === 40 ? '40' : '60';
}

function familyOf(r: string): string {
  const i = r.indexOf(':');
  return i < 0 ? r : r.slice(0, i);
}

/** Copies a deck needs to supply a resource, for a ref asking for `count` of it. */
export function needThreshold(
  resource: string,
  size: DeckSize,
  config: BulkBrewConfig,
  count = 1,
): number {
  const t = config.cardNeeds.thresholds;
  const k = sizeKey(size);
  const family = familyOf(resource);
  const table = t.families[resource] ?? t.families[family] ?? t.base;
  const per = t.perCountFamilies?.[resource] ?? t.perCountFamilies?.[family] ?? t.perCount;
  return table[k] + Math.max(0, count - 1) * per[k];
}

const TYPE_WORDS = new Set([
  'artifact',
  'enchantment',
  'creature',
  'land',
  'planeswalker',
  'battle',
  'noncreature',
  'instant-sorcery',
  'legendary',
  'historic',
  'snow',
]);

/** The resource a spell cast is counted by: cast:artifact by the deck's artifacts. */
function castOf(resource: string): string {
  if (resource === 'spells') return 'type:instant-sorcery';
  if (!resource.startsWith('cast:')) return resource;
  const inner = resource.slice(5);
  if (inner.includes(':')) return inner;
  return TYPE_WORDS.has(inner) ? `type:${inner}` : inner;
}

/** Copies of a resource in the deck, by the supply rules. */
export function supplyCount(supply: DeckSupply, resource: string): number {
  const r = castOf(resource);
  if (r.startsWith('tribe:'))
    return (supply.counts.get(r) ?? 0) + (supply.counts.get('tribe:*') ?? 0);
  if (r.startsWith('mv:')) {
    let n = 0;
    for (let v = Number(r.slice(3)); v <= 16; v++) n += supply.counts.get(`mv:${v}`) ?? 0;
    return n;
  }
  return supply.counts.get(r) ?? 0;
}

const BASIC_COLOR: Record<string, Color> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

const SUPERTYPE_RES = /^type:(?:legendary|snow|historic)$/;

function resourceMet(
  resource: string,
  supply: DeckSupply,
  card: CardRecord | undefined,
  config: BulkBrewConfig,
  ref: { count: number; other: boolean; head?: string | undefined },
  scale: number,
): boolean {
  // "A legendary creature" is counted by the cards that are both.
  const r = ref.head && SUPERTYPE_RES.test(resource) ? `${resource}&${ref.head}` : castOf(resource);
  const count = ref.count;
  // The card is one of the N it counts, except for "another".
  const own = ref.other && card && cardSupply(card, config, supply.size).includes(r) ? 1 : 0;
  const enough = (res: string, n = count) =>
    supplyCount(supply, res) - (res === r ? own : 0) >=
    scale * needThreshold(res, supply.size, config, n);
  if (r.startsWith('color:')) return supply.colors.includes(r.slice(6) as Color);
  if (r === 'land:basic') return supply.colors.length > 0;
  if (r.startsWith('land:') && BASIC_COLOR[r.slice(5)])
    return supply.colors.includes(BASIC_COLOR[r.slice(5)]!) || enough(r);
  if (r === 'commander' || r === 'format:multiplayer')
    return supply.size === 100 && (r !== 'commander' || supply.commander);
  if (r === 'type:land') return true;
  if (r === 'domain') return supply.colors.length > 1;
  if (r.startsWith('devotion:')) {
    const t = config.cardNeeds.thresholds;
    const need = (t.families.devotion ?? t.base)[sizeKey(supply.size)] * scale;
    let have = 0;
    for (const col of r.slice(9)) have += supply.devotion.get(col) ?? 0;
    return have >= Math.max(need, count);
  }
  if (r.startsWith('graveyard:')) {
    const inner = r.slice(10);
    const rule = config.cardNeeds.supply[r];
    if (inner === 'any' || inner === 'land') {
      if (rule?.freeCount !== undefined && count <= rule.freeCount) return true;
      return enough(r, Math.max(1, count - (rule?.freeCount ?? 0)));
    }
    // Cards reach the graveyard by being played: the deck's own cards of the kind.
    const of =
      inner === 'creature'
        ? 'type:creature'
        : inner.includes(':')
          ? castOf(`cast:${inner}`)
          : `type:${inner}`;
    return enough(of, 1) || enough(r);
  }
  if (r === 'creatures') return enough('type:creature', count);
  return enough(r);
}

/**
 * Whether one ref is met in this deck: the card supplies it itself, or the
 * deck's cards supply one of its resources to the threshold. Pass the card the
 * ref belongs to: it counts toward "you control N" but not toward "another".
 */
export function needMet(
  ref: NeedRef,
  supply: DeckSupply,
  card: CardRecord | undefined,
  config: BulkBrewConfig,
  depth = 0,
): boolean {
  if (ref.self) {
    if (!ref.selfVia) return true;
    // Self-supplied through an ability with needs of its own.
    if (depth < 3 && ref.selfVia.every((v) => needMet(v, supply, card, config, depth + 1)))
      return true;
  }
  const scale = ref.place === 'unparsed' ? config.cardNeeds.thresholds.unparsedScale : 1;
  const how = { count: ref.count ?? 1, other: !!ref.other, head: ref.head };
  return ref.anyOf.some((r) => resourceMet(r, supply, card, config, how, scale));
}

/**
 * A card's mana value in this deck: an additional cost it can pay with a
 * resource or with mana ("behold a Dragon or pay {1}") costs the mana when the
 * deck does not supply the resource.
 */
export function effectiveManaValue(
  card: CardRecord,
  supply: DeckSupply,
  config: BulkBrewConfig,
): number {
  let mv = card.mv;
  for (const a of cardNeeds(card, config).abilities) {
    if (a.shape !== 'additionalCost') continue;
    const extra = Math.max(
      0,
      ...a.refs.map((r) => (r.orPay && !needMet(r, supply, card, config) ? r.orPay : 0)),
    );
    mv += extra;
  }
  return mv;
}

/**
 * Whether a card earns a credit in this deck: the config gives it, every gate
 * (a drawback over what earns it, a required additional cost) is met, and some
 * clause that earns the credit has all its needs met. A role with a mana value
 * limit ("Early creature": two or less) reads the card at its mana value in
 * this deck.
 */
export function creditEarned(
  card: CardRecord,
  credit: string,
  supply: DeckSupply,
  config: BulkBrewConfig,
): boolean {
  const reading = creditNeeds(card, credit, config, supply.size);
  if (reading.kind === 'absent') return false;
  const role = config.roles.roles.find((r) => r.id === credit);
  if (role && role.match.some((cl) => cl.maxMv !== undefined || cl.minMv !== undefined)) {
    const mv = effectiveManaValue(card, supply, config);
    if (mv !== card.mv && !cardMatches({ ...card, mv }, role.match)) return false;
  }
  if (!reading.gates.every((g) => needMet(g, supply, card, config))) return false;
  return reading.clauses.some((cl) => cl.needs.every((n) => needMet(n, supply, card, config)));
}
