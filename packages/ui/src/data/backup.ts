import { RARITIES, type Backup } from '@bulk-brew/core';
import { STORAGE_KEYS } from '../storage/keys.ts';
import type { KeyValueStore } from '../storage/kv.ts';
import type { DecksState } from './useDecks.ts';
import type { PoolState } from './usePool.ts';
import type { SettingsState } from './useSettings.ts';

const plural = (n: number, word: string) =>
  `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** The question to ask before restoring these parts of a backup. */
export function restoreQuestion(backup: Backup, parts: RestoreParts = {}): string {
  const pool = (parts.pool ?? true) ? backup.pool : undefined;
  const decks = (parts.decks ?? true) ? backup.decks : undefined;
  const settings = (parts.settings ?? true) ? backup.settings : undefined;
  const items: string[] = [];
  if (pool) {
    const cards = Object.values(pool.entries).reduce((n, e) => n + e.qty, 0);
    items.push(`your bulk list with its ${plural(cards, 'card')}`);
  }
  if (decks)
    items.push(
      decks.length > 0
        ? `your decks with its ${plural(decks.length, 'deck')}`
        : 'your decks with none',
    );
  if (settings) items.push('your settings');
  const list =
    items.length > 2
      ? `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
      : items.join(' and ');
  const when = backup.exportedAt.slice(0, 10);
  // Decks alone leave the bulk list as it is, so their cards do not come back to it.
  const note =
    decks && !pool ? ' Cards in the decks you have now do not go back to your bulk list.' : '';
  return `Replace ${list}, from the backup of ${when}?${note}`;
}

/** Which parts of a backup to restore; each defaults to whether the file has it. */
export interface RestoreParts {
  pool?: boolean;
  decks?: boolean;
  settings?: boolean;
}

/**
 * Replace what the app stores with the backup's parts. Storage is written
 * first in one transaction; state follows only when that succeeded, so a
 * failed restore leaves both storage and screen as they were. A part the
 * file lacks is left alone.
 */
export async function applyBackup(
  backup: Backup,
  state: { kv: KeyValueStore; pool: PoolState; decks: DecksState; settings: SettingsState },
  parts: RestoreParts = {},
): Promise<void> {
  const pool = (parts.pool ?? true) ? backup.pool : undefined;
  const decks = (parts.decks ?? true) ? backup.decks : undefined;
  const settings = (parts.settings ?? true) ? backup.settings : undefined;
  const writes: [string, unknown][] = [];
  if (pool) writes.push([STORAGE_KEYS.pool, pool]);
  if (decks) writes.push([STORAGE_KEYS.decks, decks]);
  if (settings) writes.push([STORAGE_KEYS.settings, settings]);
  await state.kv.setMany(writes);
  if (pool) state.pool.actions.transform(() => pool);
  if (decks) state.decks.replaceAll(decks);
  if (settings)
    state.settings.update({ ...settings, rarities: settings.rarities ?? [...RARITIES] });
}
