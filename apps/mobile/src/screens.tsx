import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  addToPool,
  COLORS,
  COLOR_LABELS,
  emptyPool,
  type Color,
  type PoolEntry,
} from '@bulk-brew/core';
import {
  analysisRows,
  buildableSizes,
  COLOR_KEYS,
  DECK_SIZES,
  EMPTY_FILTERS,
  filterCount,
  ManaCost,
  MANA_VALUES,
  phone,
  Pip,
  POOL_SORTS,
  poolRows,
  poolSummary,
  scanShortfall,
  Segmented,
  tagOptions,
  Toggle,
  TYPE_KEYS,
  useImport,
  useWindowedRows,
  ViabilityDot,
  type AnalysisRow,
  type ImportMode,
  type PoolFilters,
  type PoolSort,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';
import { useNav, type PoolView } from './nav.ts';
import { Chip, LargeTitle, Pushed, Sheet } from './parts.tsx';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Loading and error states for screens that need the card data. */
export function PackGate({ children }: { children: ReactNode }) {
  const { pack } = useAppState();
  if (pack.status === 'error') {
    return (
      <div className="p-4">
        <div className={`${phone.error} flex flex-col gap-2`}>
          <span>Card data failed to load: {pack.error}</span>
          <button
            type="button"
            className="self-start font-medium underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (pack.status !== 'ready') return <p className={`${phone.note} p-4`}>Loading card data</p>;
  return <>{children}</>;
}

// ---------------------------------------------------------------- Pool

const VIEWS: { id: PoolView; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'analysis', label: 'Analysis' },
];

export function PoolScreen() {
  const nav = useNav();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LargeTitle title="Pool" action={{ label: 'Import', onClick: () => nav.go('import') }} />
      <div className="px-4 pb-2.5">
        <Segmented
          label="Pool view"
          options={VIEWS}
          value={nav.poolView}
          onChange={nav.setPoolView}
          variant="phone"
        />
      </div>
      <PackGate>{nav.poolView === 'analysis' ? <Analysis /> : <PoolCards />}</PackGate>
    </div>
  );
}

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function PoolCards() {
  const { index, pool, settings, detail, config } = useAppState();
  const nav = useNav();
  const [filters, setFilters] = useState<PoolFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<PoolSort>('name');
  const [sheet, setSheet] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const rows = useMemo(
    () => (index ? poolRows(pool.pool, index, { ...filters, sort, config }) : []),
    [index, pool.pool, filters, sort, config],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );
  const win = useWindowedRows(rows.length, 52, listRef, `${sort}|${JSON.stringify(filters)}`);
  const count = filterCount(filters);

  if (!index || !pool.loaded || !summary)
    return <p className={`${phone.note} p-4`}>Loading pool</p>;
  if (summary.distinct === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className={phone.note}>Your pool is empty. Import a list to start.</p>
        <button
          type="button"
          className={`${phone.primary} max-w-60`}
          onClick={() => nav.go('import')}
        >
          Import
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-2.5 px-4 pb-2">
        <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-fg-1">
          {COLOR_KEYS.filter((c) => c.id !== 'M' || summary.byColor.M > 0).map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              {c.id === 'M' ? <span>Multi</span> : <Pip symbol={c.id} size={14} label={c.label} />}
              <span className="tabular-nums">{fmt(summary.byColor[c.id])}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search"
            aria-label="Search name or text"
            className={`${phone.field} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => setSheet(true)}
            className={`shrink-0 rounded-lg border px-3 text-[0.875rem] ${count ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-fg-1'}`}
          >
            Filters{count ? ` · ${count}` : ''}
          </button>
        </div>
        <div className="flex items-center justify-between text-[0.71875rem] text-fg-2">
          <span>
            {count || filters.search.trim()
              ? `${fmt(rows.length)} of ${fmt(summary.distinct)} unique`
              : `${plural(summary.cards, 'card')} · ${fmt(summary.distinct)} unique`}
          </span>
          <label className="relative flex items-center gap-1">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as PoolSort)}
              className="min-h-8 appearance-none bg-transparent pr-3 text-right text-fg-2"
            >
              {POOL_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-0">
              ▾
            </span>
          </label>
        </div>
      </div>

      <ul ref={listRef} className="border-y border-line bg-surface">
        {win.topPad > 0 && <li aria-hidden style={{ height: win.topPad }} />}
        {rows.slice(win.start, win.end).map(({ entry, card }) => (
          <li
            key={card.id}
            data-row
            className="h-[3.25rem] border-b border-surface-2 last:border-b-0"
          >
            <button
              type="button"
              className="flex h-full w-full items-center gap-2.5 px-4 text-left active:bg-surface-2"
              onClick={() => detail.open(card.id, entry.printing)}
            >
              <span className="w-7 shrink-0 font-mono text-[0.75rem] text-fg-1 tabular-nums">
                {entry.qty}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.875rem] font-medium">{card.name}</span>
                <span className="truncate text-[0.71875rem] text-fg-2">{card.typeLine}</span>
              </span>
              <ManaCost cost={card.manaCost} size={15} />
            </button>
          </li>
        ))}
        {win.bottomPad > 0 && <li aria-hidden style={{ height: win.bottomPad }} />}
      </ul>
      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <p className={phone.note}>No cards match these filters.</p>
          <button
            type="button"
            className="min-h-11 text-[0.875rem] text-ink underline"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        </div>
      )}

      <FilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        setSort={setSort}
        unlimitedBasics={settings.settings.unlimitedBasics}
        onBasics={(v) => settings.update({ unlimitedBasics: v })}
      />
    </div>
  );
}

