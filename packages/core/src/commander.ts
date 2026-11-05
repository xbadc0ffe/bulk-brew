// Commander: which pool cards can lead a 100-card deck, and how promising
// each one is. Rules follow the Comprehensive Rules, section 903: the
// commander is a legendary creature, Vehicle, or Spacecraft with power and
// toughness, or a card that says it can be your commander; every card's
// color identity fits inside the commander's; one copy of each card except
// basic lands and cards whose text allows more.

import type { BulkBrewConfig } from './config.ts';
import { BuildError, buildDeck, styleCounts } from './builder.ts';
import { factsFor, listCandidates, type Candidate } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import { commanderTribes, scanPool, secondaryLabel, tribeOf } from './scan.ts';
import type { Color, Pool, ScanReport, Settings } from './types.ts';
import { normalizeColors } from './colors.ts';
import { landColors } from './lands.ts';
import { canBeCommander } from './matchers.ts';

export type CommanderTier = 'top' | 'good' | 'possible';

export interface CommanderCandidate {
  id: string;
  name: string;
  colors: Color[];
  tier: CommanderTier;
  /** Higher is more promising; orders candidates inside a tier. */
  score: number;
  /** Styles the commander itself enables or rewards that the pool can build. */
  styles: { id: string; label: string }[];
  /** The styles it rewards (a payoff for them), tribes included; the rest of `styles` it only feeds. */
  leads: { id: string; label: string }[];
  /** Synergy archetypes its text rewards or feeds, whether or not the pool can build them. */
  supports: string[];
  /** Tribes its text names that the pool can build as the primary style, such as "tribal:Dragon". */
  primaryTribes: string[];
  /** Plain-language reasons for the tier. */
  reasons: string[];
  /** Nonland cards in the pool that fit the commander's colors. */
  depth: number;
  /** Whether those cards are enough for the 99. */
  enough: boolean;
  /** Mana value of the commander. */
  mv: number;
  /** Lands in the pool that make two or more of its colors. */
  fixers: number;
  /** Whether those lands are enough for its color count (always true under three colors). */
  fixed: boolean;
}

/** Nonbasic lands in the pool that make two or more of the colors directly or by fetching. */
function fixingLands(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  colors: Color[],
): number {
  let n = 0;
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (!card || !card.types.includes('land') || entry.qty <= 0) continue;
    if (!card.identity.every((c) => colors.includes(c))) continue;
    if (landColors(card, colors, 100).length >= 2) n += Math.min(entry.qty, 1);
  }
  return n;
}

/**
 * Commanders in the pool, most promising first. Top commanders reward a
 * style the pool can build (or a creature type it has), sit on a deep pool,
 * cost two to five, and, at three colors or more, have fixing lands to
 * match. Colorless commanders are left out: a deck of basics cannot make
 * the colorless mana their colorless cards need.
 */
