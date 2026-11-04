import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COLOR_LABELS, deckToDecklist, pairPackets, type Deck } from '@bulk-brew/core';
import {
  archetypeInfo,
  ConfirmDialog,
  deckColors,
  DeckList,
  disassembleQuestion,
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

type View = { kind: 'list' } | { kind: 'deck'; id: string } | { kind: 'pair'; id: string };

export function DecksScreen() {
  const { decks } = useAppState();
  const [view, setView] = useState<View>({ kind: 'list' });
  const current = view.kind !== 'list' ? decks.decks.find((d) => d.id === view.id) : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LargeTitle title="Decks" />
      <PackGate>
        <DeckRows onOpen={(id) => setView({ kind: 'deck', id })} />
        {current && view.kind === 'deck' && (
          <SavedDeck
            deck={current}
            onBack={() => setView({ kind: 'list' })}
            onPair={() => setView({ kind: 'pair', id: current.id })}
          />
        )}
        {current && view.kind === 'pair' && (
          <PairPackets
            packet={current}
            onBack={() => setView({ kind: 'deck', id: current.id })}
            onMerged={(id) => setView({ kind: 'deck', id })}
          />
        )}
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
  const [disassembling, setDisassembling] = useState<Deck>();
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
                onClick: () => setDisassembling(d),
              },
            ]}
          >
            <span className="flex shrink-0 -space-x-1">
              {(index ? deckColors(d, index) : [d.color]).map((c) => (
                <Pip key={c} symbol={c} size={20} label={COLOR_LABELS[c]} />
              ))}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[0.9375rem] font-medium">{d.name}</span>
              <span className="truncate text-[0.75rem] text-fg-2">
                {d.size} · {archetypeInfo(config, d.archetype).label} · {savedLabel(d.createdAt)}
              </span>
            </span>
            {!d.committed && <span className={phone.badge}>Cards in bulk list</span>}
            <span aria-hidden className="text-[1.125rem] leading-none text-fg-3">
              ›
            </span>
          </SwipeRow>
        ))}
      </ul>
      <p className="px-4 pt-3 text-[0.75rem] text-fg-2">
        Swipe a deck left to export or disassemble.
      </p>
      <p role="status" className={status ? 'px-4 pt-2 text-[0.75rem] text-fg-2' : 'sr-only'}>
        {status}
      </p>
      <ConfirmDialog
        open={!!disassembling}
        title={disassembling ? `Disassemble "${disassembling.name}"?` : ''}
        message={disassembling ? disassembleQuestion(disassembling) : ''}
        confirmLabel="Disassemble"
        variant="phone"
        onConfirm={() => {
          if (disassembling) actions.disassemble(disassembling);
          setDisassembling(undefined);
        }}
        onCancel={() => setDisassembling(undefined)}
      />
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

/** A row that slides left to reveal actions. Tapping it opens the deck. */
function SwipeRow(props: {
  onOpen(): void;
  actions: { label: string; onClick(): void }[];
  children: ReactNode;
}) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x0: number; y0: number; base: number; moved: boolean } | null>(null);
  /** Set when a drag ends, so the click the browser may send afterwards is ignored. */
  const suppressClick = useRef(false);
  const tray = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLButtonElement>(null);
  const open = x !== 0;
  // The tray is sized in rem, so it follows the text size; read its width when needed.
  const width = () => tray.current?.offsetWidth ?? 176;

  return (
    <li className="relative border-b border-surface-2 last:border-b-0">
      <div ref={tray} className="absolute inset-y-0 right-0 flex w-44" aria-hidden={!open}>
        {props.actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={`flex-1 px-1 text-[0.8125rem] ${i === props.actions.length - 1 ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink'}`}
            onClick={() => {
              setX(0);
              // Focus the row first, so a sheet the action opens returns focus there.
              row.current?.focus();
              a.onClick();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button
        ref={row}
        type="button"
        className="relative flex min-h-[3.75rem] w-full touch-pan-y items-center gap-3 bg-surface px-4 py-2 text-left"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 160ms ease-out',
        }}
        onPointerDown={(e) => {
          drag.current = { x0: e.clientX, y0: e.clientY, base: x, moved: false };
          suppressClick.current = false;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          // A mouse moving with no button held is not a drag.
          if (!d || (e.pointerType === 'mouse' && e.buttons === 0)) return;
          const dx = e.clientX - d.x0;
          if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - d.y0)) {
            d.moved = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (d.moved) setX(Math.max(-width(), Math.min(0, d.base + dx)));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) {
            // A click, if any, follows at once; iOS sends none after a swipe.
            suppressClick.current = true;
            setTimeout(() => (suppressClick.current = false), 300);
            setX((v) => (v < -width() / 2 ? -width() : 0));
          }
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setX(0);
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (open) setX(0);
          else props.onOpen();
        }}
      >
        {props.children}
      </button>
    </li>
  );
}

