// Setup and payoff definitions for prototype B (docs/review/proto-b.md). Each
// card has at most one job per style, counted once. Two sources share one
// shape, so the same algorithm runs on either and the comparison separates
// definitions from algorithm: the review's theme rules (b-grow) and the live
// config's style matchers (b-oldrules).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  colorClassOf,
  COLOR_CLASSES,
  factsFor,
  inTribe,
  isLand,
  minimumsFor,
  tribalArchetype,
  type BulkBrewConfig,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type ColorClass,
  type SynergyArchetype,
} from '@bulk-brew/core';
import {
  compileThemeRules,
  DEFAULT_THEME_RULES_FILE,
  EXAMPLE_THEME_RULES,
  loadThemeRules,
  matchCard,
  type ThemeFloor,
  type ThemeRules,
  type ThemeSize,
} from '../../theme-rules.ts';

export interface Job {
  as: 'setup' | 'payoff';
  job: string;
  weight: number;
  repeatable: boolean;
}

/** Setup and payoff in a set of cards, each card once, in every unit a floor can name. */
export interface Tally {
  setupUnits: number;
  setupWeight: number;
  repeatable: number;
  payoffUnits: number;
  payoffWeight: number;
}

export const emptyTally = (): Tally => ({
  setupUnits: 0,
  setupWeight: 0,
  repeatable: 0,
  payoffUnits: 0,
  payoffWeight: 0,
});

export function addJob(t: Tally, job: Job | undefined, copies: number): void {
  if (!job) return;
  const units = Math.min(job.weight, 1) * copies;
  if (job.as === 'setup') {
    t.setupUnits += units;
    t.setupWeight += job.weight * copies;
    if (job.repeatable) t.repeatable += copies;
  } else {
    t.payoffUnits += units;
    t.payoffWeight += job.weight * copies;
  }
}

/** Per style, the mean tally of one bulk card of each color class. */
export type BulkBaseline = Map<string, Record<ColorClass, Tally>>;

export interface ThemeDefs {
  /** Where the definitions came from, for deck notes. */
  name: string;
  /** What plain bulk holds of each style, when computed (withBulkBaseline). */
  bulk?: BulkBaseline;
  /** The same for a tribe, by creature type, computed on first use. */
  tribeBulk?: (type: string) => Record<ColorClass, Tally>;
  /** Themed style ids the definitions describe, in config/archetypes.json order. */
  styles: readonly string[];
  /** One card's job for each style in `styles` (undefined: no job, a rider, or excluded). */
  jobs(facts: CardFacts, size: ThemeSize): readonly (Job | undefined)[];
  /** Floor alternatives for a style at a size, one of which a deck must meet. */
  floors(style: string, size: ThemeSize): ThemeFloor[] | undefined;
}

function synergyStyles(config: BulkBrewConfig): SynergyArchetype[] {
  return config.archetypes.archetypes.filter((a): a is SynergyArchetype => a.kind === 'synergy');
}

/** The config's enabler and payoff minimums read as setup and payoff floors. */
function configFloors(
  config: BulkBrewConfig,
  style: string,
  size: ThemeSize,
): ThemeFloor[] | undefined {
  const a = synergyStyles(config).find((x) => x.id === style);
  if (!a) return undefined;
  const m = minimumsFor(config, a, size);
  return [{ setup: m.enablers, payoff: m.payoffs }];
}

function cached(
  styles: readonly string[],
  compute: (facts: CardFacts, size: ThemeSize) => (Job | undefined)[],
): ThemeDefs['jobs'] {
  const bySize = new Map<ThemeSize, Map<string, (Job | undefined)[]>>();
  return (facts, size) => {
    let byId = bySize.get(size);
    if (!byId) bySize.set(size, (byId = new Map()));
    let out = byId.get(facts.card.id);
    if (!out) byId.set(facts.card.id, (out = compute(facts, size)));
    return out;
  };
}

/** Definitions from theme-rules.json; a style without minimums for a size falls back to the config's. */
export function rulesDefs(rules: ThemeRules, config: BulkBrewConfig, source: string): ThemeDefs {
  const styles = synergyStyles(config)
    .map((a) => a.id)
    .filter((id) => rules.styles.has(id));
  const compiled = styles.map((id) => rules.styles.get(id)!);
  return {
    name: `${source} (version ${rules.version})`,
    styles,
    jobs: cached(styles, (facts, size) =>
      compiled.map((style) => {
        const m = matchCard(facts.card, style, size);
        // A rider weighs 0: it is not setup.
        if (!m || m.as === 'excluded' || m.weight <= 0) return undefined;
        return { as: m.as, job: m.job, weight: m.weight, repeatable: m.repeatable };
      }),
    ),
    floors(style, size) {
      const entry = rules.styles.get(style)?.minimums?.[`${size}`];
      if (entry) return Array.isArray(entry) ? entry : [entry];
      return configFloors(config, style, size);
    },
  };
}

/**
 * Definitions from the live config's style matchers, as the core's candidate
 * facts report them (`enablerOf` and `payoffOf`). Each card counts once: a
 * card that is both is a payoff, since payoffs are the rarer job. Weights 1.
 */
