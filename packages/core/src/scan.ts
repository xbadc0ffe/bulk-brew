// Archetype scan: which themes and shapes a pool can support for one color
// and deck size. The builder uses it as its seed step; the Build screen shows
// it so the user can pick a style that will actually work.

import {
  templateFor,
  type Archetype,
  type BulkBrewConfig,
  type DeckTemplate,
  type RoleQuota,
  type SynergyArchetype,
  type TypeMix,
} from './config.ts';
import { listCandidates, type Candidate } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import {
  COLOR_LABELS,
  COLORS,
  type ArchetypeReport,
  type Color,
  type DeckSize,
  type Pool,
  type ScanReport,
  type Settings,
} from './types.ts';

type SizeKey = '60' | '40' | '20';

/**
 * Share of a deck's spell slots that must be cards of the deck color.
 * Colorless cards fit every color, so without this a pile of artifacts would
 * count as a deck of any color. A constant for now; config if it needs tuning.
 */
export const MIN_COLORED_SHARE = 0.5;

/**
 * Curve profile for a size and archetype. Jumpstart packets always use the
 * template's own profile: two packets must curve out together on 16 lands,
 * whatever theme each one has.
 */
export function effectiveCurveProfile(
  template: DeckTemplate,
  archetype: Archetype | undefined,
): string {
  if (template.size === 20) return template.curveProfile;
  return archetype?.curveProfile ?? template.curveProfile;
}

/** Role quotas for a size with the archetype's overrides applied, in template key order. */
export function effectiveQuotas(
  template: DeckTemplate,
  archetype: Archetype | undefined,
): Record<string, RoleQuota> {
  const key = String(template.size) as SizeKey;
  return { ...template.roles, ...(archetype?.roleOverrides?.[key] ?? {}) };
}

export function effectiveTypeMix(
  template: DeckTemplate,
  archetype: Archetype | undefined,
): TypeMix {
  return { ...template.typeMix, ...(archetype?.typeMixOverrides ?? {}) };
}

/** Available copies of spell candidates matching a predicate. */
export function countCopies(cands: Candidate[], pred: (c: Candidate) => boolean): number {
  let n = 0;
  for (const c of cands) if (c.facts.spell && pred(c)) n += c.available;
  return n;
}

