import {
  creatureTypes,
  factsFor,
  primaryGroup,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Pool,
} from '@bulk-brew/core';
import { TYPE_GROUPS } from './deckGroups.ts';
import { colorKey, type ColorKey } from './poolView.ts';

/** Color classes in the order the analysis lists them, as on the Bulk List's color filter. */
export const STAT_COLORS: readonly ColorKey[] = ['W', 'U', 'B', 'R', 'G', 'C', 'M'];

/** Mana value columns: 0 through 5, then 6 or more. */
export const MV_BUCKETS = ['0', '1', '2', '3', '4', '5', '6+'] as const;

export type ColorCounts = Record<ColorKey, number>;

/** One row of a by-color table: copies of something in each color class. */
export interface ColorRow {
  id: string;
  label: string;
  byColor: ColorCounts;
  total: number;
}

/** The Analyze pane's breakdown of the bulk list. Every count is copies. */
export interface PoolStats {
  /** Every card by color class (from its color identity), lands included. */
  colors: ColorCounts;
  /** Every card counted once in each of its colors; colorless cards under C, and M stays 0. */
  eachColor: ColorCounts;
  /** Spells (everything but lands) by color class and mana value bucket. */
  curve: Record<ColorKey, number[]>;
  /** Card types in decklist order, a card counted once under its main type. */
  types: ColorRow[];
  /** The builder's roles, in config order; roles no card fills are left out. */
  roles: ColorRow[];
  /** Creature types as printed, most copies first. */
  creatureTypes: ColorRow[];
  /** Subtypes of other spells and permanents, such as Aura, Equipment, and Vehicle, most first. */
  subtypes: ColorRow[];
}

const zeros = (): ColorCounts => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 });

/** Face types whose subtypes are not worth listing as other subtypes. */
const SKIP_FACE = /\b(Creature|Kindred|Land|Planeswalker)\b/;

/** Subtypes of a card's noncreature, nonland faces, such as Aura or Equipment. */
function otherSubtypesOf(card: CardRecord): string[] {
  const out = new Set<string>();
  for (const face of card.typeLine.split(' // ')) {
    const [type, sub] = face.split(/\s+—\s+/);
    if (!sub || SKIP_FACE.test(type ?? '')) continue;
    for (const s of sub.split(/\s+/)) if (s) out.add(s);
  }
  return [...out];
}

/** Rows counted by id, then per color class. */
class Tally {
  private readonly rows = new Map<string, ColorCounts>();
  add(id: string, key: ColorKey, n: number): void {
    let row = this.rows.get(id);
    if (!row) this.rows.set(id, (row = zeros()));
    row[key] += n;
  }
  get(id: string): ColorRow | undefined {
    const byColor = this.rows.get(id);
    if (!byColor) return undefined;
    return { id, label: id, byColor, total: STAT_COLORS.reduce((t, c) => t + byColor[c], 0) };
  }
  /** Every row, most copies first, then by name. */
  byTotal(): ColorRow[] {
    return [...this.rows.keys()]
      .map((id) => this.get(id)!)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }
}

export function poolStats(pool: Pool, index: CardIndex, config: BulkBrewConfig): PoolStats {
  const colors = zeros();
  const eachColor = zeros();
  const curve = Object.fromEntries(STAT_COLORS.map((c) => [c, MV_BUCKETS.map(() => 0)])) as Record<
    ColorKey,
    number[]
  >;
  const types = new Tally();
  const roles = new Tally();
  const tribes = new Tally();
  const subtypes = new Tally();

  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    const n = entry.qty;
    if (!card || n <= 0) continue;
    const key = colorKey(card);
    colors[key] += n;
    if (card.identity.length === 0) eachColor.C += n;
    for (const c of card.identity) eachColor[c] += n;
    const group = primaryGroup(card);
    types.add(group, key, n);
    if (group === 'Lands') continue;

    curve[key][Math.min(6, Math.max(0, Math.floor(card.mv)))]! += n;
    for (const id of factsFor(index, config, card).roles) roles.add(id, key, n);
    for (const t of creatureTypes(card)) tribes.add(t, key, n);
    for (const s of otherSubtypesOf(card)) subtypes.add(s, key, n);
  }

  const roleRows: ColorRow[] = [];
  for (const r of config.roles.roles) {
    const row = roles.get(r.id);
    if (row) roleRows.push({ ...row, label: r.label });
  }

  return {
    colors,
    eachColor,
    curve,
    types: TYPE_GROUPS.flatMap((g) => types.get(g) ?? []),
    roles: roleRows,
    creatureTypes: tribes.byTotal(),
    subtypes: subtypes.byTotal(),
  };
}