export function commanderCandidates(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  /** Scans of each commander's colors at 100, keyed by color letters such as "WU"; filled while listing. */
  scans: Map<string, ScanReport> = new Map(),
): CommanderCandidate[] {
  const out: CommanderCandidate[] = [];
  const rarities = settings.rarities?.length ? new Set(settings.rarities) : undefined;
  const candsByColors = new Map<string, Candidate[]>();
  for (const entry of Object.values(pool.entries)) {
    if (entry.qty <= 0) continue;
    const card = index.get(entry.cardId);
    if (!card || !canBeCommander(card)) continue;
    if (card.unset && !settings.includeUnsets) continue;
    if (rarities && card.rarity && !rarities.has(card.rarity)) continue;
    const colors = normalizeColors(card.identity);
    if (colors.length === 0) continue;
    const key = colors.join('');
    let scan = scans.get(key);
    if (!scan) {
      scan = scanPool(pool, index, config, settings, 100, colors);
      scans.set(key, scan);
    }
    const facts = factsFor(index, config, card);
    // Styles the commander rewards (payoff) say "build around me"; ones it only feeds are weaker.
    const leads: { id: string; label: string }[] = [];
    const feeds: { id: string; label: string }[] = [];
    for (const r of scan.archetypes) {
      if (!r.viable || r.kind !== 'synergy') continue;
      if (facts.payoffOf.includes(r.archetype)) leads.push({ id: r.archetype, label: r.label });
      else if (facts.enablerOf.includes(r.archetype))
        feeds.push({ id: r.archetype, label: r.label });
    }
    for (const t of scan.tribes ?? []) {
      if (card.tags.includes(`typal-${t.type.toLowerCase()}`))
        leads.push({ id: `tribal:${t.type}`, label: secondaryLabel(config, `tribal:${t.type}`) });
    }
    // A tribe the pool can build as the primary style leads even when it is not among the largest.
    let cands = candsByColors.get(key);
    if (!cands) {
      cands = listCandidates(pool, index, config, settings, colors, 100);
      candsByColors.set(key, cands);
    }
    const named = card.tags.some((t) => t.startsWith('typal-'));
    const others = named ? cands.filter((c) => c.facts.card.id !== card.id) : [];
    const primaryTribes = commanderTribes(card, others, config, 100)
      .filter((t) => t.viable)
      .map((t) => t.archetype.id);
    for (const id of primaryTribes)
      if (!leads.some((l) => l.id === id)) leads.push({ id, label: secondaryLabel(config, id) });
    const styles = [...leads, ...feeds];
    const supports = config.archetypes.archetypes
      .filter(
        (a) =>
          a.kind === 'synergy' && (facts.payoffOf.includes(a.id) || facts.enablerOf.includes(a.id)),
      )
      .map((a) => a.id);
    const depth = scan.distinct;
    // Three or more colors need lands that make several of them.
    const fixers = fixingLands(pool, index, config, colors);
    const fixed = colors.length < 3 || fixers >= 3 * (colors.length - 1);
    const reasons: string[] = [];
    const deep = depth >= config.builderWeights.commander.deepPool;
    // The scan counts the commander among its own candidates; the 99 cannot.
    const enough = scan.possible && scan.candidates - 1 >= scan.minSpells;
    const cheap = card.mv >= 2 && card.mv <= 5;
    if (!enough) reasons.push(`${depth} cards in its colors, not enough for 99`);
    else reasons.push(`${depth} cards in its colors`);
    if (leads.length > 0) reasons.push(`rewards ${leads.map((x) => x.label).join(', ')}`);
    else if (feeds.length > 0) reasons.push(`feeds ${feeds.map((x) => x.label).join(', ')}`);
    if (!cheap) reasons.push(`costs ${card.mv}`);
    if (!fixed) reasons.push(`${fixers} lands in the pool make two or more of its colors`);
    const tier: CommanderTier =
      enough && deep && cheap && fixed && leads.length > 0
        ? 'top'
        : enough && (leads.length > 0 || feeds.length > 0 || deep)
          ? 'good'
          : 'possible';
    const score =
      Math.min(2, depth / config.builderWeights.commander.deepPool) +
      (leads.length > 0 ? 1 + 0.25 * (leads.length - 1) : feeds.length > 0 ? 0.5 : 0) +
      (cheap ? 0.5 : 0) +
      (fixed ? 0 : -1);
    out.push({
      id: card.id,
      name: card.name,
      colors,
      tier,
      score: Math.round(score * 100) / 100,
      styles,
      leads,
      supports,
      primaryTribes,
      reasons,
      depth,
      enough,
      mv: card.mv,
      fixers,
      fixed,
    });
  }
  // On a big pool most commanders clear the bar; keep "top" to the best quarter of them.
  const qualified = out
    .filter((c) => c.tier === 'top')
    .sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));
  const keep = Math.max(5, Math.ceil(out.length / 4));
  for (const c of qualified.slice(keep)) c.tier = 'good';
  const order: Record<CommanderTier, number> = { top: 0, good: 1, possible: 2 };
  return out.sort(
    (a, b) =>
      order[a.tier] - order[b.tier] ||
      b.score - a.score ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

/**
 * Whether a commander leads the style: its text rewards or feeds a synergy
 * style, or names the tribe. Plain shapes such as Midrange suit any commander.
 */
export function commanderSuits(
  candidate: CommanderCandidate,
  style: string,
  config: BulkBrewConfig,
): boolean {
  if (tribeOf(style)) return candidate.leads.some((l) => l.id === style);
  const archetype = config.archetypes.archetypes.find((a) => a.id === style);
  if (!archetype) return false;
  return archetype.kind === 'composition' || candidate.supports.includes(style);
}

/**
 * The commanders to offer for picked colors and a style. Colors keep the
 * commanders whose colors all come from the picked ones (every commander
 * when none are picked), the ones that use every picked color first, as
 * deck options that use every picked color rank first. A style keeps the
 * commanders that lead it. The list order is otherwise kept.
 */
export function filterCommanders(
  list: readonly CommanderCandidate[],
  colors: readonly Color[],
  style: string | undefined,
  config: BulkBrewConfig,
): CommanderCandidate[] {
  const picked = new Set(colors);
  const kept = list.filter(
    (c) =>
      (picked.size === 0 || c.colors.every((x) => picked.has(x))) &&
      (!style || commanderSuits(c, style, config)),
  );
  if (picked.size < 2) return kept;
  const full = (c: CommanderCandidate) => (c.colors.length === picked.size ? 0 : 1);
  // Array sort is stable, so each group keeps the list order.
  return kept.sort((a, b) => full(a) - full(b));
}

/**
 * Whether the pool can build the style under this commander: the deck keeps
 * the style and reaches its enabler and payoff minimums. This builds a whole
 * deck, so callers check one commander at a time.
 */
export function commanderCanBuild(
  commander: string,
  style: string,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): boolean {
  try {
    const { deck } = buildDeck(
      { size: 100, colors: [], commander, style, requireStyle: true, settings },
      pool,
      index,
      config,
    );
    if (deck.archetype !== style) return false;
    const theme = styleCounts(deck, index, config).find((s) => s.id === style);
    return (
      !theme ||
      (theme.enablers.have >= theme.enablers.want && theme.payoffs.have >= theme.payoffs.want)
    );
  } catch (err) {
    if (err instanceof BuildError) return false;
    throw err;
  }
}
