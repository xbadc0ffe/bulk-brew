import { useMemo, useState } from 'react';
import { archetypeById, COLOR_LABELS, pairPackets, returnDeck } from '@bulk-brew/core';
import { DeckView } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';

export function DecksScreen() {
  const { index, config, decks, pool, pack, settings, detail } = useAppState();
  const [openId, setOpenId] = useState<string>();
  const [pairA, setPairA] = useState<string>();
  const [pairB, setPairB] = useState<string>();
  const [copied, setCopied] = useState(false);

  const open = decks.decks.find((d) => d.id === openId);
  const packets = useMemo(() => decks.decks.filter((d) => d.size === 20), [decks.decks]);
  const pair = useMemo(() => {
    const a = packets.find((d) => d.id === pairA);
    const b = packets.find((d) => d.id === pairB);
    if (!a || !b || !index) return undefined;
    return pairPackets(a, b, index, config);
  }, [packets, pairA, pairB, index, config]);

  const copyPair = async () => {
    if (!pair?.ok) return;
    try {
      await navigator.clipboard.writeText(pair.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

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
            Back
          </button>
        </div>
        <DeckView
          deck={open}
          index={index}
          config={config}
          mode="saved"
          showArt={settings.settings.showArt}
          onOpenCard={detail.open}
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

  const label = (id: string) => {
    try {
      return archetypeById(config, id).label;
    } catch {
      return id;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {decks.decks.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3 text-left"
              onClick={() => setOpenId(d.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{d.name}</span>
                <span className={`block text-xs ${muted}`}>
                  {d.size} cards, {COLOR_LABELS[d.color]}, {label(d.archetype)},{' '}
                  {d.createdAt.slice(0, 10)}
                </span>
              </span>
              {d.committed && (
                <span className="shrink-0 rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">
                  committed
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {packets.length >= 2 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Pair two packets</h2>
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
              className="rounded border border-zinc-300 bg-white px-2 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Packet {i + 1}</option>
              {packets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ))}
          {pair && !pair.ok && <p className="text-sm text-amber-600">{pair.error}</p>}
          {pair?.ok && (
            <>
              <button type="button" className={button} onClick={() => void copyPair()}>
                {copied ? 'Copied' : 'Copy list'}
              </button>
              <textarea
                readOnly
                value={pair.text}
                rows={12}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
