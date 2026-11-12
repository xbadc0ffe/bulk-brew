// Collate the blind panel's answers for one batch (docs/algo-review.md,
// Phase 3): check each answer against the rubric's shape, join it with the
// answer key, and tabulate decent rates, failures, anchors, judge agreement,
// and head-to-head pairs. Usage: docs/review/judging.md.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { arg, ROOT } from '../corpus.ts';
import {
  ANCHOR_VERSIONS,
  argAll,
  builtAnotherStyle,
  findAllDeckFiles,
  inventoryOf,
  JUDGMENTS_DIR,
  KEYS_DIR,
  readDecks,
  styleOf,
  type BatchKey,
  type DeckRef,
  type InventoryRow,
  type PairMatch,
  type SingleKey,
} from './packets.ts';

export const RESULTS_DIR = path.join(ROOT, 'data', 'review', 'results');

export const FAILURES = [
  'no-plan',
  'no-setup',
  'thin-setup',
  'no-payoff',
  'thin-payoff',
  'bad-curve',
  'bad-mana',
  'no-interaction',
  'no-win',
  'dead-cards',
  'none',
] as const;
export type Failure = (typeof FAILURES)[number];

export interface PlanCard {
  card: string;
  job: string;
  strength: 'strong' | 'weak';
}

export interface SingleAnswer {
  plan: string;
  setup: PlanCard[];
  payoff: PlanCard[];
  enough_setup: boolean;
  enough_payoff: boolean;
  curve: 'good' | 'ok' | 'poor';
  mana: 'good' | 'ok' | 'poor';
  interaction: 'good' | 'ok' | 'poor' | 'none';
  win: 'clear' | 'thin' | 'none';
  dead: string[];
  decent: boolean;
  score: 1 | 2 | 3 | 4 | 5;
  reason: string;
  /** A decent deck of the requested style; null when the packet showed none. Absent in batches made before. */
  decent_of_style?: boolean | null;
  /** One sentence; empty when decent_of_style is null. */
  style_reason?: string;
  failures: Failure[];
}

export interface PairAnswer {
  better: 'A' | 'B' | 'tie';
  reason: string;
}

/** Errors make an answer unusable; warnings break a consistency rule but the answer still counts. */
export interface Check {
  errors: string[];
  warnings: string[];
}

const SINGLE_KEYS = [
  'plan',
  'setup',
  'payoff',
  'enough_setup',
  'enough_payoff',
  'curve',
  'mana',
  'interaction',
  'win',
  'dead',
  'decent',
  'score',
  'reason',
  'failures',
];
/** The one-deck shape once packets show the requested style. */
const STYLE_KEYS = ['decent_of_style', 'style_reason'];
const PAIR_KEYS = ['better', 'reason'];
const DEAD_LIMIT: Record<number, number> = { 60: 4, 40: 3, 20: 2, 100: 7 };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function exactKeys(a: Record<string, unknown>, keys: readonly string[], errors: string[]): void {
  for (const k of keys) if (!(k in a)) errors.push(`missing "${k}"`);
  for (const k of Object.keys(a)) if (!keys.includes(k)) errors.push(`extra key "${k}"`);
}

function oneOf(
  a: Record<string, unknown>,
  k: string,
  values: readonly unknown[],
  errors: string[],
): void {
  if (k in a && !values.includes(a[k]))
    errors.push(`"${k}" must be one of ${values.map((v) => JSON.stringify(v)).join(', ')}`);
}

function text(a: Record<string, unknown>, k: string, errors: string[]): void {
  if (k in a && (typeof a[k] !== 'string' || !(a[k] as string).trim()))
    errors.push(`"${k}" must be a non-empty string`);
}

/** Card name match the way a judge may write it: the full name or one face's name, any case. */
function nameKey(copies: Record<string, number>): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of Object.keys(copies)) {
    out.set(name.toLowerCase(), name);
    for (const face of name.split(' // ')) out.set(face.toLowerCase(), name);
  }
  return out;
}

/**
 * Check a one-deck answer against the rubric's shape and consistency rules.
 * Pass the deck's copies to check card names and count dead copies, and the
 * style the packet showed (null for none) to require the style fields; keys
 * made before packets showed a style pass undefined and get the old shape.
 */
