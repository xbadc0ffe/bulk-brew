// Decklist text export and Jumpstart packet pairing.

import type { BulkBrewConfig } from './config.ts';
import type { CardIndex } from './pack.ts';
import {
  COLOR_LABELS,
  COLORS,
  type CardRecord,
  type CardType,
  type Color,
  type Deck,
  type DeckCard,
} from './types.ts';

const GROUPS: { type: CardType; label: string }[] = [
  { type: 'creature', label: 'Creatures' },
  { type: 'planeswalker', label: 'Planeswalkers' },
  { type: 'instant', label: 'Instants' },
  { type: 'sorcery', label: 'Sorceries' },
  { type: 'artifact', label: 'Artifacts' },
  { type: 'enchantment', label: 'Enchantments' },
  { type: 'battle', label: 'Battles' },
  { type: 'land', label: 'Lands' },
];

/** The group a card is listed under: the first of its types in GROUPS order. */
export function primaryGroup(card: CardRecord): string {
  for (const g of GROUPS) if (card.types.includes(g.type)) return g.label;
  return 'Other';
}

function line(card: CardRecord, dc: DeckCard): string {
  const printing = dc.printing
    ? ` (${dc.printing.set.toUpperCase()})${dc.printing.collectorNumber ? ` ${dc.printing.collectorNumber}` : ''}`
    : '';
  return `${dc.qty} ${card.name}${printing}`;
}

/** Standard decklist text grouped by type, basics last. */
export function deckToDecklist(deck: Deck, index: CardIndex, config?: BulkBrewConfig): string {
  const groups = new Map<string, string[]>();
  const counts = new Map<string, number>();
  const sorted = [...deck.cards].sort((a, b) => {
    const an = index.get(a.cardId)?.name ?? a.cardId;
    const bn = index.get(b.cardId)?.name ?? b.cardId;
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  for (const dc of sorted) {
    const card = index.get(dc.cardId);
    if (!card) continue;
    const g = primaryGroup(card);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(line(card, dc));
    counts.set(g, (counts.get(g) ?? 0) + dc.qty);
  }
  const basicLines: string[] = [];
  let basicCount = 0;
  for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
    const qty = deck.basics[color] ?? 0;
    if (qty <= 0) continue;
    const name = config?.landRules.basics.names[color] ?? DEFAULT_BASICS[color];
    basicLines.push(`${qty} ${name}`);
    basicCount += qty;
  }
  if (basicLines.length) {
    if (!groups.has('Lands')) groups.set('Lands', []);
    groups.get('Lands')!.push(...basicLines);
    counts.set('Lands', (counts.get('Lands') ?? 0) + basicCount);
  }

  // The deck's own colors, plus the basics it runs, so a merged two-packet deck names both.
  const colors = new Set<Color>(deck.colors ?? [deck.color]);
  for (const [c, n] of Object.entries(deck.basics)) if ((n ?? 0) > 0) colors.add(c as Color);
  const colorText = COLORS.filter((c) => colors.has(c))
    .map((c) => COLOR_LABELS[c])
    .join(' and ');
  const out: string[] = [`// ${deck.name}`, `// ${deck.size} cards, ${colorText}`];
  for (const g of [...GROUPS.map((x) => x.label), 'Other']) {
    const lines = groups.get(g);
    if (!lines?.length) continue;
    out.push('', `// ${g} (${counts.get(g) ?? 0})`, ...lines);
  }
  return out.join('\n') + '\n';
}

const DEFAULT_BASICS = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
} as const;

export type PairResult = { ok: true; deck: Deck; text: string } | { ok: false; error: string };

/** Combine two 20-card packets of different colors into a 40-card decklist. */
export function pairPackets(
  a: Deck,
  b: Deck,
  index: CardIndex,
  config?: BulkBrewConfig,
): PairResult {
  if (a.size !== 20 || b.size !== 20)
    return { ok: false, error: 'Both decks must be 20-card packets.' };
  if (a.color === b.color) return { ok: false, error: 'Pick two packets of different colors.' };
  const merged = new Map<string, DeckCard>();
  for (const dc of [...a.cards, ...b.cards]) {
    const existing = merged.get(dc.cardId);
    if (existing) existing.qty += dc.qty;
    else {
      const copy: DeckCard = { cardId: dc.cardId, qty: dc.qty };
      if (dc.printing) copy.printing = dc.printing;
      merged.set(dc.cardId, copy);
    }
  }
  const basics: Deck['basics'] = {};
  for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
    const qty = (a.basics[color] ?? 0) + (b.basics[color] ?? 0);
    if (qty > 0) basics[color] = qty;
  }
  const deck: Deck = {
    id: `${a.id}+${b.id}`,
    name: `${a.name} + ${b.name}`,
    size: 40,
    color: a.color,
    archetype: `${a.archetype}+${b.archetype}`,
    cards: [...merged.values()],
    basics,
    committed: a.committed && b.committed,
    createdAt: a.createdAt > b.createdAt ? a.createdAt : b.createdAt,
    configVersion: a.configVersion,
    dataVersion: a.dataVersion,
  };
  const text = deckToDecklist(deck, index, config).replace(
    `// 40 cards, ${COLOR_LABELS[a.color]}`,
    `// 40 cards, ${COLOR_LABELS[a.color]} and ${COLOR_LABELS[b.color]}`,
  );
  return { ok: true, deck, text };
}
