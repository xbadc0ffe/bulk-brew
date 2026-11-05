// Archetype scan: which themes and shapes a pool can support for one color
// and deck size. The builder uses it as its seed step; the Build screen shows
// it so the user can pick a style that will actually work.

import {
  forSize,
  minimumsFor,
  roleOverridesFor,
  templateFor,
  type Archetype,
  type BulkBrewConfig,
  type DeckTemplate,
  type RoleQuota,
  type SynergyArchetype,
  type TypeMix,
} from './config.ts';
import { listCandidates, type Candidate } from './candidates.ts';
import { colorsLabel, isCommanderSize, normalizeColors } from './colors.ts';
import { creatureTypes, inTribe } from './matchers.ts';
import type { CardIndex } from './pack.ts';
import {
  COLOR_LABELS,
  COLORS,
  type ArchetypeReport,
  type CardRecord,
  type Color,
  type DeckSize,
  type Pool,
  type ScanReport,
  type Settings,
  type TribeReport,
} from './types.ts';

/**
 * Share of a deck's spell slots that must be cards of the deck color.
 * Colorless cards fit every color, so without this a pile of artifacts would
 * count as a deck of any color. A constant for now; config if it needs tuning.
 */
export const MIN_COLORED_SHARE = 0.5;

/**
 * Curve profile for a size and archetype. Jumpstart packets always use the
 * template's own profile: two packets must curve out together on 16 lands,
 * whatever theme each one has. Commander decks do too: long multiplayer
 * games shape the curve more than the style does.
 */
export function effectiveCurveProfile(
  template: DeckTemplate,
  archetype: Archetype | undefined,
): string {
  if (template.size === 20 || template.size === 100) return template.curveProfile;
  return archetype?.curveProfile ?? template.curveProfile;
}

/** Role quotas for a size with the archetype's overrides applied, in template key order. */
export function effectiveQuotas(
  template: DeckTemplate,
  archetype: Archetype | undefined,
): Record<string, RoleQuota> {
  return { ...template.roles, ...(roleOverridesFor(archetype, template.size) ?? {}) };
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
  colors: readonly Color[],
  possible: boolean,
): ArchetypeReport {
  const want = minimumsFor(config, a, template.size);
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
  const colorOk = !a.colors || colors.some((c) => a.colors!.includes(c));
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
  colorsIn: Color | readonly Color[],
): ScanReport {
  const colors = normalizeColors(typeof colorsIn === 'string' ? [colorsIn] : colorsIn);
  const color = colors[0]!;
  const label = colorsLabel(colors);
  const template = templateFor(config, size);
  const commander = isCommanderSize(size);
  // A Commander deck's commander takes one of the 100 slots.
  const deckSlots = size - (commander ? 1 : 0);
  const spellSlots = deckSlots - template.baseLands;
  // The builder pads a thin deck with lands up to the clamp, so that many fewer spells still build.
  const minSpells = deckSlots - template.landFormula.max;
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
  if (spells < minSpells) {
    notes.push(`needs ${plural(minSpells - spells, 'more spell')} for a ${size}-card deck`);
  } else if (!commander && colored < coloredMin) {
    // A commander's identity sets a Commander deck's colors, so only other sizes check the share.
    notes.push(
      `needs ${plural(coloredMin - colored, `more ${label} card`)} (colorless cards alone do not make a ${label} deck)`,
    );
  } else if (!commander && colors.length > 1) {
    // Each color must bring a card of its own; one below minCardsPerColor is a splash,
    // and the builder fills its minimum as far as the pool allows.
    for (const c of colors) {
      if (countCopies(cands, (x) => x.facts.card.colors.includes(c)) === 0)
        notes.push(`needs 1 more ${COLOR_LABELS[c]} card for a ${label} deck`);
    }
  } else if (creatures === spells && creatures >= spellSlots) {
    notes.push('all creatures: the deck will lean on combat with no spells');
  }
  // Lands fill whatever the spells leave, at least the clamp's minimum.
  const landsNeeded = Math.max(template.landFormula.min, deckSlots - spells);
  if (!settings.unlimitedBasics && lands < landsNeeded) {
    notes.push(`needs ${plural(landsNeeded - lands, 'more land')} (basics are tracked)`);
  }
  const possible = !notes.some((n) => n.startsWith('needs '));
  const tribes = tribesOf(cands);
  const archetypes = config.archetypes.archetypes.map((a) =>
    a.kind === 'synergy'
      ? reportSynergy(a, config, cands, template, colors, possible)
      : reportComposition(a, cands, config, template, spells, spellSlots, possible),
  );
  return {
    color,
    colors,
    size,
    candidates: spells,
    colored,
    distinct,
    lands,
    spellSlots,
    minSpells,
    possible,
    archetypes,
    tribes,
    notes,
  };
}