export function checkSingle(
  raw: unknown,
  copies?: Record<string, number>,
  size?: number,
  styleShown?: string | null,
): Check {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(raw)) return { errors: ['not a JSON object'], warnings };
  const a = raw;
  const styled = styleShown !== undefined;
  exactKeys(a, styled ? [...SINGLE_KEYS, ...STYLE_KEYS] : SINGLE_KEYS, errors);
  text(a, 'plan', errors);
  text(a, 'reason', errors);
  if (styled && 'decent_of_style' in a) {
    if (styleShown === null && a.decent_of_style !== null)
      errors.push('"decent_of_style" must be null: the packet showed no requested style');
    if (styleShown !== null && typeof a.decent_of_style !== 'boolean')
      errors.push('"decent_of_style" must be true or false: the packet showed a requested style');
  }
  if (styled && 'style_reason' in a && typeof a.style_reason !== 'string')
    errors.push('"style_reason" must be a string');
  for (const k of ['setup', 'payoff']) {
    if (!(k in a)) continue;
    const list = a[k];
    if (!Array.isArray(list)) {
      errors.push(`"${k}" must be an array`);
      continue;
    }
    list.forEach((item, i) => {
      if (!isObject(item)) {
        errors.push(`"${k}"[${i}] must be an object`);
        return;
      }
      const e: string[] = [];
      exactKeys(item, ['card', 'job', 'strength'], e);
      text(item, 'card', e);
      if ('job' in item && typeof item.job !== 'string') e.push('"job" must be a string');
      oneOf(item, 'strength', ['strong', 'weak'], e);
      for (const x of e) errors.push(`"${k}"[${i}]: ${x}`);
    });
  }
  for (const k of ['enough_setup', 'enough_payoff', 'decent'])
    if (k in a && typeof a[k] !== 'boolean') errors.push(`"${k}" must be true or false`);
  oneOf(a, 'curve', ['good', 'ok', 'poor'], errors);
  oneOf(a, 'mana', ['good', 'ok', 'poor'], errors);
  oneOf(a, 'interaction', ['good', 'ok', 'poor', 'none'], errors);
  oneOf(a, 'win', ['clear', 'thin', 'none'], errors);
  if ('dead' in a && (!Array.isArray(a.dead) || a.dead.some((d) => typeof d !== 'string')))
    errors.push('"dead" must be an array of card names');
  oneOf(a, 'score', [1, 2, 3, 4, 5], errors);
  if (typeof a.score === 'number' && typeof a.decent === 'boolean' && a.decent !== a.score >= 3)
    errors.push(`"decent" is ${a.decent} but the score is ${a.score}; decent means 3 or more`);
  let failures: string[] = [];
  if ('failures' in a) {
    if (!Array.isArray(a.failures) || !a.failures.length) {
      errors.push('"failures" must be a non-empty array ("none" when nothing applies)');
    } else {
      failures = a.failures as string[];
      for (const f of failures)
        if (!(FAILURES as readonly unknown[]).includes(f))
          errors.push(`unknown failure ${JSON.stringify(f)}`);
      if (new Set(failures).size !== failures.length) errors.push('"failures" repeats a value');
      if (failures.includes('none') && failures.length > 1)
        errors.push('"none" must stand alone in "failures"');
    }
  }
  if (errors.length) return { errors, warnings };

  // Consistency rules from the rubric's answer shape; broken ones are listed, the answer still counts.
  const has = (f: Failure) => failures.includes(f);
  const noPlan = has('no-plan');
  const planText = (a.plan as string).trim().toLowerCase().replace(/\.$/, '');
  if (noPlan !== (planText === 'no clear plan'))
    warnings.push('"no-plan" and the plan "no clear plan" should go together');
  if (noPlan && (a.enough_setup || a.enough_payoff))
    warnings.push('"no-plan" goes with both "enough_" fields false');
  if (!noPlan && a.enough_setup === false && !has('no-setup') && !has('thin-setup'))
    warnings.push('"enough_setup" false without "no-setup" or "thin-setup"');
  if (!noPlan && a.enough_payoff === false && !has('no-payoff') && !has('thin-payoff'))
    warnings.push('"enough_payoff" false without "no-payoff" or "thin-payoff"');
  if (a.interaction === 'none' && !has('no-interaction'))
    warnings.push('"interaction" none without "no-interaction"');
  if (a.win === 'none' && !has('no-win')) warnings.push('"win" none without "no-win"');
  const missesPlan = ['no-plan', 'no-setup', 'thin-setup', 'no-payoff', 'thin-payoff'].some((f) =>
    has(f as Failure),
  );
  if (missesPlan && (a.score as number) > 2)
    warnings.push(`score ${a.score} with a plan or setup or payoff failure (should be 2 or less)`);
  if (styled) {
    // A decent deck of the style is a decent deck first.
    if (a.decent_of_style === true && a.decent === false)
      warnings.push('"decent_of_style" true for a deck that is not decent');
    const said = (a.style_reason as string).trim();
    if (styleShown !== null && !said)
      warnings.push('"style_reason" is empty though the packet showed a requested style');
    if (styleShown === null && said)
      warnings.push('"style_reason" should be empty when the packet showed no requested style');
  }
  const named = [
    ...(a.setup as PlanCard[]).map((c) => c.card),
    ...(a.payoff as PlanCard[]).map((c) => c.card),
    ...(a.dead as string[]),
  ];
  const seen = new Set<string>();
  for (const n of named) {
    const k = n.toLowerCase();
    if (seen.has(k)) warnings.push(`"${n}" is named more than once across setup, payoff, and dead`);
    seen.add(k);
  }
  if (copies) {
    const names = nameKey(copies);
    for (const n of named)
      if (!names.has(n.toLowerCase())) warnings.push(`"${n}" is not a card in the deck`);
    const dead = deadCopies(a.dead as string[], copies);
    const limit = size !== undefined ? DEAD_LIMIT[size] : undefined;
    if (limit !== undefined && dead >= limit && !has('dead-cards'))
      warnings.push(`${dead} dead copies without "dead-cards" (the bar is ${limit})`);
  }
  return { errors, warnings };
}

