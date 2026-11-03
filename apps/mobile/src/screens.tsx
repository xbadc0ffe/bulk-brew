import { useMemo, useState } from 'react';
import { parseDecklist } from '@bulk-brew/core';
import { ManaCost } from '@bulk-brew/ui';

// Placeholder screens. Each becomes its own file during the design pass.

export function ImportScreen() {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseDecklist(text), [text]);
  const total = parsed.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Paste a decklist or collection export.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={'4 Lightning Bolt (M10) 146\n2 Llanowar Elves\nForest x10'}
        className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="text-sm">
        {parsed.lines.length} lines, {total} cards, {parsed.skipped.length} unreadable
      </div>
    </div>
  );
}

export function PoolScreen() {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Your active pool. Example cost: <ManaCost cost="{2}{R}" />
    </p>
  );
}

export function BuildScreen() {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Pick a size, a color, and an optional style, then build.
    </p>
  );
}

export function DecksScreen() {
  return <p className="text-sm text-zinc-600 dark:text-zinc-400">Saved decks.</p>;
}

export function SettingsScreen() {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Copy limits, basics, Un-sets, card art, card data updates, backup, about.
    </p>
  );
}
