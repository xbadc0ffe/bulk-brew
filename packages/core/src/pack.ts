// In-memory index over a data pack: lookup by oracle id and by name.

import { DATA_SCHEMA_VERSION, type CardRecord, type DataPack } from './types.ts';
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

  constructor(pack: DataPack) {
    this.pack = pack;
    for (const card of pack.cards) {
      this.byId.set(card.id, card);
      push(this.byName, normalizeName(card.name), card);
      const faces = card.faces?.map((f) => f.name) ?? splitFaces(card.name);
      if (faces.length > 1 || card.faces) {
        for (const face of faces) push(this.byFace, normalizeName(face), card);
      }
    }
  }

  get size(): number {
    return this.pack.cards.length;
  }

  get version(): string {
    return this.pack.version;
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
   * name, or the front face of an "A // B" name.
   */
  find(name: string, opts: FindOptions = {}): CardRecord | undefined {
    const key = normalizeName(name);
    if (!key) return undefined;
    return (
      this.pick(this.byName.get(key), opts) ??
      this.pick(this.byFace.get(key), opts) ??
      this.pick(this.byFace.get(splitFaces(key)[0] ?? ''), opts)
    );
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
  if (pack.schema !== DATA_SCHEMA_VERSION) {
    throw new Error(
      `data pack schema ${pack.schema} is not supported (want ${DATA_SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(pack.cards)) throw new Error('data pack has no cards');
  return pack;
}
