import { useMemo, useState } from 'react';
import {
  archetypeById,
  COLOR_LABELS,
  deckToDecklist,
  primaryGroup,
  type BuildExplanation,
  type BulkBrewConfig,
  type CardIndex,
  type Color,
  type Deck,
  type DeckCard,
} from '@bulk-brew/core';
import { CurveBars } from './CurveBars.tsx';
import { ManaCost } from '../ManaCost.tsx';

export interface DeckViewProps {
  deck: Deck;
  index: CardIndex;
  config: BulkBrewConfig;
  /** Fresh builds offer Accept, Try another style, and Discard; saved decks offer rename, export, delete. */
  mode: 'fresh' | 'saved';
  onAccept?: (() => void) | undefined;
  onTryAnotherStyle?: (() => void) | undefined;
  onDiscard?: (() => void) | undefined;
  onRename?: ((name: string) => void) | undefined;
  onDelete?: ((returnCards: boolean) => void) | undefined;
}

const GROUP_ORDER = [
  'Creatures',
  'Planeswalkers',
  'Instants',
  'Sorceries',
  'Artifacts',
  'Enchantments',
  'Battles',
  'Lands',
  'Other',
];

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';
const primary =
  'rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';

function roleLabel(config: BulkBrewConfig, id: string): string {
  return config.roles.roles.find((r) => r.id === id)?.label ?? id;
}

export function DeckView(props: DeckViewProps) {
  const { deck, index, config, mode } = props;
  const explanation: BuildExplanation | undefined = deck.explanation;
  const [showWhy, setShowWhy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [returnCards, setReturnCards] = useState(true);
  const [name, setName] = useState(deck.name);

  // Derived from the current deck, so a rename never shows stale text.
  const exported = useMemo(
    () => (exportOpen ? deckToDecklist(deck, index, config) : undefined),
    [exportOpen, deck, index, config],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { card: DeckCard; name: string; cost: string | undefined }[]>();
    for (const dc of deck.cards) {
      const card = index.get(dc.cardId);
      if (!card) continue;
      const g = primaryGroup(card);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push({ card: dc, name: card.name, cost: card.manaCost });
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      count: map.get(g)!.reduce((n, x) => n + x.card.qty, 0),
      rows: map.get(g)!,
    }));
  }, [deck, index]);

  const basics = Object.entries(deck.basics).filter(([, n]) => (n ?? 0) > 0);
  const archetypeLabel = (() => {
    try {
      return archetypeById(config, deck.archetype).label;
    } catch {
      return deck.archetype;
    }
  })();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'saved' && props.onRename ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== deck.name && props.onRename?.(name.trim())}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-lg font-semibold dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Deck name"
          />
        ) : (
          <h2 className="text-lg font-semibold">{deck.name}</h2>
        )}
        <span className={muted}>
          {deck.size} cards, {COLOR_LABELS[deck.color]}, {archetypeLabel}
        </span>
        {deck.committed && (
          <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">
            cards removed from pool
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === 'fresh' && (
          <>
            <button type="button" className={primary} onClick={props.onAccept}>
              Accept
            </button>
            <button type="button" className={button} onClick={props.onTryAnotherStyle}>
              Try another style
            </button>
            <button type="button" className={button} onClick={props.onDiscard}>
              Discard
            </button>
          </>
        )}
        <button type="button" className={button} onClick={() => setExportOpen((o) => !o)}>
          {exportOpen ? 'Hide export' : 'Export'}
        </button>
        {mode === 'saved' && props.onDelete && (
          <span className="flex items-center gap-2">
            <label className={`flex items-center gap-1 ${muted}`}>
              <input
                type="checkbox"
                checked={returnCards}
                onChange={(e) => setReturnCards(e.target.checked)}
              />
              return cards to the pool
            </label>
            <button
              type="button"
              className={button}
              onClick={() => {
                if (window.confirm(`Delete "${deck.name}"?`)) props.onDelete?.(returnCards);
              }}
            >
              Delete
            </button>
          </span>
        )}
      </div>

      {exported !== undefined && (
        <div className="flex flex-col gap-2">
          <textarea
            readOnly
            value={exported}
            rows={10}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div>
            <button type="button" className={button} onClick={() => void copy(exported)}>
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                {g.label} ({g.count})
              </h3>
              <ul>
                {g.rows.map((r) => (
                  <li key={r.card.cardId} className="flex items-center gap-2 py-0.5 text-sm">
                    <span className="w-5 text-right tabular-nums">{r.card.qty}</span>
                    <span className="flex-1">{r.name}</span>
                    <ManaCost cost={r.cost} />
                    {showWhy && r.card.why && (
                      <span className="w-40 text-right text-xs text-zinc-500">{r.card.why}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {basics.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Basic lands</h3>
              <ul>
                {basics.map(([color, n]) => (
                  <li key={color} className="flex items-center gap-2 py-0.5 text-sm">
                    <span className="w-5 text-right tabular-nums">{n}</span>
                    <span>{config.landRules.basics.names[color as Color]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className={`flex items-center gap-1 ${muted}`}>
            <input
              type="checkbox"
              checked={showWhy}
              onChange={(e) => setShowWhy(e.target.checked)}
            />
            show why each card is here
          </label>
        </div>

        {explanation && (
          <div className="flex flex-col gap-3 text-sm">
            <CurveBars curve={explanation.curve} />
            <p className={muted}>
              {explanation.lands.count} lands: average cost {explanation.lands.averageMv.toFixed(1)}
              , {explanation.lands.cheapManaSources} cheap mana sources,{' '}
              {explanation.lands.nonbasics} nonbasic.
            </p>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Roles</h3>
              <ul>
                {Object.entries(explanation.roles).map(([id, c]) => (
                  <li key={id} className="flex justify-between">
                    <span>{roleLabel(config, id)}</span>
                    <span className={c.have < c.want ? 'text-amber-600' : ''}>
                      {c.have} of {c.want}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {explanation.synergies.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Synergies</h3>
                <ul className={muted}>
                  {explanation.synergies.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {explanation.notes.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Notes</h3>
                <ul className={muted}>
                  {explanation.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
