import {
  type ArchetypeReport,
  type BulkBrewConfig,
  type Color,
  type DeckSize,
  type ScanReport,
} from '@bulk-brew/core';

/**
 * Viable; short (the theme rules find the pool short of the style's floors,
 * but close enough to ask: the builder answers with the nearest deck and a
 * note); a near miss (the old scan's few cards short, where the rules do not
 * apply, such as 20 cards); or not enough.
 */
export type Viability = 'viable' | 'short' | 'near' | 'none';

/** Sizes the pool analysis covers; Commander depends on the commander, so it has its own list. */
export type ScannedSize = Exclude<DeckSize, 100>;

export const DECK_SIZES: readonly ScannedSize[] = [60, 40, 20];

/** Scans for every color at every analyzed deck size. */
export type ScansBySize = Record<ScannedSize, Record<Color, ScanReport>>;

const VIABILITY_LABEL: Record<Viability, string> = {
  viable: 'Viable',
  short: 'Short',
  near: 'Near miss',
  none: 'Not enough',
};

export function viabilityLabel(state: Viability): string {
  return VIABILITY_LABEL[state];
}

/**
 * How many cards short a style may be and still count as a near miss. This
 * only labels the scan for display; the builder never reads it.
 */
export const NEAR_MISS_SHORTFALL = 3;

const NEEDS = /^needs (\d+) more /;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Copies the scan says are missing, or undefined when a note is not a count. */
function shortfall(report: ArchetypeReport): number | undefined {
  let total = 0;
  for (const note of report.notes) {
    const m = NEEDS.exec(note);
    if (!m) return undefined;
    total += Number(m[1]);
  }
  return total;
}

/**
 * Where the scan carries the theme rules' view (synergy styles at 60, 40,
 * and 100), the rules decide, as the builder does: viable when the pool
 * meets the floors, short when it reaches `builderWeights.grow.nearMargin`
 * of them. Elsewhere the old scan decides: viable, a near miss (a few cards
 * short), or not enough.
 */
export function archetypeViability(
  report: ArchetypeReport,
  scan: ScanReport,
  config: BulkBrewConfig,
): Viability {
  const rules = report.rules;
  if (rules) {
    if (!scan.possible) return 'none';
    if (rules.viable) return 'viable';
    return rules.margin >= config.builderWeights.grow.nearMargin ? 'short' : 'none';
  }
  if (report.viable) return 'viable';
  if (!scan.possible) return 'none';
  const short = shortfall(report);
  return short !== undefined && short > 0 && short <= NEAR_MISS_SHORTFALL ? 'near' : 'none';
}

/** One short line under the viability label. */
export function viabilityDetail(
  report: ArchetypeReport,
  scan: ScanReport,
  state: Viability,
): string {
  if (state === 'viable') {
    return report.kind === 'synergy'
      ? `${report.enablers.have} enablers · ${report.payoffs.have} payoffs`
      : `${report.enablers.have} spells`;
  }
  if (state === 'short') return capitalize(report.rules?.lacks ?? '');
  if (state === 'near') return report.notes.join(', ');
  if (!scan.possible) return scanShortfall(scan) ?? 'not enough cards for this size';
  // The rules' phrase, so the line agrees with what the builder would say.
  if (report.rules?.lacks) return report.rules.lacks;
  if (report.kind === 'synergy' && report.notes.some((n) => !NEEDS.test(n)))
    return 'does not work in this color';
  if (report.kind === 'synergy')
    return `${report.enablers.have} of ${report.enablers.want} enablers, ${report.payoffs.have} of ${report.payoffs.want} payoffs`;
  return report.notes[0] ?? '';
}

/** The scan's own reason a size cannot be built, without the aside in parentheses. */
export function scanShortfall(scan: ScanReport): string | undefined {
  return scan.notes.find((n) => NEEDS.test(n))?.replace(/\s*\(.*\)$/, '');
}

/** Sizes the color can build at all, largest first. */
export function buildableSizes(scans: ScansBySize, color: Color): ScannedSize[] {
  return DECK_SIZES.filter((size) => scans[size][color].possible);
}