function SavedDeck({ deck, onBack, onPair }: { deck: Deck; onBack(): void; onPair(): void }) {
  const { config, index, decks } = useAppState();
  const actions = useActions();
  const [status, setStatus] = useStatus();
  const [confirm, setConfirm] = useState<'disassemble' | 'delete' | 'accept'>();
  if (!index) return null;
  const canPair = decks.decks.some(
    (d) => d.size === 20 && d.id !== deck.id && d.color !== deck.color,
  );
  const extra = [
    ...(deck.size === 20 && canPair
      ? [{ label: 'Pair with another packet', onSelect: onPair }]
      : []),
    {
      label: 'Rename',
      onSelect: () => {
        const name = window.prompt('Deck name', deck.name)?.trim();
        if (name && name !== deck.name) decks.update({ ...deck, name });
      },
    },
    ...(deck.committed
      ? [{ label: 'Delete without returning cards', onSelect: () => setConfirm('delete' as const) }]
      : [{ label: 'Accept', onSelect: () => setConfirm('accept' as const) }]),
  ];
  return (
    <>
      <DeckScreen
        deck={deck}
        back={{ label: 'Decks', onClick: onBack }}
        chips={[
          `${deck.size} cards`,
          `${landCount(deck, index)} lands`,
          archetypeInfo(config, deck.archetype).label,
          ...(deck.committed ? [] : ['Cards in bulk list']),
        ]}
        actions={extra}
        status={status}
        onStatus={setStatus}
        bottom={
          <button
            type="button"
            className={phone.secondary}
            onClick={() => setConfirm('disassemble')}
          >
            Disassemble
          </button>
        }
      />
      <ConfirmDialog
        open={confirm === 'disassemble'}
        title={`Disassemble "${deck.name}"?`}
        message={disassembleQuestion(deck)}
        confirmLabel="Disassemble"
        variant="phone"
        onConfirm={() => {
          setConfirm(undefined);
          actions.disassemble(deck);
          onBack();
        }}
        onCancel={() => setConfirm(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete "${deck.name}"?`}
        message="This deletes the deck without returning its cards. Your bulk list stays as it is."
        confirmLabel="Delete"
        variant="phone"
        onConfirm={() => {
          setConfirm(undefined);
          actions.deleteOnly(deck);
          onBack();
        }}
        onCancel={() => setConfirm(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'accept'}
        title="Accept this deck?"
        message="This will remove the deck's cards from your bulk list."
        confirmLabel="Accept"
        cancelLabel="Decline"
        focus="confirm"
        variant="phone"
        onConfirm={() => {
          setConfirm(undefined);
          setStatus(actions.removeFromPool(deck) ?? 'Accepted. Its cards left your bulk list.');
        }}
        onCancel={() => setConfirm(undefined)}
      />
    </>
  );
}

/** A what-if view: this packet plus another, with Merge to make it real. */
function PairPackets(props: { packet: Deck; onBack(): void; onMerged(id: string): void }) {
  const { packet, onBack, onMerged } = props;
  const { decks, index, config, settings, detail } = useAppState();
  const actions = useActions();
  const others = useMemo(
    () =>
      decks.decks.filter((d) => d.size === 20 && d.id !== packet.id && d.color !== packet.color),
    [decks.decks, packet],
  );
  const [otherId, setOtherId] = useState(others[0]?.id ?? '');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const other = others.find((d) => d.id === otherId);
  const pair = other && index ? pairPackets(packet, other, index, config) : undefined;

  return (
    <Pushed
      back={{ label: 'Packet', onClick: onBack }}
      title="Pair packets"
      bottom={
        <button
          type="button"
          className={phone.primary}
          disabled={!pair?.ok}
          onClick={() => setConfirm(true)}
        >
          Merge into one deck
        </button>
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-3">
        <p className="text-[0.8125rem] leading-[1.5] text-fg-1">
          A preview of {packet.name} played with another packet as a 40-card deck. Nothing changes
          until you merge them.
        </p>
        <label className="flex flex-col gap-1">
          <span className={phone.groupLabel}>Pair with</span>
          <select
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
            className={`${phone.field} min-h-11`}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({COLOR_LABELS[p.color]})
              </option>
            ))}
          </select>
        </label>
        {error && <p className={phone.error}>{error}</p>}
        {pair && !pair.ok && <p className={phone.error}>{pair.error}</p>}
      </div>
      {pair?.ok && index && (
        <DeckList
          deck={pair.deck}
          index={index}
          config={config}
          showArt={settings.settings.showArt}
          onOpenCard={detail.open}
          variant="phone"
        />
      )}
      <ConfirmDialog
        open={confirm}
        title="Merge these packets?"
        message={`"${packet.name}" and "${other?.name ?? ''}" are deleted and replaced by one 40-card deck.`}
        confirmLabel="Merge"
        focus="confirm"
        variant="phone"
        onConfirm={() => {
          setConfirm(false);
          if (!other) return;
          const r = actions.merge(packet, other);
          if ('error' in r) setError(r.error);
          else onMerged(r.deck.id);
        }}
        onCancel={() => setConfirm(false)}
      />
    </Pushed>
  );
}
