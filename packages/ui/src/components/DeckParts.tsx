import { useMemo, useState } from 'react';
import type { BulkBrewConfig, CardIndex, Deck, PrintingHint } from '@bulk-brew/core';
import { CardImage } from './CardImage.tsx';
import { CurveChart, RoleBar, RoleBars, type Variant } from './controls.tsx';
import { ManaCost } from '../ManaCost.tsx';
import { archetypeInfo, deckGroups } from '../data/deckGroups.ts';
import { ui } from '../styles.ts';

export interface DeckListProps {
  deck: Deck;
  index: CardIndex;
  config: BulkBrewConfig;
  showArt?: boolean | undefined;
  onOpenCard?: ((cardId: string, printing?: PrintingHint | undefined) => void) | undefined;
  variant?: Variant;
  /** Desktop only: keep one column even when there is room for two. */
  singleColumn?: boolean;
}

/** The decklist grouped by type. Desktop flows the groups into two columns. */
export function DeckList(props: DeckListProps) {
  const { deck, index, config, showArt, onOpenCard, variant = 'desktop' } = props;
  const groups = useMemo(() => deckGroups(deck, index, config), [deck, index, config]);
  const phone = variant === 'phone';

  if (phone) {
    return (
      <div className="flex flex-col">
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h3 className="flex justify-between border-y border-line bg-surface-2 px-4 py-1.5 text-[0.6875rem] tracking-[0.04em] text-fg-2 uppercase">
              <span>{g.label}</span>
              <span className="tabular-nums">{g.count}</span>
            </h3>
            <ul>
              {g.rows.map((r) => {
                const open =
                  r.card && onOpenCard ? () => onOpenCard(r.card!.id, r.printing) : undefined;
                return (
                  <li key={r.key} className="border-b border-surface-2 bg-surface last:border-b-0">
                    <button
                      type="button"
                      disabled={!open}
                      onClick={open}
                      className="flex min-h-10 w-full items-center gap-3 px-4 py-1.5 text-left"
                    >
                      <span className="w-[22px] shrink-0 font-mono text-[0.75rem] text-fg-1 tabular-nums">
                        {r.qty}
                      </span>
                      {showArt && r.card && (
                        <CardImage
                          card={r.card}
                          printing={r.printing}
                          size="small"
                          className="h-[30px] w-[22px] shrink-0 rounded-[2px] object-contain"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[0.875rem]">{r.name}</span>
                        {r.why && (
                          <span className="truncate text-[0.6875rem] text-fg-2">{r.why}</span>
                        )}
                      </span>
                      <ManaCost cost={r.card?.manaCost} size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="@container">
      <div className={`grid gap-x-8 gap-y-4 ${props.singleColumn ? '' : '@xl:grid-cols-2'}`}>
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label} className="min-w-0">
            <h3 className={`flex justify-between border-b border-line pb-[5px] ${ui.sectionLabel}`}>
              <span>{g.label}</span>
              <span className="tabular-nums">{g.count}</span>
            </h3>
            <ul className="pt-1">
              {g.rows.map((r) => (
                <li
                  key={r.key}
                  className={`flex items-center gap-2 text-[13px] ${showArt ? 'h-[34px]' : 'h-[26px]'}`}
                >
                  <span className="w-[22px] shrink-0 font-mono text-[12px] text-fg-1 tabular-nums">
                    {r.qty}
                  </span>
                  {showArt && r.card && (
                    <CardImage
                      card={r.card}
                      printing={r.printing}
                      size="small"
                      className="h-[30px] w-[22px] shrink-0 rounded-[2px] object-contain"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 items-baseline">
                    {r.card && onOpenCard ? (
                      <button
                        type="button"
                        className="truncate text-left hover:underline"
                        onClick={() => onOpenCard(r.card!.id, r.printing)}
                      >
                        {r.name}
                      </button>
                    ) : (
                      <span className="truncate">{r.name}</span>
                    )}
                    {r.why && (
                      <span className="ml-2 min-w-8 shrink-[4] truncate text-[11.5px] text-fg-2">
                        {r.why}
                      </span>
                    )}
                  </span>
                  <ManaCost cost={r.card?.manaCost} size={15} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function roleLabel(config: BulkBrewConfig, id: string): string {
  return config.roles.roles.find((r) => r.id === id)?.label ?? id;
}

/** How many copies the builder picked for each reason, most first. */
function reasons(deck: Deck): { why: string; qty: number }[] {
  const m = new Map<string, number>();
  for (const c of deck.cards) {
    const why = c.why ? c.why.replace(/^Curve: .*/, 'Curve') : 'Other';
    m.set(why, (m.get(why) ?? 0) + c.qty);
  }
  return [...m]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([why, qty]) => ({ why, qty }));
}

/**
 * Archetype, curve, roles, synergies, and the builder notes behind a
 * disclosure. `detailed` shows more: role descriptions, why each card was
 * picked, and the notes open.
 */
export function DeckExplanation({
  deck,
  config,
  variant = 'desktop',
  detailed = false,
}: {
  deck: Deck;
  config: BulkBrewConfig;
  variant?: Variant;
  detailed?: boolean;
}) {
  const [notesOpen, setNotes] = useState(false);
  const notes = notesOpen || detailed;
  const e = deck.explanation;
  const phone = variant === 'phone';
  const info = archetypeInfo(config, deck.archetype);
  const label = phone ? 'text-[0.6875rem] tracking-[0.04em] text-fg-2 uppercase' : ui.sectionLabel;
  const small = phone ? 'text-[0.8125rem] text-fg-1' : 'text-[12px] text-fg-1';
  if (!e) {
    return (
      <div className={`flex flex-col gap-1 ${phone ? 'text-[0.875rem]' : 'text-[13px]'}`}>
        <h3 className={label}>Archetype</h3>
        <span className={`font-semibold ${phone ? 'text-[1rem]' : 'text-[14px]'}`}>
          {info.label}
        </span>
        <p className="leading-[1.5] text-fg-1">
          {info.description || 'This deck was saved without an explanation.'}
        </p>
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-[18px] ${phone ? 'text-[0.875rem]' : 'text-[13px]'}`}>
      <section className="flex flex-col gap-1">
        <h3 className={label}>Archetype</h3>
        <span className={`font-semibold ${phone ? 'text-[1rem]' : 'text-[14px]'}`}>
          {info.label}
        </span>
        {info.description && <p className="leading-[1.5] text-fg-1">{info.description}</p>}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className={label}>Mana curve</h3>
        <CurveChart curve={e.curve} variant={variant} />
        <p className={small}>
          {e.lands.count} lands: average cost {e.lands.averageMv.toFixed(1)},{' '}
          {e.lands.cheapManaSources} cheap mana source{e.lands.cheapManaSources === 1 ? '' : 's'}
          {e.lands.nonbasics > 0 && `, ${e.lands.nonbasics} nonbasic`}.
        </p>
      </section>
      {Object.keys(e.roles).length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className={label}>Roles</h3>
          <RoleBars>
            {Object.entries(e.roles).map(([id, c]) => (
              <RoleBar key={id} label={roleLabel(config, id)} have={c.have} want={c.want} />
            ))}
          </RoleBars>
          {detailed && (
            <dl className={`mt-1 flex flex-col gap-1.5 ${small}`}>
              {Object.keys(e.roles).map((id) => (
                <div key={id}>
                  <dt className="inline font-medium text-ink">{roleLabel(config, id)}: </dt>
                  <dd className="inline">
                    {config.roles.roles.find((r) => r.id === id)?.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      {detailed && (
        <section className="flex flex-col gap-1.5">
          <h3 className={label}>Why the cards are here</h3>
          <ul className={`grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 ${small}`}>
            {reasons(deck).map((r) => (
              <li key={r.why} className="contents">
                <span>{r.why}</span>
                <span className="text-right font-mono tabular-nums">{r.qty}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {e.synergies.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={label}>Key synergies</h3>
          {e.synergies.map((s) => (
            <p key={s} className="border-l-2 border-line-strong pl-2.5 leading-[1.45]">
              {s}
            </p>
          ))}
        </section>
      )}
      {e.notes.length > 0 && (
        <section className="flex flex-col gap-2">
          {detailed ? (
            <h3 className={label}>Builder notes</h3>
          ) : (
            <button
              type="button"
              aria-expanded={notes}
              onClick={() => setNotes((n) => !n)}
              className={`self-start text-fg-2 underline underline-offset-2 hover:text-ink ${phone ? 'text-[0.8125rem]' : 'text-[12px]'}`}
            >
              {notes ? 'Hide builder notes' : 'Show builder notes'}
            </button>
          )}
          {notes && (
            <ul className={`flex flex-col gap-1 ${small}`}>
              {e.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
