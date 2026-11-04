import {
  COLORS,
  colorSubsets,
  creatureTypes,
  factsFor,
  landColors,
  primaryGroup,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
  type Pool,
} from '@bulk-brew/core';
import { TYPE_GROUPS } from './deckGroups.ts';
import type { TypeCount } from './deckStats.ts';
import { colorKey, type ColorKey } from './poolView.ts';

/** Color classes in the order the analysis lists them, as on the Bulk List's color filter. */
export const STAT_COLORS: readonly ColorKey[] = ['W', 'U', 'B', 'R', 'G', 'C', 'M'];

/** Mana value columns: 0 through 5, then 6 or more. */
export const MV_BUCKETS = ['0', '1', '2', '3', '4', '5', '6+'] as const;

export interface RoleRow {
  id: string;
  label: string;
  byColor: Record<ColorKey, number>;
  total: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface CreatureTypeCount extends NamedCount {
  /** Copies of cards that reward this type (tagged as its typal payoffs). */
  payoffs: number;
}

/** The Analyze pane's breakdown of the bulk list. Every count is copies. */
export interface PoolStats {
  /** Spells (everything but lands) by color class and mana value bucket. */
  curve: Record<ColorKey, number[]>;
  /** Copies of each card type, a card counted once under its main type. */
  types: TypeCount[];
  /** The builder's roles by color class, in config order; roles no card fills are left out. */
  roles: RoleRow[];
  /** Creature types, most copies first. Changelings are counted apart. */
  creatureTypes: CreatureTypeCount[];
  changelings: number;
  /** Subtypes of other spells and permanents, such as Aura, Equipment, and Vehicle. */
  otherSubtypes: NamedCount[];
  /** Nonbasic lands that make both colors of a pair, keyed by color letters such as "WU". */
  fixing: Record<string, number>;
}

const zeros = (): Record<ColorKey, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 });

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

const byCount = (a: NamedCount, b: NamedCount) => b.count - a.count || a.name.localeCompare(b.name);

/** Two-color sets in WUBRG order: WU, WB, WR, WG, UB, and so on. */
export const COLOR_PAIRS: readonly Color[][] = colorSubsets(COLORS).filter((s) => s.length === 2);

export function poolStats(pool: Pool, index: CardIndex, config: BulkBrewConfig): PoolStats {
  const curve = Object.fromEntries(STAT_COLORS.map((c) => [c, MV_BUCKETS.map(() => 0)])) as Record<
    ColorKey,
    number[]
  >;
  const types = new Map<string, number>();
  const roles = new Map<string, Record<ColorKey, number>>();
  const tribes = new Map<string, number>();
  const others = new Map<string, number>();
  const tags = new Map<string, number>();
  const fixing: Record<string, number> = Object.fromEntries(
    COLOR_PAIRS.map((p) => [p.join(''), 0]),
  );
  let changelings = 0;

  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    const n = entry.qty;
    if (!card || n <= 0) continue;
    const key = colorKey(card);
    const group = primaryGroup(card);
    types.set(group, (types.get(group) ?? 0) + n);
    for (const t of card.tags) tags.set(t, (tags.get(t) ?? 0) + n);

    if (group === 'Lands') {
      if (card.typeLine.includes('Basic')) continue;
      for (const pair of COLOR_PAIRS)
        if (landColors(card, pair, 60).length === 2) fixing[pair.join('')]! += n;
      continue;
    }

    curve[key][Math.min(6, Math.max(0, Math.floor(card.mv)))]! += n;
    for (const id of factsFor(index, config, card).roles) {
      let row = roles.get(id);
      if (!row) roles.set(id, (row = zeros()));
      row[key] += n;
    }
    if (card.keywords.includes('Changeling')) changelings += n;
    else for (const t of creatureTypes(card)) tribes.set(t, (tribes.get(t) ?? 0) + n);
    for (const s of otherSubtypesOf(card)) others.set(s, (others.get(s) ?? 0) + n);
  }

  const roleRows: RoleRow[] = [];
  for (const r of config.roles.roles) {
    const byColor = roles.get(r.id);
    if (!byColor) continue;
    roleRows.push({
      id: r.id,
      label: r.label,
      byColor,
      total: STAT_COLORS.reduce((t, c) => t + byColor[c], 0),
    });
  }

  return {
    curve,
    types: TYPE_GROUPS.filter((g) => types.has(g)).map((label) => ({
      label,
      count: types.get(label)!,
    })),
    roles: roleRows,
    creatureTypes: [...tribes]
      .map(([name, count]) => ({
        name,
        count,
        payoffs: tags.get(`typal-${name.toLowerCase()}`) ?? 0,
      }))
      .sort(byCount),
    changelings,
    otherSubtypes: [...others].map(([name, count]) => ({ name, count })).sort(byCount),
    fixing,
  };
}
