import { useEffect, useMemo, useRef } from 'react';
import type { BulkBrewConfig, CardIndex, CardRecord, PrintingHint } from '@bulk-brew/core';
import { CardArt } from './CardArt.tsx';
import { Stepper, type Variant } from './controls.tsx';
import { ManaCost, SymbolText } from '../ManaCost.tsx';
import { DISPLAY_TAGS } from '../data/config.ts';
import { cardTags, majorTags, typeParts } from '../data/poolView.ts';
import { phone as phoneStyles, ui } from '../styles.ts';

export interface CardDetailProps {
  card: CardRecord;
  printing?: PrintingHint | undefined;
  /** Copies in the pool, when shown from the pool. */
  qty?: number | undefined;
  index: CardIndex;
  config: BulkBrewConfig;
  showArt: boolean;
  /** Shows a close button and moves focus to it when a card opens. */
  onClose?: (() => void) | undefined;
  /** Close on Escape even without a close button. */
  onEscape?: (() => void) | undefined;
  onQtyChange?: ((qty: number) => void) | undefined;
  onRemove?: (() => void) | undefined;
  /** Names of saved decks that use this card. */
  inDecks?: string[] | undefined;
  variant?: Variant;
}

interface FaceLike {
  name: string;
  manaCost?: string | undefined;
  typeLine: string;
  text?: string | undefined;
  power?: string | undefined;
  toughness?: string | undefined;
  loyalty?: string | undefined;
}

function stats(face: FaceLike): string | undefined {
  if (face.loyalty) return `Loyalty ${face.loyalty}`;
  if (face.power !== undefined || face.toughness !== undefined)
    return `${face.power ?? '?'}/${face.toughness ?? '?'}`;
  return undefined;
}

/** One face laid out like a card: name, cost, type, subtype, rules text, stats. */
function FaceBlock({ face, phone }: { face: FaceLike; phone: boolean }) {
  const { type, subtype } = typeParts(face.typeLine);
  const s = stats(face);
  const size = phone
    ? {
        name: 'text-[1.0625rem]',
        type: 'text-[0.875rem]',
        sub: 'text-[0.8125rem]',
        body: 'text-[0.9375rem]',
      }
    : { name: 'text-[16px]', type: 'text-[13px]', sub: 'text-[12.5px]', body: 'text-[13px]' };
  return (
    <article className="flex flex-col rounded-lg border border-line-strong bg-surface">
      <header className="flex flex-col gap-1.5 px-3.5 pt-3 pb-2.5">
        <h2 className={`${size.name} leading-tight font-semibold`}>{face.name}</h2>
        {face.manaCost && (
          <div>
            <ManaCost cost={face.manaCost} />
          </div>
        )}
      </header>
      <div className="flex flex-col gap-0.5 border-t border-line px-3.5 py-2">
        <span className={`${size.type} font-semibold`}>{type}</span>
        {subtype && <span className={`${size.sub} text-fg-1 italic`}>{subtype}</span>}
      </div>
      {face.text && (
        <div
          className={`flex flex-col gap-1.5 border-t border-line px-3.5 py-2.5 ${size.body} leading-[1.55]`}
        >
          {face.text.split('\n').map((p, i) => (
            <p key={i}>
              <SymbolText text={p} />
            </p>
          ))}
        </div>
      )}
      {s && (
        <div
          className={`border-t border-line px-3.5 py-1.5 text-right font-semibold tabular-nums ${size.body}`}
        >
          {s}
        </div>
      )}
    </article>
  );
}

