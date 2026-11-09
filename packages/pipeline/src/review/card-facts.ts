// Card facts for the builder review: what the data pack says about a card and
// what the live builder's matchers make of it. Review tools print or embed
// these instead of card text from memory. Matching goes through the core's
// own functions, so the facts are what the builder sees.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CardIndex,
  cardStrength,
  clauseMatches,
  factsFor,
  hasColorlessPip,
  isBasicLand,
  isLand,
  needsCommander,
  parseDecklist,
  parsePack,
  resolveLines,
  toPoolEntries,
  validateConfig,
  type BulkBrewConfig,
  type CardRecord,
  type CardType,
  type Color,
  type DataPack,
  type ManaColor,
  type MatcherClause,
  type Rarity,
  type Settings,
  type StrengthPart,
  type SynergyArchetype,
} from '@bulk-brew/core';
import { PACK_FILE } from '../build.ts';
import { loadConfigDir } from '../check-config.ts';
import { attachLearned } from '../learned-data.ts';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

export interface ReviewContext {
  root: string;
  pack: DataPack;
  index: CardIndex;
  config: BulkBrewConfig;
  settings: Settings;
  /** Version of data/learned.json when it was attached. */
  learnedVersion?: string;
}

/**
 * Load the data pack, its index, the config, and the default settings once.
 * Matchers and strength do not read learned data, so it is attached only on
 * request: pass `learned: true` when building decks the way the apps do.
 */
export function loadReviewContext(opts: { learned?: boolean } = {}): ReviewContext {
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) throw new Error(`no data pack at ${packPath}; run npm run data:pull`);
  const pack = parsePack(readFileSync(packPath, 'utf8'));
  const index = new CardIndex(pack);
  const config = loadConfigDir(path.join(ROOT, 'config'));
  const problems = validateConfig(config);
  if (problems.length) throw new Error(`config problems: ${problems.join('; ')}`);
  const settings = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  const ctx: ReviewContext = { root: ROOT, pack, index, config, settings };
  if (opts.learned) {
    const version = attachLearned(index);
    if (version) ctx.learnedVersion = version;
  }
  return ctx;
}

export interface FaceFacts {
  name: string;
  manaCost?: string;
  typeLine: string;
  text: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
}

/** One matcher clause a card meets: its 1-based position, what it asks, and the card's tags that hit. */
export interface ClauseHit {
  clause: number;
  rule: string;
  hits: string[];
}

export interface StyleCheck {
  style: string;
  enabler: ClauseHit[];
  payoff: ClauseHit[];
}

export interface StyleMembership {
  style: string;
  as: ('enabler' | 'payoff')[];
}

