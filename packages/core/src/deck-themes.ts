// A deck's themes as the apps show them, counted the way the builder that made
// the deck counts them. A grow deck reads the theme rules (config/theme-rules.json):
// each card's job once, earned in the deck by the card needs reader, the
// commander at `grow.commanderCredit`, against the floors the build recorded.
// A classic deck (20-card packets, tribes, secondary styles) keeps the old
// matchers and minimums its builder counted (styleCounts), until it leaves.

import { styleCounts } from './builder.ts';
import { factsFor, type CardFacts } from './candidates.ts';
import { themeCredit } from './card-needs.ts';
import type { BulkBrewConfig } from './config.ts';
import { deckCredits } from './deck-credits.ts';
import {
  addThemeJob,
  bestFloor,
  emptyThemeTally,
  FLOOR_WORDS,
  floorCounts,
  themeFloorsOf,
  themeJobsOf,
  themeStyles,
  type Job,
} from './grow.ts';
import type { CardIndex } from './pack.ts';
import type { ThemeFloor, ThemeTally } from './theme-rules.ts';
import type { Deck, DeckSize, FloorCount } from './types.ts';

/** Whether the deck's themes are counted by the theme rules: the grow builder made it. */
export function rulesCounted(deck: Deck): boolean {
  return deck.explanation?.builder === 'grow';
}

function labelOf(config: BulkBrewConfig, style: string): string {
  return config.archetypes.archetypes.find((a) => a.id === style)?.label ?? style;
}

/**
 * Each rules style's tally in a deck: every spell's job once, counted when
 * the deck earns it (its needs met by the deck's cards, lands, colors, and
 * commander), the commander at `grow.commanderCredit`, as the grow builder
 * counts its finished deck.
 */
export function deckThemeTallies(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): Map<string, ThemeTally> {
  const styles = themeStyles(config);
  const tallies = styles.map(emptyThemeTally);
  const credits = deckCredits(deck, index, config);
  const credit = config.builderWeights.grow.commanderCredit;
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card) continue;
    const facts = factsFor(index, config, card);
    if (!facts.spell) continue;
    const copies = dc.cardId === deck.commander ? credit : dc.qty;
    themeJobsOf(config, facts, deck.size).forEach((j, i) => {
      if (j && credits.earned(card, themeCredit(styles[i]!, j.as)))
        addThemeJob(tallies[i]!, j, copies);
    });
  }
  return new Map(styles.map((s, i) => [s, tallies[i]!]));
}

/**
 * A grow deck's own theme against its floors: what the deck earns now, for
 * the floor alternative the build recorded (an older deck without a record:
 * the alternative the deck meets best). Undefined for a plain shape, a
 * classic deck, or a style the rules give no floors at the deck's size.
 */
export function deckThemeFloors(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): { style: string; floors: FloorCount[] } | undefined {
  if (!rulesCounted(deck)) return undefined;
  const style = deck.archetype;
  const floors = themeFloorsOf(config, style, deck.size);
  if (!floors?.length) return undefined;
  const t = deckThemeTallies(deck, index, config).get(style)!;
  const recorded = deck.explanation?.theme;
  const floor: ThemeFloor =
    recorded?.style === style
      ? Object.fromEntries(recorded.floors.map((f) => [f.floor, f.need]))
      : bestFloor(t, floors).floor;
  return { style, floors: floorCounts(t, floor) };
}

/** One Roles bar for a theme: "Tokens setup cards 10/9". */
export interface StyleRow {
  key: string;
  label: string;
  have: number;
  want: number;
}

/**
 * The Roles bars for a deck's themes, in the words of the builder that made
 * it. A grow deck: each floor of its theme as the rules count it ("Voltron
 * setup cards 13/12", "Voltron payoff cards 5/4"). A classic deck: the old
 * matchers' enablers and payoffs against the archetype's minimums, and a
 * tribe's creatures and the cards that reward them. Plain shapes have none.
 */
export function deckStyleRows(deck: Deck, index: CardIndex, config: BulkBrewConfig): StyleRow[] {
  if (rulesCounted(deck)) {
    const t = deckThemeFloors(deck, index, config);
    if (!t) return [];
    const name = labelOf(config, t.style);
    return t.floors.map((f) => ({
      key: `${t.style}:${f.floor}`,
      label: `${name} ${FLOOR_WORDS[f.floor]}`,
      have: f.have,
      want: f.need,
    }));
  }
  return styleCounts(deck, index, config).flatMap((s) => {
    const name = s.tribal ? s.id.slice('tribal:'.length) : s.label;
    return [
      {
        key: `${s.id}:enablers`,
        label: s.tribal ? `${name} creatures` : `${name} enablers`,
        ...s.enablers,
      },
      { key: `${s.id}:payoffs`, label: `${name} payoffs`, ...s.payoffs },
    ];
  });
}

/** Lines the key synergies list at most. */
const SYNERGY_LINES = 5;

function count(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * A grow deck's key synergies: the rules' themes it earns both setup and
 * payoff for, the fullest first (by the smaller side), each card counted once
 * as the rules count it, such as "Tokens: 10 setup cards, 6 payoff cards".
 */
export function themeSynergyLines(deck: Deck, index: CardIndex, config: BulkBrewConfig): string[] {
  const out: { style: string; setup: number; payoff: number }[] = [];
  for (const [style, t] of deckThemeTallies(deck, index, config))
    if (t.setupUnits > 0 && t.payoffUnits > 0)
      out.push({ style, setup: t.setupUnits, payoff: t.payoffUnits });
  // Map order is the rules' style order, and sort is stable.
  return out
    .sort((a, b) => Math.min(b.setup, b.payoff) - Math.min(a.setup, a.payoff))
    .slice(0, SYNERGY_LINES)
    .map(
      (s) =>
        `${labelOf(config, s.style)}: ${count(s.setup)} ${FLOOR_WORDS.setup}, ${count(s.payoff)} ${FLOOR_WORDS.payoff}`,
    );
}

/**
 * The key synergies a deck view shows: a grow deck's counted again from the
 * deck by the rules, as its Roles bars are (a deck saved before the rules
 * counted them still shows what it earns); a classic deck's as its builder
 * wrote them.
 */
export function deckSynergyLines(deck: Deck, index: CardIndex, config: BulkBrewConfig): string[] {
  if (rulesCounted(deck)) return themeSynergyLines(deck, index, config);
  return deck.explanation?.synergies ?? [];
}

/** One theme job a card has under the rules. */
export interface CardThemeSide {
  style: string;
  as: Job['as'];
  /** The rule's job text, such as "evasive attacker, power 2 or more". */
  job: string;
}

/**
 * Every theme job the rules give a card at a deck size (60 outside a deck),
 * in the rules' style order: what the card can do for a theme, before any
 * deck's needs are checked.
 */
export function cardThemeSides(
  config: BulkBrewConfig,
  facts: CardFacts,
  size: DeckSize = 60,
): CardThemeSide[] {
  const styles = themeStyles(config);
  const out: CardThemeSide[] = [];
  themeJobsOf(config, facts, size).forEach((j, i) => {
    if (j) out.push({ style: styles[i]!, as: j.as, job: j.job });
  });
  return out;
}

/** The reason label a grow deck records for a theme job: "Setup: makes a creature token". */
export function themeJobLabel(side: Job['as'], job: string): string {
  return `${side === 'setup' ? 'Setup' : 'Payoff'}: ${job}`;
}
