// Short, plain tags for showing and filtering cards ("Removal", "Draw",
// "+1/+1"). Judgment lives in config/display-tags.json; this file only
// evaluates it. Display tags never affect a build.

import type { BulkBrewConfig, Matcher } from './config.ts';
import type { CardFacts } from './candidates.ts';
import { themeCredit } from './card-needs.ts';
import { cardThemeSides } from './deck-themes.ts';
import { cardMatches } from './matchers.ts';
import type { CardRecord, DeckSize } from './types.ts';

export interface DisplayTagDef {
  id: string;
  /** One or two words, shown in a bubble. */
  label: string;
  description: string;
  /** Config role ids that count for this tag. */
  roles?: string[];
  /** Archetype ids whose setup or payoff jobs (theme rules) count for this tag. */
  styles?: string[];
  /** Tagger slugs, keywords, or types that count for this tag. */
  match?: Matcher;
}

export interface DisplayTagsConfig {
  version: string;
  tags: DisplayTagDef[];
}

/**
 * Display tags that apply to a card, in config order. A style counts through
 * the theme rules' setup or payoff job at the deck's size (60 outside a
 * deck). In a deck view (`deck`), a tag the card has through a role or a
 * style shows only when it earns one of them there; one it has through its
 * Scryfall tags alone still shows, as there is no credit to check.
 */
export function displayTagsFor(
  card: CardRecord,
  facts: CardFacts,
  tags: DisplayTagsConfig,
  config: BulkBrewConfig,
  deck?: { earned: (credit: string) => boolean; size: DeckSize },
): DisplayTagDef[] {
  const sides = cardThemeSides(config, facts, deck?.size);
  const earned = deck?.earned;
  return tags.tags.filter((t) => {
    const credits = [
      ...(t.roles?.filter((r) => facts.roles.includes(r)) ?? []),
      ...sides.filter((s) => t.styles?.includes(s.style)).map((s) => themeCredit(s.style, s.as)),
    ];
    if (credits.length > 0) return !earned || credits.some(earned);
    return t.match ? cardMatches(card, t.match) : false;
  });
}

/** Every Tagger slug the display tags reference, for checking against the pack. */
export function displayTagReferences(tags: DisplayTagsConfig): Set<string> {
  const out = new Set<string>();
  for (const t of tags.tags)
    for (const clause of t.match ?? [])
      for (const slug of [
        ...(clause.anyTags ?? []),
        ...(clause.allTags ?? []),
        ...(clause.excludeTags ?? []),
      ])
        out.add(slug);
  return out;
}

/** Problems with the display tags; empty when they are valid. */
export function validateDisplayTags(tags: DisplayTagsConfig, config: BulkBrewConfig): string[] {
  const problems: string[] = [];
  const roles = new Set(config.roles.roles.map((r) => r.id));
  const styles = new Set(config.archetypes.archetypes.map((a) => a.id));
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const t of tags.tags) {
    if (ids.has(t.id)) problems.push(`display tag ${t.id}: duplicate id`);
    if (labels.has(t.label)) problems.push(`display tag ${t.id}: duplicate label ${t.label}`);
    ids.add(t.id);
    labels.add(t.label);
    if (!t.roles?.length && !t.styles?.length && !t.match?.length)
      problems.push(`display tag ${t.id}: needs roles, styles, or match`);
    for (const r of t.roles ?? [])
      if (!roles.has(r)) problems.push(`display tag ${t.id}: unknown role ${r}`);
    for (const s of t.styles ?? [])
      if (!styles.has(s)) problems.push(`display tag ${t.id}: unknown style ${s}`);
  }
  return problems;
}
