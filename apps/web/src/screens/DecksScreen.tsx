import { useMemo, useState } from 'react';
import { COLOR_LABELS, COLORS, pairPackets, type Color, type Deck } from '@bulk-brew/core';
import {
  archetypeInfo,
  ChoiceDialog,
  ConfirmDialog,
  DeckList,
  deckColors,
  disassembleQuestion,
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
import { BackButton, PackGate } from '../screens.tsx';
import { DeckLayout, ExportMenu } from './DeckLayout.tsx';

export function DecksScreen() {
  return (
    <PackGate>
      <Decks />
    </PackGate>
  );
}

type View = { kind: 'list' } | { kind: 'deck'; id: string } | { kind: 'pair'; id: string };

/** Move focus once the element that had it is gone. */
function focusLater(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

function useActions() {
  const { decks, pool, index, config, settings } = useAppState();
  return useDeckActions({ index, config, pool, decks, settings: settings.settings });
}

function Decks() {
  const { decks } = useAppState();
  const [view, setView] = useState<View>({ kind: 'list' });
  const toList = () => {
    setView({ kind: 'list' });
    focusLater('decks-title');
  };
  const current = view.kind !== 'list' ? decks.decks.find((d) => d.id === view.id) : undefined;

  if (!decks.loaded) return <p className={`${ui.note} p-8`}>Loading decks</p>;
  if (current && view.kind === 'pair')
    return (
      <PairPackets
        packet={current}
        onBack={() => setView({ kind: 'deck', id: current.id })}
        onMerged={(id) => setView({ kind: 'deck', id })}
      />
    );
  if (current)
    return (
      <SavedDeck
        deck={current}
        onBack={toList}
        onPair={() => setView({ kind: 'pair', id: current.id })}
      />
    );
  return <DeckTable onOpen={(id) => setView({ kind: 'deck', id })} />;
}

type DeckSortKey = 'name' | 'size' | 'archetype' | 'saved';
type DeckSort = { key: DeckSortKey; dir: 'asc' | 'desc' } | undefined;

function nextDeckSort(cur: DeckSort, key: DeckSortKey): DeckSort {
  const first = key === 'saved' ? 'desc' : 'asc';
  if (!cur || cur.key !== key) return { key, dir: first };
  if (cur.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' };
  return undefined;
}

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function DeckTable({ onOpen }: { onOpen(id: string): void }) {
  const { decks, config, index } = useAppState();
  const nav = useNav();
  const actions = useActions();
  const [status, setStatus] = useStatus();
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<number[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DeckSort>(undefined);
  const [disassembling, setDisassembling] = useState<Deck>();
  const list = decks.decks;

  const info = useMemo(
    () =>
      new Map(
        list.map((d) => [
          d.id,
          {
            colors: index ? deckColors(d, index) : [d.color],
            style: archetypeInfo(config, d.archetype).label,
          },
        ]),
      ),
    [list, index, config],
  );
  const present = {
    colors: COLORS.filter((c) => list.some((d) => info.get(d.id)!.colors.includes(c))),
    sizes: [100, 60, 40, 20].filter((s) => list.some((d) => d.size === s)),
    styles: [...new Set(list.map((d) => info.get(d.id)!.style))].sort(),
  };
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = list.filter((d) => {
      const i = info.get(d.id)!;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (colors.length && !i.colors.some((c) => colors.includes(c))) return false;
      if (sizes.length && !sizes.includes(d.size)) return false;
      if (styles.length && !styles.includes(i.style)) return false;
      return true;
    });
    if (!sort) return out;
    const sign = sort.dir === 'asc' ? 1 : -1;
    const by: Record<DeckSortKey, (a: Deck, b: Deck) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      size: (a, b) => a.size - b.size,
      archetype: (a, b) => info.get(a.id)!.style.localeCompare(info.get(b.id)!.style),
      saved: (a, b) => a.createdAt.localeCompare(b.createdAt),
    };
    return [...out].sort((a, b) => sign * by[sort.key](a, b) || a.name.localeCompare(b.name));
  }, [list, info, search, colors, sizes, styles, sort]);

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className={ui.note}>No saved decks yet. Build one and accept it.</p>
        <button type="button" className={ui.primary} onClick={() => nav.go('build')}>
          Build a deck
        </button>
      </div>
    );
  }

  const filtered = colors.length + sizes.length + styles.length > 0 || search.trim() !== '';
  const packets = list.filter((d) => d.size === 20).length;
  const header = (key: DeckSortKey, label: string, className: string) => {
    const dir = sort?.key === key ? sort.dir : undefined;
    return (
      <th
        aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
        className={`border-b border-line font-normal ${className}`}
      >
        <button
          type="button"
          className={`flex items-center gap-1 py-[9px] tracking-[0.04em] uppercase hover:text-ink ${dir ? 'text-ink' : ''}`}
          onClick={() => setSort(nextDeckSort(sort, key))}
        >
          {label}
          <span aria-hidden className="w-2 text-[9px]">
            {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-8 py-[22px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 id="decks-title" tabIndex={-1} className="text-[20px] font-semibold">
          Decks
        </h1>
        <span className="text-[13px] text-fg-1">
          {list.length} saved · {packets} {packets === 1 ? 'packet' : 'packets'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Colors" className="flex items-center gap-1">
          {present.colors.map((c) => {
            const on = colors.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                aria-label={COLOR_LABELS[c]}
                onClick={() => setColors(toggle(colors, c))}
                className={`rounded-md border p-1.5 ${on ? 'border-ink bg-surface' : 'border-transparent hover:bg-surface-2'}`}
              >
                <Pip symbol={c} />
              </button>
            );
          })}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <div role="group" aria-label="Size" className="flex items-center gap-1">
          {present.sizes.map((s) => {
            const on = sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSizes(toggle(sizes, s))}
                className={`rounded-md border px-2.5 py-1.5 text-[12.5px] ${on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-fg-1 hover:bg-surface-2'}`}
              >
                {s === 20 ? '20 packets' : `${s} cards`}
              </button>
            );
          })}
        </div>
        <Dropdown
          label={
            styles.length
              ? `Archetype: ${styles.length <= 2 ? styles.join(', ') : `${styles.length} selected`}`
              : 'Archetype ▾'
          }
          buttonClassName={`rounded-md border px-2.5 py-1.5 text-[12.5px] ${styles.length ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-fg-1 hover:bg-surface-2'}`}
        >
          {() =>
            present.styles.map((s) => (
              <MenuItem key={s} onSelect={() => setStyles(toggle(styles, s))}>
                {styles.includes(s) ? '✓ ' : ''}
                {s}
              </MenuItem>
            ))
          }
        </Dropdown>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deck names"
          aria-label="Search deck names"
          className={`${ui.field} min-w-40 flex-1`}
        />
        {filtered && (
          <button
            type="button"
            className={`${ui.quiet} px-1 text-[12.5px] underline`}
            onClick={() => {
              setColors([]);
              setSizes([]);
              setStyles([]);
              setSearch('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className={`${ui.box} overflow-x-auto`}>
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className={`text-left ${ui.sectionLabel}`}>
              <th className="w-[60px] border-b border-line py-[9px] pl-[18px] font-normal">
                <span className="sr-only">Colors</span>
              </th>
              {header('name', 'Name', 'pr-3')}
              {header('size', 'Size', 'w-[72px] pr-3')}
              {header('archetype', 'Archetype', 'pr-3')}
              {header('saved', 'Saved', 'w-[110px] pr-3')}
              <th className="w-[220px] border-b border-line pr-[18px] font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="h-12 cursor-pointer border-b border-surface-2 last:border-b-0 hover:bg-surface-2"
              >
                <td className="pl-[18px]">
                  <span className="flex gap-0.5">
                    {info.get(d.id)!.colors.map((c) => (
                      <Pip key={c} symbol={c} size={18} label={COLOR_LABELS[c]} />
                    ))}
                  </span>
                </td>
                <td className="pr-3">
                  <button
                    id={`open-${d.id}`}
                    type="button"
                    className="text-left font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(d.id);
                    }}
                  >
                    {d.name}
                  </button>
                  {!d.committed && (
                    <span
                      className={`${ui.badge} ml-2`}
                      title="Its cards are still in your bulk list"
                    >
                      Cards in bulk list
                    </span>
                  )}
                </td>
                <td className="pr-3 font-mono text-[12px] text-fg-1">{d.size}</td>
                <td className="pr-3 text-fg-1">{info.get(d.id)!.style}</td>
                <td className="pr-3 text-[12.5px] text-fg-2">{savedLabel(d.createdAt)}</td>
                <td className="pr-[18px]" onClick={(e) => e.stopPropagation()}>
                  <span className="flex items-center justify-end gap-2">
                    <ExportMenu deck={d} onStatus={setStatus} label="Export" />
                    <button
                      type="button"
                      className={ui.secondary}
                      onClick={() => setDisassembling(d)}
                    >
                      Disassemble
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className={`${ui.note} p-6 text-center`}>No decks match these filters.</p>
        )}
      </div>
      <p role="status" className={status ? 'text-[12.5px] text-fg-2' : 'sr-only'}>
        {status}
      </p>

      <ConfirmDialog
        open={!!disassembling}
        title={disassembling ? `Disassemble "${disassembling.name}"?` : ''}
        message={disassembling ? disassembleQuestion(disassembling) : ''}
        confirmLabel="Disassemble"
        onConfirm={() => {
          const d = disassembling!;
          const next = rows[rows.indexOf(d) + 1] ?? rows[rows.indexOf(d) - 1];
          actions.disassemble(d);
          setDisassembling(undefined);
          focusLater(next ? `open-${next.id}` : 'decks-title');
        }}
        onCancel={() => setDisassembling(undefined)}
      />
    </div>
  );
}

function SavedDeck({ deck, onBack, onPair }: { deck: Deck; onBack(): void; onPair(): void }) {
  const { decks, index } = useAppState();
  const actions = useActions();
  const [status, setStatus] = useStatus();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(deck.name);
  const [confirm, setConfirm] = useState<'disassemble' | 'delete' | 'accept'>();
  if (!index) return null;
  const otherPackets = decks.decks.filter(
    (d) => d.size === 20 && d.id !== deck.id && d.color !== deck.color,
  );

  const finishRename = () => {
    const next = name.trim();
    if (next && next !== deck.name) decks.update({ ...deck, name: next });
    else setName(deck.name);
    setRenaming(false);
  };

  return (
    <>
      <DeckLayout
        deck={deck}
        lead={<BackButton label="Decks" onClick={onBack} />}
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
        meta={`${deck.size} cards · ${landCount(deck, index)} lands · saved ${savedLabel(deck.createdAt).toLowerCase()}${deck.committed ? '' : ' · cards in bulk list'}`}
        status={status}
        actions={
          <>
            {!deck.committed && (
              <button type="button" className={ui.go} onClick={() => setConfirm('accept')}>
                Accept
              </button>
            )}
            {deck.size === 20 && (
              <button
                type="button"
                className={ui.secondary}
                disabled={otherPackets.length === 0}
                title={
                  otherPackets.length === 0
                    ? 'Save a 20-card packet of another color to pair with this one.'
                    : undefined
                }
                onClick={onPair}
              >
                Pair with…
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
                        setConfirm('delete');
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
              onClick={() => setConfirm('disassemble')}
            >
              Disassemble
            </button>
          </>
        }
      />
      <ConfirmDialog
        open={confirm === 'disassemble'}
        title={`Disassemble "${deck.name}"?`}
        message={disassembleQuestion(deck)}
        confirmLabel="Disassemble"
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
        onConfirm={() => {
          setConfirm(undefined);
          actions.deleteOnly(deck);
          onBack();
        }}
        onCancel={() => setConfirm(undefined)}
      />
      <ChoiceDialog
        open={confirm === 'accept'}
        title="Accept this deck?"
        message="Its cards are still in your bulk list. Accepting removes them."
        choices={[
          {
            label: 'Confirm',
            detail: 'Remove cards from bulk list',
            tone: 'go',
            onSelect: () => {
              setConfirm(undefined);
              setStatus(actions.removeFromPool(deck) ?? 'Accepted. Its cards left your bulk list.');
            },
          },
          { label: 'Decline', tone: 'stop', onSelect: () => setConfirm(undefined) },
        ]}
        onCancel={() => setConfirm(undefined)}
      />
    </>
  );
}

/** A what-if view: this packet plus another, with a Merge that makes it real. */
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
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-6 py-3.5">
        <BackButton label={packet.name} onClick={onBack} />
        <h1 className="text-[17px] font-semibold">Pair packets</h1>
        <label className="flex items-center gap-2 text-[13px] text-fg-1">
          with
          <select
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
            className={`${ui.field} min-w-56`}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({COLOR_LABELS[p.color]})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${ui.primary} ml-auto`}
          disabled={!pair?.ok}
          onClick={() => setConfirm(true)}
        >
          Merge into one deck
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
        <p className="mb-4 max-w-2xl text-[13px] leading-[1.5] text-fg-1">
          This is a preview of the two packets played together as a 40-card deck. Nothing changes
          until you merge them. Merging replaces both packets with one deck.
        </p>
        {error && <p className={`${ui.error} mb-4`}>{error}</p>}
        {pair && !pair.ok && <p className={ui.error}>{pair.error}</p>}
        {pair?.ok && index && (
          <>
            <p className="mb-3 flex items-center gap-2 text-[13px]">
              <span className="flex gap-1">
                {deckColors(pair.deck, index).map((c) => (
                  <Pip key={c} symbol={c} size={18} label={COLOR_LABELS[c]} />
                ))}
              </span>
              <span className="font-medium">{pair.deck.name}</span>
              <span className="text-fg-1">· 40 cards</span>
            </p>
            <DeckList
              deck={pair.deck}
              index={index}
              config={config}
              showArt={settings.settings.showArt}
              onOpenCard={detail.open}
            />
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Merge these packets?"
        message={`"${packet.name}" and "${other?.name ?? ''}" are deleted and replaced by one 40-card deck. Cards still in your bulk list are removed from it.`}
        confirmLabel="Merge"
        focus="confirm"
        onConfirm={() => {
          setConfirm(false);
          if (!other) return;
          const r = actions.merge(packet, other);
          if ('error' in r) setError(r.error);
          else onMerged(r.deck.id);
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
