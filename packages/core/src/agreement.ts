// The agreement check (builder phase 2, step 4): everything the player sees
// agrees with what the builder counted. For one request, the scan (the style
// pickers and the Analyze pane's list), the Analyze pane's plan
// (bestDeckPlans), the Build page's plan (planOptions), and the builder's own
// plan list (pickerPlans) name the same viable styles, with the same pool
// counts; and every deck built shows, on its Roles bars, reasons, and key
// synergies, the setup and payoff counts its builder counted. It reports
// style ids and counts only, never card names, so `npm run review:agree` can
// run it on held-out pools.

import { BuildError, buildDeck } from './builder.ts';
import { bestDeckPlans } from './best-decks.ts';
import { factsFor } from './candidates.ts';
import { normalizeColors } from './colors.ts';
import type { BulkBrewConfig } from './config.ts';
import { deckCredits, reasonEarned } from './deck-credits.ts';
import {
  cardThemeSides,
  deckStyleRows,
  deckThemeFloors,
  deckTribes,
  rulesCounted,
  themeJobLabel,
  themeSynergyLines,
} from './deck-themes.ts';
import { pickerPlans, type PickerPlan } from './grow.ts';
import { planOptions } from './options.ts';
import type { CardIndex } from './pack.ts';
import { scanPool } from './scan.ts';
import type { BuildResult, Color, Deck, FloorCount, Pool, ScanReport, Settings } from './types.ts';

export type AgreementKind =
  /** The scan's viable styles differ from the builder's plan list. */
  | 'scan'
  /** The scan's pool counts for a theme differ from the builder's. */
  | 'pool-counts'
  /** The Analyze pane's plan for the color set differs from the builder's. */
  | 'analyze'
  /** The Build page's plan for the picked colors differs from the builder's. */
  | 'options'
  /** Best fit compared a plan that is not on the builder's list, or left out one it built. */
  | 'best-fit'
  /** A style every surface plans as viable that no deck could be built for. */
  | 'unbuilt'
  /** A deck's Roles bars differ from the setup and payoff its builder counted. */
  | 'bars'
  /** A grow deck shows a theme reason that is not the rules' job, or hides one its builder recorded. */
  | 'reasons'
  /** A grow deck's key synergies differ from the rules' count of the deck. */
  | 'synergies';

export interface Disagreement {
  kind: AgreementKind;
  /** The style concerned, when one is. */
  style?: string;
  /** What differs, in counts and style ids. */
  detail: string;
}

export interface AgreementReport {
  issues: Disagreement[];
  /** Styles every surface plans, in the builder's order. */
  plans: string[];
  /** Planned styles the builder could not build; each is also an 'unbuilt' disagreement. */
  unbuilt: string[];
  /** Decks built and checked. */
  decks: number;
}

export interface AgreementRequest {
  size: 60 | 40 | 20 | 100;
  colors: Color[];
  /** Commander card id at 100. */
  commander?: string;
}

function sameFloors(a: readonly FloorCount[], b: readonly FloorCount[]): boolean {
  return (
    a.length === b.length &&
    a.every((f, i) => f.floor === b[i]!.floor && f.have === b[i]!.have && f.need === b[i]!.need)
  );
}

function floorText(floors: readonly FloorCount[]): string {
  return floors.map((f) => `${f.floor} ${f.have}/${f.need}`).join(', ');
}

function setDiff(label: string, a: readonly string[], b: readonly string[]): string {
  const only = (x: readonly string[], y: readonly string[]) => x.filter((s) => !y.includes(s));
  return `${label}: only there ${only(a, b).join(' ') || '-'}; only in the builder ${only(b, a).join(' ') || '-'}`;
}

/**
 * What a built deck shows against what its builder counted: the Roles bars'
 * theme rows (the option cards and the deck view read the same rows), the
 * reasons a grow deck shows for its theme cards, and its key synergies.
 * Classic decks keep their own counts and are not compared here.
 */
export function deckDisagreements(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): Disagreement[] {
  if (!rulesCounted(deck)) return [];
  const out: Disagreement[] = [];
  const style = deck.archetype;
  const e = deck.explanation!;
  const shown = deckThemeFloors(deck, index, config);
  const counted = e.theme;
  if ((shown === undefined) !== (counted === undefined))
    out.push({
      kind: 'bars',
      style,
      detail: `bars ${shown ? 'shown' : 'missing'}, builder count ${counted ? 'recorded' : 'missing'}`,
    });
  else if (shown && counted && !sameFloors(shown.floors, counted.floors))
    out.push({
      kind: 'bars',
      style,
      detail: `bars ${floorText(shown.floors)}; builder ${floorText(counted.floors)}`,
    });
  const rows = deckStyleRows(deck, index, config);
  if (shown && rows.length !== shown.floors.length)
    out.push({
      kind: 'bars',
      style,
      detail: `${rows.length} rows for ${shown.floors.length} floors`,
    });

  // Theme reasons: shown only when earned, and then the rules' own job for the card.
  const credits = deckCredits(deck, index, config);
  let hidden = 0;
  let wrong = 0;
  for (const dc of deck.cards) {
    const why = dc.why ?? '';
    if (!/^(Setup|Payoff): /.test(why) || dc.cardId === deck.commander) continue;
    const card = index.get(dc.cardId);
    if (!card) continue;
    if (!reasonEarned(why, card, deck, credits, config)) {
      hidden += dc.qty;
      continue;
    }
    const side = cardThemeSides(
      config,
      factsFor(index, config, card),
      deck.size,
      deckTribes(deck, index, config),
    ).find((s) => s.style === style);
    if (!side || themeJobLabel(side.as, side.job) !== why) wrong += dc.qty;
  }
  if (hidden)
    out.push({ kind: 'reasons', style, detail: `${hidden} copies hide a reason the builder gave` });
  if (wrong)
    out.push({
      kind: 'reasons',
      style,
      detail: `${wrong} copies show a job the rules do not give`,
    });

  const lines = themeSynergyLines(deck, index, config);
  if (lines.join('|') !== e.synergies.join('|'))
    out.push({
      kind: 'synergies',
      style,
      detail: `${e.synergies.length} lines recorded, ${lines.length} counted, first differs`,
    });
  return out;
}

