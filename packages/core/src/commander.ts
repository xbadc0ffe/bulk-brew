// Commander: which pool cards can lead a 100-card deck, and how promising
// each one is. Rules follow the Comprehensive Rules, section 903: the
// commander is a legendary creature, Vehicle, or Spacecraft with power and
// toughness, or a card that says it can be your commander; every card's
// color identity fits inside the commander's; one copy of each card except
// basic lands and cards whose text allows more.

import type { BulkBrewConfig } from './config.ts';
import { factsFor } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import { scanPool, secondaryLabel } from './scan.ts';
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
  /** Plain-language reasons for the tier. */
  reasons: string[];
  /** Nonland cards in the pool that fit the commander's colors. */
  depth: number;
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
): CommanderCandidate[] {
  const out: CommanderCandidate[] = [];
  const scans = new Map<string, ScanReport>();
  const rarities = settings.rarities?.length ? new Set(settings.rarities) : undefined;
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
    const styles = [...leads, ...feeds];
    const depth = scan.distinct;
    // Three or more colors need lands that make several of them.
    const fixers = fixingLands(pool, index, config, colors);
    const fixed = colors.length < 3 || fixers >= 3 * (colors.length - 1);
    const reasons: string[] = [];
    const deep = depth >= config.builderWeights.commander.deepPool;
    // The scan counts the commander among its own candidates; the 99 cannot.
    const enough = scan.possible && scan.candidates - 1 >= scan.spellSlots;
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
      reasons,
      depth,
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
