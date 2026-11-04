// Turns pool entries into builder candidates with precomputed facts: which
// roles, themes, and synergy rules each card serves. Facts depend only on the
// card and the config, so they are cached per index and config bundle and
// shared by the scan and the builder.

import { templateFor, type BulkBrewConfig } from './config.ts';
import {
  cardMatches,
  hasColorlessPip,
  isBasicLand,
  isEvasiveCreature,
  isFinisher,
  isLand,
  isMdfcLand,
  manaSourceKind,
  needsCommander,
  type ManaSourceKind,
} from './matchers.ts';
import type { CardIndex } from './pack.ts';
import { identityWithin, isCommanderSize, normalizeColors, playableWith } from './colors.ts';
import { cardStrength } from './strength.ts';
import type { CardRecord, Color, DeckSize, Pool, PrintingHint, Settings } from './types.ts';

export interface CardFacts {
  card: CardRecord;
  /** Role ids the card fills, sorted. */
  roles: string[];
  /** Synergy archetype ids the card enables, sorted. */
  enablerOf: string[];
  /** Synergy archetype ids the card pays off, sorted. */
  payoffOf: string[];
  /** Synergy rule ids where the card is an enabler, sorted. */
  ruleEnabler: string[];
  /** Synergy rule ids where the card is a payoff, sorted. */
  rulePayoff: string[];
  manaSource?: ManaSourceKind;
  finisher: boolean;
  evasive: boolean;
  land: boolean;
  basic: boolean;
  mdfcLand: boolean;
  /** Takes a spell slot: any nonland card, plus a modal card with a land back face. */
  spell: boolean;
  creature: boolean;
  instantOrSorcery: boolean;
  /** Artifact, enchantment, planeswalker, or battle that is not also a creature. */
  noncreaturePermanent: boolean;
  power: number;
  toughness: number;
  /** Curve bucket 0 through 7 (7 is seven or more). Lands get -1. */
  bucket: number;
  /** Card strength score from config/card-strength.json. */
  strength: number;
}

export interface Candidate {
  facts: CardFacts;
  /** Copies the builder may use: pool quantity capped by the copy limit (basics are uncapped). */
  available: number;
  /**
   * Copies the builder uses before it bends the copy guidelines (legendary and
   * expensive cards); more only when the deck cannot be filled otherwise.
   */
  preferred: number;
  printing?: PrintingHint;
}

const factsCache = new WeakMap<CardIndex, WeakMap<BulkBrewConfig, Map<string, CardFacts>>>();

export function bucketOf(mv: number): number {
  return Math.max(0, Math.min(7, Math.floor(mv)));
}

function numeric(v: string | undefined): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

/** Compute facts for one card without caching. */
export function computeFacts(card: CardRecord, config: BulkBrewConfig): CardFacts {
  const land = isLand(card);
  const mdfcLand = isMdfcLand(card);
  const creature = card.types.includes('creature');
  const roles: string[] = [];
  for (const r of config.roles.roles) if (cardMatches(card, r.match)) roles.push(r.id);
  const enablerOf: string[] = [];
  const payoffOf: string[] = [];
  for (const a of config.archetypes.archetypes) {
    if (a.kind !== 'synergy') continue;
    if (cardMatches(card, a.enablers)) enablerOf.push(a.id);
    if (cardMatches(card, a.payoffs)) payoffOf.push(a.id);
  }
  const ruleEnabler: string[] = [];
  const rulePayoff: string[] = [];
  for (const s of config.synergyRules.rules) {
    if (cardMatches(card, s.enabler)) ruleEnabler.push(s.id);
    if (cardMatches(card, s.payoff)) rulePayoff.push(s.id);
  }
  const facts: CardFacts = {
    card,
    roles: roles.sort(),
    enablerOf: enablerOf.sort(),
    payoffOf: payoffOf.sort(),
    ruleEnabler: ruleEnabler.sort(),
    rulePayoff: rulePayoff.sort(),
    finisher: isFinisher(card),
    evasive: isEvasiveCreature(card),
    land,
    basic: land && isBasicLand(card),
    mdfcLand,
    spell: !land || mdfcLand,
    creature,
    instantOrSorcery:
      !creature && (card.types.includes('instant') || card.types.includes('sorcery')),
    noncreaturePermanent:
      !creature &&
      !land &&
      (card.types.includes('artifact') ||
        card.types.includes('enchantment') ||
        card.types.includes('planeswalker') ||
        card.types.includes('battle')),
    power: numeric(card.power),
    toughness: numeric(card.toughness),
    bucket: land && !mdfcLand ? -1 : bucketOf(card.mv),
    strength: cardStrength(card, config.cardStrength).score,
  };
  const source = manaSourceKind(card);
  if (source) facts.manaSource = source;
  return facts;
}

