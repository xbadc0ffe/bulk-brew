// In-memory index over a data pack: lookup by oracle id and by name.

import {
  DATA_SCHEMA_VERSION,
  SUPPORTED_DATA_SCHEMAS,
  type CardRecord,
  type DataPack,
} from './types.ts';
import { normalizeName, splitFaces } from './names.ts';

export interface FindOptions {
  includeUnsets?: boolean;
}

export class CardIndex {
  readonly pack: DataPack;
  private readonly byId = new Map<string, CardRecord>();
  /** Normalized full name -> ids, non-Un-set cards first. */
  private readonly byName = new Map<string, string[]>();
  /** Normalized single face name -> ids. */
  private readonly byFace = new Map<string, string[]>();
  /** Normalized flavor name (an alternate printing's printed name) -> ids. */
  private readonly byFlavor = new Map<string, string[]>();

  constructor(pack: DataPack) {
    this.pack = pack;
    for (const card of pack.cards) {
      this.byId.set(card.id, card);
      push(this.byName, normalizeName(card.name), card);
      const faces = card.faces?.map((f) => f.name) ?? splitFaces(card.name);
      if (faces.length > 1 || card.faces) {
        for (const face of faces) push(this.byFace, normalizeName(face), card);
      }
      for (const flavor of card.flavorNames ?? []) push(this.byFlavor, normalizeName(flavor), card);
    }
  }

  get size(): number {
    return this.pack.cards.length;
  }

  /** The Scryfall bulk data date, for display. */
  get version(): string {
    return this.pack.version;
  }

  /**
   * What decks record as their data version. Schema 2 adds fields that change
   * builds, so a schema 2 pack of the same date is different data.
   */
  get dataVersion(): string {
    return this.pack.schema === 1 ? this.pack.version : `${this.pack.version}.s${this.pack.schema}`;
  }

  get(id: string): CardRecord | undefined {
    return this.byId.get(id);
  }

  /** Every normalized full name, for suggestions. */
  names(): IterableIterator<string> {
    return this.byName.keys();
  }

  /**
   * Find a card by the name a person typed: the full name, a single face
   * name, the front face of an "A // B" name, or, when no card has that name,
   * a flavor name printed on one of its printings.
   */
  find(name: string, opts: FindOptions = {}): CardRecord | undefined {
    const key = normalizeName(name);
    if (!key) return undefined;
    const named = this.byName.get(key);
    const front = splitFaces(key)[0] ?? '';
    const hit =
      this.pick(named, opts) ??
      this.pick(this.byFace.get(key), opts) ??
      this.pick(this.byFace.get(front), opts);
    // A card's own name, even a hidden Un-set one, never falls through to another card's flavor name.
    if (hit || named) return hit;
    return this.pick(this.byFlavor.get(key), opts) ?? this.pick(this.byFlavor.get(front), opts);
  }

  private pick(ids: string[] | undefined, opts: FindOptions): CardRecord | undefined {
    if (!ids) return undefined;
    for (const id of ids) {
      const card = this.byId.get(id)!;
      if (card.unset && !opts.includeUnsets) continue;
      return card;
    }
    return undefined;
  }
}

function push(map: Map<string, string[]>, key: string, card: CardRecord): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [card.id]);
  } else if (card.unset) {
    list.push(card.id);
  } else {
    list.unshift(card.id);
  }
}

/** Parse and validate pack JSON. Throws on a schema mismatch. */
export function parsePack(json: string): DataPack {
  const pack = JSON.parse(json) as DataPack;
  if (!SUPPORTED_DATA_SCHEMAS.includes(pack.schema)) {
    throw new Error(
      `data pack schema ${pack.schema} is not supported (want ${SUPPORTED_DATA_SCHEMAS.join(' or ')}; current is ${DATA_SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(pack.cards)) throw new Error('data pack has no cards');
  return pack;
}
