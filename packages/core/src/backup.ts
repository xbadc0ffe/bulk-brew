// One-file backup of everything the app stores: pool, decks, settings.
// The core has no clock, so the caller passes the export time.

import { COLORS, RARITIES, type Deck, type Pool, type Settings } from './types.ts';

export const BACKUP_SCHEMA = 1;

export interface Backup {
  schema: typeof BACKUP_SCHEMA;
  app: 'bulk-brew';
  exportedAt: string;
  /** Data pack version the pool and decks were resolved against. */
  dataVersion: string;
  pool: Pool;
  decks: Deck[];
  settings: Settings;
}

export interface BackupParts {
  pool: Pool;
  decks: Deck[];
  settings: Settings;
  dataVersion: string;
}

export function exportBackup(parts: BackupParts, exportedAt: string): string {
  const backup: Backup = {
    schema: BACKUP_SCHEMA,
    app: 'bulk-brew',
    exportedAt,
    dataVersion: parts.dataVersion,
    pool: parts.pool,
    decks: parts.decks,
    settings: parts.settings,
  };
  return JSON.stringify(backup, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function fail(msg: string): never {
  throw new Error(`Not a Bulk Brew backup: ${msg}.`);
}

function checkPrinting(printing: unknown, where: string): void {
  if (printing === undefined) return;
  if (!isRecord(printing) || typeof printing.set !== 'string') fail(`${where} has a bad printing`);
  if (printing.collectorNumber !== undefined && typeof printing.collectorNumber !== 'string')
    fail(`${where} has a bad collector number`);
}

/** Validate backup JSON. Throws a plain-language error on anything unexpected. */
export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    fail('the file is not valid JSON');
  }
  if (!isRecord(data)) fail('expected an object at the top level');
  if (data.schema !== BACKUP_SCHEMA) fail(`schema ${String(data.schema)} is not supported`);
  if (data.app !== 'bulk-brew') fail('it was made by a different app');
  if (typeof data.exportedAt !== 'string') fail('missing export time');

  const pool = data.pool;
  if (!isRecord(pool) || !isRecord(pool.entries)) fail('pool is missing');
  for (const [id, entry] of Object.entries(pool.entries)) {
    if (!isRecord(entry) || entry.cardId !== id) fail(`pool entry ${id} is malformed`);
    if (!isCount(entry.qty)) fail(`pool entry ${id} has no quantity`);
    checkPrinting(entry.printing, `pool entry ${id}`);
  }

  const decks = data.decks;
  if (!Array.isArray(decks)) fail('decks are missing');
  for (const deck of decks) {
    if (!isRecord(deck) || typeof deck.id !== 'string' || typeof deck.name !== 'string')
      fail('a deck has no id or name');
    const where = `deck "${deck.name}"`;
    if (![60, 40, 20].includes(deck.size as number)) fail(`${where} has a bad size`);
    if (!COLORS.includes(deck.color as never)) fail(`${where} has a bad color`);
    if (
      deck.colors !== undefined &&
      (!Array.isArray(deck.colors) || !deck.colors.every((c) => COLORS.includes(c as never)))
    )
      fail(`${where} has a bad color list`);
    if (!Array.isArray(deck.cards)) fail(`${where} has no card list`);
    for (const card of deck.cards) {
      if (!isRecord(card) || typeof card.cardId !== 'string' || !isCount(card.qty))
        fail(`${where} has a malformed card`);
      checkPrinting(card.printing, where);
    }
    if (!isRecord(deck.basics)) fail(`${where} has no basics`);
    for (const [color, n] of Object.entries(deck.basics)) {
      if (!COLORS.includes(color as never)) fail(`${where} has basics of an unknown color`);
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0)
        fail(`${where} has a bad basic land count`);
    }
  }

  const settings = data.settings;
  if (!isRecord(settings) || !isRecord(settings.maxCopies)) fail('settings are missing');
  if ('rarities' in settings) {
    const known = Array.isArray(settings.rarities)
      ? RARITIES.filter((r) => (settings.rarities as unknown[]).includes(r))
      : [];
    if (known.length > 0) settings.rarities = known;
    else delete settings.rarities;
  }

  return {
    schema: BACKUP_SCHEMA,
    app: 'bulk-brew',
    exportedAt: data.exportedAt,
    dataVersion: typeof data.dataVersion === 'string' ? data.dataVersion : '',
    pool: {
      entries: pool.entries as Pool['entries'],
      updatedAt: typeof pool.updatedAt === 'string' ? pool.updatedAt : data.exportedAt,
    },
    decks: decks as Deck[],
    settings: settings as unknown as Settings,
  };
}