/** Creature types with at least three member copies, most members first. */
export function tribesOf(cands: Candidate[]): TribeReport[] {
  const members = new Map<string, number>();
  let changelings = 0;
  for (const c of cands) {
    if (!c.facts.spell) continue;
    if (c.facts.card.keywords.includes('Changeling')) {
      changelings += c.available;
      continue;
    }
    for (const t of creatureTypes(c.facts.card))
      members.set(t, (members.get(t) ?? 0) + c.available);
  }
  const out: TribeReport[] = [];
  for (const [type, n] of members) {
    if (n + changelings < 3) continue;
    const tag = `typal-${type.toLowerCase()}`;
    const payoffs = countCopies(cands, (c) => c.facts.card.tags.includes(tag));
    out.push({ type, members: n + changelings, payoffs });
  }
  // Tribes with cards that reward them first, then by size.
  return out
    .sort(
      (a, b) =>
        Number(b.payoffs > 0) - Number(a.payoffs > 0) ||
        b.members - a.members ||
        (a.type < b.type ? -1 : 1),
    )
    .slice(0, 15);
}

export interface SecondaryChoice {
  /** Archetype id, or "tribal:<Type>". */
  id: string;
  label: string;
  kind: 'synergy' | 'composition' | 'tribal';
  state: 'viable' | 'near';
  /** What a near miss lacks, in plain words. */
  note: string;
}

/** Display name of a secondary style id. */
export function secondaryLabel(config: BulkBrewConfig, id: string): string {
  if (id.startsWith(TRIBAL)) return `${id.slice(TRIBAL.length)} tribe`;
  return config.archetypes.archetypes.find((a) => a.id === id)?.label ?? id;
}

/** Style ids for tribes start with this, as in "tribal:Dragon". */
export const TRIBAL = 'tribal:';

/**
 * A tribe as a Commander deck's primary style, shaped like a synergy
 * archetype: members are its enablers and cards that reward the type
 * (Tagger `typal-<type>`) its payoffs. It needs twice the secondary tribe
 * counts, as a secondary theme needs half of a primary's.
 */
export function tribalArchetype(type: string, config: BulkBrewConfig): SynergyArchetype {
  const sec = config.builderWeights.secondary;
  const minimums = {} as SynergyArchetype['minimums'];
  for (const size of ['100', '60', '40', '20'] as const) {
    const w = forSize(sec.tribal, Number(size));
    minimums[size] = {
      enablers: Math.ceil(w.enablers / sec.minimumShare),
      payoffs: Math.ceil(w.payoffs / sec.minimumShare),
    };
  }
  return {
    kind: 'synergy',
    id: `${TRIBAL}${type}`,
    label: `${type} tribe`,
    description: `${type} creatures and the cards that reward them.`,
    curveProfile: 'midrange',
    enablers: [],
    payoffs: [],
    minimums,
    synergyWeight: 1,
  };
}

/** Whether a style id names a tribe, and its creature type. */
export function tribeOf(id: string | undefined): string | undefined {
  return id?.startsWith(TRIBAL) ? id.slice(TRIBAL.length) : undefined;
}

export interface CommanderTribe {
  archetype: SynergyArchetype;
  members: number;
  payoffs: number;
  viable: boolean;
}

/**
 * Tribes a commander's own text names (its Tagger `typal-<type>` tags, for
 * types the candidates hold) with their member and payoff copies against
 * the primary minimums. The commander is not one of the candidates.
 */
export function commanderTribes(
  commander: CardRecord,
  cands: Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
): CommanderTribe[] {
  const tags = commander.tags.filter((t) => t.startsWith('typal-')).sort();
  if (tags.length === 0) return [];
  const types = new Map<string, string>();
  for (const c of cands)
    if (c.facts.spell) for (const t of creatureTypes(c.facts.card)) types.set(t.toLowerCase(), t);
  const out: CommanderTribe[] = [];
  for (const tag of tags) {
    const type = types.get(tag.slice(6));
    if (!type) continue;
    const archetype = tribalArchetype(type, config);
    const want = minimumsFor(config, archetype, size);
    const members = countCopies(cands, (c) => inTribe(c.facts.card, type));
    const payoffs = countCopies(cands, (c) => c.facts.card.tags.includes(tag));
    const viable = members >= want.enablers && payoffs >= want.payoffs;
    out.push({ archetype, members, payoffs, viable });
  }
  return out;
}

