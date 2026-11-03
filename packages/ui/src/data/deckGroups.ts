import {
  archetypeById,
  COLORS,
  primaryGroup,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
  type Deck,
  type PrintingHint,
} from '@bulk-brew/core';

export interface DeckRow {
  key: string;
  qty: number;
  name: string;
  /** Why the builder picked it, in lower case; absent for basics. */
  why?: string | undefined;
  card?: CardRecord | undefined;
  printing?: PrintingHint | undefined;
}

export interface DeckGroup {
  label: string;
  count: number;
  rows: DeckRow[];
}

// The core's type groups folded into the design's four, plus a catch-all.
const FOLD: Record<string, string> = {
  Creatures: 'Creatures',
  Instants: 'Instants and sorceries',
  Sorceries: 'Instants and sorceries',
  Enchantments: 'Enchantments and artifacts',
  Artifacts: 'Enchantments and artifacts',
  Lands: 'Lands',
};
const ORDER = [
  'Creatures',
  'Instants and sorceries',
  'Enchantments and artifacts',
  'Other spells',
  'Lands',
];

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Deck cards grouped by type, most copies first; basics lead the Lands group. */
export function deckGroups(deck: Deck, index: CardIndex, config: BulkBrewConfig): DeckGroup[] {
  const map = new Map<string, DeckRow[]>();
  const add = (label: string, row: DeckRow) => {
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(row);
  };
  const sorted = deck.cards
    .map((dc) => ({ dc, card: index.get(dc.cardId) }))
    .filter((x): x is { dc: (typeof deck.cards)[number]; card: CardRecord } => !!x.card)
    .sort(
      (a, b) =>
        b.dc.qty - a.dc.qty || a.card.mv - b.card.mv || a.card.name.localeCompare(b.card.name),
    );
  for (const { color, n } of Object.entries(deck.basics).map(([color, n]) => ({
    color: color as Color,
    n: n ?? 0,
  }))) {
    if (n <= 0) continue;
    const name = config.landRules.basics.names[color];
    add('Lands', { key: `basic-${color}`, qty: n, name, card: index.find(name) });
  }
  for (const { dc, card } of sorted) {
    add(FOLD[primaryGroup(card)] ?? 'Other spells', {
      key: dc.cardId,
      qty: dc.qty,
      name: card.name,
      why: dc.why ? lowerFirst(dc.why) : undefined,
      card,
      printing: dc.printing,
    });
  }
  return ORDER.filter((g) => map.has(g)).map((label) => {
    const rows = map.get(label)!;
    return { label, count: rows.reduce((n, r) => n + r.qty, 0), rows };
  });
}

export function landCount(deck: Deck, index: CardIndex): number {
  if (deck.explanation) return deck.explanation.lands.count;
  let n = Object.values(deck.basics).reduce((t: number, x) => t + (x ?? 0), 0);
  for (const dc of deck.cards) if (index.get(dc.cardId)?.types.includes('land')) n += dc.qty;
  return n;
}

export function archetypeInfo(
  config: BulkBrewConfig,
  id: string,
): { label: string; description: string } {
  // Merged packets record both styles as "a+b".
  if (id.includes('+')) {
    const parts = id.split('+').map((p) => archetypeInfo(config, p).label);
    return {
      label: parts.join(' + '),
      description: `Two packets merged into one deck: ${parts.join(' and ')}.`,
    };
  }
  try {
    const a = archetypeById(config, id);
    return { label: a.label, description: a.description };
  } catch {
    return { label: id, description: '' };
  }
}

/** The deck's colors in WUBRG order: its cards' colors plus its basics. */
export function deckColors(deck: Deck, index: CardIndex): Color[] {
  const set = new Set<Color>();
  for (const [c, n] of Object.entries(deck.basics)) if ((n ?? 0) > 0) set.add(c as Color);
  for (const dc of deck.cards) for (const c of index.get(dc.cardId)?.identity ?? []) set.add(c);
  if (set.size === 0) set.add(deck.color);
  return COLORS.filter((c) => set.has(c));
}

/** A file name from a deck name: "White Tokens 60" becomes "white-tokens-60.txt". */
export function deckFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'deck'}.txt`;
}

/** "Today", "Yesterday", or a short date like "Oct 30". */
export function savedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}