export interface CardFactsSheet {
  id: string;
  name: string;
  /** Copies, when the card came from a decklist. */
  qty?: number;
  layout: string;
  /** The pack's card-level cost: the front face's on split and adventure cards; `faces` hold each. */
  manaCost: string;
  mv: number;
  typeLine: string;
  /** Card types matchers test: the front face's, plus the back's on modal double-faced cards. */
  types: CardType[];
  colors: Color[];
  identity: Color[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  /** Oracle text; multi-face cards join faces with a "//" line. */
  text: string;
  faces?: FaceFacts[];
  keywords: string[];
  rarity?: Rarity;
  /** Scryfall's Commander popularity rank; it feeds strength. */
  rank?: number;
  unset?: true;
  commanderLegality?: 'banned' | 'not_legal';
  gameChanger?: true;
  /** Mana the permanent makes, and whether a land enters tapped; the mana base reads these. */
  produces?: ManaColor[];
  entersTapped?: true;
  /**
   * Why the builder's candidate list leaves the card out under the default
   * settings, whatever the deck's colors. Roles and styles below still show
   * what it would count as.
   */
  leftOut?: string[];
  /** Tagger tags plus the local overlay, as the pack ships them. */
  tags: string[];
  /** Role ids from config/roles.json. */
  roles: string[];
  /** Synergy styles from config/archetypes.json the card counts toward. */
  styles: StyleMembership[];
  /** Synergy rule ids from config/synergy-rules.json. */
  synergyRules: { enabler: string[]; payoff: string[] };
  finisher: boolean;
  evasive: boolean;
  manaSource?: string;
  strength: number;
  strengthParts: StrengthPart[];
  /** Present when a style was asked for: which of its matcher clauses the card meets. */
  styleCheck?: StyleCheck;
}

/** The synergy style with this id, or an error message naming the valid ids. */
export function synergyStyle(config: BulkBrewConfig, id: string): SynergyArchetype | string {
  const synergy = config.archetypes.archetypes.filter(
    (a): a is SynergyArchetype => a.kind === 'synergy',
  );
  const hit = synergy.find((a) => a.id === id);
  if (hit) return hit;
  const shape = config.archetypes.archetypes.find((a) => a.id === id);
  const why = shape
    ? `"${id}" is a shape style with no enabler or payoff matchers`
    : `no style "${id}"`;
  return `${why}; styles with matchers: ${synergy.map((a) => a.id).join(', ')}`;
}

/** A matcher clause in short words, such as "anyTags loot|rummage + allTags reanimate". */
export function describeClause(c: MatcherClause): string {
  const parts: string[] = [];
  const list = (label: string, v: readonly string[] | undefined) => {
    if (v?.length) parts.push(`${label} ${v.join('|')}`);
  };
  list('anyTags', c.anyTags);
  list('allTags', c.allTags);
  list('excludeTags', c.excludeTags);
  list('anyKeywords', c.anyKeywords);
  list('types', c.types);
  list('anyTypes', c.anyTypes);
  list('excludeTypes', c.excludeTypes);
  list('typeLineAny', c.typeLineAny);
  list('excludeTypeLine', c.excludeTypeLine);
  if (c.minMv !== undefined) parts.push(`minMv ${c.minMv}`);
  if (c.maxMv !== undefined) parts.push(`maxMv ${c.maxMv}`);
  if (c.derived) parts.push(`derived ${c.derived}`);
  return parts.join(' + ') || 'any card';
}

function clauseHits(card: CardRecord, clauses: readonly MatcherClause[]): ClauseHit[] {
  const out: ClauseHit[] = [];
  clauses.forEach((c, i) => {
    if (!clauseMatches(card, c)) return;
    const asked = [...(c.anyTags ?? []), ...(c.allTags ?? [])];
    const keywords = (c.anyKeywords ?? []).filter((k) => card.keywords.includes(k));
    const hits = [...new Set(asked.filter((t) => card.tags.includes(t))), ...keywords];
    out.push({ clause: i + 1, rule: describeClause(c), hits });
  });
  return out;
}

/** Which of a style's enabler and payoff clauses the card meets. */
export function checkStyle(card: CardRecord, style: SynergyArchetype): StyleCheck {
  return {
    style: style.id,
    enabler: clauseHits(card, style.enablers),
    payoff: clauseHits(card, style.payoffs),
  };
}

/**
 * The color-independent checks of the core's listCandidates, under the
 * default settings (Un-sets off, unlimited basics, every rarity on). Keep in
 * step with listCandidates in packages/core/src/candidates.ts.
 */
export function leftOutBy(card: CardRecord): string[] {
  const out: string[] = [];
  if (card.unset) out.push('Un-set (off by default)');
  if (card.commanderLegality === 'banned') out.push('banned in Commander (100)');
  else if (card.commanderLegality) out.push('not legal in Commander (100)');
  if (needsCommander(card)) out.push('mentions a commander (60, 40, 20)');
  if (hasColorlessPip(card)) out.push('{C} in its cost (every deck)');
  if (isLand(card) && isBasicLand(card)) out.push('basic land (the mana base adds it)');
  return out;
}

/** `{ key: v }`, or nothing when v is undefined, so optional fields stay absent rather than undefined. */
function maybe<K extends string, V>(key: K, v: V | undefined): { [P in K]?: V } {
  return v === undefined ? {} : ({ [key]: v } as { [P in K]?: V });
}

function faceFacts(f: NonNullable<CardRecord['faces']>[number]): FaceFacts {
  return {
    name: f.name,
    ...maybe('manaCost', f.manaCost),
    typeLine: f.typeLine,
    text: f.text ?? '',
    ...maybe('power', f.power),
    ...maybe('toughness', f.toughness),
    ...maybe('loyalty', f.loyalty),
  };
}

/**
 * Everything a reviewer needs about one card, as a plain object: printed
 * facts from the pack, plus the roles, styles, synergy rules, and strength
 * the builder assigns it. Pass `style` to add which of that style's clauses
 * the card meets.
 */
export function cardFacts(
  card: CardRecord,
  config: BulkBrewConfig,
  index: CardIndex,
  opts: { style?: SynergyArchetype; qty?: number } = {},
): CardFactsSheet {
  const f = factsFor(index, config, card);
  const styles: StyleMembership[] = [];
  for (const a of config.archetypes.archetypes) {
    const as: StyleMembership['as'] = [];
    if (f.enablerOf.includes(a.id)) as.push('enabler');
    if (f.payoffOf.includes(a.id)) as.push('payoff');
    if (as.length) styles.push({ style: a.id, as });
  }
  const leftOut = leftOutBy(card);
  return {
    id: card.id,
    name: card.name,
    ...maybe('qty', opts.qty),
    layout: card.layout,
    manaCost: card.manaCost ?? '',
    mv: card.mv,
    typeLine: card.typeLine,
    types: card.types,
    colors: card.colors,
    identity: card.identity,
    ...maybe('power', card.power),
    ...maybe('toughness', card.toughness),
    ...maybe('loyalty', card.loyalty),
    text: card.text,
    ...maybe('faces', card.faces?.length ? card.faces.map(faceFacts) : undefined),
    keywords: card.keywords,
    ...maybe('rarity', card.rarity),
    ...maybe('rank', card.rank),
    ...maybe('unset', card.unset),
    ...maybe('commanderLegality', card.commanderLegality),
    ...maybe('gameChanger', card.gameChanger),
    ...maybe('produces', card.produces),
    ...maybe('entersTapped', card.entersTapped),
    ...maybe('leftOut', leftOut.length ? leftOut : undefined),
    tags: card.tags,
    roles: f.roles,
    styles,
    synergyRules: { enabler: f.ruleEnabler, payoff: f.rulePayoff },
    finisher: f.finisher,
    evasive: f.evasive,
    ...maybe('manaSource', f.manaSource),
    strength: f.strength,
    strengthParts: cardStrength(card, config.cardStrength).parts,
    ...maybe('styleCheck', opts.style && checkStyle(card, opts.style)),
  };
}

function stats(power?: string, toughness?: string, loyalty?: string): string {
  if (power !== undefined || toughness !== undefined) return `${power ?? '?'}/${toughness ?? '?'}`;
  return loyalty !== undefined ? `loyalty ${loyalty}` : '';
}

function colorsText(c: readonly Color[]): string {
  return c.length ? c.join('') : 'colorless';
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function styleText(styles: readonly StyleMembership[]): string {
  return styles.map((s) => `${s.style} (${s.as.join(', ')})`).join(', ') || 'none';
}

function hitText(h: ClauseHit): string {
  return `#${h.clause} [${h.rule}]${h.hits.length ? ` via ${h.hits.join(', ')}` : ''}`;
}

/** Each face's cost when more than one face has one (split, adventure), else the card's. */
function costText(s: CardFactsSheet): string {
  const costs = (s.faces ?? []).flatMap((f) => (f.manaCost ? [f.manaCost] : []));
  return costs.length > 1 ? costs.join(' // ') : s.manaCost;
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

/** Card facts as text: a block per card, or one line with `compact`. */
export function formatCardFacts(s: CardFactsSheet, opts: { compact?: boolean } = {}): string {
  const qty = s.qty !== undefined ? `${s.qty} ` : '';
  const pt = stats(s.power, s.toughness, s.loyalty);
  const cost = costText(s);
  if (opts.compact) {
    const cells = [
      `${qty}${s.name}`,
      `${cost || 'no cost'} mv ${s.mv}`,
      s.typeLine,
      colorsText(s.identity),
    ];
    if (pt) cells.push(pt);
    cells.push(`roles: ${s.roles.join(', ') || 'none'}`);
    cells.push(`styles: ${styleText(s.styles)}`);
    cells.push(`strength ${s.strength}`);
    if (s.leftOut) cells.push(`left out: ${s.leftOut.join('; ')}`);
    if (s.styleCheck) {
      const c = s.styleCheck;
      const e = c.enabler.map((h) => `#${h.clause}`).join(',') || 'no';
      const p = c.payoff.map((h) => `#${h.clause}`).join(',') || 'no';
      cells.push(`${c.style}: enabler ${e}, payoff ${p}`);
    }
    return cells.join(' | ');
  }

  const lines: string[] = [];
  lines.push(`${qty}${s.name}  ${cost || '(no cost)'}  mv ${s.mv}`);
  lines.push(`  id: ${s.id}  layout: ${s.layout}`);
  lines.push(`  type: ${s.typeLine}${pt ? `  ${pt}` : ''}`);
  if (s.faces?.length) lines.push(`  matcher types: ${s.types.join(', ')}`);
  const info = [`colors: ${colorsText(s.colors)}`, `identity: ${colorsText(s.identity)}`];
  if (s.rarity) info.push(`rarity: ${s.rarity}`);
  if (s.rank !== undefined) info.push(`rank: ${s.rank}`);
  if (s.unset) info.push('Un-set');
  if (s.commanderLegality) info.push(`Commander: ${s.commanderLegality}`);
  if (s.gameChanger) info.push('game changer');
  if (s.produces?.length) info.push(`produces: ${s.produces.join('')}`);
  if (s.entersTapped) info.push('enters tapped');
  lines.push(`  ${info.join('  ')}`);
  if (s.leftOut) lines.push(`  builder leaves it out: ${s.leftOut.join('; ')}`);
  if (s.faces?.length) {
    s.faces.forEach((f, i) => {
      const fpt = stats(f.power, f.toughness, f.loyalty);
      const fcost = f.manaCost ? `  ${f.manaCost}` : '';
      lines.push(`  face ${i + 1}: ${f.name}${fcost}  (${f.typeLine}${fpt ? `, ${fpt}` : ''})`);
      lines.push(indent(f.text || '(no text)', '    '));
    });
  } else {
    lines.push('  text:');
    lines.push(indent(s.text || '(no text)', '    '));
  }
  lines.push(`  keywords: ${s.keywords.join(', ') || 'none'}`);
  lines.push(`  tags: ${s.tags.join(', ') || 'none'}`);
  lines.push(`  roles: ${s.roles.join(', ') || 'none'}`);
  lines.push(`  styles: ${styleText(s.styles)}`);
  const rules = [
    ...s.synergyRules.enabler.map((r) => `${r} (enabler)`),
    ...s.synergyRules.payoff.map((r) => `${r} (payoff)`),
  ];
  lines.push(`  synergy rules: ${rules.join(', ') || 'none'}`);
  const derived: string[] = [];
  if (s.finisher) derived.push('finisher');
  if (s.evasive) derived.push('evasive');
  if (s.manaSource) derived.push(`mana source (${s.manaSource})`);
  if (derived.length) lines.push(`  derived: ${derived.join(', ')}`);
  const parts = s.strengthParts.map((p) => `${p.label} ${signed(p.value)}`).join(', ');
  lines.push(`  strength: ${s.strength}${parts ? ` (${parts})` : ''}`);
  if (s.styleCheck) {
    const c = s.styleCheck;
    lines.push(`  ${c.style} matchers met:`);
    lines.push(`    enabler: ${c.enabler.map(hitText).join('; ') || 'none'}`);
    lines.push(`    payoff: ${c.payoff.map(hitText).join('; ') || 'none'}`);
  }
  return lines.join('\n');
}

const ORACLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Find a card by oracle id, full name, "Front // Back" name, or one face's
 * name. Un-set cards are found too, but only when no other card has the name.
 */
export function findCard(index: CardIndex, query: string): CardRecord | undefined {
  const q = query.trim();
  if (ORACLE_ID.test(q)) return index.get(q.toLowerCase());
  return index.find(q) ?? index.find(q, { includeUnsets: true });
}

function byName(a: CardRecord, b: CardRecord): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every card with a tag, sorted by name (then id, so ties stay put). */
export function cardsWithTag(index: CardIndex, tag: string): CardRecord[] {
  return index.pack.cards.filter((c) => c.tags.includes(tag)).sort(byName);
}

/** Tags in the pack that contain this text, for "did you mean" hints. */
export function similarTags(index: CardIndex, text: string, limit = 10): string[] {
  const all = new Set<string>();
  for (const c of index.pack.cards) for (const t of c.tags) if (t.includes(text)) all.add(t);
  return [...all].sort().slice(0, limit);
}

export interface DecklistCards {
  cards: { card: CardRecord; qty: number }[];
  /** Lines no card matched, as written. */
  unresolved: string[];
}

/** The cards of a decklist, one entry per card with copies summed, in first-seen order. */
export function cardsFromDecklist(index: CardIndex, text: string): DecklistCards {
  const report = resolveLines(parseDecklist(text).lines, index, { suggest: false });
  const cards = toPoolEntries(report.resolved).map((e) => ({
    card: index.get(e.cardId)!,
    qty: e.qty,
  }));
  return { cards, unresolved: report.unresolved.map((u) => u.line.raw) };
}