function FilterSheet(props: {
  open: boolean;
  onClose(): void;
  filters: PoolFilters;
  setFilters(f: PoolFilters): void;
  sort: PoolSort;
  setSort(s: PoolSort): void;
  unlimitedBasics: boolean;
  onBasics(v: boolean): void;
}) {
  const { config } = useAppState();
  const { filters: f, setFilters } = props;
  const tags = useMemo(() => tagOptions(config), [config]);
  const section = (title: string, children: ReactNode) => (
    <section key={title} className="flex flex-col gap-2 pt-4">
      <h3 className={phone.groupLabel}>{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="Filters"
      lead={{ label: 'Clear', onClick: () => setFilters({ ...EMPTY_FILTERS, search: f.search }) }}
    >
      {section(
        'Color',
        COLOR_KEYS.map((c) => (
          <Chip
            key={c.id}
            on={f.colors.includes(c.id)}
            onClick={() => setFilters({ ...f, colors: toggle(f.colors, c.id) })}
          >
            {c.id !== 'M' && <Pip symbol={c.id} size={14} />}
            {c.label}
          </Chip>
        )),
      )}
      {section(
        'Type',
        TYPE_KEYS.map((t) => (
          <Chip
            key={t.id}
            on={f.types.includes(t.id)}
            onClick={() => setFilters({ ...f, types: toggle(f.types, t.id) })}
          >
            {t.label}
          </Chip>
        )),
      )}
      {section(
        'Mana value',
        MANA_VALUES.map((m) => (
          <Chip
            key={m.id}
            on={f.manaValues.includes(m.id)}
            onClick={() => setFilters({ ...f, manaValues: toggle(f.manaValues, m.id) })}
          >
            {m.label}
          </Chip>
        )),
      )}
      {tags.map((g) =>
        section(
          `Tags: ${g.group}`,
          g.tags.map((t) => (
            <Chip
              key={t.id}
              on={f.tags.includes(t.id)}
              onClick={() => setFilters({ ...f, tags: toggle(f.tags, t.id) })}
            >
              {t.label}
            </Chip>
          )),
        ),
      )}
      {section(
        'Sort',
        POOL_SORTS.map((s) => (
          <Chip key={s.id} on={props.sort === s.id} onClick={() => props.setSort(s.id)}>
            {s.label}
          </Chip>
        )),
      )}
      <div className={`${phone.group} mt-5`}>
        <label className={phone.row}>
          <span className="flex-1 text-[0.9375rem]">Unlimited basic lands</span>
          <Toggle
            label="Unlimited basic lands"
            checked={props.unlimitedBasics}
            onChange={props.onBasics}
            variant="phone"
          />
        </label>
      </div>
    </Sheet>
  );
}

/** One line under each archetype on the phone, from the three size cells. */
function phoneNote(row: AnalysisRow): string {
  const states = DECK_SIZES.map((s) => ({ size: s, ...row.cells[s] }));
  const viable = states.filter((s) => s.state === 'viable');
  const near = states.filter((s) => s.state === 'near');
  if (viable.length === 3) return `Viable at every size. ${cap(states[0]!.detail)}.`;
  if (near.length > 0)
    return `Near miss at ${near.map((s) => s.size).join(' and ')}: ${near[0]!.detail}.`;
  if (viable.length > 0) {
    const none = states.filter((s) => s.state === 'none').map((s) => s.size);
    return `Viable at ${viable.map((s) => s.size).join(' and ')}, not enough for ${none.join(' and ')}.`;
  }
  return `${cap(states[0]!.detail)}.`;
}

function Analysis() {
  const { scans, pool, build } = useAppState();
  const nav = useNav();
  const [color, setColor] = useState<Color>(() => build.color ?? 'W');
  const rows = useMemo(() => (scans ? analysisRows(scans, color) : []), [scans, color]);
  if (!scans || !pool.loaded) return <p className={`${phone.note} p-4`}>Loading pool</p>;
  const scan = scans[60][color];
  const sizes = buildableSizes(scans, color);
  const name = COLOR_LABELS[color];
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-2.5 px-4 pb-2.5">
        <div role="radiogroup" aria-label="Color" className="grid grid-cols-5 gap-1.5">
          {COLORS.map((c) => {
            const on = c === color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${COLOR_LABELS[c]}, ${scans[60][c].candidates} candidates`}
                onClick={() => setColor(c)}
                className={`flex flex-col items-center gap-1 rounded-lg border py-2 ${on ? 'border-ink bg-surface' : 'border-line'}`}
              >
                <Pip symbol={c} size={18} />
                <span className="text-[0.6875rem] text-fg-1 tabular-nums">
                  {fmt(scans[60][c].candidates)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[0.78125rem] text-fg-1">
          {name} · {fmt(scan.candidates)} candidates ·{' '}
          {sizes.length ? `can build ${sizes.join(', ')}` : 'cannot build a deck yet'}
        </p>
      </div>
      {sizes.length === 0 ? (
        <p className={`${phone.note} px-4`}>
          Even a 20-card packet {scanShortfall(scans[20][color]) ?? 'needs more cards'}.
        </p>
      ) : (
        <ul className="border-y border-line bg-surface">
          {rows.map((r) => (
            <li
              key={r.archetype}
              className="flex flex-col gap-1 border-b border-surface-2 px-4 py-2.5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.875rem] font-medium">{r.label}</span>
                <span className="flex shrink-0 gap-2.5 text-[0.71875rem] text-fg-1">
                  {DECK_SIZES.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1"
                      aria-label={`${s}: ${r.cells[s].state === 'viable' ? 'viable' : r.cells[s].state === 'near' ? 'near miss' : 'not enough'}`}
                    >
                      <ViabilityDot state={r.cells[s].state} />
                      <span aria-hidden>{s}</span>
                    </span>
                  ))}
                </span>
              </div>
              <p className="text-[0.75rem] text-fg-2">{phoneNote(r)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="p-4">
        <button
          type="button"
          className={phone.secondary}
          disabled={sizes.length === 0}
          onClick={() => {
            // Land on a size this color can build, and keep a result already shown for it.
            if (!scans[build.size][color].possible) build.setSize(sizes[0]!);
            if (build.color !== color) build.setColor(color);
            nav.go('build');
          }}
        >
          Build {name.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Import

const MODES: { id: ImportMode; label: string }[] = [
  { id: 'add', label: 'Add to pool' },
  { id: 'replace', label: 'Replace pool' },
];

export function ImportScreen() {
  const { index, pool, settings, pack } = useAppState();
  const nav = useNav();
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string>();
  const target = useMemo(
    () => ({
      add: pool.actions.add,
      replace: (entries: PoolEntry[]) =>
        pool.actions.transform(() => addToPool(emptyPool(), entries)),
    }),
    [pool.actions],
  );
  const imp = useImport(index, target, {
    includeUnsets: settings.settings.includeUnsets,
    unlimitedBasics: settings.settings.unlimitedBasics,
  });
  const preview = imp.preview;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) imp.setText(imp.text ? `${imp.text}\n${text}` : text);
      else setNote('The clipboard is empty.');
    } catch {
      setNote('Paste was not allowed. Long-press the box and choose Paste.');
    }
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

  const bottom = preview ? (
    <button type="button" className={phone.primary} disabled={preview.cards === 0} onClick={commit}>
      {imp.mode === 'replace'
        ? `Replace pool with ${plural(preview.cards, 'card')}`
        : `Add ${plural(preview.cards, 'card')} to pool`}
    </button>
  ) : imp.done ? (
    <button type="button" className={phone.primary} onClick={() => nav.go('pool')}>
      Open the pool
    </button>
  ) : (
    <button
      type="button"
      className={phone.primary}
      disabled={!imp.canResolve}
      onClick={imp.resolve}
    >
      Import
    </button>
  );

  return (
    <Pushed
      back={{ label: 'Pool', onClick: () => nav.go('pool') }}
      title="Import"
      action={{ label: 'Paste', onClick: () => void paste() }}
      bottom={bottom}
    >
      <div className="flex flex-col gap-3 px-4 pb-4">
        <textarea
          value={imp.text}
          onChange={(e) => imp.setText(e.target.value)}
          aria-label="Card list"
          placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\n10 Forest'}
          spellCheck={false}
          className="h-[10.625rem] w-full resize-none rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 font-mono text-[0.8125rem] leading-[1.6] placeholder:text-fg-3"
        />
        <div className="flex items-center justify-between gap-2 text-[0.78125rem] text-fg-1">
          <span>
            {plural(imp.parsed.lines.length, 'line')} · {plural(imp.totalCards, 'card')} ·{' '}
            {fmt(imp.parsed.skipped.length)} unreadable
          </span>
          <button
            type="button"
            className="min-h-9 text-ink underline"
            onClick={() => fileInput.current?.click()}
          >
            Choose file
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
        {note && <p className={phone.note}>{note}</p>}
        <Segmented
          label="Import mode"
          options={MODES}
          value={imp.mode}
          onChange={imp.setMode}
          variant="phone"
        />
        {pack.status === 'loading' && <p className={phone.note}>Card data is still loading.</p>}
        {!preview && !imp.done && (
          <p className={phone.note}>
            Paste a decklist or a ManaBox, Moxfield, or Deckbox export, then tap Import. Every line
            is checked before anything is added.
          </p>
        )}
        {imp.done && (
          <p className="text-[0.875rem]">
            {imp.done.mode === 'replace' ? 'Replaced the pool with ' : 'Added '}
            {plural(imp.done.cards, 'card')}
            {imp.done.mode === 'replace' ? '.' : ' to the pool.'}
          </p>
        )}
        {preview && (
          <>
            <div className="flex gap-6">
              <PhoneStat value={preview.cards} caption="resolved" />
              <PhoneStat value={preview.unresolved.length} caption="unresolved" muted />
              {settings.settings.unlimitedBasics && (
                <PhoneStat value={preview.basics} caption="basics" muted />
              )}
            </div>
            {preview.unresolved.length > 0 ? (
              <ul className={phone.group}>
                {preview.unresolved.map((u, i) => {
                  const next = preview.unresolved[i + 1] ?? preview.unresolved[i - 1];
                  const then = (fn: () => void) => {
                    fn();
                    setTimeout(() => {
                      if (next) document.getElementById(`unresolved-${next.line.line}`)?.focus();
                    }, 0);
                  };
                  const suggestion = u.suggestions[0];
                  const submit = (value: string) => {
                    const v = value.trim();
                    if (v && v !== u.name) imp.editLine(u.line.line, v);
                  };
                  return (
                    <li
                      key={u.line.line}
                      className="flex flex-col gap-1.5 border-b border-surface-2 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[0.75rem] text-fg-1">
                          {u.line.qty}
                        </span>
                        <input
                          id={`unresolved-${u.line.line}`}
                          defaultValue={u.name}
                          aria-label={`Card name on line ${u.line.line}`}
                          enterKeyHint="done"
                          onBlur={(e) => {
                            const row = e.currentTarget.closest('li');
                            if (
                              row &&
                              e.relatedTarget instanceof Node &&
                              row.contains(e.relatedTarget)
                            )
                              return;
                            submit(e.currentTarget.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submit(e.currentTarget.value);
                          }}
                          className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 py-[0.4375rem] text-[0.875rem]"
                        />
                      </div>
                      <div className="flex items-center gap-3 pl-[1.875rem] text-[0.75rem] text-fg-1">
                        <span className="min-w-0 flex-1">
                          {suggestion ? (
                            <>
                              Did you mean <span className="text-ink">{suggestion}</span>?
                            </>
                          ) : (
                            'No close match. Edit the name.'
                          )}
                        </span>
                        {suggestion && (
                          <button
                            type="button"
                            className="min-h-9 px-1 font-medium text-ink"
                            onClick={() =>
                              then(() => imp.acceptSuggestion(u.line.line, suggestion))
                            }
                          >
                            Use
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-9 px-1 text-fg-2"
                          onClick={() => then(() => imp.skip(u.line.line))}
                        >
                          Skip
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={phone.note}>
                {preview.cards === 0
                  ? preview.basics > 0
                    ? 'Only basic lands, which are unlimited and not stored.'
                    : 'Nothing to add. Check the names or the format.'
                  : preview.skipped > 0
                    ? `Skipped ${plural(preview.skipped, 'line')}. Everything else matched.`
                    : 'Every line matched a card.'}
              </p>
            )}
            {preview.unresolved.length > 1 && (
              <button
                type="button"
                className="min-h-11 self-start text-[0.875rem] text-fg-1 underline"
                onClick={imp.skipAll}
              >
                Skip all unresolved
              </button>
            )}
          </>
        )}
      </div>
    </Pushed>
  );
}

function PhoneStat({ value, caption, muted }: { value: number; caption: string; muted?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className={`text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums ${muted ? 'text-fg-1' : ''}`}
      >
        {fmt(value)}
      </span>
      <span className="text-[0.71875rem] text-fg-2">{caption}</span>
    </div>
  );
}
