import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COLOR_LABELS, deckToDecklist, pairPackets, type Deck } from '@bulk-brew/core';
import {
  archetypeInfo,
  deckFilename,
  disassembleQuestion,
  downloadText,
  landCount,
  phone,
  Pip,
  savedLabel,
  useDeckActions,
  useStatus,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { exportActions } from '../deck-actions.ts';
import { useNav } from '../nav.ts';
import { ActionSheet, LargeTitle, Pushed } from '../parts.tsx';
import { PackGate } from '../screens.tsx';
import { DeckScreen } from './DeckView.tsx';

type View = { kind: 'list' } | { kind: 'deck'; id: string } | { kind: 'pair' };

export function DecksScreen() {
  const { decks } = useAppState();
  const [view, setView] = useState<View>({ kind: 'list' });
  // Pairing needs two packets of different colors.
  const pairable = new Set(decks.decks.filter((d) => d.size === 20).map((d) => d.color)).size >= 2;
  const open = view.kind === 'deck' ? decks.decks.find((d) => d.id === view.id) : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LargeTitle
        title="Decks"
        action={{
          label: 'Pair packets',
          disabled: !pairable,
          onClick: () => setView({ kind: 'pair' }),
        }}
      />
      <PackGate>
        <DeckRows onOpen={(id) => setView({ kind: 'deck', id })} />
        {open && <SavedDeck deck={open} onBack={() => setView({ kind: 'list' })} />}
        {view.kind === 'pair' && <PairPackets onBack={() => setView({ kind: 'list' })} />}
      </PackGate>
    </div>
  );
}

function useActions() {
  const { index, config, pool, decks, settings } = useAppState();
  return useDeckActions({ index, config, pool, decks, settings: settings.settings });
}

function DeckRows({ onOpen }: { onOpen(id: string): void }) {
  const { decks, config, index } = useAppState();
  const nav = useNav();
  const actions = useActions();
  const [exporting, setExporting] = useState<Deck>();
  const [status, setStatus] = useStatus();

  if (!decks.loaded) return <p className={`${phone.note} p-4`}>Loading decks</p>;
  if (decks.decks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className={phone.note}>No saved decks yet. Build one and save it.</p>
        <button
          type="button"
          className={`${phone.primary} max-w-60`}
          onClick={() => nav.go('build')}
        >
          Build a deck
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ul className="overflow-hidden border-y border-line bg-surface">
        {decks.decks.map((d) => (
          <SwipeRow
            key={d.id}
            onOpen={() => onOpen(d.id)}
            actions={[
              { label: 'Export', onClick: () => setExporting(d) },
              {
                label: 'Disassemble',
                onClick: () => {
                  if (window.confirm(disassembleQuestion(d))) actions.disassemble(d);
                },
              },
            ]}
          >
            <Pip symbol={d.color} size={20} label={COLOR_LABELS[d.color]} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[0.9375rem] font-medium">{d.name}</span>
              <span className="truncate text-[0.75rem] text-fg-2">
                {d.size} · {archetypeInfo(config, d.archetype).label} · {savedLabel(d.createdAt)}
              </span>
            </span>
            <span className={phone.badge}>{d.committed ? 'Cards removed' : 'Still in pool'}</span>
            <span aria-hidden className="text-[1.125rem] leading-none text-fg-3">
              ›
            </span>
          </SwipeRow>
        ))}
      </ul>
      <p className="px-4 pt-3 text-[0.75rem] text-fg-2">
        Swipe a deck left to export or disassemble.
      </p>
      {status && (
        <p role="status" className="px-4 pt-2 text-[0.75rem] text-fg-2">
          {status}
        </p>
      )}
      {exporting && index && (
        <ActionSheet
          open
          onClose={() => setExporting(undefined)}
          title={`Export ${exporting.name}`}
          actions={exportActions(
            exporting,
            () => deckToDecklist(exporting, index, config),
            setStatus,
          )}
        />
      )}
    </div>
  );
}

const SWIPE = 176;

