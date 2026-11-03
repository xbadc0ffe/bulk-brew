import { useMemo, useRef, useState } from 'react';
import { poolToDecklist, type Color } from '@bulk-brew/core';
import {
  CardImage,
  COLOR_NAMES,
  COLOR_ORDER,
  IMPORT_FORMAT_LABELS,
  ManaCost,
  POOL_SORTS,
  poolRows,
  poolSummary,
  useImport,
  useWindowedRows,
  type ColorFilter,
  type PoolSort,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';

// Plain functional screens. The design pass restyles and splits them up.

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';
const primary =
  'rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const field =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export function ImportScreen() {
  const { index, pool, pack, settings } = useAppState();
  const imp = useImport(index, pool.actions.add, settings.settings.includeUnsets);
  const total = imp.parsed.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <p className={muted}>
        Paste a decklist or a collection export, or choose a file. Decklist lines like{' '}
        <code>4 Lightning Bolt</code>, <code>4x Lightning Bolt</code>, and{' '}
        <code>4 Lightning Bolt (M10) 146 *F*</code> work, and so do CSV exports from ManaBox,
        Moxfield, and Deckbox. Set codes are kept only to show the matching card art.
      </p>
      <textarea
        value={imp.text}
        onChange={(e) => imp.setText(e.target.value)}
        rows={12}
        placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\nForest x10'}
        className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} disabled={!imp.canAdd} onClick={imp.addToPool}>
          Add to pool
        </button>
        <label className={`${button} cursor-pointer`}>
          Choose file
          <input
            type="file"
            accept=".txt,.csv,.tsv,.dec,text/plain,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void imp.loadFile(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className={button}
          disabled={!imp.text}
          onClick={() => imp.setText('')}
        >
          Clear text
        </button>
        <span className={muted}>
          {imp.parsed.lines.length} lines, {total} cards
          {imp.parsed.skipped.length > 0 && `, ${imp.parsed.skipped.length} skipped`}
          {imp.text && ` (${IMPORT_FORMAT_LABELS[imp.format]})`}
          {pack.status === 'loading' && ' (card data still loading)'}
        </span>
      </div>

      {imp.report && (
        <div className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <p>
            Added {imp.report.cardCount} cards ({imp.report.resolved.length} lines) to the pool.
          </p>
          {imp.report.unresolved.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">{imp.report.unresolved.length} lines not recognized:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {imp.report.unresolved.map((u) => (
                  <li key={u.line.line} className="flex flex-wrap items-center gap-2">
                    <code className="text-xs">{u.line.raw}</code>
                    {u.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={button}
                        onClick={() => imp.acceptSuggestion(u, s)}
                      >
                        Use {s}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PoolScreen() {
  const { index, pool, pack, settings, detail } = useAppState();
  const showArt = settings.settings.showArt;
  const [search, setSearch] = useState('');
  const [color, setColor] = useState<ColorFilter>('all');
  const [sort, setSort] = useState<PoolSort>('name');
  const [exported, setExported] = useState<string>();

  const rows = useMemo(
    () => (index ? poolRows(pool.pool, index, { search, color, sort }) : []),
    [index, pool.pool, search, color, sort],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );
  // Rows share one height so the long list can render only what is on screen;
  // the hook measures the real height and re-measures when the list changes.
  const rowHeight = showArt ? 44 : 34;
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const win = useWindowedRows(rows.length, rowHeight, tbodyRef, `${sort}|${color}|${search}`);

  if (pack.status === 'error') {
    return <p className="text-sm text-amber-600">Card data failed to load: {pack.error}</p>;
  }
  if (pack.status !== 'ready' || !index || !pool.loaded) return <p className={muted}>Loading.</p>;
  if (!summary || summary.distinct === 0) {
    return <p className={muted}>The pool is empty. Import some cards first.</p>;
  }

  const filters: { id: ColorFilter; label: string }[] = [
    { id: 'all', label: `All ${summary.cards}` },
    ...COLOR_ORDER.map((c: Color) => ({
      id: c as ColorFilter,
      label: `${COLOR_NAMES[c]} ${summary.byColor[c]}`,
    })),
    { id: 'C', label: `Colorless ${summary.byColor.C}` },
  ];
  const visible = rows.slice(win.start, win.end);
  const columns = showArt ? 6 : 5;

  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <p className={muted}>
        {summary.distinct} distinct cards, {summary.cards} copies, {summary.byColor.M} multicolor.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setColor(f.id)}
            aria-pressed={color === f.id}
            className={`${button} ${color === f.id ? 'ring-2 ring-zinc-500' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or type"
          className={`w-64 ${field}`}
        />
        <label className={`flex items-center gap-2 ${muted}`}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PoolSort)}
            className={field}
          >
            {POOL_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={button}
          onClick={() => setExported(poolToDecklist(pool.pool, index))}
        >
          Export list
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            if (window.confirm('Remove every card from the pool?')) pool.actions.clear();
          }}
        >
          Clear pool
        </button>
      </div>
      {exported !== undefined && (
        <textarea
          readOnly
          value={exported}
          rows={8}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}
      <table className="w-full table-fixed text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="w-10 py-1 pr-2">Qty</th>
            {showArt && <th className="w-10 py-1 pr-2"></th>}
            <th className="py-1 pr-2">Name</th>
            <th className="w-32 py-1 pr-2">Cost</th>
            <th className="w-40 py-1 pr-2">Type</th>
            <th className="w-36 py-1"></th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {win.topPad > 0 && (
            <tr aria-hidden style={{ height: win.topPad }}>
              <td colSpan={columns} />
            </tr>
          )}
          {visible.map(({ entry, card }) => (
            <tr
              key={card.id}
              data-row
              className="border-t border-zinc-200 dark:border-zinc-800"
              style={{ height: rowHeight }}
            >
              <td className="pr-2 tabular-nums">{entry.qty}</td>
              {showArt && (
                <td className="pr-2">
                  <button
                    type="button"
                    onClick={() => detail.open(card.id, entry.printing)}
                    aria-label={`Show ${card.name}`}
                  >
                    <CardImage card={card} size="small" className="h-9 w-auto" />
                  </button>
                </td>
              )}
              <td className="pr-2">
                <button
                  type="button"
                  className="block w-full truncate text-left hover:underline"
                  title={card.name}
                  onClick={() => detail.open(card.id, entry.printing)}
                >
                  {card.name}
                </button>
              </td>
              <td className="pr-2 whitespace-nowrap">
                <ManaCost cost={card.manaCost} />
              </td>
              <td className={`truncate pr-2 ${muted}`} title={card.typeLine}>
                {card.typeLine}
              </td>
              <td className="text-right whitespace-nowrap">
                <button
                  type="button"
                  className={button}
                  onClick={() => pool.actions.remove(card.id, 1)}
                  aria-label={`Remove one ${card.name}`}
                >
                  -
                </button>{' '}
                <button
                  type="button"
                  className={button}
                  onClick={() => pool.actions.add([{ cardId: card.id, qty: 1 }])}
                  aria-label={`Add one ${card.name}`}
                >
                  +
                </button>{' '}
                <button
                  type="button"
                  className={button}
                  onClick={() => pool.actions.remove(card.id)}
                  aria-label={`Remove all ${card.name}`}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {win.bottomPad > 0 && (
            <tr aria-hidden style={{ height: win.bottomPad }}>
              <td colSpan={columns} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && <p className={muted}>No cards match.</p>}
    </div>
  );
}