export function checkPair(raw: unknown): Check {
  const errors: string[] = [];
  if (!isObject(raw)) return { errors: ['not a JSON object'], warnings: [] };
  exactKeys(raw, PAIR_KEYS, errors);
  oneOf(raw, 'better', ['A', 'B', 'tie'], errors);
  text(raw, 'reason', errors);
  return { errors, warnings: [] };
}

/** Copies of the named dead cards, read from the deck list the packet showed. */
export function deadCopies(dead: readonly string[], copies: Record<string, number>): number {
  const names = nameKey(copies);
  const counted = new Set<string>();
  let n = 0;
  for (const d of dead) {
    const name = names.get(d.toLowerCase());
    if (!name || counted.has(name)) continue;
    counted.add(name);
    n += copies[name] ?? 0;
  }
  return n;
}

/** Parse an answer file. A fenced code block around the JSON is tolerated with a warning. */
export function parseAnswer(source: string): { value?: unknown; error?: string; warning?: string } {
  let s = source.trim();
  let warning: string | undefined;
  const fence = /^```[a-z]*\s*\n([\s\S]*?)\n```$/i.exec(s);
  if (fence) {
    s = fence[1]!.trim();
    warning = 'answer was wrapped in a code fence';
  }
  try {
    return { value: JSON.parse(s) as unknown, ...(warning ? { warning } : {}) };
  } catch (err) {
    return { error: `not valid JSON: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------- collation

export interface Stat {
  judged: number;
  decent: number;
  /** Over judged built decks. */
  decentRate: number | null;
  /** Over all requests, counting a declined request as not decent: decentRate times builtShare. */
  decentRateAll: number | null;
  /** built / (built + declined), from the deck files. */
  builtShare: number | null;
  /** Judged built decks whose packet showed a requested style. */
  styleJudged: number;
  /** Of those, judged a decent deck of that style. */
  decentOfStyle: number;
  /** decentOfStyle / styleJudged. */
  decentOfStyleRate: number | null;
  /**
   * Over every styled request, counting a declined or substituted one as not
   * decent of its style: decentOfStyleRate times the styled requests' built share.
   */
  decentOfStyleRateAll: number | null;
  meanScore: number | null;
  /** Mean dead copies per judged deck, from the judges' dead lists and the packet's copies. */
  meanDeadCopies: number | null;
  failures: Partial<Record<Failure, number>>;
  /** Deck files for this row, built and declined (the version's error, or another style built). */
  built: number;
  declined: number;
  /** Of `declined`, styled requests the version answered with another style. */
  substituted: number;
}

export interface SizeRow extends Stat {
  version: string;
  size: number;
}

export interface StyleRow extends Stat {
  version: string;
  style: string;
}

export interface AnchorRow {
  version: string;
  judged: number;
  /** Decks scored 3 or more. */
  passed: number;
  passShare: number | null;
  expected: 'fail most' | 'pass most';
  /** Whether the panel did what the anchor expects; null when none were judged. */
  ok: boolean | null;
}

export interface Agreement {
  /** Duplicated packets where both copies have a valid answer. */
  pairs: number;
  decentAgree: number;
  decentAgreeShare: number | null;
  meanAbsScoreDiff: number | null;
  exactScore: number;
  exactScoreShare: number | null;
}

/**
 * One version pair at one match step, from `a`'s side, pooled over which deck was shown as A.
 * Only same-request pairs compare two builders on equal terms, so steps are never pooled.
 */
export interface HeadToHead {
  a: string;
  b: string;
  match: PairMatch;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  /** (wins + ties / 2) / games. */
  winShare: number | null;
}

export interface Example {
  version: string;
  size: number;
  which: 'lowest' | 'highest';
  packet: string;
  file: string;
  pool: string;
  poolKind: string;
  style: string;
  colors: string;
  score: number;
  plan: string;
  reason: string;
  /** Present when the judge answered the style question: null when no style was shown. */
  decentOfStyle?: boolean | null;
  styleReason?: string;
  dead: string[];
  failures: Failure[];
}

export interface FileProblem {
  file: string;
  problems: string[];
}

/** Per version: styled requests answered with another style, counted as declined in every table. */
export interface AnotherStyleRow {
  version: string;
  /** Deck files with a requested style, built or declined. */
  styled: number;
  /** Of those, built in another style. */
  substituted: number;
  /** Judged decks left out of the tables because they built another style. */
  judgedSetAside: number;
  /** Of those, judged decent: how good the nearest deck was, kept apart from the request it missed. */
  setAsideDecent: number;
}

export interface Collation {
  batch: string;
  seed: number;
  dataVersion?: string;
  /** Where the built and declined counts came from. */
  countsFrom: string;
  packets: { singles: number; duplicates: number; pairs: number };
  answered: number;
  unanswered: string[];
  invalid: FileProblem[];
  warnings: FileProblem[];
  bySize: SizeRow[];
  byStyle: StyleRow[];
  anotherStyle: AnotherStyleRow[];
  anchors: AnchorRow[];
  agreement: Agreement;
  headToHead: HeadToHead[];
  /** Pairs left out of head to head because a deck in them built another style. */
  pairsSetAside: number;
  /** How often the judges picked the deck shown as A, to spot an order bias. */
  position: { games: number; pickedA: number; pickedB: number; ties: number };
  examples: Example[];
}

export interface AnswerFile {
  /** Packet id, from the file name. */
  id: string;
  file: string;
  text: string;
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function share(n: number, d: number): number | null {
  return d ? round(n / d) : null;
}

interface Judged {
  id: string;
  ref: DeckRef;
  answer: SingleAnswer;
  dead: number;
}

/** A styled request the version answered with another style; see builtAnotherStyle. */
function substitute(ref: Pick<DeckRef, 'request' | 'archetype'>): boolean {
  return builtAnotherStyle(ref.request, ref.archetype);
}

function stat(
  judged: readonly Judged[],
  rows: readonly Pick<InventoryRow, 'style' | 'built' | 'declined' | 'substituted'>[],
): Stat {
  const built = rows.reduce((n, r) => n + r.built, 0);
  const declined = rows.reduce((n, r) => n + r.declined, 0);
  const substituted = rows.reduce((n, r) => n + (r.substituted ?? 0), 0);
  const failures: Partial<Record<Failure, number>> = {};
  for (const j of judged) for (const f of j.answer.failures) failures[f] = (failures[f] ?? 0) + 1;
  const decent = judged.filter((j) => j.answer.decent).length;
  const mean = (f: (j: Judged) => number) =>
    judged.length ? round(judged.reduce((n, j) => n + f(j), 0) / judged.length) : null;
  const requests = built + declined;
  // Only styled requests can be decent of their style; best fit shows none.
  const ofStyle = judged.filter((j) => typeof j.answer.decent_of_style === 'boolean');
  const decentOfStyle = ofStyle.filter((j) => j.answer.decent_of_style).length;
  const styledRows = rows.filter((r) => r.style !== 'bestfit');
  const styledBuilt = styledRows.reduce((n, r) => n + r.built, 0);
  const styledRequests = styledRows.reduce((n, r) => n + r.built + r.declined, 0);
  return {
    judged: judged.length,
    decent,
    decentRate: share(decent, judged.length),
    decentRateAll:
      judged.length && requests ? round((decent / judged.length) * (built / requests)) : null,
    builtShare: share(built, requests),
    styleJudged: ofStyle.length,
    decentOfStyle,
    decentOfStyleRate: share(decentOfStyle, ofStyle.length),
    decentOfStyleRateAll:
      ofStyle.length && styledRequests
        ? round((decentOfStyle / ofStyle.length) * (styledBuilt / styledRequests))
        : null,
    meanScore: mean((j) => j.answer.score),
    meanDeadCopies: mean((j) => j.dead),
    failures,
    built,
    declined,
    substituted,
  };
}

const SIZE_ORDER = [100, 60, 40, 20];
const MATCH_ORDER: readonly PairMatch[] = ['same-request', 'same-pool', 'same-colors'];

function versionOrder(a: string, b: string): number {
  const aa = ANCHOR_VERSIONS.includes(a);
  const bb = ANCHOR_VERSIONS.includes(b);
  if (aa !== bb) return aa ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Collate answers against a batch key. Pure, so the final report can reuse it.
 * Built and declined counts come from `counts` when given (every deck file, as
 * collateFromDisk reads them), else from the key's inventory.
 */
export function collate(
  key: BatchKey,
  answers: readonly AnswerFile[],
  counts?: { inventory: InventoryRow[]; from: string },
): Collation {
  const inventory = counts?.inventory ?? key.inventory;
  const invalid: FileProblem[] = [];
  const warnings: FileProblem[] = [];
  const singles = new Map<string, SingleAnswer>();
  const pairs = new Map<string, PairAnswer>();
  for (const f of [...answers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const entry = Object.hasOwn(key.packets, f.id) ? key.packets[f.id] : undefined;
    if (!entry) {
      invalid.push({ file: f.file, problems: ['no packet with this id in the key'] });
      continue;
    }
    const parsed = parseAnswer(f.text);
    if (parsed.error) {
      invalid.push({ file: f.file, problems: [parsed.error] });
      continue;
    }
    const check =
      entry.kind === 'single'
        ? checkSingle(parsed.value, entry.copies, entry.request.size, entry.styleShown)
        : checkPair(parsed.value);
    if (parsed.warning) check.warnings.unshift(parsed.warning);
    if (check.errors.length) {
      invalid.push({ file: f.file, problems: check.errors });
      continue;
    }
    if (check.warnings.length) warnings.push({ file: f.file, problems: check.warnings });
    if (entry.kind === 'single') singles.set(f.id, parsed.value as SingleAnswer);
    else pairs.set(f.id, parsed.value as PairAnswer);
  }

  const ids = Object.keys(key.packets).sort();
  const entries = ids.map((id) => [id, key.packets[id]!] as const);
  const single = entries.filter((e): e is readonly [string, SingleKey] => e[1].kind === 'single');
  const given = new Set(answers.map((a) => a.id));
  const unanswered = ids.filter((id) => !given.has(id));

  // One judgment per deck: the first copy's, or the second's when the first is missing or invalid.
  // Second copies otherwise feed only the agreement table.
  const seconds = new Map<string, string[]>();
  for (const [id, e] of single)
    if (e.duplicateOf) seconds.set(e.duplicateOf, [...(seconds.get(e.duplicateOf) ?? []), id]);
  const judged: Judged[] = [];
  const setAside = new Map<string, number>();
  const setAsideDecent = new Map<string, number>();
  for (const [id, e] of single) {
    if (e.duplicateOf) continue;
    const useId = [id, ...(seconds.get(id) ?? [])].find((x) => singles.has(x));
    if (!useId) continue;
    const answer = singles.get(useId)!;
    // Another style built counts as declined, so its judgment stays out of every table.
    if (substitute(e)) {
      setAside.set(e.version, (setAside.get(e.version) ?? 0) + 1);
      if (answer.decent) setAsideDecent.set(e.version, (setAsideDecent.get(e.version) ?? 0) + 1);
      continue;
    }
    judged.push({ id: useId, ref: e, answer, dead: deadCopies(answer.dead, e.copies) });
  }

  // Rows for the versions the batch knew; versions built since get no row.
  const versions = [
    ...new Set([
      ...judged.map((j) => j.ref.version),
      ...setAside.keys(),
      ...key.inventory.map((r) => r.version),
    ]),
  ].sort(versionOrder);

  const bySize: SizeRow[] = [];
  const byStyle: StyleRow[] = [];
  const anotherStyle: AnotherStyleRow[] = [];
  for (const version of versions) {
    const inv = inventory.filter((r) => r.version === version);
    const mine = judged.filter((j) => j.ref.version === version);
    const sizes = new Set([...inv.map((r) => r.size), ...mine.map((j) => j.ref.request.size)]);
    for (const size of SIZE_ORDER.filter((s) => sizes.has(s))) {
      bySize.push({
        version,
        size,
        ...stat(
          mine.filter((j) => j.ref.request.size === size),
          inv.filter((r) => r.size === size),
        ),
      });
    }
    const styles = new Set([
      ...inv.map((r) => r.style),
      ...mine.map((j) => styleOf(j.ref.request)),
    ]);
    for (const style of [...styles].sort()) {
      byStyle.push({
        version,
        style,
        ...stat(
          mine.filter((j) => styleOf(j.ref.request) === style),
          inv.filter((r) => r.style === style),
        ),
      });
    }
    const styled = inv.filter((r) => r.style !== 'bestfit');
    const row: AnotherStyleRow = {
      version,
      styled: styled.reduce((n, r) => n + r.built + r.declined, 0),
      substituted: styled.reduce((n, r) => n + (r.substituted ?? 0), 0),
      judgedSetAside: setAside.get(version) ?? 0,
      setAsideDecent: setAsideDecent.get(version) ?? 0,
    };
    if (row.styled || row.judgedSetAside) anotherStyle.push(row);
  }

  const anchors: AnchorRow[] = ANCHOR_VERSIONS.map((version) => {
    const mine = judged.filter((j) => j.ref.version === version);
    const passed = mine.filter((j) => j.answer.score >= 3).length;
    const passShare = share(passed, mine.length);
    const expected = version === 'random' ? 'fail most' : 'pass most';
    const ok =
      passShare === null ? null : expected === 'fail most' ? passShare < 0.5 : passShare > 0.5;
    return { version, judged: mine.length, passed, passShare, expected, ok };
  });

  let agreePairs = 0;
  let decentAgree = 0;
  let exactScore = 0;
  let absDiff = 0;
  for (const [id, e] of single) {
    if (!e.duplicateOf) continue;
    const a = singles.get(e.duplicateOf);
    const b = singles.get(id);
    if (!a || !b) continue;
    agreePairs++;
    if (a.decent === b.decent) decentAgree++;
    if (a.score === b.score) exactScore++;
    absDiff += Math.abs(a.score - b.score);
  }
  const agreement: Agreement = {
    pairs: agreePairs,
    decentAgree,
    decentAgreeShare: share(decentAgree, agreePairs),
    meanAbsScoreDiff: agreePairs ? round(absDiff / agreePairs) : null,
    exactScore,
    exactScoreShare: share(exactScore, agreePairs),
  };

  const h2h = new Map<string, HeadToHead>();
  const position = { games: 0, pickedA: 0, pickedB: 0, ties: 0 };
  let pairsSetAside = 0;
  for (const [id, e] of entries) {
    if (e.kind !== 'pair') continue;
    const ans = pairs.get(id);
    if (!ans) continue;
    position.games++;
    if (ans.better === 'A') position.pickedA++;
    else if (ans.better === 'B') position.pickedB++;
    else position.ties++;
    const va = e.pair.A.version;
    const vb = e.pair.B.version;
    if (va === vb) continue;
    // A deck built in another style is a declined request, and declined builds never enter pairs.
    if (substitute(e.pair.A) || substitute(e.pair.B)) {
      pairsSetAside++;
      continue;
    }
    const [x, y] = [va, vb].sort();
    const match = e.pair.match;
    const k = `${x}|${y}|${MATCH_ORDER.indexOf(match)}`;
    const row = h2h.get(k) ?? {
      a: x!,
      b: y!,
      match,
      games: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winShare: null,
    };
    row.games++;
    const winner = ans.better === 'tie' ? undefined : ans.better === 'A' ? va : vb;
    if (!winner) row.ties++;
    else if (winner === x) row.wins++;
    else row.losses++;
    h2h.set(k, row);
  }
  const headToHead = [...h2h.keys()].sort().map((k) => {
    const r = h2h.get(k)!;
    return { ...r, winShare: share(r.wins + r.ties / 2, r.games) };
  });

  const examples: Example[] = [];
  for (const row of bySize) {
    // Public and plain pools only: owner pools are personal and never quoted.
    const pool = judged.filter(
      (j) =>
        j.ref.version === row.version &&
        j.ref.request.size === row.size &&
        (j.ref.pool.kind === 'public' || j.ref.pool.kind === 'plain'),
    );
    const byId = (a: Judged, b: Judged) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    // The highest first, so a row with only two or three decks still shows its best one.
    const high = [...pool].sort((a, b) => b.answer.score - a.answer.score || byId(a, b))[0];
    const low = pool
      .filter((j) => j !== high)
      .sort((a, b) => a.answer.score - b.answer.score || byId(a, b))
      .slice(0, 2);
    const pick = (j: Judged, which: Example['which']): Example => ({
      version: row.version,
      size: row.size,
      which,
      packet: j.id,
      file: j.ref.file,
      pool: j.ref.pool.id,
      poolKind: j.ref.pool.kind,
      style: styleOf(j.ref.request),
      colors: j.ref.request.colors.join(''),
      score: j.answer.score,
      plan: j.answer.plan,
      reason: j.answer.reason,
      ...('decent_of_style' in j.answer
        ? {
            decentOfStyle: j.answer.decent_of_style ?? null,
            styleReason: j.answer.style_reason ?? '',
          }
        : {}),
      dead: j.answer.dead,
      failures: j.answer.failures,
    });
    for (const j of low) examples.push(pick(j, 'lowest'));
    if (high) examples.push(pick(high, 'highest'));
  }

  const duplicates = single.filter(([, e]) => e.duplicateOf).length;
  return {
    batch: key.batch,
    seed: key.options.seed,
    ...(key.dataVersion ? { dataVersion: key.dataVersion } : {}),
    countsFrom: counts?.from ?? "the batch key's inventory, taken when the packets were made",
    packets: {
      singles: single.length - duplicates,
      duplicates,
      pairs: entries.length - single.length,
    },
    answered: singles.size + pairs.size,
    unanswered,
    invalid,
    warnings,
    bySize,
    byStyle,
    anotherStyle,
    anchors,
    agreement,
    headToHead,
    pairsSetAside,
    position,
    examples,
  };
}

/**
 * Read the key and every answer file of a batch, count built and declined decks
 * over every deck file under `decks` and `also` (default: the specs the batch
 * was drawn from), then collate. With no deck files there, the key's inventory is used.
 */
export function collateFromDisk(
  batch: string,
  opts: { keysDir?: string; judgmentsDir?: string; decks?: string; also?: string[] } = {},
): Collation {
  const keyFile = path.join(opts.keysDir ?? KEYS_DIR, `${batch}.json`);
  if (!existsSync(keyFile)) throw new Error(`no key for batch "${batch}" at ${keyFile}`);
  const key = JSON.parse(readFileSync(keyFile, 'utf8')) as BatchKey;
  const specs = [opts.decks ?? key.options.decks, ...(opts.also ?? key.options.also ?? [])];
  const files = findAllDeckFiles(specs);
  const counts = files.length
    ? {
        inventory: inventoryOf(readDecks(files).decks),
        from: `${files.length} deck files under ${specs.join(', ')}, read when collating`,
      }
    : undefined;
  const dir = path.join(opts.judgmentsDir ?? JUDGMENTS_DIR, batch);
  const answers: AnswerFile[] = [];
  if (existsSync(dir))
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(dir, name);
      answers.push({
        id: name.slice(0, -'.json'.length),
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        text: readFileSync(file, 'utf8'),
      });
    }
  return collate(key, answers, counts);
}

// ---------------------------------------------------------------- report

function pct(x: number | null): string {
  return x === null ? '-' : `${Math.round(x * 100)}%`;
}

function num(x: number | null): string {
  return x === null ? '-' : String(x);
}

function failureText(f: Stat['failures']): string {
  return (
    FAILURES.filter((k) => f[k])
      .map((k) => `${k} ${f[k]}`)
      .join(', ') || '-'
  );
}

function statCells(s: Stat): string[] {
  return [
    String(s.judged),
    s.judged ? `${pct(s.decentRate)} (${s.decent})` : '-',
    pct(s.decentRateAll),
    s.styleJudged ? `${pct(s.decentOfStyleRate)} (${s.decentOfStyle} of ${s.styleJudged})` : '-',
    pct(s.decentOfStyleRateAll),
    num(s.meanScore),
    num(s.meanDeadCopies),
    failureText(s.failures),
    `${s.declined} of ${s.built + s.declined}` +
      (s.substituted ? ` (${s.substituted} another style)` : ''),
  ];
}

function table(head: string[], rows: string[][]): string[] {
  const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ];
}

const STAT_HEAD = [
  'Judged',
  'Decent, built',
  'Decent, all requests',
  'Of style, built',
  'Of style, all requests',
  'Mean score',
  'Dead copies',
  'Failures',
  'Declined',
];

/** The collation as Markdown, for data/review/results/<batch>.md. */
export function renderCollation(c: Collation): string {
  const L: string[] = [`# Judging results: ${c.batch}`, ''];
  L.push(
    `Seed ${c.seed}${c.dataVersion ? `, data ${c.dataVersion}` : ''}. Packets: ${c.packets.singles} decks, ${c.packets.duplicates} second copies, ${c.packets.pairs} pairs. Valid answers: ${c.answered}. Invalid: ${c.invalid.length}. Unanswered: ${c.unanswered.length}.`,
    '',
    'Each deck counts once, with its first valid judgment; second copies feed only the agreement table.',
    '',
    `"Declined" counts deck files with an error (the version could not build the request) or built in another style than the one requested, out of all deck files for the row, from ${c.countsFrom}. "Decent, built" is over judged built decks. "Decent, all requests" counts a declined request as not decent: the built rate times the share of requests the version built.`,
    '',
    '"Of style, built" is the share of judged built decks with a requested style that the judge called a decent deck of that style. "Of style, all requests" is over every styled request, counting a declined or substituted one as not decent of its style.',
    '',
    '## By version and size',
    '',
  );
  L.push(
    ...table(
      ['Version', 'Size', ...STAT_HEAD],
      c.bySize.map((r) => [r.version, String(r.size), ...statCells(r)]),
    ),
    '',
  );
  L.push('## By version and requested style', '');
  L.push(
    ...table(
      ['Version', 'Style', ...STAT_HEAD],
      c.byStyle.map((r) => [r.version, r.style, ...statCells(r)]),
    ),
    '',
  );
  L.push(
    '## Built another style',
    '',
    'A styled request the version answered with another style, such as a Graveyard request built as Midrange. Each counts as declined in every table above, and its judgment, if any, is left out. Best fit has no style and never counts here. "Set aside, decent" says how many of the judged ones were decent decks all the same.',
    '',
  );
  if (c.anotherStyle.length)
    L.push(
      ...table(
        [
          'Version',
          'Styled requests',
          'Built another style',
          'Judged decks set aside',
          'Set aside, decent',
        ],
        c.anotherStyle.map((r) => [
          r.version,
          String(r.styled),
          `${r.substituted}${r.styled ? ` (${pct(r.substituted / r.styled)})` : ''}`,
          String(r.judgedSetAside),
          r.judgedSetAside
            ? `${r.setAsideDecent} (${pct(r.setAsideDecent / r.judgedSetAside)})`
            : '-',
        ]),
      ),
      '',
    );
  else L.push('No styled requests.', '');
  L.push(
    '## Anchors',
    '',
    'Before trusting the panel: judges must fail most random piles and pass most real decks.',
    '',
  );
  L.push(
    ...table(
      ['Anchor', 'Judged', 'Scored 3 or more', 'Expected', 'As expected'],
      c.anchors.map((a) => [
        a.version,
        String(a.judged),
        a.judged ? `${pct(a.passShare)} (${a.passed})` : '-',
        a.expected,
        a.ok === null ? 'none judged' : a.ok ? 'yes' : 'no',
      ]),
    ),
    '',
  );
  const g = c.agreement;
  L.push('## Judge agreement', '');
  L.push(
    g.pairs
      ? `${g.pairs} decks judged twice. Agreed on decent: ${pct(g.decentAgreeShare)} (${g.decentAgree}). Same score: ${pct(g.exactScoreShare)} (${g.exactScore}). Mean score difference: ${g.meanAbsScoreDiff}.`
      : 'No deck has two valid judgments.',
    '',
  );
  L.push(
    '## Head to head',
    '',
    'Declined builds never enter pairs, so a version that declines a request skips that comparison; read these rows beside the declined counts above.' +
      (c.pairsSetAside
        ? ` ${c.pairsSetAside} judged pair${c.pairsSetAside === 1 ? '' : 's'} with a deck built in another style ${c.pairsSetAside === 1 ? 'is' : 'are'} left out.`
        : ''),
    '',
  );
  if (c.headToHead.length) {
    L.push(
      ...table(
        ['Version', 'Against', 'Match', 'Games', 'Wins', 'Losses', 'Ties', 'Win share'],
        c.headToHead.map((h) => [
          h.a,
          h.b,
          h.match,
          String(h.games),
          String(h.wins),
          String(h.losses),
          String(h.ties),
          pct(h.winShare),
        ]),
      ),
      '',
      'Win share counts a tie as half a win, pooled over which deck was shown as A. Only same-request rows compare two versions on the same pool and request; looser matches are kept apart.',
      '',
    );
  } else L.push('No valid pair answers.', '');
  const p = c.position;
  if (p.games)
    L.push(
      `Order check: of ${p.games} pairs, A was picked ${p.pickedA} times, B ${p.pickedB}, tie ${p.ties}.`,
      '',
    );
  L.push(
    '## Example decks',
    '',
    'Per version and size: the two lowest scored and the highest scored deck from public and plain pools.',
    '',
  );
  for (const e of c.examples) {
    L.push(
      `### ${e.version} ${e.size}, ${e.which}: score ${e.score} (${e.packet})`,
      '',
      `- Deck: \`${e.file}\` (pool ${e.pool}, ${e.colors}, ${e.style})`,
      `- Plan: ${e.plan}`,
      `- Reason: ${e.reason}`,
      ...(e.decentOfStyle === undefined
        ? []
        : [
            e.decentOfStyle === null
              ? '- Of its style: no style shown'
              : `- Of its style: ${e.decentOfStyle ? 'yes' : 'no'}. ${e.styleReason ?? ''}`.trimEnd(),
          ]),
      `- Dead: ${e.dead.join(', ') || 'none'}`,
      `- Failures: ${e.failures.join(', ')}`,
      '',
    );
  }
  if (!c.examples.length) L.push('None judged yet.', '');
  if (c.invalid.length) {
    L.push('## Invalid answers', '');
    for (const f of c.invalid) L.push(`- \`${f.file}\`: ${f.problems.join('; ')}`);
    L.push('');
  }
  if (c.warnings.length) {
    L.push('## Answers with consistency warnings (still counted)', '');
    for (const f of c.warnings) L.push(`- \`${f.file}\`: ${f.problems.join('; ')}`);
    L.push('');
  }
  if (c.unanswered.length) {
    // The JSON keeps the full list; a long one would bury the tables here.
    const shown = c.unanswered.slice(0, 40).join(', ');
    const more = c.unanswered.length > 40 ? `, and ${c.unanswered.length - 40} more` : '';
    L.push(`## Unanswered packets (${c.unanswered.length})`, '', shown + more, '');
  }
  return L.join('\n').replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------- command line

function main(): number {
  const batch = arg('batch');
  if (!batch) {
    console.error(
      'Usage: npm run review:collate -- --batch <name> [--decks <folder or glob>] [--also <folder or glob>]... [--out data/review/results]',
    );
    return 2;
  }
  let c: Collation;
  try {
    const decks = arg('decks');
    const also = argAll('also');
    c = collateFromDisk(batch, { ...(decks ? { decks } : {}), ...(also.length ? { also } : {}) });
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
  const out = path.resolve(ROOT, arg('out') ?? RESULTS_DIR);
  mkdirSync(out, { recursive: true });
  const json = path.join(out, `${batch}.json`);
  const md = path.join(out, `${batch}.md`);
  writeFileSync(json, JSON.stringify(c, null, 2) + '\n');
  writeFileSync(md, renderCollation(c));
  console.log(
    `${c.answered} valid answers, ${c.invalid.length} invalid, ${c.warnings.length} with warnings, ${c.unanswered.length} packets unanswered`,
  );
  for (const f of c.invalid) console.log(`invalid ${f.file}: ${f.problems.join('; ')}`);
  for (const a of c.anchors)
    if (a.judged)
      console.log(
        `anchor ${a.version}: ${pct(a.passShare)} scored 3+ of ${a.judged} (${a.expected})`,
      );
  const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');
  console.log(`wrote ${rel(json)} and ${rel(md)}`);
  return 0;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/collate.ts')) {
  process.exitCode = main();
}