function ratio(have: number, want: number): number {
  return want <= 0 ? have + 1 : have / want;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function reportSynergy(
  a: SynergyArchetype,
  config: BulkBrewConfig,
  cands: Candidate[],
  template: DeckTemplate,
  color: Color,
  possible: boolean,
): ArchetypeReport {
  const key = String(template.size) as SizeKey;
  const want = a.minimums[key];
  const isEnabler = (c: Candidate) => c.facts.enablerOf.includes(a.id);
  const isPayoff = (c: Candidate) => c.facts.payoffOf.includes(a.id);
  const enablers = countCopies(cands, isEnabler);
  const payoffs = countCopies(cands, isPayoff);
  // The margin counts only theme cards strong enough to play on their own, so
  // a theme made of weak cards ranks low without being ruled out.
  const bar = config.cardStrength.themeMinStrength;
  const strongEnablers = countCopies(cands, (c) => isEnabler(c) && c.facts.strength >= bar);
  const strongPayoffs = countCopies(cands, (c) => isPayoff(c) && c.facts.strength >= bar);
  const notes: string[] = [];
  const colorOk = !a.colors || a.colors.includes(color);
  if (!colorOk) notes.push(`${a.label} does not work in this color`);
  if (enablers < want.enablers)
    notes.push(`needs ${plural(want.enablers - enablers, `more ${a.label} enabler`)}`);
  if (payoffs < want.payoffs)
    notes.push(`needs ${plural(want.payoffs - payoffs, `more ${a.label} payoff`)}`);
  const margin =
    Math.min(ratio(strongEnablers, want.enablers), ratio(strongPayoffs, want.payoffs)) - 1;
  return {
    archetype: a.id,
    label: a.label,
    kind: 'synergy',
    viable: possible && colorOk && enablers >= want.enablers && payoffs >= want.payoffs,
    enablers: { have: enablers, want: want.enablers },
    payoffs: { have: payoffs, want: want.payoffs },
    margin,
    notes,
  };
}

function reportComposition(
  a: Archetype,
  cands: Candidate[],
  config: BulkBrewConfig,
  template: DeckTemplate,
  spells: number,
  spellSlots: number,
  possible: boolean,
): ArchetypeReport {
  const quotas = effectiveQuotas(template, a);
  const notes: string[] = [];
  let margin = ratio(spells, spellSlots) - 1;
  for (const [roleId, q] of Object.entries(quotas)) {
    if (q.min <= 0) continue;
    const have = countCopies(cands, (c) => c.facts.roles.includes(roleId));
    const role = config.roles.roles.find((r) => r.id === roleId);
    const label = (role?.label ?? roleId).toLowerCase();
    if (have < q.min) notes.push(`needs ${q.min - have} more ${label}`);
    margin = Math.min(margin, ratio(have, q.min) - 1);
  }
  return {
    archetype: a.id,
    label: a.label,
    kind: 'composition',
    viable: possible && notes.length === 0,
    enablers: { have: spells, want: spellSlots },
    payoffs: { have: 0, want: 0 },
    margin,
    notes,
  };
}

/** Scan an already computed candidate list. */
export function scanCandidates(
  cands: Candidate[],
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  color: Color,
): ScanReport {
  const template = templateFor(config, size);
  const spellSlots = size - template.baseLands;
  let spells = 0;
  let colored = 0;
  let creatures = 0;
  let distinct = 0;
  let nonbasics = 0;
  let basics = 0;
  for (const c of cands) {
    if (c.facts.spell) {
      spells += c.available;
      distinct += 1;
      if (c.facts.card.identity.length > 0) colored += c.available;
      if (c.facts.creature) creatures += c.available;
    } else if (c.facts.land) {
      if (c.facts.basic) basics += c.available;
      else nonbasics += c.available;
    }
  }
  // Lands the mana base could actually use: nonbasics are capped by their share.
  const nonbasicCap = Math.floor(template.baseLands * config.landRules.nonbasic.maxShare);
  const lands = Math.min(nonbasics, nonbasicCap) + basics;
  // The builder's last fill pass ignores type caps, so a creature-only pool
  // with enough copies is buildable and "possible" only needs enough spells.
  const notes: string[] = [];
  const coloredMin = Math.ceil(spellSlots * MIN_COLORED_SHARE);
  if (spells < spellSlots) {
    notes.push(`needs ${plural(spellSlots - spells, 'more spell')} for a ${size}-card deck`);
  } else if (colored < coloredMin) {
    notes.push(
      `needs ${plural(coloredMin - colored, `more ${COLOR_LABELS[color]} card`)} (colorless cards alone do not make a ${COLOR_LABELS[color]} deck)`,
    );
  } else if (creatures === spells && creatures >= spellSlots) {
    notes.push('all creatures: the deck will lean on combat with no spells');
  }
  if (!settings.unlimitedBasics && lands < template.landFormula.min) {
    notes.push(`needs ${template.landFormula.min - lands} more lands (basics are tracked)`);
  }
  const possible = !notes.some((n) => n.startsWith('needs '));
  const archetypes = config.archetypes.archetypes.map((a) =>
    a.kind === 'synergy'
      ? reportSynergy(a, config, cands, template, color, possible)
      : reportComposition(a, cands, config, template, spells, spellSlots, possible),
  );
  return {
    color,
    size,
    candidates: spells,
    colored,
    distinct,
    lands,
    spellSlots,
    possible,
    archetypes,
    notes,
  };
}

export function scanPool(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  color: Color,
): ScanReport {
  return scanCandidates(
    listCandidates(pool, index, config, settings, color, size),
    config,
    settings,
    size,
    color,
  );
}

export function scanAll(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
): Record<Color, ScanReport> {
  const out = {} as Record<Color, ScanReport>;
  for (const color of COLORS) out[color] = scanPool(pool, index, config, settings, size, color);
  return out;
}
