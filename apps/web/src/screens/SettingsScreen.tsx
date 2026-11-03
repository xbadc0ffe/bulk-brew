import { useRef, useState, type ReactNode } from 'react';
import {
  configVersion,
  DATA_SCHEMA_VERSION,
  exportBackup,
  parseBackup,
  type DeckSize,
} from '@bulk-brew/core';
import {
  APPEARANCE_MODES,
  applyBackup,
  backupFilename,
  CONFIG_PROBLEMS,
  downloadText,
  FAN_CONTENT_NOTICE,
  readFileText,
  REPO_URL,
  SCRYFALL_NOTICE,
  SCRYFALL_URL,
  Segmented,
  THEME_COLORS,
  Toggle,
  ui,
  WIZARDS_NOTICE,
  type ThemeColor,
} from '@bulk-brew/ui';
import { version } from '../../package.json';
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

const COPY_ROWS: { size: DeckSize; label: string }[] = [
  { size: 60, label: 'Max copies, 60-card' },
  { size: 40, label: 'Max copies, 40-card' },
  { size: 20, label: 'Max copies, 20-card packet' },
];

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
        <span>{label}</span>
        {hint && <span className="text-[11.5px] text-fg-2">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { kv, pack, index, config, settings, pool, decks, appearance } = useAppState();
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
          `Replace your pool, decks, and settings with the backup from ${when} (${cards} cards, ${backup.decks.length} decks)?`,
        )
      )
        return;
      await applyBackup(backup, { kv, pool, decks, settings });
      setMessage(`Restored the backup from ${when}.`);
    } catch (err) {
      setMessage(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const clearAll = () => {
    if (!window.confirm('Delete your pool, every saved deck, and your settings?')) return;
    pool.actions.clear();
    decks.replaceAll([]);
    settings.reset();
    appearance.reset();
    setMessage('Everything was cleared.');
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-[22px] text-[13px]">
      <h1 className="mb-4 text-[20px] font-semibold">Settings</h1>
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Group title="Building">
            {COPY_ROWS.map(({ size, label }) => (
              <Row key={size} label={label} htmlFor={`copies-${size}`}>
                <input
                  id={`copies-${size}`}
                  type="number"
                  min={1}
                  max={99}
                  disabled={!ready}
                  value={s.maxCopies[size]}
                  onChange={(e) =>
                    settings.update({
                      maxCopies: {
                        ...s.maxCopies,
                        [size]: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-14 rounded-[5px] border border-line-strong bg-surface px-2.5 py-[3px] text-center font-mono text-[12.5px] disabled:opacity-50"
                />
              </Row>
            ))}
            <Row label="Unlimited basic lands" hint="Basics need not be imported">
              <Toggle
                label="Unlimited basic lands"
                checked={s.unlimitedBasics}
                disabled={!ready}
                onChange={(v) => settings.update({ unlimitedBasics: v })}
              />
            </Row>
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
          <div>
            <button
              type="button"
              className={`${ui.quiet} text-[12px] underline underline-offset-2`}
              disabled={!ready}
              onClick={() => {
                settings.reset();
                setMessage('Settings are back to their defaults.');
              }}
            >
              Reset settings to defaults
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Group title="Card data">
            <Row
              label={`Scryfall oracle cards · v${DATA_SCHEMA_VERSION}`}
              hint={
                pack.status === 'ready'
                  ? `${pack.index.version} · ${pack.index.size.toLocaleString('en-US')} cards · config ${configVersion(config)}`
                  : pack.status === 'loading'
                    ? 'Loading'
                    : `Failed to load: ${pack.error}`
              }
            />
            {CONFIG_PROBLEMS.length > 0 && (
              <div className="px-4 py-[11px] text-ink">
                <p>The shipped config has problems:</p>
                <ul className="list-disc pl-5">
                  {CONFIG_PROBLEMS.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </Group>

          <Group title="Backup">
            <Row label="Export backup" hint="Pool, decks and settings as one file">
              <button type="button" className={ui.small} disabled={!ready} onClick={exportNow}>
                Export
              </button>
            </Row>
            <Row label="Restore from backup" hint="Replaces your pool, decks, and settings">
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
            <Row label={<span className="text-fg-1">Clear all data</span>}>
              <button type="button" className={ui.small} disabled={!ready} onClick={clearAll}>
                Clear
              </button>
            </Row>
          </Group>
          {message && (
            <p role="status" className="-mt-3 text-[12.5px] text-fg-2">
              {message}
            </p>
          )}

          <section className="flex flex-col gap-2 text-[12.5px] leading-[1.6] text-fg-1">
            <h2 className={ui.sectionLabel}>About</h2>
            <p>
              Bulk Brew {version} · MIT License ·{' '}
              <a className={ui.link} href={REPO_URL} target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
            </p>
            <p>{FAN_CONTENT_NOTICE}</p>
            <p>{WIZARDS_NOTICE}</p>
            <p>
              {SCRYFALL_NOTICE}{' '}
              <a className={ui.link} href={SCRYFALL_URL} target="_blank" rel="noreferrer">
                scryfall.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
