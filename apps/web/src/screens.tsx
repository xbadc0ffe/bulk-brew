import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { exportBackup, poolToDecklist, removeFromPool, type PrintingHint } from '@bulk-brew/core';
import {
  backupFilename,
  CardDetail,
  CardImage,
  COLOR_KEYS,
  ConfirmDialog,
  DISPLAY_TAGS,
  downloadText,
  Dropdown,
  EMPTY_FILTERS,
  filterCount,
  IMPORT_FORMAT_LABELS,
  majorTags,
  ManaCost,
  MenuCheck,
  MV_OPS,
  nextSort,
  Pip,
  poolFacets,
  poolRows,
  poolSummary,
  typeParts,
  ui,
  useImport,
  useMediaQuery,
  useWindowedRows,
  type ColorKey,
  type Facet,
  type MvOp,
  type OpenLine,
  type PoolFilters,
  type SortKey,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';
import { useNav } from './nav.ts';
import { AnalysisPanel } from './screens/AnalysisPanel.tsx';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const copies = (n: number) => `${fmt(n)} ${n === 1 ? 'copy' : 'copies'}`;

/** Shown in place of a screen while the card data loads or after it failed. */
export function PackGate({ children }: { children: ReactNode }) {
  const { pack } = useAppState();
  if (pack.status === 'error') {
    return (
      <div className="p-8">
        <div className={`${ui.error} flex flex-wrap items-center gap-3`}>
          <span>Card data failed to load: {pack.error}</span>
          <button type="button" className={ui.small} onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (pack.status !== 'ready') return <p className={`${ui.note} p-8`}>Loading card data</p>;
  return <>{children}</>;
}

/** The large back button on subpages. */
export function BackButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-surface-2"
    >
      <span aria-hidden className="text-[16px] leading-none">
        ‹
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------- Import

export function ImportScreen() {
  const { index, pool, pack, settings } = useAppState();
  const nav = useNav();
  const imp = useImport(index, pool.actions.add, {
    includeUnsets: settings.settings.includeUnsets,
  });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = imp.preview;

  const importButton = (
    <button
      type="button"
      className={`${ui.primary} px-6 py-2.5 text-[14px]`}
      disabled={!imp.canImport}
      onClick={imp.commit}
    >
      {preview && preview.cards > 0 ? `Import ${plural(preview.cards, 'card')}` : 'Import'}
    </button>
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void imp.loadFile(file);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-line px-6 py-3">
        <BackButton label="Bulk List" onClick={() => nav.go('pool')} />
        <h1 className="text-[20px] font-semibold">Import</h1>
        <span className="ml-auto lg:hidden">{importButton}</span>
      </header>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <section className="flex min-h-[520px] flex-col gap-3.5 border-line px-8 py-6 lg:min-h-0 lg:border-r">
          <p className="text-[13px] leading-[1.5] text-fg-1">
            Paste a decklist or collection export, or drop a text file. Accepted lines:{' '}
            <code className={ui.code}>4 Lightning Bolt</code>{' '}
            <code className={ui.code}>4x Lightning Bolt</code>{' '}
            <code className={ui.code}>4 Lightning Bolt (M10) 146</code>. CSV exports from ManaBox,
            Moxfield, and Deckbox work too.
          </p>
          <textarea
            value={imp.text}
            onChange={(e) => imp.setText(e.target.value)}
            aria-label="Card list"
            placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\n10 Forest'}
            spellCheck={false}
            className="min-h-48 flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3.5 py-3 font-mono text-[12.5px] leading-[1.7] placeholder:text-fg-3"
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border border-dashed border-line-strong p-3.5 text-center text-[13px] text-fg-2 ${dragging ? 'bg-surface-2' : ''}`}
          >
            Drop a .txt or .csv file here, or{' '}
            <button type="button" className={ui.link} onClick={() => fileInput.current?.click()}>
              choose a file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.csv,.tsv,.dec,text/plain,text/csv"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void imp.loadFile(file);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-[12.5px] text-fg-1">
            {plural(imp.parsed.lines.length, 'line')} · {plural(imp.totalCards, 'card')} ·{' '}
            {fmt(imp.parsed.skipped.length)} unreadable
            {imp.text && imp.format !== 'decklist' && ` · ${IMPORT_FORMAT_LABELS[imp.format]}`}
          </p>
        </section>

        <section
          aria-label="Live check"
          className="flex flex-col gap-4 px-8 py-6 lg:overflow-y-auto"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[13px] text-fg-1">
              {imp.done
                ? `Added ${plural(imp.done.cards, 'card')} to your bulk list.${
                    imp.done.left > 0
                      ? ` ${plural(imp.done.left, 'line')} did not match and ${imp.done.left === 1 ? 'is' : 'are'} still in the box.`
                      : ''
                  }`
                : ''}
            </p>
            <span className="ml-auto hidden lg:inline-flex">{importButton}</span>
          </div>

          {pack.status === 'loading' && (
            <p className={ui.note}>
              Card data is still loading. The check starts once it is ready.
            </p>
          )}
          {!preview && pack.status === 'ready' && !imp.done && (
            <p className={ui.note}>
              Paste or type a list. Every line is checked as you go, and Import adds the cards that
              matched.
            </p>
          )}
          {imp.done && !preview && (
            <p>
              <button type="button" className={ui.link} onClick={() => nav.go('pool')}>
                Back to the bulk list
              </button>
            </p>
          )}

          {preview && (
            <>
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <Stat value={preview.cards} caption="cards matched" />
                <Stat value={preview.distinct} caption="unique cards" muted />
                <Stat value={preview.unresolved.length} caption="lines not matched" muted />
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-1">
                {COLOR_KEYS.filter((c) => preview.byColor[c.id] > 0).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    {c.id === 'M' ? <span>Multicolor</span> : <Pip symbol={c.id} label={c.label} />}
                    <span className="tabular-nums">{fmt(preview.byColor[c.id])}</span>
                  </li>
                ))}
              </ul>
              {preview.unresolved.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className={ui.sectionLabel}>Not matched</h2>
                    <button
                      type="button"
                      className={`${ui.quiet} text-[12.5px] underline`}
                      onClick={imp.skipAll}
                    >
                      Skip all
                    </button>
                  </div>
                  <ul className={`${ui.box} flex flex-col`}>
                    {preview.unresolved.slice(0, 50).map((u, i) => {
                      const next = preview.unresolved[i + 1] ?? preview.unresolved[i - 1];
                      const then = (fn: () => void) => () => {
                        fn();
                        setTimeout(() => {
                          if (next)
                            document.getElementById(`unresolved-${next.line.line}`)?.focus();
                        }, 0);
                      };
                      return (
                        <UnresolvedRow
                          key={`${u.line.line}:${u.line.raw}`}
                          line={u}
                          suggestions={imp.suggestionsFor(u.name)}
                          onEdit={(name) => imp.editLine(u.key, name)}
                          onSuggestion={(name) => then(() => imp.acceptSuggestion(u.key, name))()}
                          onSkip={then(() => imp.skip(u.key))}
                        />
                      );
                    })}
                  </ul>
                  {preview.unresolved.length > 50 && (
                    <p className={ui.note}>
                      Showing the first 50 of {fmt(preview.unresolved.length)} lines that did not
                      match.
                    </p>
                  )}
                </>
              ) : (
                <p className={ui.note}>
                  {preview.skipped > 0
                    ? `Skipped ${plural(preview.skipped, 'line')}. Everything else matched.`
                    : 'Every line matched a card.'}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ value, caption, muted }: { value: number; caption: string; muted?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className={`text-[28px] leading-tight font-semibold tracking-[-0.02em] tabular-nums ${muted ? 'text-fg-1' : ''}`}
      >
        {fmt(value)}
      </span>
      <span className="text-[12px] text-fg-2">{caption}</span>
    </div>
  );
}

function UnresolvedRow(props: {
  line: OpenLine;
  suggestions: string[];
  onEdit(name: string): void;
  onSuggestion(name: string): void;
  onSkip(): void;
}) {
  const { line, suggestions, onEdit, onSuggestion, onSkip } = props;
  const suggestion = suggestions[0];
  const submit = (value: string) => {
    const name = value.trim();
    if (name && name !== line.name) onEdit(name);
  };
  return (
    <li className="grid grid-cols-[34px_1fr_auto] items-start gap-3 border-b border-surface-2 px-3.5 py-2.5 last:border-b-0">
      <span className="pt-1.5 font-mono text-[12px] text-fg-1 tabular-nums">{line.line.qty}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <input
          id={`unresolved-${line.line.line}`}
          defaultValue={line.name}
          aria-label={`Card name, line ${line.line.line}`}
          onBlur={(e) => {
            // Moving to this row's own buttons should not re-check under the pointer.
            const row = e.currentTarget.closest('li');
            if (row && e.relatedTarget instanceof Node && row.contains(e.relatedTarget)) return;
            submit(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(e.currentTarget.value);
          }}
          className="w-full rounded-[5px] border border-line-strong bg-surface px-[9px] py-[5px] text-[13px]"
        />
        <span className="text-[12px] text-fg-1">
          {suggestion ? (
            <>
              Did you mean{' '}
              {suggestions.map((s, i) => (
                <span key={s}>
                  {i > 0 && (i === suggestions.length - 1 ? ' or ' : ', ')}
                  <button type="button" className={ui.link} onClick={() => onSuggestion(s)}>
                    {s}
                  </button>
                </span>
              ))}
              ?
            </>
          ) : (
            'No close match. Edit the name and press Enter.'
          )}
        </span>
      </div>
      <div className="flex items-center gap-3 pt-0.5">
        {suggestion && (
          <button type="button" className={ui.small} onClick={() => onSuggestion(suggestion)}>
            Use suggestion
          </button>
        )}
        <button type="button" className={`${ui.quiet} text-[12.5px]`} onClick={onSkip}>
          Skip
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Bulk List

const chipBase = 'inline-flex items-center rounded-md border text-[12.5px]';
const chipOff = 'border-line-strong bg-surface text-fg-1 hover:bg-surface-2';
const chipOn = 'border-ink bg-ink text-on-ink';

/** A multi-select filter menu, optionally with a search box for long lists. */
function FilterChip<T extends string | number>(props: {
  name: string;
  options: Facet<T>[];
  selected: T[];
  onToggle(id: T): void;
  onClear(): void;
  searchable?: boolean;
}) {
  const { name, options, selected, onToggle, onClear, searchable } = props;
  const [q, setQ] = useState('');
  const chosen = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  const applied = selected.length > 0;
  const value = chosen.length <= 2 ? chosen.join(', ') : `${chosen.length} selected`;
  const query = q.trim().toLowerCase();
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  // One Dropdown in the same place either way, so the menu stays open as values change.
  return (
    <span className={`${chipBase} ${applied ? chipOn : chipOff}`}>
      <Dropdown
        label={applied ? `${name}: ${value}` : `${name} ▾`}
        buttonClassName={`max-w-56 truncate py-1.5 ${applied ? 'pr-1 pl-2.5' : 'px-2.5'}`}
      >
        {() => (
          <>
            {searchable && (
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Find a ${name.toLowerCase()}`}
                aria-label={`Find a ${name.toLowerCase()}`}
                className={`${ui.field} m-1 py-1`}
              />
            )}
            {shown.length === 0 && <p className={`${ui.note} px-2.5 py-1.5`}>Nothing matches.</p>}
            {shown.map((o) => (
              <MenuCheck
                key={String(o.id)}
                checked={selected.includes(o.id)}
                onToggle={() => onToggle(o.id)}
              >
                <span className="flex w-full justify-between gap-4">
                  <span>{o.label}</span>
                  <span className="text-fg-2 tabular-nums">{o.count}</span>
                </span>
              </MenuCheck>
            ))}
          </>
        )}
      </Dropdown>
      {applied && (
        <button
          type="button"
          aria-label={`Clear ${name.toLowerCase()} filter`}
          className="py-1.5 pr-2.5 pl-1"
          onClick={onClear}
        >
          ✕
        </button>
      )}
    </span>
  );
}

