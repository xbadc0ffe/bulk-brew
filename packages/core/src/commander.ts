// Commander: which pool cards can lead a 100-card deck, and how promising
// each one is. Rules follow the Comprehensive Rules, section 903: the
// commander is a legendary creature, Vehicle, or Spacecraft with power and
// toughness, or a card that says it can be your commander; every card's
// color identity fits inside the commander's; one copy of each card except
// basic lands and cards whose text allows more.

import type { BulkBrewConfig } from './config.ts';
import { BuildError, buildDeck, styleCounts } from './builder.ts';
import type { DeckSupply } from './card-needs.ts';
import { factsFor, listCandidates, type Candidate } from './candidates.ts';
import { cardThemeSides } from './deck-themes.ts';
import { poolSupply, poolThemeJobs, themeStyles } from './grow.ts';
import type { CardIndex } from './pack.ts';
import { scanCandidates, scanUnderCommander, tribeOf } from './scan.ts';
import type { Color, Pool, ScanReport, Settings } from './types.ts';
import { normalizeColors } from './colors.ts';
import { draftOnly, landColors } from './lands.ts';
import { canBeCommander } from './matchers.ts';

export type CommanderTier = 'top' | 'good' | 'possible';

export interface CommanderCandidate {
  id: string;
  name: string;
  colors: Color[];
  tier: CommanderTier;
  /** Higher is more promising; orders candidates inside a tier. */
  score: number;
  /** Styles the commander itself enables or rewards that the pool can build under it. */
  styles: { id: string; label: string }[];
  /** The styles it rewards (a payoff job in the theme rules), tribes included; the rest of `styles` it only feeds (setup). */
  leads: { id: string; label: string }[];
  /** Synergy archetypes the theme rules give it a setup or payoff job for, whether or not the pool can build them. */
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
    if (!card.identity.every((c) => colors.includes(c)) || draftOnly(card)) continue;
    if (landColors(card, colors, 100, config).length >= 2) n += Math.min(entry.qty, 1);
  }
  return n;
}

/**
 * Commanders in the pool, most promising first. Top commanders reward a
 * style the pool can build (or a creature type it has), sit on a deep pool,
 * cost two to five, and, at three colors or more, have fixing lands to
 * match. Colorless commanders are left out: a deck of basics cannot make
 * the colorless mana their colorless cards need. A commander leads the
 * themes its own text pays off by the theme rules and feeds the ones it is
 * setup for, where the pool can build them under it (the scan, as the
 * builder counts the commander).
 */
export function commanderCandidates(
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  /** Each commander's own scan at 100, keyed by its card id; filled while listing. */
  scans: Map<string, ScanReport> = new Map(),
): CommanderCandidate[] {
  const out: CommanderCandidate[] = [];
  const rarities = settings.rarities?.length ? new Set(settings.rarities) : undefined;
  // Candidates and the classic scan once per color identity; each commander's own view from them.
  const byColors = new Map<string, { cands: Candidate[]; base: ScanReport; supply: DeckSupply }>();
  for (const entry of Object.values(pool.entries)) {
    if (entry.qty <= 0) continue;
    const card = index.get(entry.cardId);
    if (!card || !canBeCommander(card)) continue;
    if (card.unset && !settings.includeUnsets) continue;
    if (rarities && card.rarity && !rarities.has(card.rarity)) continue;
    const colors = normalizeColors(card.identity);
    if (colors.length === 0) continue;
    const key = colors.join('');
    let shared = byColors.get(key);
    if (!shared) {
      const cands = listCandidates(pool, index, config, settings, colors, 100);
      shared = {
        cands,
        base: scanCandidates(cands, config, settings, 100, colors),
        supply: poolSupply(cands, config, 100, colors),
      };
      byColors.set(key, shared);
    }
    const { cands } = shared;
    const facts = factsFor(index, config, card);
    let scan = scans.get(card.id);
    if (!scan) {
      scan = scanUnderCommander(shared.base, cands, config, settings, facts);
      scans.set(card.id, scan);
    }
    // Styles the commander rewards (payoff) say "build around me"; ones it only feeds are weaker.
    // Its jobs count as the builder credits them: only where the pool pays for their needs.
    const sides = cardThemeSides(config, facts, 100);
    // The color set's supply holds the commander once, as a single candidate copy does.
    const single = cands.some((c) => c.facts.card.id === card.id && c.preferred === 1);
    const supply = single ? shared.supply : poolSupply(cands, config, 100, colors, card);
    const paid = poolThemeJobs(config, facts, 100, supply);
    const styleIds = themeStyles(config);
    const leads: { id: string; label: string }[] = [];
    const feeds: { id: string; label: string }[] = [];
    for (const r of scan.archetypes) {
      if (!r.rules?.viable || r.kind !== 'synergy') continue;
      const side = paid[styleIds.indexOf(r.archetype)]?.as;
      if (side === 'payoff') leads.push({ id: r.archetype, label: r.label });
      else if (side === 'setup') feeds.push({ id: r.archetype, label: r.label });
    }
    // The tribes its text names lead too, as the builder plans them: viable ones as the
    // primary style, short ones offered down to grow.nearMargin of the tribe rules' floors.
    const near = config.builderWeights.grow.nearMargin;
    const primaryTribes: string[] = [];
    for (const t of scan.leadTribes ?? []) {
      if (t.rules.viable) primaryTribes.push(t.style);
      if (t.rules.viable || t.rules.margin >= near) leads.push({ id: t.style, label: t.label });
    }
    const styles = [...leads, ...feeds];
    const supports = sides.map((s) => s.style);
    // Nonland cards in its colors, the commander among them.
    const depth = cands.reduce((n, c) => n + (c.facts.spell ? 1 : 0), 0);
    // Three or more colors need lands that make several of them.
    const fixers = fixingLands(pool, index, config, colors);
    const fixed = colors.length < 3 || fixers >= 3 * (colors.length - 1);
    const reasons: string[] = [];
    const deep = depth >= config.builderWeights.commander.deepPool;
    // The scan leaves the commander out of the 99 it counts.
    const enough = scan.possible;
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
 * Whether the pool can build the style under this commander: the deck the
 * options would build keeps the style (the grow builder answers a theme or
 * tribe the pool falls short of with another style), and a classic deck
 * reaches its enabler and payoff minimums. This builds a whole deck, so
 * callers check one commander at a time.
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
    // Asked for by name, as the options build it.
    const { deck, explanation } = buildDeck(
      { size: 100, colors: [], commander, style, requireStyle: true, settings },
      pool,
      index,
      config,
    );
    if (deck.archetype !== style || explanation.nearest) return false;
    // The grow builder builds a theme only to its floors, and answers a short one with another style.
    if (explanation.builder === 'grow') return true;
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