/** Facts for a card, cached per index and config. */
export function factsFor(index: CardIndex, config: BulkBrewConfig, card: CardRecord): CardFacts {
  let byConfig = factsCache.get(index);
  if (!byConfig) factsCache.set(index, (byConfig = new WeakMap()));
  let byId = byConfig.get(config);
  if (!byId) byConfig.set(config, (byId = new Map()));
  let facts = byId.get(card.id);
  if (!facts) byId.set(card.id, (facts = computeFacts(card, config)));
  return facts;
}

/** Copy limit for a deck size: the user setting when present, else the template default. */
export function maxCopiesFor(settings: Settings, config: BulkBrewConfig, size: DeckSize): number {
  const fromSettings = settings.maxCopies?.[size];
  if (typeof fromSettings === 'number' && fromSettings >= 1) return Math.floor(fromSettings);
  return templateFor(config, size).maxCopies;
}

/** Preferred copies of one card: the deck limit, lowered for legendary and expensive cards. */
export function preferredCopies(
  card: CardRecord,
  limit: number,
  caps: { legendary: number; expensiveMv: number; expensive: number },
): number {
  let n = limit;
  if (/^Legendary\b/.test(card.typeLine)) n = Math.min(n, caps.legendary);
  if (card.mv >= caps.expensiveMv) n = Math.min(n, caps.expensive);
  return n;
}

/** Whether a card fits a deck of these colors and size: castability, or identity for Commander. */
export function fitsColors(card: CardRecord, colors: readonly Color[], size: DeckSize): boolean {
  if (isCommanderSize(size)) return identityWithin(card, colors);
  return playableWith(card, colors) && !needsCommander(card);
}

/**
 * Candidates for one color and deck size, sorted by card id so every
 * downstream step is deterministic. Basics are left out when they are
 * unlimited, because the mana base adds them freely.
 */
export function listCandidates(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  colors: Color | readonly Color[],
  size: DeckSize,
): Candidate[] {
  const deckColors = normalizeColors(typeof colors === 'string' ? [colors] : colors);
  const limit = maxCopiesFor(settings, config, size);
  const caps = templateFor(config, size).copyCaps;
  const rarities = settings.rarities?.length ? new Set(settings.rarities) : undefined;
  const out: Candidate[] = [];
  const ids = Object.keys(pool.entries).sort();
  for (const id of ids) {
    const entry = pool.entries[id]!;
    if (entry.qty <= 0) continue;
    const card = index.get(id);
    if (!card) continue;
    if (card.unset && !settings.includeUnsets) continue;
    if (!fitsColors(card, deckColors, size)) continue;
    // Decks run basics of their colors, which cannot make the {C} these cards demand.
    if (hasColorlessPip(card)) continue;
    const facts = factsFor(index, config, card);
    if (facts.basic && settings.unlimitedBasics) continue;
    // Cards with no known rarity (schema 1 packs) stay in, so the filter never empties a pool by accident.
    if (rarities && !facts.basic && card.rarity && !rarities.has(card.rarity)) continue;
    const available = facts.basic ? entry.qty : Math.min(entry.qty, limit);
    const preferred = facts.basic
      ? available
      : Math.min(available, preferredCopies(card, limit, caps));
    const cand: Candidate = { facts, available, preferred };
    if (entry.printing) cand.printing = entry.printing;
    out.push(cand);
  }
  return out;
}