export interface AnalysisRow {
  archetype: string;
  label: string;
  cells: Record<DeckSize, { state: Viability; detail: string }>;
}

/**
 * One row per archetype for a color, the most buildable first; ties keep
 * the config order.
 */
export function analysisRows(
  scans: ScansBySize,
  color: Color,
  config: BulkBrewConfig,
): AnalysisRow[] {
  const base = scans[60][color].archetypes;
  const rows = base.map((a, order) => {
    const cells = {} as AnalysisRow['cells'];
    let score = 0;
    for (const size of DECK_SIZES) {
      const scan = scans[size][color];
      const report = scan.archetypes.find((r) => r.archetype === a.archetype) ?? a;
      const state = archetypeViability(report, scan, config);
      score += state === 'viable' ? 2 : state === 'short' || state === 'near' ? 1 : 0;
      cells[size] = { state, detail: viabilityDetail(report, scan, state) };
    }
    return { row: { archetype: a.archetype, label: a.label, cells }, score, order };
  });
  rows.sort((a, b) => b.score - a.score || a.order - b.order);
  return rows.map((r) => r.row);
}

/** A style offered in the Build page's archetype pickers. */
export interface StyleChoice {
  id: string;
  label: string;
  description: string;
  /**
   * Viable and short styles can be picked (a short one is built as the
   * nearest deck with a note, or under a commander shows who leads it); a
   * near miss cannot.
   */
  state: 'viable' | 'short' | 'near';
}

const CHOICE_ORDER: Record<StyleChoice['state'], number> = { viable: 0, short: 1, near: 2 };

/**
 * The primary styles worth offering for the picked colors, from the scans of
 * every subset of them: the best viability any subset reaches. A viable
 * style shows its description; a short one what the pool lacks, from the
 * subset closest to the floors; a near miss what the old scan says is
 * missing. Viable first, then short, then near, each in config order.
 */
export function styleChoicesFrom(
  config: BulkBrewConfig,
  scans: ReadonlyMap<string, ScanReport>,
): StyleChoice[] {
  const out: StyleChoice[] = [];
  for (const a of config.archetypes.archetypes) {
    let best: { choice: StyleChoice; margin: number } | undefined;
    for (const scan of scans.values()) {
      const report = scan.archetypes.find((r) => r.archetype === a.id);
      if (!report) continue;
      const state = archetypeViability(report, scan, config);
      if (state === 'none') continue;
      const margin = report.rules?.margin ?? report.margin;
      if (best) {
        const order = CHOICE_ORDER[state] - CHOICE_ORDER[best.choice.state];
        if (order > 0 || (order === 0 && (state !== 'short' || margin <= best.margin))) continue;
      }
      const description =
        state === 'viable'
          ? a.description
          : state === 'short'
            ? viabilityDetail(report, scan, state)
            : capitalize(report.notes.join(', '));
      best = { choice: { id: a.id, label: a.label, description, state }, margin };
      if (state === 'viable') break;
    }
    if (best) out.push(best.choice);
  }
  // Array sort is stable, so each group keeps the config order.
  return out.sort((x, y) => CHOICE_ORDER[x.state] - CHOICE_ORDER[y.state]);
}

/**
 * What the bulk list lacks for a primary style no color subset can build:
 * the rules' phrase from the scan of the most colors that can build the size
 * at all, the subset with the most cards. Undefined where the rules do not
 * cover the style.
 */
export function primaryLacks(
  scans: ReadonlyMap<string, ScanReport>,
  style: string,
): string | undefined {
  const fullest = [...scans.values()]
    .filter((s) => s.possible)
    .sort((a, b) => b.colors.length - a.colors.length);
  for (const scan of fullest) {
    const lacks = scan.archetypes.find((r) => r.archetype === style)?.rules?.lacks;
    if (lacks) return lacks;
  }
  return undefined;
}

/** Folds the core's 0 to 7-plus curve into the design's 0 to 6-plus buckets. */
export function curveBuckets(curve: number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  curve.forEach((n, i) => {
    const k = Math.min(i, 6);
    out[k] = (out[k] ?? 0) + n;
  });
  return out;
}
