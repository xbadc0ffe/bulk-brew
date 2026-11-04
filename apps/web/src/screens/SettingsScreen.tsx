import { useRef, useState, type ReactNode } from 'react';
import { collectionText, exportBackup, parseBackup } from '@bulk-brew/core';
import {
  APPEARANCE_MODES,
  applyBackup,
  ChoiceDialog,
  restoreQuestion,
  downloadText,
  exportFilename,
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

/** What an export or restore covers. */
type Part = 'list' | 'decks' | 'both';

const PART_LABELS: Record<Part, string> = { list: 'Bulk list', decks: 'Decks', both: 'Both' };

const plural = (n: number, word: string) =>
  `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

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
    <div className="flex items-center justify-between gap-4 border-b-1 border-surface-2 px-4 py-[11px] last:border-b-0">
      <Label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-0.5">
        <span className={ui.label}>{label}</span>
        {hint && <span className={ui.hint}>{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { kv, index, config, settings, pool, decks, appearance, build } = useAppState();
  const s = settings.settings;
  // Controls wait for the stored settings so an early edit cannot be overwritten.
  const ready = settings.loaded && pool.loaded && decks.loaded;
  const [message, setMessage] = useState<string>();
  const restoreInput = useRef<HTMLInputElement>(null);
  /** The open export question: what to export, then which format. */
  const [exporting, setExporting] = useState<'what' | Part>();
  const [restoreAsk, setRestoreAsk] = useState(false);
  /** What the file about to be picked should restore. */
  const [restoring, setRestoring] = useState<Part>('both');

  const pickRestore = (what: Part) => {
    setRestoreAsk(false);
    setRestoring(what);
    // Still inside the click, so the browser lets the file picker open.
    restoreInput.current?.click();
  };

  const exportNow = (what: Part, format: 'json' | 'txt') => {
    setExporting(undefined);
    const now = new Date();
    const withList = what !== 'decks';
    const withDecks = what !== 'list';
    if (format === 'json') {
      // Both is a full backup, settings included, as before.
      const json = exportBackup(
        {
          ...(withList ? { pool: pool.pool } : {}),
          ...(withDecks ? { decks: decks.decks } : {}),
          ...(what === 'both' ? { settings: s } : {}),
          dataVersion: index?.version ?? '',
        },
        now.toISOString(),
      );
      downloadText(exportFilename(now, what, 'json'), json);
    } else {
      if (!index) {
        setMessage('The card data is still loading. Try the text export again in a moment.');
        return;
      }
      const text = collectionText(
        {
          ...(withList ? { pool: pool.pool } : {}),
          ...(withDecks ? { decks: decks.decks } : {}),
        },
        index,
        config,
      );
      downloadText(exportFilename(now, what, 'txt'), text);
    }
    setMessage(
      `${what === 'both' ? 'Bulk list and decks' : PART_LABELS[what]} downloaded as ${format.toUpperCase()}.`,
    );
  };

  const restore = async (file: File) => {
    const what = restoring;
    try {
      const backup = parseBackup(await readFileText(file));
      const when = backup.exportedAt.slice(0, 10);
      const wantList = what !== 'decks';
      const wantDecks = what !== 'list';
      if ((wantList && !backup.pool) || (wantDecks && !backup.decks)) {
        const has = backup.pool ? 'a bulk list' : backup.decks ? 'decks' : 'settings';
        setMessage(
          `That file holds only ${has}, so there is no ${wantList && !backup.pool ? 'bulk list' : 'deck list'} to restore.`,
        );
        return;
      }
      const parts = { pool: wantList, decks: wantDecks, settings: what === 'both' };
      if (!window.confirm(restoreQuestion(backup, parts))) return;
      await applyBackup(backup, { kv, pool, decks, settings }, parts);
      // A build or a saved-deck note from before the restore no longer fits.
      build.reset();
      setMessage(
        `Restored ${what === 'both' ? 'the backup' : PART_LABELS[what].toLowerCase()} from ${when}.`,
      );
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
            <Row label="Export" hint="Your bulk list, decks, or both, as JSON or text">
              <button
                type="button"
                className={ui.small}
                disabled={!ready}
                onClick={() => setExporting('what')}
              >
                Export
              </button>
            </Row>
            <Row label="Restore from backup" hint="Replaces your bulk list, decks, or both">
              <button
                type="button"
                className={ui.small}
                disabled={!ready}
                onClick={() => setRestoreAsk(true)}
              >
                Restore
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

      <ChoiceDialog
        open={exporting === 'what'}
        title="Mass export"
        message="What do you want to export?"
        choices={[
          ...(['list', 'decks', 'both'] as const).map((p) => ({
            label: PART_LABELS[p],
            detail:
              p === 'list'
                ? plural(
                    Object.values(pool.pool.entries).reduce((n, e) => n + e.qty, 0),
                    'card',
                  )
                : p === 'decks'
                  ? plural(decks.decks.length, 'saved deck')
                  : 'Bulk list and decks in one file',
            tone: 'go-soft' as const,
            onSelect: () => setExporting(p),
          })),
          { label: 'Cancel', tone: 'stop-soft', onSelect: () => setExporting(undefined) },
        ]}
        onCancel={() => setExporting(undefined)}
      />
      <ChoiceDialog
        open={exporting !== undefined && exporting !== 'what'}
        title="Export as"
        message="Which kind of file?"
        choices={[
          {
            label: 'JSON',
            detail: 'Restore it later from Settings',
            tone: 'go-soft',
            onSelect: () => exportNow(exporting as Part, 'json'),
          },
          {
            label: 'TXT',
            detail: 'A card list to read, share, or import',
            tone: 'go-soft',
            onSelect: () => exportNow(exporting as Part, 'txt'),
          },
          { label: 'Cancel', tone: 'stop-soft', onSelect: () => setExporting(undefined) },
        ]}
        onCancel={() => setExporting(undefined)}
      />
      <ChoiceDialog
        open={restoreAsk}
        title="Restore from backup"
        message="What do you want to restore? You pick the backup file next."
        choices={[
          {
            label: PART_LABELS.list,
            detail: 'Replaces your bulk list; decks stay',
            tone: 'go-soft',
            onSelect: () => pickRestore('list'),
          },
          {
            label: PART_LABELS.decks,
            detail: 'Replaces your decks; the bulk list stays',
            tone: 'go-soft',
            onSelect: () => pickRestore('decks'),
          },
          {
            label: PART_LABELS.both,
            detail: 'Replaces both, and your settings if the file has them',
            tone: 'go-soft',
            onSelect: () => pickRestore('both'),
          },
          { label: 'Cancel', tone: 'stop-soft', onSelect: () => setRestoreAsk(false) },
        ]}
        focus={3}
        onCancel={() => setRestoreAsk(false)}
      />
    </div>
  );
}
