import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  addToPool,
  emptyPool,
  exportBackup,
  poolToDecklist,
  type PoolEntry,
} from '@bulk-brew/core';
import {
  backupFilename,
  CardDetail,
  CardImage,
  cardTags,
  COLOR_KEYS,
  downloadText,
  Dropdown,
  EMPTY_FILTERS,
  filterCount,
  IMPORT_FORMAT_LABELS,
  ManaCost,
  MANA_VALUES,
  MenuCheck,
  MenuItem,
  Pip,
  POOL_SORTS,
  poolRows,
  poolSummary,
  Segmented,
  tagOptions,
  Toggle,
  TYPE_KEYS,
  ui,
  useImport,
  useMediaQuery,
  useWindowedRows,
  type ImportMode,
  type OpenLine,
  type PoolFilters,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';
import { useNav } from './nav.ts';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

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

// ---------------------------------------------------------------- Import

const MODES: { id: ImportMode; label: string }[] = [
  { id: 'add', label: 'Add to pool' },
  { id: 'replace', label: 'Replace pool' },
];

export function ImportScreen() {
  const { index, pool, pack, settings, build } = useAppState();
  const nav = useNav();
  const target = useMemo(
    () => ({
      add: pool.actions.add,
      replace: (entries: PoolEntry[]) => {
        pool.actions.transform(() => addToPool(emptyPool(), entries));
        // A build made from the old pool no longer fits.
        build.reset();
      },
    }),
    [pool.actions, build],
  );
  const imp = useImport(index, target, {
    includeUnsets: settings.settings.includeUnsets,
    unlimitedBasics: settings.settings.unlimitedBasics,
  });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = imp.preview;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void imp.loadFile(file);
  };

  const commit = () => {
    if (!preview) return;
    if (
      imp.mode === 'replace' &&
      !window.confirm(
        `Replace the whole pool with these ${plural(preview.cards, 'card')}? The cards in it now are removed.`,
      )
    )
      return;
    imp.commit();
  };

  const addLabel =
    imp.mode === 'replace'
      ? `Replace pool with ${plural(preview?.cards ?? 0, 'card')}`
      : `Add ${plural(preview?.cards ?? 0, 'card')} to pool`;

  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
      <section className="flex min-h-[560px] flex-col gap-3.5 border-line px-8 py-7 lg:min-h-0 lg:border-r">
        <h1 className="text-[20px] font-semibold">Import</h1>
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
          Drop a .txt file here, or{' '}
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-36 flex-1 text-[12.5px] text-fg-1">
            {plural(imp.parsed.lines.length, 'line')} · {plural(imp.totalCards, 'card')} ·{' '}
            {fmt(imp.parsed.skipped.length)} unreadable
            {imp.text && imp.format !== 'decklist' && ` · ${IMPORT_FORMAT_LABELS[imp.format]}`}
          </span>
          <Segmented label="Import mode" options={MODES} value={imp.mode} onChange={imp.setMode} />
          <button
            type="button"
            className={ui.primary}
            disabled={!imp.canResolve}
            onClick={imp.resolve}
          >
            Import
          </button>
        </div>
        {pack.status === 'loading' && (
          <p className={ui.note}>Card data is still loading. Import works once it is ready.</p>
        )}
      </section>

      <section
        aria-label="Resolution report"
        className="flex flex-col gap-3.5 px-8 py-7 lg:overflow-y-auto"
      >
        <h2 className="text-[20px] font-semibold">Resolution report</h2>
        {imp.done && !preview && (
          <div className="flex flex-col gap-2 text-[13px]">
            <p>
              {imp.done.mode === 'replace' ? 'Replaced the pool with' : 'Added'}{' '}
              {plural(imp.done.cards, 'card')}
              {imp.done.mode === 'replace' ? '.' : ' to the pool.'}
            </p>
            <p>
              <button type="button" className={ui.link} onClick={() => nav.go('pool')}>
                Open the pool
              </button>
            </p>
          </div>
        )}
        {!imp.done && !preview && (
          <p className={ui.note}>
            Paste a list and press Import. Every line is checked before anything is added.
          </p>
        )}
        {preview && (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <Stat value={preview.cards} caption="cards resolved" />
              <Stat value={preview.unresolved.length} caption="unresolved lines" muted />
              {settings.settings.unlimitedBasics && (
                <Stat value={preview.basics} caption="basics, not stored" muted />
              )}
            </div>
            {preview.unresolved.length > 0 ? (
              <>
                <h3 className={ui.sectionLabel}>Unresolved</h3>
                <ul className={`${ui.box} flex flex-col`}>
                  {preview.unresolved.map((u, i) => {
                    // After a row resolves or is skipped, focus the next one.
                    const next = preview.unresolved[i + 1] ?? preview.unresolved[i - 1];
                    const then = (fn: () => void) => () => {
                      fn();
                      setTimeout(() => {
                        if (next) document.getElementById(`unresolved-${next.line.line}`)?.focus();
                      }, 0);
                    };
                    return (
                      <UnresolvedRow
                        key={u.line.line}
                        line={u}
                        onEdit={(name) => imp.editLine(u.line.line, name)}
                        onSuggestion={(name) =>
                          then(() => imp.acceptSuggestion(u.line.line, name))()
                        }
                        onSkip={then(() => imp.skip(u.line.line))}
                      />
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className={ui.note}>
                {preview.cards === 0
                  ? preview.basics > 0
                    ? 'Only basic lands, which are unlimited and not stored. Nothing to add.'
                    : 'Nothing to add. Check the names or the format.'
                  : preview.skipped > 0
                    ? `Skipped ${plural(preview.skipped, 'line')}. Everything else matched.`
                    : 'Every line matched a card.'}
              </p>
            )}
            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
              <button
                type="button"
                className={ui.secondary}
                disabled={preview.unresolved.length === 0}
                onClick={imp.skipAll}
              >
                Skip all unresolved
              </button>
              <button
                type="button"
                className={ui.primary}
                disabled={preview.cards === 0}
                onClick={commit}
              >
                {addLabel}
              </button>
            </div>
          </>
        )}
      </section>
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
  onEdit(name: string): void;
  onSuggestion(name: string): void;
  onSkip(): void;
}) {
  const { line, onEdit, onSuggestion, onSkip } = props;
  const suggestion = line.suggestions[0];
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
          aria-label={`Card name on line ${line.line.line}`}
          onBlur={(e) => {
            // Moving to this row's own buttons should not re-resolve under the pointer.
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
              <button type="button" className={ui.link} onClick={() => onSuggestion(suggestion)}>
                {suggestion}
              </button>
              ?
              {line.suggestions.length > 1 && (
                <>
                  {' '}
                  Or{' '}
                  {line.suggestions.slice(1).map((s, i) => (
                    <span key={s}>
                      {i > 0 && ', '}
                      <button type="button" className={ui.link} onClick={() => onSuggestion(s)}>
                        {s}
                      </button>
                    </span>
                  ))}
                  .
                </>
              )}
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

// ---------------------------------------------------------------- Pool

type ListKey = 'colors' | 'types' | 'manaValues' | 'tags';

function FilterChip<T extends string | number>(props: {
  name: string;
  options: { id: T; label: string }[];
  groups?: { group: string; options: { id: T; label: string }[] }[];
  selected: T[];
  onToggle(id: T): void;
  onClear(): void;
}) {
  const { name, options, selected, onToggle, onClear } = props;
  const groups = props.groups ?? [{ group: '', options }];
  const all = groups.flatMap((g) => g.options);
  const chosen = all.filter((o) => selected.includes(o.id)).map((o) => o.label);
  const items = (
    <>
      {groups.map((g) => (
        <div key={g.group} className="flex flex-col">
          {g.group && <div className={`${ui.sectionLabel} px-2.5 pt-2 pb-1`}>{g.group}</div>}
          {g.options.map((o) => (
            <MenuCheck
              key={String(o.id)}
              checked={selected.includes(o.id)}
              onToggle={() => onToggle(o.id)}
            >
              {o.label}
            </MenuCheck>
          ))}
        </div>
      ))}
    </>
  );
  const applied = chosen.length > 0;
  const value = chosen.length <= 2 ? chosen.join(', ') : `${chosen.length} selected`;
  // One Dropdown in the same place either way, so the menu stays open as values change.
  return (
    <span
      className={`inline-flex items-center rounded-md border text-[12.5px] ${
        applied
          ? 'border-ink bg-ink text-on-ink'
          : 'border-line-strong bg-surface text-fg-1 hover:bg-surface-2'
      }`}
    >
      <Dropdown
        label={applied ? `${name}: ${value}` : `${name} ▾`}
        buttonClassName={`max-w-56 truncate py-1.5 ${applied ? 'pr-1 pl-2.5' : 'px-2.5'}`}
      >
        {() => items}
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

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function PoolScreen() {
  return (
    <PackGate>
      <PoolLoaded />
    </PackGate>
  );
}

function PoolLoaded() {
  const { index, pool, settings, detail, config, decks, build } = useAppState();
  const nav = useNav();
  const showArt = settings.settings.showArt;
  const {
    poolFilters: filters,
    setPoolFilters: setFilters,
    poolSort: sort,
    setPoolSort: setSort,
  } = nav;
  const searchRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const rows = useMemo(
    () => (index ? poolRows(pool.pool, index, { ...filters, sort, config }) : []),
    [index, pool.pool, filters, sort, config],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );
  const rowHeight = showArt ? 38 : 32;
  const version = `${sort}|${JSON.stringify(filters)}|${showArt}`;
  const win = useWindowedRows(rows.length, rowHeight, tbodyRef, version);
  // A new filter or sort starts at the top of the list.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [version]);
  const selectedId = detail.current?.cardId;
  const selectedIndex = rows.findIndex((r) => r.card.id === selectedId);
  const tags = useMemo(() => tagOptions(config), [config]);
  const wide = useMediaQuery('(min-width: 1024px)');
  const columns = wide ? 5 : 4;

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
      if (el.closest('[data-menu]') || rows.length === 0) return;
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
      // Focus follows the selection from a row, so Enter acts on the new card;
      // from the search field it stays put so typing can continue.
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

  if (!index || !pool.loaded || !summary) return <p className={`${ui.note} p-8`}>Loading pool</p>;

  if (summary.distinct === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className={ui.note}>Your pool is empty. Import a list to start.</p>
        <button type="button" className={ui.primary} onClick={() => nav.go('import')}>
          Import
        </button>
      </div>
    );
  }

  const set = <K extends ListKey>(key: K, value: PoolFilters[K]) =>
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

  const exportBackupNow = () => {
    const now = new Date();
    downloadText(
      backupFilename(now),
      exportBackup(
        {
          pool: pool.pool,
          decks: decks.decks,
          settings: settings.settings,
          dataVersion: index.version,
        },
        now.toISOString(),
      ),
    );
  };

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col lg:border-r lg:border-line">
        <header className="flex flex-col gap-3.5 px-6 pt-[22px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h1 className="text-[20px] font-semibold">Pool</h1>
            <span className="text-[13px] text-fg-1">
              {plural(summary.cards, 'card')} · {fmt(summary.distinct)} unique
            </span>
            <label className="ml-auto flex items-center gap-2.5 self-center text-[12.5px] text-fg-1">
              Unlimited basic lands
              <Toggle
                label="Unlimited basic lands"
                checked={settings.settings.unlimitedBasics}
                disabled={!settings.loaded}
                onChange={(v) => settings.update({ unlimitedBasics: v })}
              />
            </label>
          </div>
          <ul className="flex flex-wrap items-center gap-x-[18px] gap-y-1 text-[12.5px] text-fg-1">
            {COLOR_KEYS.filter((c) => c.id !== 'M' || summary.byColor.M > 0).map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                {c.id === 'M' ? <span>Multicolor</span> : <Pip symbol={c.id} label={c.label} />}
                <span className="tabular-nums">{fmt(summary.byColor[c.id])}</span>
              </li>
            ))}
          </ul>
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
            <FilterChip
              name="Color"
              options={COLOR_KEYS}
              selected={filters.colors}
              onToggle={(id) => set('colors', toggle(filters.colors, id))}
              onClear={() => set('colors', [])}
            />
            <FilterChip
              name="Type"
              options={TYPE_KEYS}
              selected={filters.types}
              onToggle={(id) => set('types', toggle(filters.types, id))}
              onClear={() => set('types', [])}
            />
            <FilterChip
              name="Mana value"
              options={MANA_VALUES}
              selected={filters.manaValues}
              onToggle={(id) => set('manaValues', toggle(filters.manaValues, id))}
              onClear={() => set('manaValues', [])}
            />
            <FilterChip
              name="Tags"
              options={[]}
              groups={tags.map((g) => ({ group: g.group, options: g.tags }))}
              selected={filters.tags}
              onToggle={(id) => set('tags', toggle(filters.tags, id))}
              onClear={() => set('tags', [])}
            />
            <Dropdown
              label={`Sort: ${POOL_SORTS.find((s) => s.id === sort)?.label ?? 'Name'} ▾`}
              buttonClassName={`${ui.quiet} px-1.5 py-1.5 text-[12.5px]`}
              align="right"
            >
              {(close) =>
                POOL_SORTS.map((s) => (
                  <MenuItem
                    key={s.id}
                    onSelect={() => {
                      setSort(s.id);
                      close();
                    }}
                  >
                    {s.id === sort ? '✓ ' : ''}
                    {s.label}
                  </MenuItem>
                ))
              }
            </Dropdown>
          </div>
        </header>

        <div ref={scroller} className="relative mt-3 min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <colgroup>
              <col style={{ width: 76 }} />
              <col />
              <col style={{ width: 122 }} />
              <col style={{ width: 202 }} />
              {wide && <col />}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-canvas text-left">
              <tr className={ui.sectionLabel}>
                <th className="border-b border-line py-1.5 pr-3 pl-6 font-normal">Qty</th>
                <th className="border-b border-line py-1.5 pr-3 font-normal">Name</th>
                <th className="border-b border-line py-1.5 pr-3 font-normal">Cost</th>
                <th className="border-b border-line py-1.5 pr-3 font-normal">Type</th>
                {wide && <th className="border-b border-line py-1.5 pr-6 font-normal">Tags</th>}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {win.topPad > 0 && (
                <tr aria-hidden style={{ height: win.topPad }}>
                  <td colSpan={columns} />
                </tr>
              )}
              {visible.map(({ entry: e, card }) => {
                const on = card.id === selectedId;
                return (
                  <tr
                    key={card.id}
                    data-row
                    onClick={() => detail.open(card.id, e.printing)}
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
                          aria-current={on ? 'true' : undefined}
                          tabIndex={card.id === focusId ? 0 : -1}
                          className="min-w-0 truncate text-left font-medium"
                          title={card.name}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            detail.open(card.id, e.printing);
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key !== 'Enter') return;
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
                    <td className="truncate pr-3 text-fg-1" title={card.typeLine}>
                      {card.typeLine}
                    </td>
                    {wide && (
                      <td className="truncate pr-6 text-[12px] text-fg-2">
                        {cardTags(index, config, card)
                          .map((t) => t.label)
                          .join(', ')}
                      </td>
                    )}
                  </tr>
                );
              })}
              {win.bottomPad > 0 && (
                <tr aria-hidden style={{ height: win.bottomPad }}>
                  <td colSpan={columns} />
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
                downloadText(`bulk-brew-pool-${today}.txt`, poolToDecklist(pool.pool, index))
              }
            >
              Export pool
            </button>
            ·
            <button type="button" className="hover:text-ink" onClick={exportBackupNow}>
              Backup
            </button>
            ·
            <button
              type="button"
              className="hover:text-ink"
              onClick={() => {
                if (window.confirm('Remove every card from the pool? Saved decks stay.')) {
                  detail.close();
                  pool.actions.clear();
                  build.reset();
                }
              }}
            >
              Clear pool
            </button>
          </span>
        </footer>
      </section>

      <aside
        ref={detailRef}
        tabIndex={-1}
        aria-label="Card detail"
        className={`${selected ? 'fixed inset-y-0 right-0 z-40 flex' : 'hidden'} w-[300px] max-w-full shrink-0 flex-col overflow-y-auto border-l border-line bg-surface p-[22px] lg:static lg:z-auto lg:flex lg:border-l-0`}
      >
        {selected ? (
          <>
            <CardDetail
              onClose={wide ? undefined : detail.close}
              card={selected}
              printing={detail.current?.printing ?? entry?.printing}
              qty={entry?.qty}
              index={index}
              config={config}
              showArt={showArt}
              inDecks={inDecks}
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
          </>
        ) : (
          <p className={`${ui.note} m-auto text-center`}>
            Select a card to see its text, tags, and quantity.
          </p>
        )}
      </aside>
    </div>
  );
}