/** A row that slides left to reveal actions. Tapping it opens the deck. */
function SwipeRow(props: {
  onOpen(): void;
  actions: { label: string; onClick(): void }[];
  children: ReactNode;
}) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x0: number; y0: number; base: number; moved: boolean } | null>(null);
  const open = x !== 0;

  return (
    <li className="relative border-b border-surface-2 last:border-b-0">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE }} aria-hidden={!open}>
        {props.actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={`flex-1 text-[0.8125rem] ${i === props.actions.length - 1 ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink'}`}
            onClick={() => {
              setX(0);
              a.onClick();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="relative flex min-h-[3.75rem] w-full touch-pan-y items-center gap-3 bg-surface px-4 py-2 text-left"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 160ms ease-out',
        }}
        onPointerDown={(e) => {
          drag.current = { x0: e.clientX, y0: e.clientY, base: x, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x0;
          if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - d.y0)) {
            d.moved = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (d.moved) setX(Math.max(-SWIPE, Math.min(0, d.base + dx)));
        }}
        onPointerUp={() => {
          const d = drag.current;
          if (d?.moved) setX((v) => (v < -SWIPE / 2 ? -SWIPE : 0));
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setX(0);
        }}
        onClick={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) return;
          if (open) setX(0);
          else props.onOpen();
        }}
      >
        {props.children}
      </button>
    </li>
  );
}

function SavedDeck({ deck, onBack }: { deck: Deck; onBack(): void }) {
  const { config, index, decks } = useAppState();
  const actions = useActions();
  const [status, setStatus] = useStatus();
  if (!index) return null;
  const extra = [
    {
      label: 'Rename',
      onSelect: () => {
        const name = window.prompt('Deck name', deck.name)?.trim();
        if (name && name !== deck.name) decks.update({ ...deck, name });
      },
    },
    ...(deck.committed
      ? [
          {
            label: 'Delete without returning cards',
            onSelect: () => {
              if (window.confirm(`Delete "${deck.name}" without returning its cards?`)) {
                actions.deleteOnly(deck);
                onBack();
              }
            },
          },
        ]
      : [
          {
            label: 'Remove from pool',
            onSelect: () =>
              setStatus(actions.removeFromPool(deck) ?? 'Removed its cards from the pool.'),
          },
        ]),
  ];
  return (
    <DeckScreen
      deck={deck}
      back={{ label: 'Decks', onClick: onBack }}
      chips={[
        `${deck.size} cards`,
        `${landCount(deck, index)} lands`,
        archetypeInfo(config, deck.archetype).label,
        deck.committed ? 'Cards removed' : 'Still in pool',
      ]}
      actions={extra}
      status={status}
      onStatus={setStatus}
      bottom={
        <button
          type="button"
          className={phone.secondary}
          onClick={() => {
            if (window.confirm(disassembleQuestion(deck))) {
              actions.disassemble(deck);
              onBack();
            }
          }}
        >
          {deck.committed ? 'Disassemble' : 'Delete'}
        </button>
      }
    />
  );
}

function PairPackets({ onBack }: { onBack(): void }) {
  const { decks, index, config } = useAppState();
  const [status, setStatus] = useStatus();
  const packets = useMemo(() => decks.decks.filter((d) => d.size === 20), [decks.decks]);
  const [a, setA] = useState(packets[0]?.id ?? '');
  const [b, setB] = useState(packets.find((p) => p.color !== packets[0]?.color)?.id ?? '');
  const pa = packets.find((p) => p.id === a);
  const pb = packets.find((p) => p.id === b);
  const pair = pa && pb && index ? pairPackets(pa, pb, index, config) : undefined;

  const select = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex flex-col gap-1">
      <span className={phone.groupLabel}>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className={phone.field}>
        <option value="">Choose a packet</option>
        {packets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({COLOR_LABELS[p.color]})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Pushed
      back={{ label: 'Decks', onClick: onBack }}
      title="Pair packets"
      bottom={
        pair?.ok ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={phone.secondary}
              onClick={() => downloadText(deckFilename(pair.deck.name), pair.text)}
            >
              Download
            </button>
            <button
              type="button"
              className={phone.primary}
              onClick={() =>
                navigator.clipboard.writeText(pair.text).then(
                  () => setStatus('Copied the combined list.'),
                  () => setStatus('Copy failed. Try Download instead.'),
                )
              }
            >
              Copy list
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[0.8125rem] leading-[1.5] text-fg-1">
          Two 20-card packets of different colors make a 40-card two-color deck, like Jumpstart.
        </p>
        {select(a, setA, 'First packet')}
        {select(b, setB, 'Second packet')}
        {pair && !pair.ok && <p className={phone.error}>{pair.error}</p>}
        {status && (
          <p role="status" className={phone.note}>
            {status}
          </p>
        )}
        {pair?.ok && (
          <pre className="overflow-x-auto rounded-[10px] border border-line bg-surface px-3 py-2.5 font-mono text-[0.75rem] leading-[1.6]">
            {pair.text}
          </pre>
        )}
      </div>
    </Pushed>
  );
}
