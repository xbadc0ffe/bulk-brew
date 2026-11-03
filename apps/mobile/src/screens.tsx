import { useMemo, useState } from 'react';
import { addToPool, emptyPool, type Color, type PoolEntry } from '@bulk-brew/core';
import {
  CardImage,
  COLOR_ORDER,
  IMPORT_FORMAT_LABELS,
  ManaCost,
  POOL_SORTS,
  poolRows,
  poolSummary,
  useImport,
  type ColorKey,
  type PoolSort,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';

// Plain functional screens for phones. The design pass restyles and splits them up.

const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const primary =
  'rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const field =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900';

export function ImportScreen() {
  const { index, pool, settings } = useAppState();
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
  const total = imp.totalCards;

  return (
    <div className="flex flex-col gap-3">
      <p className={muted}>
        Paste a decklist or a collection export, or choose a file. CSV exports from ManaBox,
        Moxfield, and Deckbox work too.
      </p>
      <textarea
        value={imp.text}
        onChange={(e) => imp.setText(e.target.value)}
        rows={8}
        placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\nForest x10'}
        className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={!imp.canResolve} onClick={imp.resolve}>
          Check list
        </button>
        <label className={button}>
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
        <span className={muted}>
          {imp.parsed.lines.length} lines, {total} cards
          {imp.text && ` (${IMPORT_FORMAT_LABELS[imp.format]})`}
        </span>
      </div>
      {imp.done && <p className={muted}>Added {imp.done.cards} cards to the pool.</p>}
      {imp.preview && (
        <div className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <button type="button" className={primary} onClick={imp.commit}>
            Add {imp.preview.cards} cards to pool
          </button>
          {imp.preview.unresolved.map((u) => (
            <div key={u.line.line} className="mt-2 flex flex-wrap items-center gap-2">
              <code className="text-xs">{u.line.raw}</code>
              {u.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={button}
                  onClick={() => imp.acceptSuggestion(u.line.line, s)}
                >
                  Use {s}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PoolScreen() {
  const { index, pool, pack, settings, detail } = useAppState();
  const showArt = settings.settings.showArt;
  const [search, setSearch] = useState('');
  const [color, setColor] = useState<ColorKey | 'all'>('all');
  const [sort, setSort] = useState<PoolSort>('name');
  const rows = useMemo(
    () =>
      index
        ? poolRows(pool.pool, index, { search, colors: color === 'all' ? [] : [color], sort })
        : [],
    [index, pool.pool, search, color, sort],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );

  if (pack.status === 'error') {
    return <p className="text-sm text-amber-600">Card data failed to load: {pack.error}</p>;
  }
  if (pack.status !== 'ready' || !index || !pool.loaded) return <p className={muted}>Loading.</p>;
  if (!summary || summary.distinct === 0)
    return <p className={muted}>The pool is empty. Import some cards first.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className={muted}>
        {summary.distinct} distinct cards, {summary.cards} copies.
      </p>
      <div className="flex flex-wrap gap-1">
        {(['all', ...COLOR_ORDER, 'C'] as (ColorKey | 'all')[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-pressed={color === c}
            className={`${button} ${color === c ? 'ring-2 ring-zinc-500' : ''}`}
          >
            {c === 'all'
              ? `All ${summary.cards}`
              : c === 'C'
                ? `C ${summary.byColor.C}`
                : `${c} ${summary.byColor[c as Color]}`}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className={`min-w-0 flex-1 ${field}`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PoolSort)}
          className={field}
          aria-label="Sort"
        >
          {POOL_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map(({ entry, card }) => (
          <li key={card.id} className="flex items-center gap-3 py-2">
            <span className="w-6 shrink-0 text-right tabular-nums">{entry.qty}</span>
            {showArt && (
              <button
                type="button"
                className="shrink-0"
                onClick={() => detail.open(card.id, entry.printing)}
                aria-label={`Show ${card.name}`}
              >
                <CardImage card={card} size="small" className="h-11 w-auto" />
              </button>
            )}
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => detail.open(card.id, entry.printing)}
            >
              <span className="block truncate">{card.name}</span>
              <span className={`block truncate text-xs ${muted}`}>{card.typeLine}</span>
            </button>
            <ManaCost cost={card.manaCost} />
            <button
              type="button"
              className={button}
              onClick={() => pool.actions.remove(card.id, 1)}
              aria-label={`Remove one ${card.name}`}
            >
              -
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className={muted}>No cards match.</p>}
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
  );
}