/** Mana value: a comparison and a value, linked. */
function ManaValueFilter(props: {
  values: number[];
  op: MvOp;
  value: number;
  onChange(op: MvOp, value: number): void;
}) {
  const { values, op, value, onChange } = props;
  const on = op !== 'any';
  const select = `appearance-none rounded bg-transparent px-1 py-1.5 text-[12.5px] ${on ? 'text-on-ink' : 'text-fg-1'}`;
  return (
    <span
      role="group"
      aria-label="Mana value"
      className={`${chipBase} gap-0.5 pr-1 pl-2.5 ${on ? chipOn : chipOff}`}
    >
      <span>Mana value</span>
      <select
        aria-label="Compare mana value"
        value={op}
        onChange={(e) => onChange(e.target.value as MvOp, value)}
        className={select}
      >
        {MV_OPS.map((o) => (
          <option key={o.id} value={o.id} className="bg-surface text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Mana value to compare with"
        value={value}
        hidden={!on}
        onChange={(e) => onChange(op, Number(e.target.value))}
        className={`${select} disabled:opacity-50`}
      >
        {(values.includes(value) ? values : [...values, value].sort((a, b) => a - b)).map((v) => (
          <option key={v} value={v} className="bg-surface text-ink">
            {v}
          </option>
        ))}
      </select>
    </span>
  );
}

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

const COLUMNS: { key: SortKey; label: string; width?: number; pad: string; wideOnly?: boolean }[] =
  [
    { key: 'qty', label: 'Qty', width: 68, pad: 'pr-3 pl-6' },
    { key: 'name', label: 'Name', pad: 'pr-3' },
    { key: 'cost', label: 'Cost', width: 116, pad: 'pr-3' },
    { key: 'type', label: 'Type', width: 156, pad: 'pr-3' },
    { key: 'subtype', label: 'Subtype', width: 156, pad: 'pr-3', wideOnly: true },
    { key: 'tags', label: 'Tags', pad: 'pr-6', wideOnly: true },
  ];

export function PoolScreen() {
  return (
    <PackGate>
      <BulkList />
    </PackGate>
  );
}

function BulkList() {
  const { index, pool, settings, detail, config, decks, build } = useAppState();
  const nav = useNav();
  const {
    poolFilters: filters,
    setPoolFilters: setFilters,
    poolSort: sort,
    setPoolSort: setSort,
    analyze,
    setAnalyze,
  } = nav;
  const showArt = settings.settings.showArt;
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'remove' | 'clear'>();
  const searchRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');

  const rows = useMemo(
    () =>
      index
        ? poolRows(pool.pool, index, { ...filters, sort, config, displayTags: DISPLAY_TAGS })
        : [],
    [index, pool.pool, filters, sort, config],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );
  const facets = useMemo(
    () => (index ? poolFacets(pool.pool, index, config, DISPLAY_TAGS) : undefined),
    [index, pool.pool, config],
  );
  const rowHeight = showArt ? 38 : 34;
  const version = `${JSON.stringify(sort)}|${JSON.stringify(filters)}|${showArt}|${analyze}`;
  const win = useWindowedRows(rows.length, rowHeight, tbodyRef, version);
  // A new filter or sort starts at the top of the list.
  const listKey = `${JSON.stringify(sort)}|${JSON.stringify(filters)}`;
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [listKey]);
  const selectedId = detail.current?.cardId;
  const selectedIndex = rows.findIndex((r) => r.card.id === selectedId);

  // "/" focuses search; arrow keys move the selection through the filtered list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest('input, textarea, select, [contenteditable]') !== null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.shiftKey) return;
      if (typing && el !== searchRef.current) return;
      if (el.closest('[data-menu], [role=alertdialog]') || rows.length === 0) return;
      e.preventDefault();
      const next =
        selectedIndex < 0
          ? 0
          : Math.max(
              0,
              Math.min(rows.length - 1, selectedIndex + (e.key === 'ArrowDown' ? 1 : -1)),
            );
      const row = rows[next]!;
      detail.open(row.card.id, row.entry.printing);
      // Focus follows the selection from a row, so Enter acts on the new card.
      if (el.closest('[data-row]') || el === document.body) {
        const id = `pool-row-${row.card.id}`;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true })),
        );
      }
      const box = scroller.current;
      const body = tbodyRef.current;
      if (!box || !body) return;
      const head = body.offsetTop;
      const top = head + next * rowHeight;
      if (top - head < box.scrollTop) box.scrollTop = top - head;
      else if (top + rowHeight > box.scrollTop + box.clientHeight)
        box.scrollTop = top + rowHeight - box.clientHeight;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rows, selectedIndex, detail, rowHeight]);

  if (!index || !pool.loaded || !summary || !facets)
    return <p className={`${ui.note} p-8`}>Loading your bulk list</p>;

  if (summary.distinct === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className={ui.note}>Your bulk list is empty. Import a list to start.</p>
        <button type="button" className={ui.primary} onClick={() => nav.go('import')}>
          Import
        </button>
      </div>
    );
  }

  const set = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const selected = selectedId ? index.get(selectedId) : undefined;
  const entry = selected ? pool.pool.entries[selected.id] : undefined;
  const inDecks = selected
    ? decks.decks.filter((d) => d.cards.some((c) => c.cardId === selected.id)).map((d) => d.name)
    : [];
  const filtered = filterCount(filters) > 0 || filters.search.trim() !== '';
  const visible = rows.slice(win.start, win.end);
  // Roving focus: one row is in the tab order, the selected one when it is rendered.
  const focusId = visible.some((r) => r.card.id === selectedId) ? selectedId : visible[0]?.card.id;
  const today = new Date().toISOString().slice(0, 10);
  // Picks hidden by the filters, or already removed, do not count and are not removed.
  const pickedRows = rows.filter((r) => picked.has(r.card.id));
  const pickedCopies = pickedRows.reduce((n, r) => n + r.entry.qty, 0);
  const shownColumns = COLUMNS.filter((c) => wide || !c.wideOnly);
  const columnCount = shownColumns.length + (selecting ? 1 : 0);
  const openRow = (cardId: string, printing: PrintingHint | undefined) => {
    // Clicking the open card again closes the detail.
    if (cardId === selectedId) detail.close();
    else detail.open(cardId, printing);
  };

  const exportBackupNow = () => {
    const now = new Date();
    downloadText(
      backupFilename(now),
      exportBackup(
        {
          pool: pool.pool,
          decks: decks.decks,
          settings: settings.settings,
          dataVersion: index.dataVersion,
        },
        now.toISOString(),
      ),
    );
  };

  const removePicked = () => {
    const ids = pickedRows.map((r) => r.card.id);
    pool.actions.transform((p) => ids.reduce((acc, id) => removeFromPool(acc, id), p));
    if (selectedId && ids.includes(selectedId)) detail.close();
    setPicked(new Set());
    setConfirm(undefined);
    // The Remove button is disabled now; land in the search box.
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex min-h-0 ${analyze ? 'basis-1/2' : 'flex-1'}`}>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-3 px-6 pt-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[20px] font-semibold">Bulk List</h1>
              <span className="text-[13px] text-fg-1">
                {plural(summary.cards, 'card')} · {fmt(summary.distinct)} unique
              </span>
              <button
                type="button"
                className={`${ui.primary} ml-auto`}
                onClick={() => nav.go('import')}
              >
                Import
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Colors" className="flex flex-wrap items-center gap-1">
                {COLOR_KEYS.filter((c) => c.id !== 'M' || summary.byColor.M > 0).map((c) => {
                  const on = filters.colors.includes(c.id as ColorKey);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${c.label}, ${plural(summary.byColor[c.id], 'card')}`}
                      title={`Show only ${c.label.toLowerCase()} cards`}
                      onClick={() => set('colors', toggle(filters.colors, c.id))}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12.5px] ${
                        on
                          ? 'border-ink bg-surface font-medium text-ink'
                          : 'border-transparent text-fg-1 hover:bg-surface-2'
                      }`}
                    >
                      {c.id === 'M' ? <span>Multi</span> : <Pip symbol={c.id} label={c.label} />}
                      <span className="tabular-nums">{fmt(summary.byColor[c.id])}</span>
                    </button>
                  );
                })}
              </div>
              <span aria-hidden className="mx-1 h-5 w-px bg-line" />
              <FilterChip
                name="Type"
                options={facets.types}
                selected={filters.types}
                onToggle={(id) => set('types', toggle(filters.types, id))}
                onClear={() => set('types', [])}
              />
              <FilterChip
                name="Subtype"
                options={facets.subtypes}
                selected={filters.subtypes}
                onToggle={(id) => set('subtypes', toggle(filters.subtypes, id))}
                onClear={() => set('subtypes', [])}
                searchable
              />
              <ManaValueFilter
                values={facets.manaValues}
                op={filters.mv.op}
                value={
                  filters.mv.op === 'any' && !facets.manaValues.includes(filters.mv.value)
                    ? (facets.manaValues[0] ?? 0)
                    : filters.mv.value
                }
                onChange={(op, value) => set('mv', { op, value })}
              />
              <FilterChip
                name="Tags"
                options={facets.tags}
                selected={filters.tags}
                onToggle={(id) => set('tags', toggle(filters.tags, id))}
                onClear={() => set('tags', [])}
              />
              <FilterChip
                name="Subtags"
                options={facets.subtags}
                selected={filters.subtags}
                onToggle={(id) => set('subtags', toggle(filters.subtags, id))}
                onClear={() => set('subtags', [])}
                searchable
              />
              {filtered && (
                <button
                  type="button"
                  className={`${ui.quiet} px-1 text-[12.5px] underline`}
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={searchRef}
                type="search"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search name or text"
                aria-label="Search name or text"
                className={`${ui.field} min-w-40 flex-1`}
              />
              <button
                type="button"
                aria-pressed={selecting}
                className={selecting ? ui.primary : ui.secondary}
                onClick={() => {
                  setSelecting((s) => !s);
                  setPicked(new Set());
                }}
              >
                Select
              </button>
              <button
                type="button"
                aria-pressed={analyze}
                className={analyze ? ui.primary : ui.secondary}
                onClick={() => setAnalyze(!analyze)}
              >
                Analyze
              </button>
            </div>

            {selecting && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px]">
                <span className="mr-auto text-fg-1">
                  {pickedRows.length > 0
                    ? `${plural(pickedRows.length, 'card')} selected (${copies(pickedCopies)})`
                    : 'Tick cards to select them.'}
                </span>
                <button
                  type="button"
                  className={ui.small}
                  onClick={() => setPicked(new Set(rows.map((r) => r.card.id)))}
                >
                  Select all {fmt(rows.length)}
                </button>
                <button
                  type="button"
                  className={ui.small}
                  disabled={pickedRows.length === 0}
                  onClick={() => setPicked(new Set())}
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  className={`${ui.primary} py-[5px] text-[12.5px]`}
                  disabled={pickedRows.length === 0}
                  onClick={() => setConfirm('remove')}
                >
                  Remove{pickedRows.length > 0 ? ` ${fmt(pickedRows.length)}` : ''}
                </button>
              </div>
            )}
          </header>

          <div ref={scroller} className="relative mt-3 min-h-0 flex-1 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <colgroup>
                {shownColumns.map((c) => (
                  <col key={c.key} style={c.width ? { width: c.width } : undefined} />
                ))}
                {selecting && <col style={{ width: 52 }} />}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-canvas text-left">
                <tr className={ui.sectionLabel}>
                  {shownColumns.map((c) => {
                    const dir = sort?.key === c.key ? sort.dir : undefined;
                    return (
                      <th
                        key={c.key}
                        aria-sort={
                          dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'
                        }
                        className={`border-b border-line font-normal ${c.pad}`}
                      >
                        <button
                          type="button"
                          className={`flex items-center gap-1 py-1.5 tracking-[0.04em] uppercase hover:text-ink ${dir ? 'text-ink' : ''}`}
                          onClick={() => setSort(nextSort(sort, c.key))}
                        >
                          {c.label}
                          <span aria-hidden className="w-2 text-[9px]">
                            {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  {selecting && (
                    <th className="border-b border-line pr-6 font-normal">
                      <input
                        type="checkbox"
                        aria-label="Select all shown"
                        checked={rows.length > 0 && pickedRows.length === rows.length}
                        onChange={(e) =>
                          setPicked(
                            e.target.checked ? new Set(rows.map((r) => r.card.id)) : new Set(),
                          )
                        }
                        className="size-4 accent-[var(--ink)]"
                      />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {win.topPad > 0 && (
                  <tr aria-hidden style={{ height: win.topPad }}>
                    <td colSpan={columnCount} />
                  </tr>
                )}
                {visible.map(({ entry: e, card }) => {
                  const on = card.id === selectedId;
                  const { type, subtype } = typeParts(card.typeLine);
                  const tags = wide ? majorTags(index, config, DISPLAY_TAGS, card) : [];
                  return (
                    <tr
                      key={card.id}
                      data-row
                      onClick={() => openRow(card.id, e.printing)}
                      className={`cursor-pointer border-b border-surface-2 ${on ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                      style={{ height: rowHeight }}
                    >
                      <td className="pr-3 pl-6 font-mono text-[12px] text-fg-1 tabular-nums">
                        {e.qty}
                      </td>
                      <td className="pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          {showArt && (
                            <CardImage
                              card={card}
                              printing={e.printing}
                              size="small"
                              className="h-[30px] w-[22px] shrink-0 rounded-[2px] object-contain"
                            />
                          )}
                          <button
                            id={`pool-row-${card.id}`}
                            type="button"
                            aria-pressed={on}
                            tabIndex={card.id === focusId ? 0 : -1}
                            className="min-w-0 truncate text-left font-medium"
                            title={card.name}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openRow(card.id, e.printing);
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key !== 'Enter' || on) return;
                              // Enter opens the card and moves into its detail.
                              ev.preventDefault();
                              detail.open(card.id, e.printing);
                              requestAnimationFrame(() => detailRef.current?.focus());
                            }}
                          >
                            {card.name}
                          </button>
                        </span>
                      </td>
                      <td className="pr-3 whitespace-nowrap">
                        <ManaCost cost={card.manaCost} />
                      </td>
                      <td className="truncate pr-3 text-fg-1" title={type}>
                        {type}
                      </td>
                      {wide && (
                        <>
                          <td
                            className="truncate pr-3 text-[12.5px] text-fg-1 italic"
                            title={subtype}
                          >
                            {subtype}
                          </td>
                          <td className="pr-6" title={tags.map((t) => t.label).join(', ')}>
                            {/* Bubbles that do not fit wrap onto a hidden line, so none is cut. */}
                            <span className="flex h-[20px] min-w-0 flex-wrap items-center gap-1 overflow-hidden">
                              {tags.map((t) => (
                                <span
                                  key={t.id}
                                  title={t.description}
                                  className="shrink-0 rounded-full border border-line px-2 py-px text-[11px] whitespace-nowrap text-fg-1"
                                >
                                  {t.label}
                                </span>
                              ))}
                            </span>
                          </td>
                        </>
                      )}
                      {selecting && (
                        <td className="pr-6" onClick={(ev) => ev.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${card.name}`}
                            checked={picked.has(card.id)}
                            onChange={() =>
                              setPicked((s) => {
                                const next = new Set(s);
                                if (next.has(card.id)) next.delete(card.id);
                                else next.add(card.id);
                                return next;
                              })
                            }
                            className="size-4 accent-[var(--ink)]"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {win.bottomPad > 0 && (
                  <tr aria-hidden style={{ height: win.bottomPad }}>
                    <td colSpan={columnCount} />
                  </tr>
                )}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <p className={ui.note}>No cards match these filters.</p>
                <button type="button" className={ui.link} onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-2 text-[12px] text-fg-2">
            <span>
              {filtered
                ? `Showing ${fmt(rows.length)} of ${fmt(summary.distinct)} unique`
                : `Showing all ${fmt(summary.distinct)} unique`}
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className="hover:text-ink"
                onClick={() =>
                  downloadText(`bulk-brew-list-${today}.txt`, poolToDecklist(pool.pool, index))
                }
              >
                Export list
              </button>
              ·
              <button type="button" className="hover:text-ink" onClick={exportBackupNow}>
                Backup
              </button>
              ·
              <button type="button" className="hover:text-ink" onClick={() => setConfirm('clear')}>
                Clear list
              </button>
            </span>
          </footer>
        </section>

        {selected && (
          <aside
            ref={detailRef}
            tabIndex={-1}
            aria-label="Card detail"
            className="fixed inset-y-0 right-0 z-40 flex w-[320px] max-w-full shrink-0 flex-col overflow-y-auto border-l border-line bg-surface p-[22px] lg:static lg:z-auto"
          >
            <CardDetail
              card={selected}
              printing={detail.current?.printing ?? entry?.printing}
              qty={entry?.qty}
              index={index}
              config={config}
              showArt={showArt}
              inDecks={inDecks}
              onClose={wide ? undefined : detail.close}
              onEscape={detail.close}
              onQtyChange={entry ? (q) => pool.actions.setQty(selected.id, q) : undefined}
              onRemove={
                entry
                  ? () => {
                      detail.close();
                      pool.actions.remove(selected.id);
                    }
                  : undefined
              }
            />
          </aside>
        )}
      </div>

      {analyze && (
        <section
          aria-label="Analysis"
          className="min-h-0 basis-1/2 overflow-y-auto border-t-2 border-line-strong"
        >
          <AnalysisPanel />
        </section>
      )}

      <ConfirmDialog
        open={confirm === 'remove'}
        title={`Remove ${plural(pickedRows.length, 'card')}?`}
        message={`This removes all ${copies(pickedCopies)} of the ${plural(pickedRows.length, 'selected card')} from your bulk list.`}
        confirmLabel="Remove"
        onConfirm={removePicked}
        onCancel={() => setConfirm(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        title="Clear your bulk list?"
        message="This removes every card from your bulk list. Saved decks stay."
        confirmLabel="Clear list"
        onConfirm={() => {
          detail.close();
          pool.actions.clear();
          build.reset();
          setConfirm(undefined);
        }}
        onCancel={() => setConfirm(undefined)}
      />
    </div>
  );
}
