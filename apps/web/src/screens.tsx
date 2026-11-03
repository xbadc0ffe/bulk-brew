import { useMemo, useState } from 'react';
import { poolToDecklist, type Color } from '@bulk-brew/core';
import {
  COLOR_NAMES,
  COLOR_ORDER,
  ManaCost,
  poolRows,
  poolSummary,
  useImport,
  type ColorFilter,
} from '@bulk-brew/ui';
import { useAppState } from './app-context.ts';

// Plain functional screens. The design pass restyles and splits them up.

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';
const primary =
  'rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';

export function ImportScreen() {
  const { index, pool, pack } = useAppState();
  const imp = useImport(index, pool.actions.add);
  const total = imp.parsed.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <p className={muted}>
        Paste a decklist or collection export. Formats like <code>4 Lightning Bolt</code>,{' '}
        <code>4x Lightning Bolt</code>, and <code>4 Lightning Bolt (M10) 146 *F*</code> all work.
        Set codes are kept only to show the matching card art.
      </p>
      <textarea
        value={imp.text}
        onChange={(e) => imp.setText(e.target.value)}
        rows={12}
        placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\nForest x10'}
        className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-3">
        <button type="button" className={primary} disabled={!imp.canAdd} onClick={imp.addToPool}>
          Add to pool
        </button>
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
          {imp.parsed.skipped.length > 0 && `, ${imp.parsed.skipped.length} unreadable`}
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
  const { index, pool, pack } = useAppState();
  const [search, setSearch] = useState('');
  const [color, setColor] = useState<ColorFilter>('all');
  const [exported, setExported] = useState<string>();

  const rows = useMemo(
    () => (index ? poolRows(pool.pool, index, { search, color }) : []),
    [index, pool.pool, search, color],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );

  if (pack.status === 'loading' || !pool.loaded) return <p className={muted}>Loading.</p>;
  if (pack.status === 'error' || !index) return <p className={muted}>Card data failed to load.</p>;
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

  return (
    <div className="flex max-w-4xl flex-col gap-3">
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
        <span className={muted}>
          {summary.distinct} distinct, {summary.byColor.M} multicolor
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or type"
          className="w-64 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
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
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="py-1 pr-2">Qty</th>
            <th className="py-1 pr-2">Name</th>
            <th className="py-1 pr-2">Cost</th>
            <th className="py-1 pr-2">Type</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, card }) => (
            <tr key={card.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1 pr-2 tabular-nums">{entry.qty}</td>
              <td className="py-1 pr-2">{card.name}</td>
              <td className="py-1 pr-2">
                <ManaCost cost={card.manaCost} />
              </td>
              <td className={`py-1 pr-2 ${muted}`}>{card.typeLine}</td>
              <td className="py-1 text-right whitespace-nowrap">
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
        </tbody>
      </table>
      {rows.length === 0 && <p className={muted}>No cards match.</p>}
    </div>
  );
}

export function BuildScreen() {
  return (
    <p className={muted}>
      Pick a deck size (60, 40, 20), a color, and an optional style, then build. Coming in phase 5.
    </p>
  );
}

export function DecksScreen() {
  return (
    <p className={muted}>
      Saved decks. Export, delete, or pair two 20-card packets into a 40-card deck. Coming in phase
      5.
    </p>
  );
}

export function SettingsScreen() {
  const { pack } = useAppState();
  return (
    <div className={`flex flex-col gap-2 ${muted}`}>
      <p>
        Card data:{' '}
        {pack.status === 'ready' ? `${pack.index.version}, ${pack.index.size} cards` : pack.status}
      </p>
      <p>
        Copy limits, basics, Un-sets, card art, backup and restore, about: coming with the full app.
      </p>
    </div>
  );
}
