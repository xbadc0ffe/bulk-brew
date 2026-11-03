// Automatic deck quality metrics for the evaluation harness. Pure: no Node
// APIs, so tests can feed hand-made decks. The numbers approximate the
// rubric in eval/rubric.md; they catch regressions, they do not judge taste.

import {
  COLORS,
  curveProfileFor,
  curveTargets,
  effectiveCurveProfile,
  effectiveQuotas,
  effectiveTypeMix,
  factsFor,
  isFillerPick,
  manaCostsOf,
  maxCopiesFor,
  templateFor,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
  type Deck,
  type Settings,
} from '@bulk-brew/core';

export interface RoleMetric {
  have: number;
  min: number;
  target: number;
}

export interface DeckMetrics {
  /** Cards in the deck including basics. */
  total: number;
  exactSize: boolean;
  copyLimitOk: boolean;
  colorLegal: boolean;
  spells: number;
  lands: number;
  nonbasics: number;
  landMin: number;
  landMax: number;
  landsInClamp: boolean;
  averageMv: number;
  /** Spell copies per mana value bucket 0 through 7-plus. */
  curve: number[];
  /** Targets per bucket 1 through 7 from the effective curve profile (index 0 unused). */
  curveTargets: number[];
  /** Sum of absolute bucket differences beyond the template tolerance. */
  curveDeviation: number;
  creatureShare: number;
  instantSorceryShare: number;
  noncreaturePermanentShare: number;
  typeMixOk: boolean;
  roles: Record<string, RoleMetric>;
  rolesBelowMin: number;
  rolesBelowTarget: number;
  /** Sum over synergy rules of min(enablers, payoffs). */
  synergyPairs: number;
  /** Rule weight times pairs, divided by spell count. */
  synergyDensity: number;
  /** Copies picked as filler, or for the curve without filling a role (see isFillerPick). */
  filler: number;
  castable: boolean;
  /** Names of spells whose pips cannot be paid with basics of the deck color. */
  offenders: string[];
}

function payable(cost: string, color: Color): boolean {
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const sym = m[1]!.toUpperCase();
    // {C} needs colorless mana specifically, which basics of a color cannot make.
    if (sym === 'C') return false;
    if (sym.includes('/')) {
      const parts = sym.split('/');
      if (parts.includes('P')) continue;
      if (parts.some((p) => p === color || /^\d+$/.test(p))) continue;
      return false;
    }
    if ((COLORS as readonly string[]).includes(sym) && sym !== color) return false;
  }
  return true;
}

/**
 * Whether every cost on the card, on every face, can be paid by basics of the
 * deck color. Hybrid symbols pass when one side fits; Phyrexian symbols can be
 * paid with life; generic and X costs always pass.
 */
export function castableIn(card: CardRecord, color: Color): boolean {
  return manaCostsOf(card).every((cost) => payable(cost, color));
}

function round(n: number, places = 3): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function deckMetrics(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): DeckMetrics {
  const template = templateFor(config, deck.size);
  const archetype = config.archetypes.archetypes.find((a) => a.id === deck.archetype);
  const quotas = effectiveQuotas(template, archetype);
  const typeMix = effectiveTypeMix(template, archetype);
  const shape = curveProfileFor(config, effectiveCurveProfile(template, archetype)).shape;
  const limit = maxCopiesFor(settings, config, deck.size);
  const quotaRoles = new Set(Object.keys(quotas));

  let spells = 0;
  let nonbasics = 0;
  let mvTotal = 0;
  let creatures = 0;
  let instSorc = 0;
  let ncPerm = 0;
  let filler = 0;
  let copyLimitOk = true;
  let colorLegal = true;
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  const roleHave = new Map<string, number>();
  const ruleE = new Map<string, number>();
  const ruleP = new Map<string, number>();
  const offenders: string[] = [];
  let total = 0;

  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card) continue;
    total += dc.qty;
    if (dc.qty > limit) copyLimitOk = false;
    if (!card.identity.every((c) => c === deck.color)) colorLegal = false;
    const f = factsFor(index, config, card);
    if (f.spell) {
      spells += dc.qty;
      mvTotal += card.mv * dc.qty;
      curve[f.bucket]! += dc.qty;
      if (f.creature) creatures += dc.qty;
      if (f.instantOrSorcery) instSorc += dc.qty;
      if (f.noncreaturePermanent) ncPerm += dc.qty;
      if (
        isFillerPick(
          dc.why,
          f.roles.some((r) => quotaRoles.has(r)),
        )
      )
        filler += dc.qty;
      for (const r of f.roles) roleHave.set(r, (roleHave.get(r) ?? 0) + dc.qty);
      for (const r of f.ruleEnabler) ruleE.set(r, (ruleE.get(r) ?? 0) + dc.qty);
      for (const r of f.rulePayoff) ruleP.set(r, (ruleP.get(r) ?? 0) + dc.qty);
      if (!castableIn(card, deck.color)) offenders.push(card.name);
    } else if (f.land) {
      nonbasics += dc.qty;
    }
  }
  const basics = Object.values(deck.basics).reduce((n, q) => n + (q ?? 0), 0);
  total += basics;
  const lands = nonbasics + basics;

  const targets = curveTargets(shape, spells);
  let curveDeviation = 0;
  for (let b = 1; b <= 7; b++) {
    const have = curve[b]! + (b === 1 ? curve[0]! : 0);
    curveDeviation += Math.max(0, Math.abs(have - targets[b]!) - template.tolerances.curve);
  }

  const share = (n: number) => (spells > 0 ? n / spells : 0);
  const tol = template.tolerances.typeMix;
  const creatureShare = share(creatures);
  const instantSorceryShare = share(instSorc);
  const noncreaturePermanentShare = share(ncPerm);
  const typeMixOk =
    creatureShare >= typeMix.creatureMin - tol &&
    creatureShare <= typeMix.creatureMax + tol &&
    instantSorceryShare >= typeMix.instantSorceryMin - tol &&
    noncreaturePermanentShare <= typeMix.noncreaturePermanentMax + tol;

  const roles: Record<string, RoleMetric> = {};
  let rolesBelowMin = 0;
  let rolesBelowTarget = 0;
  for (const [id, q] of Object.entries(quotas)) {
    const have = roleHave.get(id) ?? 0;
    roles[id] = { have, min: q.min, target: q.target };
    if (have < q.min) rolesBelowMin++;
    if (have < q.target) rolesBelowTarget++;
  }

  let synergyPairs = 0;
  let weighted = 0;
  for (const rule of config.synergyRules.rules) {
    const pairs = Math.min(ruleE.get(rule.id) ?? 0, ruleP.get(rule.id) ?? 0);
    synergyPairs += pairs;
    weighted += rule.weight * pairs;
  }

  return {
    total,
    exactSize: total === deck.size,
    copyLimitOk,
    colorLegal,
    spells,
    lands,
    nonbasics,
    landMin: template.landFormula.min,
    landMax: template.landFormula.max,
    landsInClamp: lands >= template.landFormula.min && lands <= template.landFormula.max,
    averageMv: round(spells > 0 ? mvTotal / spells : 0, 2),
    curve,
    curveTargets: targets,
    curveDeviation,
    creatureShare: round(creatureShare),
    instantSorceryShare: round(instantSorceryShare),
    noncreaturePermanentShare: round(noncreaturePermanentShare),
    typeMixOk,
    roles,
    rolesBelowMin,
    rolesBelowTarget,
    synergyPairs,
    synergyDensity: round(spells > 0 ? weighted / spells : 0),
    filler,
    castable: offenders.length === 0,
    offenders,
  };
}
