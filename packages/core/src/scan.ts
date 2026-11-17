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
import { creditEarned, type DeckSupply } from './card-needs.ts';
import { factsFor, listCandidates, type Candidate, type CardFacts } from './candidates.ts';
import { colorsLabel, isCommanderSize, normalizeColors } from './colors.ts';
import { growViability, namedTribes, poolSupply, type StyleViability } from './grow.ts';
import { creatureTypes, inTribe, typalTag } from './matchers.ts';
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
  supply: DeckSupply,
): ArchetypeReport {
  const quotas = effectiveQuotas(template, a);
  const notes: string[] = [];
  let margin = ratio(spells, spellSlots) - 1;
  for (const [roleId, q] of Object.entries(quotas)) {
    if (q.min <= 0) continue;
    // A role counts only on cards that could earn it with what the pool supplies.
    const have = countCopies(
      cands,
      (c) => c.facts.roles.includes(roleId) && creditEarned(c.facts.card, roleId, supply, config),
    );
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

/** Whether a deck of this size and these colors can be built at all, and what the pool lacks. */
export function scanPossible(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colors: readonly Color[],
): { possible: boolean; notes: string[] } {
  const { possible, notes } = poolCounts(cands, config, settings, size, colors);
  return { possible, notes };
}

function poolCounts(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colors: readonly Color[],
) {
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
      if (countCopies([...cands], (x) => x.facts.card.colors.includes(c)) === 0)
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
  return { template, spells, colored, distinct, lands, spellSlots, minSpells, notes, possible };
}

/** What a style lacks when the size cannot be built at all. */
function tooFew(size: DeckSize): string {
  return `too few cards for a ${size}-card deck`;
}

/**
 * The rules' view of one style, for the sizes the grow builder builds. A size
 * that cannot be built makes no style viable, so the apps read one field; the
 * grow builder plans every plain shape whenever the size can be built.
 */
function rulesView(
  a: Archetype,
  r: StyleViability | undefined,
  possible: boolean,
  size: DeckSize,
): ArchetypeReport['rules'] {
  const impossible = tooFew(size);
  if (a.kind !== 'synergy')
    return {
      viable: possible,
      margin: possible ? 1 : 0,
      lacks: possible ? '' : impossible,
      floors: [],
    };
  if (!r) return undefined;
  return themeView(r, possible, size);
}

function themeView(
  r: StyleViability,
  possible: boolean,
  size: DeckSize,
): NonNullable<ArchetypeReport['rules']> {
  return possible
    ? { viable: r.viable, margin: r.margin, lacks: r.lacks, floors: r.floors }
    : { viable: false, margin: 0, lacks: tooFew(size), floors: r.floors };
}

/**
 * The tribes a commander names, against the tribe rules' floors over the
 * candidates (the commander left out of them and credited once), as the
 * grow builder plans them.
 */
function leadTribesOf(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
  colors: readonly Color[],
  commander: CardFacts,
  possible: boolean,
  supply?: DeckSupply,
): ScanReport['leadTribes'] {
  const tribes = namedTribes(config, commander.card);
  if (tribes.length === 0) return undefined;
  const own = cands.filter((c) => c.facts.card.id !== commander.card.id);
  const rules = growViability(own, config, size, commander, colors, supply, tribes, true);
  return tribes.flatMap((style) =>
    rules[style]
      ? [
          {
            style,
            label: secondaryLabel(config, style),
            rules: themeView(rules[style], possible, size),
          },
        ]
      : [],
  );
}

/**
 * A color set's scan at 100 (`base`, the commander among its candidates) as
 * that commander leads it, as scanCandidates with the commander counts it:
 * what the size can build is counted again with the commander left out of
 * the 99. The color set counts the commander as one candidate, one copy, at
 * the same pool supply, so while `grow.commanderCredit` is 1 its rules' view
 * is the commander's own; at another credit it is counted again. The
 * classic fields stay the color set's. Cheap enough for every commander of
 * a big pool.
 */
export function scanUnderCommander(
  base: ScanReport,
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  settings: Settings,
  commander: CardFacts,
): ScanReport {
  const own = cands.filter((c) => c.facts.card.id !== commander.card.id);
  const { spells, colored, distinct, lands, notes, possible } = poolCounts(
    own,
    config,
    settings,
    base.size,
    base.colors,
  );
  const copies = cands.find((c) => c.facts.card.id === commander.card.id)?.preferred ?? 0;
  const rules =
    copies === config.builderWeights.grow.commanderCredit
      ? undefined
      : growViability(
          own,
          config,
          base.size,
          commander,
          base.colors,
          poolSupply(own, config, base.size, base.colors, commander.card),
        );
  const archetypes = base.archetypes.map((report) => {
    const a = config.archetypes.archetypes.find((x) => x.id === report.archetype)!;
    // Fewer candidates can only make the size harder to build, never easier.
    const view = rules
      ? rulesView(a, rules[a.id], possible, base.size)
      : report.rules && !possible
        ? { viable: false, margin: 0, lacks: tooFew(base.size), floors: report.rules.floors }
        : report.rules;
    const { rules: _old, ...rest } = report;
    return view ? { ...rest, rules: view } : rest;
  });
  const leadTribes = leadTribesOf(own, config, base.size, base.colors, commander, possible);
  const { leadTribes: _none, ...shared } = base;
  return {
    ...shared,
    candidates: spells,
    colored,
    distinct,
    lands,
    notes,
    possible,
    archetypes,
    ...(leadTribes ? { leadTribes } : {}),
  };
}

/**
 * Scan an already computed candidate list. At 100 with a commander, the
 * commander leads rather than counting as one of the 99: it is left out of
 * the candidates and credited once, as the grow builder credits it.
 */
export function scanCandidates(
  candsIn: Candidate[],
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colorsIn: Color | readonly Color[],
  commander?: CardFacts,
): ScanReport {
  const colors = normalizeColors(typeof colorsIn === 'string' ? [colorsIn] : colorsIn);
  const color = colors[0]!;
  const cands = commander ? candsIn.filter((c) => c.facts.card.id !== commander.card.id) : candsIn;
  const { template, spells, colored, distinct, lands, spellSlots, minSpells, notes, possible } =
    poolCounts(cands, config, settings, size, colors);
  const tribes = tribesOf(cands);
  // What the pool could supply, read once for the theme rules' view and the shapes' role counts.
  const supply = poolSupply(cands, config, size, colors, commander?.card);
  // The theme rules' view, as the grow builder counts the pool; the old fields stay as they were.
  // Under a commander, its named tribes get the same view (leadTribes).
  const rules = growViability(cands, config, size, commander, colors, supply);
  const archetypes = config.archetypes.archetypes.map((a) => {
    const report =
      a.kind === 'synergy'
        ? reportSynergy(a, config, cands, template, colors, possible)
        : reportComposition(a, cands, config, template, spells, spellSlots, possible, supply);
    const view = rules && rulesView(a, rules[a.id], possible, size);
    if (view) report.rules = view;
    return report;
  });
  const leadTribes =
    commander && isCommanderSize(size)
      ? leadTribesOf(cands, config, size, colors, commander, possible, supply)
      : undefined;
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
    ...(leadTribes ? { leadTribes } : {}),
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
    const tag = typalTag(type);
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
 * counts, as a secondary theme needs half of a primary's. The classic
 * builder reads these minimums; the grow builder reads the tribe rules'
 * floors and takes only the label from here.
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
 * the primary minimums. The commander is not one of the candidates. This is
 * the classic builder's count, for a tribe with a secondary style; the grow
 * builder and the scan's `leadTribes` read the tribe rules.
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
    if (c.facts.spell) for (const t of creatureTypes(c.facts.card)) types.set(typalTag(t), t);
  const out: CommanderTribe[] = [];
  for (const tag of tags) {
    const type = types.get(tag);
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

/** Scan a pool for one size and color set; at 100, under the commander when given (see scanCandidates). */
export function scanPool(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  colors: Color | readonly Color[],
  commander?: CardRecord,
): ScanReport {
  return scanCandidates(
    listCandidates(pool, index, config, settings, colors, size),
    config,
    settings,
    size,
    colors,
    commander && isCommanderSize(size) ? factsFor(index, config, commander) : undefined,
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
