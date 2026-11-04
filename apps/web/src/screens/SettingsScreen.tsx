import { useRef, useState, type ReactNode } from 'react';
import { exportBackup, parseBackup } from '@bulk-brew/core';
import {
  APPEARANCE_MODES,
  applyBackup,
  backupFilename,
  downloadText,
  readFileText,
  Segmented,
  THEME_COLORS,
  Toggle,
  ui,
  type ThemeColor,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/** Swatch fills from the design; grey follows the theme's secondary text color. */
const SWATCH: Record<ThemeColor, string> = {
  grey: 'var(--text2)',
  W: 'oklch(0.86 0.02 85)',
  U: 'oklch(0.78 0.05 245)',
  B: 'oklch(0.55 0.04 305)',
  R: 'oklch(0.72 0.06 25)',
  G: 'oklch(0.68 0.06 150)',
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={ui.sectionLabel}>{title}</h2>
      <div className={ui.box}>{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
}) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-2 px-4 py-[11px] last:border-b-0">
      <Label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-0.5">
        <span className={ui.label}>{label}</span>
        {hint && <span className={ui.hint}>{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { kv, index, settings, pool, decks, appearance, build } = useAppState();
  const s = settings.settings;
  // Controls wait for the stored settings so an early edit cannot be overwritten.
  const ready = settings.loaded && pool.loaded && decks.loaded;
  const [message, setMessage] = useState<string>();
  const restoreInput = useRef<HTMLInputElement>(null);

  const exportNow = () => {
    const now = new Date();
    const json = exportBackup(
      { pool: pool.pool, decks: decks.decks, settings: s, dataVersion: index?.version ?? '' },
      now.toISOString(),
    );
    downloadText(backupFilename(now), json);
    setMessage('Backup downloaded.');
  };

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await readFileText(file));
      const cards = Object.values(backup.pool.entries).reduce((n, e) => n + e.qty, 0);
      const when = backup.exportedAt.slice(0, 10);
      if (
        !window.confirm(
          `Replace your bulk list, decks, and settings with the backup from ${when} (${cards} cards, ${backup.decks.length} decks)?`,
        )
      )
        return;
      await applyBackup(backup, { kv, pool, decks, settings });
      // A build made from the old pool no longer fits.
      build.reset();
      setMessage(`Restored the backup from ${when}.`);
    } catch (err) {
      setMessage(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const clearAll = () => {
    if (!window.confirm('Delete your bulk list, every saved deck, and your settings?')) return;
    pool.actions.clear();
    decks.replaceAll([]);
    settings.reset();
    appearance.reset();
    build.reset();
    setMessage('Everything was cleared.');
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-[22px] text-[13px]">
      <h1 className="mb-4 text-[20px] font-semibold">Settings</h1>
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Group title="Building">
            <Row label="Include Un-set and acorn cards">
              <Toggle
                label="Include Un-set and acorn cards"
                checked={s.includeUnsets}
                disabled={!ready}
                onChange={(v) => settings.update({ includeUnsets: v })}
              />
            </Row>
          </Group>

          <Group title="Display">
            <Row label="Show card art" hint="Loads images from Scryfall as you browse">
              <Toggle
                label="Show card art"
                checked={s.showArt}
                disabled={!ready}
                onChange={(v) => settings.update({ showArt: v })}
              />
            </Row>
            <Row label="Appearance">
              <Segmented
                label="Appearance"
                options={APPEARANCE_MODES}
                value={appearance.appearance.mode}
                onChange={appearance.setMode}
                compact
              />
            </Row>
            <Row label="Theme color" hint="Tints the whole app toward one color">
              <div role="radiogroup" aria-label="Theme color" className="flex gap-1.5">
                {THEME_COLORS.map((t) => {
                  const on = appearance.appearance.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${t.label} theme`}
                      title={t.label}
                      onClick={() => appearance.setTheme(t.id)}
                      className={`size-5 rounded-full ${on ? 'outline-2 outline-offset-2 outline-ink' : 'border border-line-strong'}`}
                      style={{ background: SWATCH[t.id] }}
                    />
                  );
                })}
              </div>
            </Row>
          </Group>
        </div>

        <div className="flex flex-col gap-5">
          <Group title="Your data">
            <Row label="Export backup" hint="Bulk list, decks, and settings as one file">
              <button type="button" className={ui.small} disabled={!ready} onClick={exportNow}>
                Export
              </button>
            </Row>
            <Row label="Restore from backup" hint="Replaces your bulk list, decks, and settings">
              <button
                type="button"
                className={ui.small}
                disabled={!ready}
                onClick={() => restoreInput.current?.click()}
              >
                Choose file
              </button>
              <input
                ref={restoreInput}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void restore(file);
                  e.target.value = '';
                }}
              />
            </Row>
            <Row
              label="Reset settings to defaults"
              hint="Your bulk list and decks stay as they are"
            >
              <button
                type="button"
                className={ui.small}
                disabled={!ready}
                onClick={() => {
                  settings.reset();
                  setMessage('Settings are back to their defaults.');
                }}
              >
                Reset
              </button>
            </Row>
            <Row label="Clear all data" hint="Deletes your bulk list, decks, and settings">
              <button type="button" className={ui.smallStop} disabled={!ready} onClick={clearAll}>
                Clear
              </button>
            </Row>
          </Group>
          <p role="status" className={message ? '-mt-3 text-[12.5px] text-fg-2' : 'sr-only'}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
