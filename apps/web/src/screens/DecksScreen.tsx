import { useMemo, useState } from 'react';
import { COLOR_LABELS, deckToDecklist, pairPackets, type Deck } from '@bulk-brew/core';
import {
  archetypeInfo,
  deckFilename,
  disassembleQuestion,
  downloadText,
  Dropdown,
  landCount,
  MenuItem,
  Pip,
  savedLabel,
  ui,
  useDeckActions,
  useStatus,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { useNav } from '../nav.ts';
import { PackGate } from '../screens.tsx';
import { DeckLayout, ExportMenu } from './DeckLayout.tsx';

export function DecksScreen() {
  return (
    <PackGate>
      <Decks />
    </PackGate>
  );
}

type View = { kind: 'list' } | { kind: 'deck'; id: string } | { kind: 'pair' };

/** Shared deck actions with this app's confirmations. Each returns whether it went ahead. */
function useDeckActionsWithConfirm() {
  const { decks, pool, index, config, settings } = useAppState();
  const actions = useDeckActions({ index, config, pool, decks, settings: settings.settings });
  return {
    disassemble(deck: Deck): boolean {
      if (!window.confirm(disassembleQuestion(deck))) return false;
      actions.disassemble(deck);
      return true;
    },
    deleteOnly(deck: Deck): boolean {
      if (
        !window.confirm(
          `Delete "${deck.name}" without returning its cards? The pool stays as it is.`,
        )
      )
        return false;
      actions.deleteOnly(deck);
      return true;
    },
    removeFromPool: actions.removeFromPool,
  };
}

/** Move focus once the element that had it is gone. */
function focusLater(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

function Decks() {
  const { decks } = useAppState();
  const [view, setView] = useState<View>({ kind: 'list' });
  const open = view.kind === 'deck' ? decks.decks.find((d) => d.id === view.id) : undefined;

  if (!decks.loaded) return <p className={`${ui.note} p-8`}>Loading decks</p>;
  if (view.kind === 'pair')
    return (
      <PairPackets
        onBack={() => {
          setView({ kind: 'list' });
          focusLater('decks-title');
        }}
      />
    );
  if (open)
    return (
      <SavedDeck
        deck={open}
        onBack={() => {
          setView({ kind: 'list' });
          focusLater('decks-title');
        }}
      />
    );
  return (
    <DeckTable
      onOpen={(id) => setView({ kind: 'deck', id })}
      onPair={() => setView({ kind: 'pair' })}
    />
  );
}

function DeckTable({ onOpen, onPair }: { onOpen(id: string): void; onPair(): void }) {
  const { decks, config } = useAppState();
  const nav = useNav();
  const actions = useDeckActionsWithConfirm();
  const [status, setStatus] = useStatus();
  const list = decks.decks;
  const packets = list.filter((d) => d.size === 20).length;
  // Pairing needs two packets of different colors.
  const pairable = new Set(list.filter((d) => d.size === 20).map((d) => d.color)).size >= 2;

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className={ui.note}>No saved decks yet. Build one and save it.</p>
        <button type="button" className={ui.primary} onClick={() => nav.go('build')}>
          Build a deck
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-8 py-[22px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 id="decks-title" tabIndex={-1} className="text-[20px] font-semibold">
          Decks
        </h1>
        <span className="text-[13px] text-fg-1">
          {list.length} saved · {packets} {packets === 1 ? 'packet' : 'packets'}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className={ui.secondary}
            disabled={!pairable}
            title={
              pairable ? undefined : 'Save two 20-card packets of different colors to pair them.'
            }
            onClick={onPair}
          >
            Pair packets
          </button>
          <button type="button" className={ui.primary} onClick={() => nav.go('build')}>
            New deck
          </button>
        </div>
      </div>

      <div className={`${ui.box} overflow-x-auto`}>
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className={`text-left ${ui.sectionLabel}`}>
              <th className="w-[46px] border-b border-line py-[9px] pl-[18px] font-normal">
                <span className="sr-only">Color</span>
              </th>
              <th className="border-b border-line py-[9px] pr-3 font-normal">Name</th>
              <th className="w-[82px] border-b border-line py-[9px] pr-3 font-normal">Size</th>
              <th className="border-b border-line py-[9px] pr-3 font-normal">Archetype</th>
              <th className="w-[132px] border-b border-line py-[9px] pr-3 font-normal">Saved</th>
              <th className="w-[132px] border-b border-line py-[9px] pr-3 font-normal">Pool</th>
              <th className="w-[238px] border-b border-line py-[9px] pr-[18px] font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="h-11 border-b border-surface-2 last:border-b-0">
                <td className="pl-[18px]">
                  <Pip symbol={d.color} size={18} label={COLOR_LABELS[d.color]} />
                </td>
                <td className="pr-3">
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => onOpen(d.id)}
                  >
                    {d.name}
                  </button>
                </td>
                <td className="pr-3 font-mono text-[12px] text-fg-1">{d.size}</td>
                <td className="pr-3 text-fg-1">{archetypeInfo(config, d.archetype).label}</td>
                <td className="pr-3 text-[12.5px] text-fg-2">{savedLabel(d.createdAt)}</td>
                <td className="pr-3">
                  <span className={ui.badge}>
                    {d.committed ? 'Cards removed' : 'Still in pool'}
                  </span>
                </td>
                <td className="pr-[18px]">
                  <span className="flex items-center justify-end gap-3.5">
                    <button
                      id={`open-${d.id}`}
                      type="button"
                      className={ui.link}
                      onClick={() => onOpen(d.id)}
                    >
                      Open
                    </button>
                    <ExportMenuInline deck={d} onStatus={setStatus} />
                    <button
                      type="button"
                      className={ui.quiet}
                      onClick={() => {
                        const next = list[list.indexOf(d) + 1] ?? list[list.indexOf(d) - 1];
                        if (actions.disassemble(d))
                          focusLater(next ? `open-${next.id}` : 'decks-title');
                      }}
                    >
                      Disassemble
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-fg-2">
        Disassemble deletes the deck and returns its cards to the pool. Delete without returning is
        under the deck&apos;s menu.
      </p>
      <p role="status" className="min-h-4 text-[12.5px] text-fg-2">
        {status}
      </p>
    </div>
  );
}

/** "Export" as a quiet text menu, for table rows. */
function ExportMenuInline({ deck, onStatus }: { deck: Deck; onStatus(s: string): void }) {
  const { index, config } = useAppState();
  if (!index) return null;
  const text = () => deckToDecklist(deck, index, config);
  return (
    <Dropdown label="Export" buttonClassName={ui.quiet} align="right">
      {(close) => (
        <>
          <MenuItem
            onSelect={() => {
              close();
              navigator.clipboard.writeText(text()).then(
                () => onStatus(`Copied "${deck.name}" to the clipboard.`),
                () => onStatus('Copy failed. Try Download .txt instead.'),
              );
            }}
          >
            Copy as text
          </MenuItem>
          <MenuItem
            onSelect={() => {
              close();
              downloadText(deckFilename(deck.name), text());
            }}
          >
            Download .txt
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

function SavedDeck({ deck, onBack }: { deck: Deck; onBack(): void }) {
  const { decks, index } = useAppState();
  const actions = useDeckActionsWithConfirm();
  const [status, setStatus] = useStatus();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(deck.name);
  if (!index) return null;

  const finishRename = () => {
    const next = name.trim();
    if (next && next !== deck.name) decks.update({ ...deck, name: next });
    else setName(deck.name);
    setRenaming(false);
  };

  return (
    <DeckLayout
      deck={deck}
      lead={
        <button type="button" className={`${ui.quiet} text-[13px]`} onClick={onBack}>
          ‹ Decks
        </button>
      }
      title={
        renaming ? (
          <input
            autoFocus
            value={name}
            aria-label="Deck name"
            onChange={(e) => setName(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename();
              if (e.key === 'Escape') {
                setName(deck.name);
                setRenaming(false);
              }
            }}
            className={`${ui.field} text-[15px] font-semibold`}
          />
        ) : undefined
      }
      meta={`${deck.size} cards · ${landCount(deck, index)} lands · saved ${savedLabel(deck.createdAt).toLowerCase()}`}
      badge={deck.committed ? 'Cards removed' : 'Still in pool'}
      status={status}
      actions={
        <>
          {!deck.committed && (
            <button
              type="button"
              className={`${ui.quiet} px-1 text-[13px]`}
              onClick={() =>
                setStatus(actions.removeFromPool(deck) ?? 'Removed its cards from the pool.')
              }
            >
              Remove from pool
            </button>
          )}
          <ExportMenu deck={deck} onStatus={setStatus} />
          <Dropdown
            label="⋯"
            ariaLabel="More deck actions"
            buttonClassName={ui.secondary}
            align="right"
          >
            {(close) => (
              <>
                <MenuItem
                  onSelect={() => {
                    close();
                    setName(deck.name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </MenuItem>
                {deck.committed && (
                  <MenuItem
                    onSelect={() => {
                      close();
                      if (actions.deleteOnly(deck)) onBack();
                    }}
                  >
                    Delete without returning cards
                  </MenuItem>
                )}
              </>
            )}
          </Dropdown>
          <button
            type="button"
            className={ui.secondary}
            onClick={() => {
              if (actions.disassemble(deck)) onBack();
            }}
          >
            {deck.committed ? 'Disassemble' : 'Delete'}
          </button>
        </>
      }
    />
  );
}

function PairPackets({ onBack }: { onBack(): void }) {
  const { decks, index, config } = useAppState();
  const [status, setStatus] = useStatus();
  const packets = useMemo(() => decks.decks.filter((d) => d.size === 20), [decks.decks]);
  const [a, setA] = useState<string>(packets[0]?.id ?? '');
  const [b, setB] = useState<string>(packets.find((p) => p.color !== packets[0]?.color)?.id ?? '');
  const pa = packets.find((p) => p.id === a);
  const pb = packets.find((p) => p.id === b);
  const pair = pa && pb && index ? pairPackets(pa, pb, index, config) : undefined;

  const select = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex flex-col gap-1 text-[12px] text-fg-2">
      {label}
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`${ui.field} min-w-56`}
      >
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-8 py-[22px]">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${ui.quiet} text-[13px]`} onClick={onBack}>
          ‹ Decks
        </button>
        <h1 className="text-[20px] font-semibold">Pair packets</h1>
      </div>
      <p className="max-w-xl text-[13px] leading-[1.5] text-fg-1">
        Two 20-card packets of different colors make a 40-card two-color deck, like Jumpstart. Pick
        two, then copy or download the combined list.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {select(a, setA, 'First packet')}
        {select(b, setB, 'Second packet')}
      </div>
      {pair && !pair.ok && <p className={ui.error}>{pair.error}</p>}
      {pair?.ok && (
        <div className="flex max-w-xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-[13px] text-fg-1">
              {pair.deck.name} · {pair.deck.size} cards
            </span>
            <button
              type="button"
              className={ui.secondary}
              onClick={() =>
                navigator.clipboard.writeText(pair.text).then(
                  () => setStatus('Copied the combined list.'),
                  () => setStatus('Copy failed. Try Download .txt instead.'),
                )
              }
            >
              Copy
            </button>
            <button
              type="button"
              className={ui.secondary}
              onClick={() => downloadText(deckFilename(pair.deck.name), pair.text)}
            >
              Download .txt
            </button>
          </div>
          <textarea
            readOnly
            value={pair.text}
            rows={16}
            aria-label="Combined list"
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-lg border border-line-strong bg-surface px-3.5 py-3 font-mono text-[12.5px] leading-[1.6]"
          />
        </div>
      )}
      <p role="status" className="min-h-4 max-w-xl text-[12.5px] text-fg-2">
        {status}
      </p>
    </div>
  );
}
