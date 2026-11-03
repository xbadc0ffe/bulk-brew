import { useMemo, useState } from 'react';
import type { Color } from '@bulk-brew/core';
import {
  COLOR_ORDER,
  ManaCost,
  poolRows,
  poolSummary,
  useImport,
  type ColorFilter,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';

// Plain functional screens for phones. The design pass restyles and splits them up.

const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const primary =
  'rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';

export function ImportScreen() {
  const { index, pool } = useAppState();
  const imp = useImport(index, pool.actions.add);
  const total = imp.parsed.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className={muted}>Paste a decklist or collection export.</p>
      <textarea
        value={imp.text}
        onChange={(e) => imp.setText(e.target.value)}
        rows={8}
        placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\nForest x10'}
        className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-2">
        <button type="button" className={primary} disabled={!imp.canAdd} onClick={imp.addToPool}>
          Add to pool
        </button>
        <span className={muted}>
          {imp.parsed.lines.length} lines, {total} cards
        </span>
      </div>
      {imp.report && (
        <div className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <p>Added {imp.report.cardCount} cards to the pool.</p>
          {imp.report.unresolved.map((u) => (
            <div key={u.line.line} className="mt-2 flex flex-wrap items-center gap-2">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PoolScreen() {
  const { index, pool, pack } = useAppState();
  const [search, setSearch] = useState('');
  const [color, setColor] = useState<ColorFilter>('all');
  const rows = useMemo(
    () => (index ? poolRows(pool.pool, index, { search, color }) : []),
    [index, pool.pool, search, color],
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
      <div className="flex flex-wrap gap-1">
        {(['all', ...COLOR_ORDER, 'C'] as ColorFilter[]).map((c) => (
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
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search"
        className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map(({ entry, card }) => (
          <li key={card.id} className="flex items-center gap-3 py-2">
            <span className="w-6 text-right tabular-nums">{entry.qty}</span>
            <span className="flex-1">
              <span className="block">{card.name}</span>
              <span className={`block text-xs ${muted}`}>{card.typeLine}</span>
            </span>
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
