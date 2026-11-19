import { useEffect, useState, type ReactNode } from 'react';
import {
  COLOR_KEYS,
  compactCount,
  EMPTY_FILTERS,
  MV_OPS,
  nextSort,
  Pip,
  Sheet,
  ui,
  type ColorKey,
  type Facet,
  type PoolFacets,
  type PoolFilters,
  type PoolSort,
  type PoolSummary,
  type SortKey,
} from '@bulk-brew/ui';

// The Bulk List's phone parts: color tiles, and the sheets behind the Filters and Sort buttons.

const fmt = (n: number) => n.toLocaleString('en-US');

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * One tile per color: the symbol filters the list, the count under it is
 * short (1.2k) and shows the exact number in a bubble when tapped. A tap
 * anywhere closes the bubble.
 */
export function ColorTiles(props: {
  summary: PoolSummary;
  selected: ColorKey[];
  onToggle(id: ColorKey): void;
}) {
  const { summary, selected, onToggle } = props;
  const [tip, setTip] = useState<ColorKey>();
  useEffect(() => {
    if (!tip) return;
    // A tap anywhere closes it; a count closes or moves it itself.
    const onPointer = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-count]')) setTip(undefined);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTip(undefined);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [tip]);
  const keys = COLOR_KEYS.filter((c) => c.id !== 'M' || summary.byColor.M > 0);
  const tipLabel = COLOR_KEYS.find((c) => c.id === tip)?.label.toLowerCase();
  return (
    <div className="relative">
      <div role="group" aria-label="Colors" className="grid auto-cols-fr grid-flow-col gap-1">
        {keys.map((c) => {
          const on = selected.includes(c.id);
          const n = summary.byColor[c.id];
          return (
            <div
              key={c.id}
              className={`flex min-w-0 flex-col items-center rounded-lg border ${
                on ? 'border-ink bg-surface' : 'border-transparent'
              }`}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Show only ${c.label.toLowerCase()} cards`}
                onClick={() => onToggle(c.id)}
                className="flex h-9 w-full items-end justify-center pb-0.5"
              >
                {c.id === 'M' ? (
                  <span className="text-[0.75rem] leading-[22px] font-semibold">Multi</span>
                ) : (
                  <Pip symbol={c.id} size={22} />
                )}
              </button>
              <button
                type="button"
                aria-label={`${fmt(n)} ${c.label.toLowerCase()} cards`}
                data-count
                onClick={() => setTip((t) => (t === c.id ? undefined : c.id))}
                onBlur={() => setTip((t) => (t === c.id ? undefined : t))}
                className={`h-7 w-full text-[0.8125rem] tabular-nums ${on ? 'font-semibold text-ink' : 'text-fg-1'}`}
              >
                {compactCount(n)}
              </button>
            </div>
          );
        })}
      </div>
      {/* Always present, so screen readers announce the number. */}
      <p
        role="status"
        className={
          tip
            ? 'absolute top-full left-1/2 z-20 mt-1 -translate-x-1/2 rounded-md bg-ink px-3 py-1.5 text-[0.8125rem] whitespace-nowrap text-on-ink shadow-lg'
            : 'sr-only'
        }
      >
        {tip &&
          `${fmt(summary.byColor[tip])} ${tipLabel} ${summary.byColor[tip] === 1 ? 'card' : 'cards'}`}
      </p>
    </div>
  );
}

/** A square icon button for the toolbar, with a count in its corner. */
export function IconButton(props: {
  label: string;
  badge?: number | boolean;
  onClick(): void;
  children: ReactNode;
}) {
  const { label, badge, onClick, children } = props;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-ink [--icon-fill:var(--surface)] pointer-coarse:size-11"
    >
      {children}
      {badge !== undefined && badge !== false && badge !== 0 && (
        <span
          aria-hidden
          className={`absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-ink text-[0.6875rem] leading-none font-semibold text-on-ink ${
            badge === true ? 'size-3' : 'h-5 min-w-5 px-1'
          }`}
        >
          {badge === true ? '' : badge}
        </span>
      )}
    </button>
  );
}

const pill = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem]';
const pillOff = 'border-line-strong bg-surface text-fg-1';
const pillOn = 'border-ink bg-ink font-semibold text-on-ink';

/** Most values shown at once; a longer list gets a search box. */
const CAP = 24;

function FacetGroup<T extends string | number>(props: {
  name: string;
  options: Facet<T>[];
  selected: T[];
  onChange(next: T[]): void;
}) {
  const { name, options, selected, onChange } = props;
  const [q, setQ] = useState('');
  if (options.length === 0) return null;
  const long = options.length > CAP;
  const query = q.trim().toLowerCase();
  const match = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  // Picked values stay in view however long the list is.
  const picked = match.filter((o) => selected.includes(o.id));
  const shown = long
    ? [...picked, ...match.filter((o) => !selected.includes(o.id))].slice(
        0,
        Math.max(CAP, picked.length),
      )
    : match;
  const lower = name.toLowerCase();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className={ui.sectionLabel}>
          {name}
          {selected.length > 0 && ` (${selected.length})`}
        </h3>
        {selected.length > 0 && (
          <button
            type="button"
            className={`${ui.quiet} text-[0.78125rem] underline`}
            onClick={() => onChange([])}
          >
            Clear {lower}
          </button>
        )}
      </div>
      {long && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Find a ${lower}`}
          aria-label={`Find a ${lower}`}
          className={ui.field}
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {shown.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={String(o.id)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggle(selected, o.id))}
              className={`${pill} ${on ? pillOn : pillOff}`}
            >
              {o.label}
              <span className={`tabular-nums ${on ? '' : 'text-fg-2'}`}>{o.count}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 && <p className={ui.note}>Nothing matches.</p>}
      {match.length > shown.length && (
        <p className={ui.hint}>
          Showing {shown.length} of {match.length}. Search to find the rest.
        </p>
      )}
    </section>
  );
}

/** Every Bulk List filter but the colors, which have their tiles on the page. */
export function FilterSheet(props: {
  open: boolean;
  onClose(): void;
  facets: PoolFacets;
  filters: PoolFilters;
  setFilters(f: PoolFilters | ((f: PoolFilters) => PoolFilters)): void;
  /** Whether any filter or search is on, so Clear has something to do. */
  filtered: boolean;
  /** Unique cards the filters leave. */
  shown: number;
}) {
  const { open, onClose, facets, filters, setFilters, filtered, shown } = props;
  const set = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const values = facets.manaValues;
  const mvOn = filters.mv.op !== 'any';
  const mvValue = values.includes(filters.mv.value) ? filters.mv.value : (values[0] ?? 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Filters"
      title={
        <div className="flex items-center justify-between gap-3">
          <span>Filters</span>
          <button
            type="button"
            className={`${ui.small} font-normal`}
            disabled={!filtered}
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        </div>
      }
      footer={(close) => (
        <button type="button" className={`${ui.primary} w-full`} onClick={close}>
          Show {fmt(shown)} {shown === 1 ? 'card' : 'cards'}
        </button>
      )}
    >
      <div className="flex flex-col gap-5">
        <FacetGroup
          name="Type"
          options={facets.types}
          selected={filters.types}
          onChange={(v) => set('types', v)}
        />
        <section className="flex flex-col gap-2">
          <h3 className={ui.sectionLabel}>Mana value</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {MV_OPS.map((o) => {
              const on = filters.mv.op === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={o.id === 'any' ? 'Any mana value' : `Mana value ${o.label}`}
                  onClick={() => set('mv', { op: o.id, value: mvValue })}
                  className={`${pill} min-w-11 justify-center ${on ? pillOn : pillOff}`}
                >
                  {o.label}
                </button>
              );
            })}
            {mvOn && (
              <select
                aria-label="Mana value to compare with"
                value={mvValue}
                onChange={(e) => set('mv', { op: filters.mv.op, value: Number(e.target.value) })}
                className={`${ui.field} ml-1`}
              >
                {values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>
        <FacetGroup
          name="Subtype"
          options={facets.subtypes}
          selected={filters.subtypes}
          onChange={(v) => set('subtypes', v)}
        />
        <FacetGroup
          name="Tags"
          options={facets.tags}
          selected={filters.tags}
          onChange={(v) => set('tags', v)}
        />
        <FacetGroup
          name="Subtags"
          options={facets.subtags}
          selected={filters.subtags}
          onChange={(v) => set('subtags', v)}
        />
      </div>
    </Sheet>
  );
}

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'qty', label: 'Quantity' },
  { key: 'cost', label: 'Cost' },
  { key: 'type', label: 'Type' },
  { key: 'subtype', label: 'Subtype' },
  { key: 'tags', label: 'Tags' },
];

/** Sorting, which the column headings do on a wide screen, and the way into Select. */
export function SortSheet(props: {
  open: boolean;
  onClose(): void;
  sort: PoolSort;
  setSort(s: PoolSort): void;
  selecting: boolean;
  onSelecting(on: boolean): void;
}) {
  const { open, onClose, sort, setSort, selecting, onSelecting } = props;
  return (
    <Sheet open={open} onClose={onClose} label="Sort and select" title="Sort and select">
      {(close) => (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h3 className={ui.sectionLabel}>Sort by</h3>
            <div className="flex flex-wrap gap-1.5">
              {SORT_KEYS.map((k) => {
                const dir = sort?.key === k.key ? sort.dir : undefined;
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={dir !== undefined}
                    aria-label={
                      dir ? `${k.label}, ${dir === 'asc' ? 'ascending' : 'descending'}` : k.label
                    }
                    onClick={() => setSort(nextSort(sort, k.key))}
                    className={`${pill} ${dir ? pillOn : pillOff}`}
                  >
                    {k.label}
                    {dir && (
                      <span aria-hidden className="text-[0.625rem]">
                        {dir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={ui.hint}>
              Tap again to reverse the order, and once more to go back to names A to Z.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className={ui.sectionLabel}>Select</h3>
            <button
              type="button"
              className={`${selecting ? ui.primary : ui.secondary} w-full`}
              onClick={() => {
                onSelecting(!selecting);
                close();
              }}
            >
              {selecting ? 'Stop selecting' : 'Select cards to remove'}
            </button>
          </section>
        </div>
      )}
    </Sheet>
  );
}