/** What a tribe lacks as a primary style, in the scan's "needs" words. */
export function tribeShortfall(t: CommanderTribe, config: BulkBrewConfig, size: DeckSize): string {
  const want = minimumsFor(config, t.archetype, size);
  const type = t.archetype.id.slice(TRIBAL.length);
  return [
    t.members < want.enablers
      ? `needs ${plural(want.enablers - t.members, `more ${type} creature`)}`
      : '',
    t.payoffs < want.payoffs
      ? `needs ${plural(want.payoffs - t.payoffs, 'more card')} that reward${want.payoffs - t.payoffs === 1 ? 's' : ''} the ${type} tribe`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Secondary styles that can go with a primary style in one scan: other
 * themes reaching a share of their minimums, the plain shapes under a
 * themed primary, and tribes with enough members and type payoffs. Two
 * shapes do not combine.
 */
export function secondaryChoices(
  scan: ScanReport,
  config: BulkBrewConfig,
  primaryId: string,
): SecondaryChoice[] {
  if (!scan.possible) return [];
  const primaryTribe = tribeOf(primaryId);
  const primary =
    config.archetypes.archetypes.find((a) => a.id === primaryId) ??
    (primaryTribe ? tribalArchetype(primaryTribe, config) : undefined);
  if (!primary) return [];
  const sec = config.builderWeights.secondary;
  const out: SecondaryChoice[] = [];
  const judge = (short: number) =>
    short <= 0 ? 'viable' : short <= sec.nearMiss ? 'near' : undefined;
  for (const a of config.archetypes.archetypes) {
    if (a.id === primaryId) continue;
    if (a.kind === 'composition') {
      // A shape only follows a themed primary, and only where the shape itself can be built.
      if (primary.kind !== 'synergy') continue;
      const report = scan.archetypes.find((r) => r.archetype === a.id);
      if (report?.viable)
        out.push({ id: a.id, label: a.label, kind: 'composition', state: 'viable', note: '' });
      continue;
    }
    const report = scan.archetypes.find((r) => r.archetype === a.id);
    if (!report) continue;
    if (a.colors && !scan.colors.some((c) => a.colors!.includes(c))) continue;
    const wantE = Math.ceil(minimumsFor(config, a, scan.size).enablers * sec.minimumShare);
    const wantP = Math.ceil(minimumsFor(config, a, scan.size).payoffs * sec.minimumShare);
    const shortE = Math.max(0, wantE - report.enablers.have);
    const shortP = Math.max(0, wantP - report.payoffs.have);
    const state = judge(shortE + shortP);
    if (!state) continue;
    const note = [
      shortE > 0 ? `needs ${shortE} more ${a.label} enabler${shortE === 1 ? '' : 's'}` : '',
      shortP > 0 ? `needs ${shortP} more ${a.label} payoff${shortP === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    out.push({ id: a.id, label: a.label, kind: 'synergy', state, note });
  }
  const want = forSize(sec.tribal, scan.size);
  for (const t of scan.tribes ?? []) {
    // A type with no cards that reward it is just a crowd of bodies, not a tribe.
    if (t.payoffs === 0 || t.type === primaryTribe) continue;
    const shortE = Math.max(0, want.enablers - t.members);
    const shortP = Math.max(0, want.payoffs - t.payoffs);
    const state = judge(shortE + shortP);
    if (!state) continue;
    const note = [
      shortE > 0 ? `needs ${shortE} more ${t.type} creature${shortE === 1 ? '' : 's'}` : '',
      shortP > 0
        ? `needs ${shortP} more card${shortP === 1 ? '' : 's'} that reward${shortP === 1 ? 's' : ''} the ${t.type} tribe`
        : '',
    ]
      .filter(Boolean)
      .join(', ');
    out.push({ id: `tribal:${t.type}`, label: `${t.type} tribe`, kind: 'tribal', state, note });
  }
  return out;
}

export function scanPool(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colors: Color | readonly Color[],
): ScanReport {
  return scanCandidates(
    listCandidates(pool, index, config, settings, colors, size),
    config,
    settings,
    size,
    colors,
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