/** What every surface planned for one request, and what the builder did with it. */
export interface PlanInputs {
  /** The builder's own plan list (pickerPlans), with its pool counts for each theme. */
  builder: readonly PickerPlan[];
  /** The scan of the request's colors, under its commander at 100. */
  scan: ScanReport;
  /** The Analyze pane's plan for the colors (bestDeckPlans); absent under a commander, whose Analyze deck is best fit. */
  analyze?: readonly string[];
  /** The Build page's plan for the picked colors (planOptions). */
  options: readonly string[];
  /** The plans best fit compared (its picker ranking); absent when nothing was planned. */
  compared?: readonly string[];
  /** Planned styles the builder could not build. */
  unbuilt: readonly string[];
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

/**
 * The plan-level comparisons, on what the surfaces planned: the scan's viable
 * styles and pool counts, the Analyze pane's and the Build page's plans, best
 * fit's ranking, and every planned style built. A style planned but not built
 * is a disagreement too: the style pickers call it viable while every list of
 * options drops it.
 */
export function planDisagreements(input: PlanInputs): Disagreement[] {
  const issues: Disagreement[] = [];
  const planned = input.builder.map((p) => p.style);
  // A commander's named tribes are the scan's lead tribes, counted by the tribe rules.
  const rows = [
    ...input.scan.archetypes.map((a) => ({ style: a.archetype, rules: a.rules })),
    ...(input.scan.leadTribes ?? []),
  ];
  const viable = rows.filter((a) => a.rules?.viable).map((a) => a.style);
  if (!sameSet(viable, planned))
    issues.push({ kind: 'scan', detail: setDiff('scan', viable, planned) });
  for (const p of input.builder) {
    if (!p.floors) continue;
    const r = rows.find((a) => a.style === p.style)?.rules;
    if (!r || !sameFloors(r.floors, p.floors))
      issues.push({
        kind: 'pool-counts',
        style: p.style,
        detail: `scan ${r ? floorText(r.floors) : 'none'}; builder ${floorText(p.floors)}`,
      });
  }
  if (input.analyze && !sameSet(input.analyze, planned))
    issues.push({ kind: 'analyze', detail: setDiff('analyze', input.analyze, planned) });
  if (!sameSet(input.options, planned))
    issues.push({ kind: 'options', detail: setDiff('options', input.options, planned) });
  for (const style of input.unbuilt)
    issues.push({
      kind: 'unbuilt',
      style,
      detail: 'planned as viable, but no deck could be built',
    });
  if (input.compared) {
    const stray = input.compared.filter((s) => !planned.includes(s));
    const missing = planned.filter(
      (s) => !input.unbuilt.includes(s) && !input.compared!.includes(s),
    );
    if (stray.length || missing.length)
      issues.push({
        kind: 'best-fit',
        detail: `compared but not planned ${stray.join(' ') || '-'}; built but not compared ${missing.join(' ') || '-'}`,
      });
  }
  return issues;
}

/**
 * Check one request at 60, 40, 20, or 100 cards (no style, no secondary): the
 * plans every surface lists (planDisagreements), and each planned deck as
 * built (deckDisagreements).
 */
export function checkAgreement(
  req: AgreementRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): AgreementReport {
  const lead = req.commander ? index.get(req.commander) : undefined;
  const colors = normalizeColors(lead ? lead.identity : req.colors);
  const request = {
    size: req.size,
    colors,
    settings,
    ...(req.commander ? { commander: req.commander } : {}),
    id: 'agree',
    createdAt: '',
  };
  const builder = pickerPlans(request, pool, index, config);
  const planned = builder.map((p) => p.style);
  const scan = scanPool(pool, index, config, settings, req.size, colors, lead);
  const key = colors.join('');
  const analyze = lead ? undefined : bestDeckPlans(new Map([[key, scan]])).map((p) => p.style!);
  const options = planOptions(
    { size: req.size, colors, settings, ...(req.commander ? { commander: req.commander } : {}) },
    pool,
    index,
    config,
  )
    .plans.filter((p) => p.colors.join('') === key)
    .map((p) => p.style);

  // Each planned deck, built as the options build it.
  const deckIssues: Disagreement[] = [];
  const unbuilt: string[] = [];
  let decks = 0;
  for (const style of planned) {
    let result: BuildResult;
    try {
      result = buildDeck({ ...request, style }, pool, index, config);
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      unbuilt.push(style);
      continue;
    }
    decks += 1;
    deckIssues.push(...deckDisagreements(result.deck, index, config));
  }
  let compared: string[] | undefined;
  if (planned.length > 0) {
    const best = buildDeck(request, pool, index, config);
    compared = best.explanation.pick?.ranked?.map((r) => r.style) ?? [best.deck.archetype];
    deckIssues.push(...deckDisagreements(best.deck, index, config));
  }
  const issues = [
    ...planDisagreements({
      builder,
      scan,
      ...(analyze ? { analyze } : {}),
      options,
      ...(compared ? { compared } : {}),
      unbuilt,
    }),
    ...deckIssues,
  ];
  return { issues, plans: planned, unbuilt, decks };
}