export function oldRulesDefs(config: BulkBrewConfig): ThemeDefs {
  const styles = synergyStyles(config).map((a) => a.id);
  return {
    name: `config/archetypes.json matchers (version ${config.archetypes.version})`,
    styles,
    jobs: cached(styles, (facts) =>
      styles.map((id): Job | undefined => {
        if (facts.payoffOf.includes(id))
          return { as: 'payoff', job: 'payoff (config matcher)', weight: 1, repeatable: false };
        if (facts.enablerOf.includes(id))
          return { as: 'setup', job: 'enabler (config matcher)', weight: 1, repeatable: false };
        return undefined;
      }),
    ),
    floors: (style, size) => configFloors(config, style, size),
  };
}

/** The theme rules file, or the format's example with a loud warning while it does not exist. */
export function loadRulesDefs(config: BulkBrewConfig): ThemeDefs {
  const rules = loadThemeRules();
  if (rules) return rulesDefs(rules, config, 'theme-rules.json');
  const file = fileURLToPath(DEFAULT_THEME_RULES_FILE);
  console.warn(
    `\n*** b-grow: ${file} ${existsSync(file) ? 'did not load' : 'does not exist'}; ` +
      'using EXAMPLE_THEME_RULES (Graveyard only, config minimums). Decks are not comparable. ***\n',
  );
  return rulesDefs(compileThemeRules(EXAMPLE_THEME_RULES), config, 'EXAMPLE_THEME_RULES');
}

/**
 * A tribe as a plan: creatures of the type are setup, cards that reward the
 * type (Tagger `typal-<type>`) are payoffs; a member that also rewards the
 * type counts once, as a payoff. Neither rules source describes tribes.
 */
export function tribalJob(card: CardRecord, type: string): Job | undefined {
  if (card.tags.includes(`typal-${type.toLowerCase()}`))
    return { as: 'payoff', job: `rewards ${type}`, weight: 1, repeatable: false };
  if (inTribe(card, type))
    return { as: 'setup', job: `${type} creature`, weight: 1, repeatable: false };
  return undefined;
}

/** The core's tribal minimums for a size (from config/builder-weights.json), as floors. */
export function tribalFloors(config: BulkBrewConfig, type: string, size: ThemeSize): ThemeFloor[] {
  const m = tribalArchetype(type, config).minimums;
  const at = m[`${size}`] ?? m['60'];
  return [{ setup: at.enablers, payoff: at.payoffs }];
}

/**
 * What plain bulk holds of each style: every common and uncommon spell in the
 * pack, Un-sets left out, read at 60 cards. A pool's richness in a theme is
 * its setup and payoff over this expectation for the same cards' colors.
 */
export function withBulkBaseline(
  defs: ThemeDefs,
  index: CardIndex,
  config: BulkBrewConfig,
): ThemeDefs {
  const sums = defs.styles.map(() => new Map<ColorClass, Tally>());
  const counts = new Map<ColorClass, number>();
  for (const card of index.pack.cards) {
    if (card.unset || (card.rarity !== 'common' && card.rarity !== 'uncommon')) continue;
    if (isLand(card) && card.layout !== 'modal_dfc') continue;
    const k = colorClassOf(card);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    defs.jobs(factsFor(index, config, card), 60).forEach((job, i) => {
      if (!job) return;
      let t = sums[i]!.get(k);
      if (!t) sums[i]!.set(k, (t = emptyTally()));
      addJob(t, job, 1);
    });
  }
  const perCard = (t: Tally | undefined, n: number): Tally => ({
    setupUnits: n && t ? t.setupUnits / n : 0,
    setupWeight: n && t ? t.setupWeight / n : 0,
    repeatable: n && t ? t.repeatable / n : 0,
    payoffUnits: n && t ? t.payoffUnits / n : 0,
    payoffWeight: n && t ? t.payoffWeight / n : 0,
  });
  const bulk: BulkBaseline = new Map();
  defs.styles.forEach((style, i) => {
    const per = {} as Record<ColorClass, Tally>;
    for (const k of COLOR_CLASSES) per[k] = perCard(sums[i]!.get(k), counts.get(k) ?? 0);
    bulk.set(style, per);
  });
  const bulkCards = index.pack.cards.filter(
    (c) =>
      !c.unset &&
      (c.rarity === 'common' || c.rarity === 'uncommon') &&
      (!isLand(c) || c.layout === 'modal_dfc'),
  );
  const tribes = new Map<string, Record<ColorClass, Tally>>();
  const tribeBulk = (type: string) => {
    let per = tribes.get(type);
    if (!per) {
      const sum = new Map<ColorClass, Tally>();
      for (const card of bulkCards) {
        const job = tribalJob(card, type);
        if (!job) continue;
        const k = colorClassOf(card);
        let t = sum.get(k);
        if (!t) sum.set(k, (t = emptyTally()));
        addJob(t, job, 1);
      }
      per = {} as Record<ColorClass, Tally>;
      for (const k of COLOR_CLASSES) per[k] = perCard(sum.get(k), counts.get(k) ?? 0);
      tribes.set(type, per);
    }
    return per;
  };
  return { ...defs, bulk, tribeBulk };
}