/** Everything the app knows about one card. Presentational; the host supplies the panel or sheet. */
export function CardDetail(props: CardDetailProps) {
  const {
    card,
    printing,
    qty,
    index,
    config,
    showArt,
    onClose,
    onEscape,
    variant = 'desktop',
  } = props;
  const phone = variant === 'phone';
  const major = useMemo(() => majorTags(index, config, DISPLAY_TAGS, card), [index, config, card]);
  const general = useMemo(() => {
    const seen = new Set<string>();
    return cardTags(index, config, card).filter((t) => !seen.has(t.label) && seen.add(t.label));
  }, [index, config, card]);
  const faces: FaceLike[] = card.faces && card.faces.length > 1 ? card.faces : [card];
  const closeButton = useRef<HTMLButtonElement>(null);

  // Keyboard users land on Close when a card opens and can leave with Escape.
  useEffect(() => {
    closeButton.current?.focus();
  }, [card.id]);
  const escape = onClose ?? onEscape;
  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Escape in a text field belongs to the field (a search box clears itself).
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      escape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escape]);

  const label = phone ? phoneStyles.groupLabel : ui.sectionLabel;
  const small = phone ? 'text-[0.8125rem] text-fg-2' : 'text-[12.5px] text-fg-2';
  const bubble = phone ? 'px-2.5 py-1 text-[0.75rem]' : 'px-2.5 py-[3px] text-[12px]';
  const editable = qty !== undefined && props.onQtyChange;

  return (
    <div className={`flex min-h-full flex-col ${phone ? 'gap-4' : 'gap-3.5'}`}>
      {(onClose || editable) && (
        <div className="flex items-center justify-between gap-3">
          {editable ? (
            <span className="flex items-center gap-2.5">
              <span className={phone ? 'text-[0.9375rem] text-fg-1' : 'text-[13px] text-fg-1'}>
                Quantity
              </span>
              <Stepper
                label="Quantity"
                value={qty}
                min={1}
                onChange={props.onQtyChange!}
                variant={variant}
              />
            </span>
          ) : (
            <span />
          )}
          {onClose && (
            <button
              ref={closeButton}
              type="button"
              className={
                phone
                  ? 'min-h-11 shrink-0 px-1 text-[0.9375rem] font-semibold text-ink'
                  : `${ui.quiet} shrink-0 px-1 text-[16px] leading-none`
              }
              onClick={onClose}
              aria-label="Close card detail"
            >
              {phone ? 'Done' : '✕'}
            </button>
          )}
        </div>
      )}
      {qty !== undefined && !props.onQtyChange && (
        <p className={small}>{qty > 0 ? `${qty} in your bulk list` : 'Not in your bulk list'}</p>
      )}

      {showArt && (
        <CardArt
          card={card}
          printing={printing}
          size="normal"
          variant={variant}
          frameClassName={`mx-auto w-full rounded-[12px] ${phone ? 'max-w-xs' : 'max-w-[256px]'}`}
          className="block w-full rounded-[12px]"
        />
      )}

      {faces.map((f, i) => (
        <FaceBlock key={i} face={f} phone={phone} />
      ))}

      {major.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className={label}>Tags</h3>
          <ul className="flex flex-wrap gap-1.5">
            {major.map((t) => (
              <li
                key={t.id}
                title={t.description}
                className={`rounded-full border border-line-strong bg-surface font-semibold text-ink ${bubble}`}
              >
                {t.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {general.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className={label}>Roles and archetypes</h3>
          <ul className="flex flex-wrap gap-1.5">
            {general.map((t) => (
              <li key={t.label} className={`rounded-full bg-surface-2 text-fg-1 ${bubble}`}>
                {t.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className={small}>
        <summary className="cursor-pointer">Scryfall tags ({card.tags.length})</summary>
        <ul className="mt-2 flex flex-wrap gap-1">
          {card.tags.length === 0 && <li>none</li>}
          {card.tags.map((t) => (
            <li
              key={t}
              className="rounded border border-line px-1.5 py-px font-mono text-[11px] text-fg-1"
            >
              {t}
            </li>
          ))}
        </ul>
      </details>

      {props.inDecks && (
        <p className={small}>
          {props.inDecks.length > 0
            ? `In saved decks: ${props.inDecks.length} (${props.inDecks.join(', ')})`
            : 'Not in any saved deck.'}
        </p>
      )}

      {card.unset && <p className={small}>Un-set card. Used only when the setting allows.</p>}

      {props.onRemove && (
        <div className="mt-auto pt-2">
          <button
            type="button"
            className={
              phone ? `${phoneStyles.secondary} text-fg-1` : `${ui.secondary} w-full text-fg-1`
            }
            onClick={props.onRemove}
          >
            Remove from bulk list
          </button>
        </div>
      )}
    </div>
  );
}
