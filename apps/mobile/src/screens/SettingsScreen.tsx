import { useRef, useState } from 'react';
import { exportBackup, parseBackup, type DeckSize } from '@bulk-brew/core';
import {
  APPEARANCE_MODES,
  applyBackup,
  restoreQuestion,
  backupFilename,
  downloadText,
  phone,
  readFileText,
  Segmented,
  Stepper,
  THEME_COLORS,
  Toggle,
  type ThemeColor,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { Group, LargeTitle, Pushed, Row, ToggleRow } from '../parts.tsx';
import { AboutPage } from './AboutPage.tsx';

const SWATCH: Record<ThemeColor, string> = {
  grey: 'var(--text2)',
  W: 'oklch(0.86 0.02 85)',
  U: 'oklch(0.78 0.05 245)',
  B: 'oklch(0.55 0.04 305)',
  R: 'oklch(0.72 0.06 25)',
  G: 'oklch(0.68 0.06 150)',
};

const SIZES: { size: DeckSize; label: string }[] = [
  { size: 60, label: '60-card deck' },
  { size: 40, label: '40-card deck' },
  { size: 20, label: '20-card packet' },
];

type Sub = 'copies' | 'appearance' | 'about' | undefined;

export function SettingsScreen() {
  const { kv, index, settings, pool, decks, appearance, build } = useAppState();
  const s = settings.settings;
  // Controls wait for the stored settings so an early edit cannot be overwritten.
  const ready = settings.loaded && pool.loaded && decks.loaded;
  const [message, setMessage] = useState<string>();
  const [sub, setSub] = useState<Sub>();
  const restoreInput = useRef<HTMLInputElement>(null);

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
      const when = backup.exportedAt.slice(0, 10);
      if (!window.confirm(restoreQuestion(backup))) return;
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

  const mode = APPEARANCE_MODES.find((m) => m.id === appearance.appearance.mode)?.label;
  const theme = THEME_COLORS.find((t) => t.id === appearance.appearance.theme)?.label;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LargeTitle title="Settings" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6">
        <Group label="Building">
          <Row
            label="Max copies"
            value={`60: ${s.maxCopies[60]} · 40: ${s.maxCopies[40]} · 20: ${s.maxCopies[20]}`}
            onClick={() => setSub('copies')}
            disabled={!ready}
          />
          <ToggleRow label="Include Un-set and acorn cards">
            <Toggle
              label="Include Un-set and acorn cards"
              checked={s.includeUnsets}
              disabled={!ready}
              onChange={(v) => settings.update({ includeUnsets: v })}
              variant="phone"
            />
          </ToggleRow>
        </Group>

        <Group label="Display">
          <ToggleRow label="Show card art" hint="Loads images from Scryfall as you browse">
            <Toggle
              label="Show card art"
              checked={s.showArt}
              disabled={!ready}
              onChange={(v) => settings.update({ showArt: v })}
              variant="phone"
            />
          </ToggleRow>
          <Row
            label="Appearance"
            value={`${mode} · ${theme}`}
            onClick={() => setSub('appearance')}
          />
        </Group>

        <Group label="Backup">
          <Row
            label="Export backup"
            hint="Bulk list, decks, and settings as one file"
            onClick={exportNow}
            disabled={!ready}
          />
          <Row
            label="Restore from backup"
            hint="Replaces your bulk list, decks, and settings"
            onClick={() => restoreInput.current?.click()}
            disabled={!ready}
          />
          <Row
            label={<span className="text-fg-1">Clear all data</span>}
            onClick={clearAll}
            disabled={!ready}
          />
        </Group>
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
        <p role="status" className={message ? `${phone.note} px-1` : 'sr-only'}>
          {message}
        </p>

        <Group>
          <Row label="About Bulk Brew" onClick={() => setSub('about')} />
        </Group>
        <button
          type="button"
          className="min-h-11 self-start px-1 text-[0.8125rem] text-fg-2 underline"
          disabled={!ready}
          onClick={() => {
            settings.reset();
            setMessage('Settings are back to their defaults.');
          }}
        >
          Reset settings to defaults
        </button>
      </div>

      {sub === 'about' && <AboutPage onBack={() => setSub(undefined)} />}

      {sub === 'copies' && (
        <Pushed back={{ label: 'Settings', onClick: () => setSub(undefined) }} title="Max copies">
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Group>
              {SIZES.map(({ size, label }) => (
                <Row key={size} label={label}>
                  <Stepper
                    label={`Max copies, ${label}`}
                    value={s.maxCopies[size]}
                    min={1}
                    max={99}
                    onChange={(n) => settings.update({ maxCopies: { ...s.maxCopies, [size]: n } })}
                    variant="phone"
                  />
                </Row>
              ))}
            </Group>
            <p className={`${phone.note} px-1`}>
              The most copies of one card a deck may use. Basic lands are never limited.
            </p>
          </div>
        </Pushed>
      )}

      {sub === 'appearance' && (
        <Pushed back={{ label: 'Settings', onClick: () => setSub(undefined) }} title="Appearance">
          <div className="flex flex-col gap-4 px-4 pb-4">
            <section className="flex flex-col gap-1.5">
              <h2 className={phone.groupLabel}>Mode</h2>
              <Segmented
                label="Appearance"
                options={APPEARANCE_MODES}
                value={appearance.appearance.mode}
                onChange={appearance.setMode}
                variant="phone"
              />
              <p className={`${phone.note} px-1`}>
                System follows the light or dark setting of your device.
              </p>
            </section>
            <section className="flex flex-col gap-1.5">
              <h2 className={phone.groupLabel}>Theme color</h2>
              <div role="radiogroup" aria-label="Theme color" className={phone.group}>
                {THEME_COLORS.map((t) => {
                  const on = appearance.appearance.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => appearance.setTheme(t.id)}
                      className={`${phone.row} w-full active:bg-surface-2`}
                    >
                      <span
                        aria-hidden
                        className={`size-6 shrink-0 rounded-full ${on ? 'outline-2 outline-offset-2 outline-ink' : 'border border-line-strong'}`}
                        style={{ background: SWATCH[t.id] }}
                      />
                      <span className="flex-1 text-left text-[0.9375rem]">{t.label}</span>
                      {on && <span className="text-[0.9375rem] text-ink">✓</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </Pushed>
      )}
    </div>
  );
}
