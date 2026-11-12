import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COLORS, COLOR_LABELS, exportBackup, poolToDecklist, type Color } from '@bulk-brew/core';
import {
  analysisRows,
  backupFilename,
  buildableSizes,
  COLOR_KEYS,
  DECK_SIZES,
  DISPLAY_TAGS,
  downloadText,
  EMPTY_FILTERS,
  filterCount,
  ManaCost,
  MV_OPS,
  phone,
  Pip,
  poolFacets,
  poolRows,
  poolSummary,
  scanShortfall,
  Segmented,
  SORT_CHOICES,
  useImport,
  useWindowedRows,
  ViabilityDot,
  viabilityLabel,
  type AnalysisRow,
  type MvOp,
  type PoolFacets,
  type PoolFilters,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';
import { useNav, type PoolView } from './nav.ts';
import { Chip, LargeTitle, Pushed, Sheet } from './parts.tsx';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

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
      <LargeTitle title="Bulk List" action={{ label: 'Import', onClick: () => nav.go('import') }} />
      <div className="px-4 pb-2.5">
        <Segmented
          label="Bulk List view"
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
  const { index, pool, settings, detail, config, decks, build } = useAppState();
  const nav = useNav();
  const {
    poolFilters: filters,
    setPoolFilters: setFilters,
    poolSort: sort,
    setPoolSort: setSort,
  } = nav;
  const [sheet, setSheet] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
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
  const win = useWindowedRows(
    rows.length,
    52,
    listRef,
    `${JSON.stringify(sort)}|${JSON.stringify(filters)}`,
  );
  const count = filterCount(filters);
  const facets = useMemo(
    () => (index ? poolFacets(pool.pool, index, config, DISPLAY_TAGS) : undefined),
    [index, pool.pool, config],
  );
  // The phone picker offers a few fixed orders; a column sort from elsewhere shows as its key.
  const sortId =
    SORT_CHOICES.find((c) => JSON.stringify(c.sort) === JSON.stringify(sort))?.id ?? 'name';

  if (!index || !pool.loaded || !summary)
    return <p className={`${phone.note} p-4`}>Loading your bulk list</p>;
  if (summary.distinct === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className={phone.note}>Your bulk list is empty. Import a list to start.</p>
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
              value={sortId}
              onChange={(e) => setSort(SORT_CHOICES.find((c) => c.id === e.target.value)?.sort)}
              className="min-h-11 appearance-none bg-transparent pr-3 text-right text-fg-2"
            >
              {SORT_CHOICES.map((s) => (
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
            className="h-[3.25rem] border-b-1 border-surface-2 last:border-b-0"
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

      <div className="flex flex-wrap gap-x-5 px-4 pt-2 pb-4 text-[0.8125rem]">
        <button
          type="button"
          className="min-h-11 text-fg-1 underline"
          onClick={() =>
            downloadText(
              `bulk-brew-list-${new Date().toISOString().slice(0, 10)}.txt`,
              poolToDecklist(pool.pool, index),
            )
          }
        >
          Export list
        </button>
        <button
          type="button"
          className="min-h-11 text-fg-1 underline"
          onClick={() => {
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
          }}
        >
          Backup
        </button>
        <button
          type="button"
          className="min-h-11 text-fg-1 underline"
          onClick={() => {
            if (window.confirm('Remove every card from your bulk list? Saved decks stay.')) {
              pool.actions.clear();
              build.reset();
            }
          }}
        >
          Clear list
        </button>
      </div>

      <FilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        filters={filters}
        setFilters={setFilters}
        facets={facets}
      />
    </div>
  );
}

function FilterSheet(props: {
  open: boolean;
  onClose(): void;
  filters: PoolFilters;
  setFilters(f: PoolFilters): void;
  facets: PoolFacets | undefined;
}) {
  const { filters: f, setFilters, facets } = props;
  const [subtypeQuery, setSubtypeQuery] = useState('');
  const section = (title: string, children: ReactNode) => (
    <section key={title} className="flex flex-col gap-2 pt-4">
      <h3 className={phone.groupLabel}>{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
  if (!facets) return null;
  const q = subtypeQuery.trim().toLowerCase();
  const subtypes = facets.subtypes.filter(
    (s) => f.subtypes.includes(s.id) || (q ? s.label.toLowerCase().includes(q) : s.count >= 3),
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
        facets.types.map((t) => (
          <Chip
            key={t.id}
            on={f.types.includes(t.id)}
            onClick={() => setFilters({ ...f, types: toggle(f.types, t.id) })}
          >
            {t.label}
          </Chip>
        )),
      )}
      <section className="flex flex-col gap-2 pt-4">
        <h3 className={phone.groupLabel}>Subtype</h3>
        <input
          type="search"
          value={subtypeQuery}
          onChange={(e) => setSubtypeQuery(e.target.value)}
          placeholder="Find a subtype"
          aria-label="Find a subtype"
          className={phone.field}
        />
        <div className="flex flex-wrap gap-1.5">
          {subtypes.slice(0, 40).map((s) => (
            <Chip
              key={s.id}
              on={f.subtypes.includes(s.id)}
              onClick={() => setFilters({ ...f, subtypes: toggle(f.subtypes, s.id) })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2 pt-4">
        <h3 className={phone.groupLabel}>Mana value</h3>
        <div className="flex gap-2">
          <select
            aria-label="Compare mana value"
            value={f.mv.op}
            onChange={(e) => setFilters({ ...f, mv: { ...f.mv, op: e.target.value as MvOp } })}
            className={`${phone.field} min-h-11 flex-1`}
          >
            {MV_OPS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id === 'any' ? 'Any mana value' : o.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Mana value to compare with"
            value={f.mv.value}
            disabled={f.mv.op === 'any'}
            onChange={(e) => setFilters({ ...f, mv: { ...f.mv, value: Number(e.target.value) } })}
            className={`${phone.field} min-h-11 w-24 disabled:opacity-50`}
          >
            {facets.manaValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </section>
      {section(
        'Tags',
        facets.tags.map((t) => (
          <Chip
            key={t.id}
            on={f.tags.includes(t.id)}
            onClick={() => setFilters({ ...f, tags: toggle(f.tags, t.id) })}
          >
            {t.label}
          </Chip>
        )),
      )}
      {section(
        'Subtags',
        facets.subtags.map((t) => (
          <Chip
            key={t.id}
            on={f.subtags.includes(t.id)}
            onClick={() => setFilters({ ...f, subtags: toggle(f.subtags, t.id) })}
          >
            {t.label}
          </Chip>
        )),
      )}
    </Sheet>
  );
}

/** One line under each archetype on the phone, from the three size cells. */
function phoneNote(row: AnalysisRow): string {
  const states = DECK_SIZES.map((s) => ({ size: s, ...row.cells[s] }));
  const viable = states.filter((s) => s.state === 'viable');
  const short = states.filter((s) => s.state === 'short');
  const near = states.filter((s) => s.state === 'near');
  if (viable.length === 3) return `Viable at every size. ${cap(states[0]!.detail)}.`;
  if (short.length > 0 || near.length > 0) {
    const at = (list: typeof states) => list.map((s) => s.size).join(' and ');
    const parts = viable.length ? [`Viable at ${at(viable)}.`] : [];
    // A short style's detail is a sentence of its own; here it follows a colon.
    if (short.length) parts.push(`Short at ${at(short)}: ${lower(short[0]!.detail)}.`);
    if (near.length) parts.push(`Near miss at ${at(near)}: ${near[0]!.detail}.`);
    return parts.join(' ');
  }
  if (viable.length > 0) {
    const none = states.filter((s) => s.state === 'none').map((s) => s.size);
    return `Viable at ${viable.map((s) => s.size).join(' and ')}, not enough for ${none.join(' and ')}.`;
  }
  return `${cap(states[0]!.detail)}.`;
}

function Analysis() {
  const { scans, pool, build, config } = useAppState();
  const nav = useNav();
  const [color, setColor] = useState<Color>(() => build.color ?? 'W');
  const rows = useMemo(
    () => (scans ? analysisRows(scans, color, config) : []),
    [scans, color, config],
  );
  if (!scans || !pool.loaded) return <p className={`${phone.note} p-4`}>Loading</p>;
  const scan = scans[60][color];
  const sizes = buildableSizes(scans, color);
  const name = COLOR_LABELS[color];
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-2.5 px-4 pb-2.5">
        <div role="group" aria-label="Color" className="grid grid-cols-5 gap-1.5">
          {COLORS.map((c) => {
            const on = c === color;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
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
              className="flex flex-col gap-1 border-b-1 border-surface-2 px-4 py-2.5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.875rem] font-medium">{r.label}</span>
                <span className="flex shrink-0 gap-2.5 text-[0.71875rem] text-fg-1">
                  {DECK_SIZES.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1"
                      aria-label={`${s}: ${viabilityLabel(r.cells[s].state).toLowerCase()}`}
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
            if (build.size === 100 || !scans[build.size][color].possible) build.setSize(sizes[0]!);
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

export function ImportScreen() {
  const { index, pool, settings, pack } = useAppState();
  const nav = useNav();
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string>();
  const imp = useImport(index, pool.actions.add, {
    includeUnsets: settings.settings.includeUnsets,
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

  return (
    <Pushed
      back={{ label: 'Bulk List', onClick: () => nav.go('pool') }}
      title="Import"
      action={{ label: 'Paste', onClick: () => void paste() }}
      bottom={
        <button
          type="button"
          className={phone.primary}
          disabled={!imp.canImport}
          onClick={imp.commit}
        >
          {preview && preview.cards > 0 ? `Import ${plural(preview.cards, 'card')}` : 'Import'}
        </button>
      }
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
            className="min-h-11 text-ink underline"
            onClick={() => fileInput.current?.click()}
          >
            Choose files
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.csv,.tsv,.dec,text/plain,text/csv"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void imp.addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
        {note && <p className={phone.note}>{note}</p>}
        <p role="status" className={imp.done ? 'text-[0.875rem]' : 'sr-only'}>
          {imp.done
            ? `Added ${plural(imp.done.cards, 'card')} to your bulk list.${
                imp.done.left > 0
                  ? ` ${plural(imp.done.left, 'line')} did not match and ${imp.done.left === 1 ? 'is' : 'are'} still in the box.`
                  : ''
              }`
            : ''}
        </p>
        {pack.status === 'loading' && <p className={phone.note}>Card data is still loading.</p>}
        {!preview && !imp.done && (
          <p className={phone.note}>
            Paste a decklist or a ManaBox, Moxfield, or Deckbox export. Every line is checked as you
            go, and Import adds the cards that matched.
          </p>
        )}
        {preview && (
          <>
            <div className="flex gap-6">
              <PhoneStat value={preview.cards} caption="matched" />
              <PhoneStat value={preview.distinct} caption="unique" muted />
              <PhoneStat value={preview.unresolved.length} caption="not matched" muted />
            </div>
            {preview.unresolved.length > 0 ? (
              <ul className={phone.group}>
                {preview.unresolved.slice(0, 30).map((u, i) => {
                  const next = preview.unresolved[i + 1] ?? preview.unresolved[i - 1];
                  const then = (fn: () => void) => {
                    fn();
                    setTimeout(() => {
                      if (next) document.getElementById(`unresolved-${next.line.line}`)?.focus();
                    }, 0);
                  };
                  const suggestion = imp.suggestionsFor(u.name)[0];
                  const submit = (value: string) => {
                    const v = value.trim();
                    if (v && v !== u.name) imp.editLine(u.key, v);
                  };
                  return (
                    <li
                      key={`${u.line.line}:${u.line.raw}`}
                      className="flex flex-col gap-1.5 border-b-1 border-surface-2 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[0.75rem] text-fg-1">
                          {u.line.qty}
                        </span>
                        <input
                          id={`unresolved-${u.line.line}`}
                          defaultValue={u.name}
                          aria-label={`Card name, line ${u.line.line}`}
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
                            className="min-h-11 px-1 font-medium text-ink"
                            onClick={() => then(() => imp.acceptSuggestion(u.key, suggestion))}
                          >
                            Use
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-11 px-1 text-fg-2"
                          onClick={() => then(() => imp.skip(u.key))}
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
                {preview.skipped > 0
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
                Skip all that did not match
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
