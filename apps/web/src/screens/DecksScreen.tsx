import { useMemo, useState } from 'react';
import { archetypeById, COLOR_LABELS, pairPackets, returnDeck, type Deck } from '@bulk-brew/core';
import { DeckView } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';

function archetypeLabel(config: ReturnType<typeof useAppState>['config'], id: string): string {
  try {
    return archetypeById(config, id).label;
  } catch {
    return id;
  }
}

export function DecksScreen() {
  const { index, config, decks, pool, pack } = useAppState();
  const [openId, setOpenId] = useState<string>();
  const [pairA, setPairA] = useState<string>();
  const [pairB, setPairB] = useState<string>();

  const open = decks.decks.find((d) => d.id === openId);
  const packets = decks.decks.filter((d) => d.size === 20);
  const pair = useMemo(() => {
    const a = packets.find((d) => d.id === pairA);
    const b = packets.find((d) => d.id === pairB);
    if (!a || !b || !index) return undefined;
    return pairPackets(a, b, index, config);
  }, [packets, pairA, pairB, index, config]);

  if (pack.status === 'error') {
    return <p className="text-sm text-amber-600">Card data failed to load: {pack.error}</p>;
  }
  if (pack.status !== 'ready' || !index || !decks.loaded) {
    return <p className={muted}>Loading.</p>;
  }

  if (open) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <button type="button" className={button} onClick={() => setOpenId(undefined)}>
            Back to decks
          </button>
        </div>
        <DeckView
          deck={open}
          index={index}
          config={config}
          mode="saved"
          onRename={(name) => decks.update({ ...open, name })}
          onDelete={(returnCards) => {
            if (returnCards && open.committed) {
              const now = new Date().toISOString();
              pool.actions.transform((p) => returnDeck(p, open, index, config, now));
            }
            decks.remove(open.id);
            setOpenId(undefined);
          }}
        />
      </div>
    );
  }

  if (decks.decks.length === 0) {
    return <p className={muted}>No saved decks yet. Build one and accept it.</p>;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="py-1 pr-2">Name</th>
            <th className="py-1 pr-2">Size</th>
            <th className="py-1 pr-2">Color</th>
            <th className="py-1 pr-2">Style</th>
            <th className="py-1 pr-2">Created</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {decks.decks.map((d: Deck) => (
            <tr key={d.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1 pr-2">
                <button type="button" className="underline" onClick={() => setOpenId(d.id)}>
                  {d.name}
                </button>
              </td>
              <td className="py-1 pr-2 tabular-nums">{d.size}</td>
              <td className="py-1 pr-2">{COLOR_LABELS[d.color]}</td>
              <td className="py-1 pr-2">{archetypeLabel(config, d.archetype)}</td>
              <td className={`py-1 pr-2 ${muted}`}>{d.createdAt.slice(0, 10)}</td>
              <td className="py-1 text-right">
                {d.committed && (
                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    committed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {packets.length >= 2 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Pair two packets into a 40-card deck</h2>
          <div className="flex flex-wrap gap-2">
            {[
              [pairA, setPairA],
              [pairB, setPairB],
            ].map(([value, set], i) => (
              <select
                key={i}
                value={(value as string | undefined) ?? ''}
                onChange={(e) =>
                  (set as (v: string | undefined) => void)(e.target.value || undefined)
                }
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Packet {i + 1}</option>
                {packets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {pair && !pair.ok && <p className="text-sm text-amber-600">{pair.error}</p>}
          {pair?.ok && (
            <textarea
              readOnly
              value={pair.text}
              rows={12}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
        </section>
      )}
    </div>
  );
}
