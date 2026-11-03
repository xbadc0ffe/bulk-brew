import type { Backup } from '@bulk-brew/core';
import { STORAGE_KEYS } from '../storage/keys.ts';
import type { KeyValueStore } from '../storage/kv.ts';
import type { DecksState } from './useDecks.ts';
import type { PoolState } from './usePool.ts';
import type { SettingsState } from './useSettings.ts';

/**
 * Replace everything the app stores with the backup's contents. Storage is
 * written first in one transaction; state follows only when that succeeded,
 * so a failed restore leaves both storage and screen as they were.
 */
export async function applyBackup(
  backup: Backup,
  state: { kv: KeyValueStore; pool: PoolState; decks: DecksState; settings: SettingsState },
): Promise<void> {
  await state.kv.setMany([
    [STORAGE_KEYS.pool, backup.pool],
    [STORAGE_KEYS.decks, backup.decks],
    [STORAGE_KEYS.settings, backup.settings],
  ]);
  state.pool.actions.transform(() => backup.pool);
  state.decks.replaceAll(backup.decks);
  state.settings.update(backup.settings);
}
