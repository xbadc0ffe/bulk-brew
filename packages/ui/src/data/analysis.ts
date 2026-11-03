import { type ArchetypeReport, type Color, type DeckSize, type ScanReport } from '@bulk-brew/core';

export type Viability = 'viable' | 'near' | 'none';

export const DECK_SIZES: readonly DeckSize[] = [60, 40, 20];

/** Scans for every color at every deck size. */
export type ScansBySize = Record<DeckSize, Record<Color, ScanReport>>;

const VIABILITY_LABEL: Record<Viability, string> = {
  viable: 'Viable',
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

/** Viable, a near miss (a few cards short), or not enough. */
export function archetypeViability(report: ArchetypeReport, scan: ScanReport): Viability {
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
  if (state === 'near') return report.notes.join(', ');
  if (!scan.possible) return scanShortfall(scan) ?? 'pool too small for this size';
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
export function buildableSizes(scans: ScansBySize, color: Color): DeckSize[] {
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
export function analysisRows(scans: ScansBySize, color: Color): AnalysisRow[] {
  const base = scans[60][color].archetypes;
  const rows = base.map((a, order) => {
    const cells = {} as AnalysisRow['cells'];
    let score = 0;
    for (const size of DECK_SIZES) {
      const scan = scans[size][color];
      const report = scan.archetypes.find((r) => r.archetype === a.archetype) ?? a;
      const state = archetypeViability(report, scan);
      score += state === 'viable' ? 2 : state === 'near' ? 1 : 0;
      cells[size] = { state, detail: viabilityDetail(report, scan, state) };
    }
    return { row: { archetype: a.archetype, label: a.label, cells }, score, order };
  });
  rows.sort((a, b) => b.score - a.score || a.order - b.order);
  return rows.map((r) => r.row);
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
