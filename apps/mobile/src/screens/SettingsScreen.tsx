import { useState } from 'react';
import { configVersion, exportBackup, parseBackup, type DeckSize } from '@bulk-brew/core';
import {
  applyBackup,
  backupFilename,
  CONFIG_PROBLEMS,
  downloadText,
  FAN_CONTENT_NOTICE,
  LICENSE_LINE,
  readFileText,
  REPO_URL,
  SCRYFALL_NOTICE,
  SCRYFALL_URL,
  WIZARDS_NOTICE,
} from '@bulk-brew/ui';
import { version } from '../../package.json';
import { useAppState } from '../app-context.ts';

const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const input =
  'w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-base disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';

export function SettingsScreen() {
  const { kv, pack, index, config, settings, pool, decks } = useAppState();
  const s = settings.settings;
  // Controls wait for the stored settings so an early edit cannot be overwritten.
  const ready = settings.loaded && pool.loaded && decks.loaded;
  const [message, setMessage] = useState<string>();

  const exportNow = () => {
    const now = new Date();
    const json = exportBackup(
      { pool: pool.pool, decks: decks.decks, settings: s, dataVersion: index?.version ?? '' },
      now.toISOString(),
    );
    downloadText(backupFilename(now), json);
    setMessage('Backup saved.');
  };

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await readFileText(file));
      const cards = Object.values(backup.pool.entries).reduce((n, e) => n + e.qty, 0);
      const when = backup.exportedAt.slice(0, 10);
      if (
        !window.confirm(
          `Replace your pool, decks, and settings with the backup from ${when} (${cards} cards, ${backup.decks.length} decks)?`,
        )
      )
        return;
      await applyBackup(backup, { kv, pool, decks, settings });
      setMessage(`Restored the backup from ${when}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const clearAll = () => {
    if (!window.confirm('Delete your pool, every saved deck, and your settings?')) return;
    pool.actions.clear();
    decks.replaceAll([]);
    settings.reset();
    setMessage('Everything was cleared.');
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Copies per card</h2>
        {([60, 40, 20] as DeckSize[]).map((size) => (
          <label key={size} className="flex items-center justify-between py-1">
            {size}-card deck
            <input
              type="number"
              min={1}
              max={99}
              disabled={!ready}
              value={s.maxCopies[size]}
              onChange={(e) =>
                settings.update({
                  maxCopies: { ...s.maxCopies, [size]: Math.max(1, Number(e.target.value) || 1) },
                })
              }
              className={input}
            />
          </label>
        ))}
        <p className={muted}>Basic lands are never limited.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Pool</h2>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.unlimitedBasics}
            onChange={(e) => settings.update({ unlimitedBasics: e.target.checked })}
          />
          Basic lands are unlimited
        </label>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.includeUnsets}
            onChange={(e) => settings.update({ includeUnsets: e.target.checked })}
          />
          Include Un-set and acorn cards
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Display</h2>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.showArt}
            onChange={(e) => settings.update({ showArt: e.target.checked })}
          />
          Show card art (loads images from Scryfall as you browse)
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Backup</h2>
        <p className={muted}>
          One file holds your pool, saved decks, and settings. Restoring replaces all three.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!ready} onClick={exportNow}>
            Export backup
          </button>
          <label className={`${button} ${ready ? '' : 'opacity-50'}`}>
            Restore backup
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              disabled={!ready}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void restore(file);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className={button} disabled={!ready} onClick={clearAll}>
            Clear all data
          </button>
        </div>
        {message && <p className={muted}>{message}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Card data</h2>
        <p className={muted}>
          {pack.status === 'ready'
            ? `Version ${pack.index.version}, ${pack.index.size} cards.`
            : pack.status === 'loading'
              ? 'Loading.'
              : `Failed to load: ${pack.error}`}
        </p>
        {CONFIG_PROBLEMS.length > 0 && (
          <div className="text-amber-600">
            <p>The shipped config has problems:</p>
            <ul className="list-disc pl-5">
              {CONFIG_PROBLEMS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">About</h2>
        <p className={muted}>
          Bulk Brew {version}. Card data {index?.version ?? 'not loaded'}
          {index ? `, ${index.size} cards` : ''}. Config {configVersion(config)}.
        </p>
        <p className={muted}>{FAN_CONTENT_NOTICE}</p>
        <p className={muted}>{WIZARDS_NOTICE}</p>
        <p className={muted}>
          {SCRYFALL_NOTICE}{' '}
          <a className="underline" href={SCRYFALL_URL} target="_blank" rel="noreferrer">
            scryfall.com
          </a>
        </p>
        <p className={muted}>
          {LICENSE_LINE}{' '}
          <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </p>
        <button type="button" className={button} disabled={!ready} onClick={settings.reset}>
          Reset settings to defaults
        </button>
      </section>
    </div>
  );
}
