// Scryfall card object in, CardRecord out. Also decides what is playable.

import type { CardFace, CardRecord, CardType, Color, ManaColor, Rarity } from '@bulk-brew/core';
import type { ScryfallCard, ScryfallFace } from './scryfall.ts';

/** Layouts that are not cards you can put in a deck. */
const EXCLUDED_LAYOUTS = new Set([
  'token',
  'double_faced_token',
  'emblem',
  'art_series',
  'planar',
  'scheme',
  'vanguard',
  'augment',
  'host',
]);

/** Type lines that mark non-deck objects even on a normal layout. */
const EXCLUDED_TYPES =
  /^(Token|Card|Dungeon|Emblem|Plane|Phenomenon|Scheme|Vanguard|Conspiracy|Hero|Stickers?)\b/;

const COLORS = new Set<string>(['W', 'U', 'B', 'R', 'G']);

const TYPE_WORDS: Record<string, CardType> = {
  Creature: 'creature',
  Instant: 'instant',
  Sorcery: 'sorcery',
  Enchantment: 'enchantment',
  Artifact: 'artifact',
  Planeswalker: 'planeswalker',
  Battle: 'battle',
  Land: 'land',
  Kindred: 'kindred',
  Tribal: 'kindred',
};

/** Playtest sets (Mystery Booster test cards) have no legality anywhere. */
const PLAYTEST_SETS = new Set(['cmb1', 'cmb2']);

/**
 * Whether a card can go in a deck. The oracle file carries one printing per
 * card and sometimes picks a digital-only printing of a real paper card, so
 * the printing's `games` list is not used. Only Alchemy designs are dropped.
 */
export function isPlayable(card: ScryfallCard): boolean {
  if (!card.oracle_id) return false;
  if (card.set_type === 'alchemy') return false;
  if (card.oversized) return false;
  if (EXCLUDED_LAYOUTS.has(card.layout)) return false;
  const typeLine = card.type_line ?? card.card_faces?.[0]?.type_line ?? '';
  if (EXCLUDED_TYPES.test(typeLine)) return false;
  return true;
}

export function isUnset(card: ScryfallCard): boolean {
  if (card.security_stamp === 'acorn') return true;
  if (PLAYTEST_SETS.has(card.set)) return true;
  if (card.set_type === 'funny') {
    const legalSomewhere = Object.values(card.legalities ?? {}).some((v) => v !== 'not_legal');
    return !legalSomewhere;
  }
  return false;
}

/** Normalized types from a type line's supertype and type words (before the long dash). */
export function parseTypes(typeLine: string): CardType[] {
  const out: CardType[] = [];
  for (const part of typeLine.split('//')) {
    const left = part.split('—')[0] ?? '';
    for (const word of left.trim().split(/\s+/)) {
      const t = TYPE_WORDS[word];
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** Scryfall's special (timeshifted and similar) and bonus rarities sit above uncommon; store them as rare. */
export function rarityOf(r: string | undefined): Rarity | undefined {
  if (r === 'common' || r === 'uncommon' || r === 'rare' || r === 'mythic') return r;
  if (r === 'special' || r === 'bonus') return 'rare';
  return undefined;
}

const ENTERS_TAPPED = /\benters (the battlefield )?tapped\b/i;

function colorsOf(list: string[] | undefined): Color[] {
  return (list ?? []).filter((c): c is Color => COLORS.has(c));
}

function faceOf(f: ScryfallFace, fallbackColors: Color[]): CardFace {
  const face: CardFace = {
    name: f.name,
    typeLine: f.type_line ?? '',
    colors: f.colors ? colorsOf(f.colors) : fallbackColors,
  };
  if (f.mana_cost) face.manaCost = f.mana_cost;
  if (f.oracle_text) face.text = f.oracle_text;
  if (f.power !== undefined) face.power = f.power;
  if (f.toughness !== undefined) face.toughness = f.toughness;
  if (f.loyalty !== undefined) face.loyalty = f.loyalty;
  return face;
}

/**
 * Build the shipped record. Multi-face rules:
 * - transform / modal_dfc: cost and colors come from the front face; a modal
 *   back face that is a land also marks the card as a land.
 * - split / adventure / prepare: the card's own mana_cost is "A // B"; the
 *   record keeps the front half as manaCost and both halves in faces.
 */
export function toCardRecord(card: ScryfallCard, tags: string[]): CardRecord {
  const faces = card.card_faces ?? [];
  const front = faces[0];
  const topColors = colorsOf(card.colors);
  const colors = card.colors ? topColors : front ? colorsOf(front.colors) : [];

  // Front face cost when faces exist; otherwise the card's own cost, which for
  // split-style cards would read "A // B".
  const ownCost = card.mana_cost && !card.mana_cost.includes('//') ? card.mana_cost : undefined;
  const manaCost = front?.mana_cost || ownCost;
  const typeLine = card.type_line ?? front?.type_line ?? '';
  const text =
    faces.length > 0
      ? faces.map((f) => f.oracle_text ?? '').join('\n//\n')
      : (card.oracle_text ?? '');

  let types = parseTypes(front?.type_line ?? typeLine);
  if (card.layout === 'modal_dfc') {
    for (const f of faces.slice(1)) {
      for (const t of parseTypes(f.type_line ?? '')) if (!types.includes(t)) types.push(t);
    }
  } else if (faces.length === 0) {
    types = parseTypes(typeLine);
  }

  const rec: CardRecord = {
    id: card.oracle_id!,
    name: card.name,
    layout: card.layout,
    mv: card.cmc ?? 0,
    typeLine,
    text,
    colors,
    identity: colorsOf(card.color_identity),
    keywords: card.keywords ?? [],
    types,
    tags,
    img: card.id,
  };
  if (manaCost) rec.manaCost = manaCost;
  const pt = front ?? card;
  if (pt.power !== undefined) rec.power = pt.power;
  if (pt.toughness !== undefined) rec.toughness = pt.toughness;
  if (pt.loyalty !== undefined) rec.loyalty = pt.loyalty;
  if (card.produced_mana?.length) {
    rec.produces = card.produced_mana.filter((c): c is ManaColor => COLORS.has(c) || c === 'C');
  }
  if (types.includes('land') && ENTERS_TAPPED.test(text)) rec.entersTapped = true;
  if (isUnset(card)) rec.unset = true;
  const commander = card.legalities?.commander;
  if (commander === 'banned' || commander === 'not_legal') rec.commanderLegality = commander;
  if (card.game_changer) rec.gameChanger = true;
  if (typeof card.edhrec_rank === 'number' && card.edhrec_rank > 0) rec.rank = card.edhrec_rank;
  const rarity = rarityOf(card.rarity);
  if (rarity) rec.rarity = rarity;
  if (faces.length > 0) rec.faces = faces.map((f) => faceOf(f, colors));
  return rec;
}
