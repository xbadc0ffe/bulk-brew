import { useEffect, useMemo, useRef } from 'react';
import type { BulkBrewConfig, CardIndex, CardRecord, PrintingHint } from '@bulk-brew/core';
import { CardImage } from './CardImage.tsx';
import { Stepper, type Variant } from './controls.tsx';
import { ManaCost } from '../ManaCost.tsx';
import { cardTags } from '../data/poolView.ts';
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
  /** Close on Escape even without a close button (the pool panel). */
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

function typeWithStats(face: FaceLike): string {
  const s = stats(face);
  return s ? `${face.typeLine} · ${s}` : face.typeLine;
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
  const tags = useMemo(() => {
    const seen = new Set<string>();
    return cardTags(index, config, card).filter((t) => !seen.has(t.label) && seen.add(t.label));
  }, [index, config, card]);
  const multiFace = (card.faces?.length ?? 0) > 1;
  const closeButton = useRef<HTMLButtonElement>(null);

  // Keyboard users land on Close when a card opens and can leave with Escape.
  useEffect(() => {
    closeButton.current?.focus();
  }, [card.id]);
  const escape = onClose ?? onEscape;
  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) escape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escape]);

  const t = phone
    ? {
        name: 'text-[1.125rem] font-semibold leading-tight',
        type: 'text-[0.8125rem] text-fg-1',
        body: 'text-[0.9375rem] leading-[1.55]',
        small: 'text-[0.8125rem] text-fg-2',
      }
    : {
        name: 'text-[16px] font-semibold leading-[1.25]',
        type: 'text-[12.5px] text-fg-1',
        body: 'text-[13px] leading-[1.55]',
        small: 'text-[12.5px] text-fg-2',
      };

  return (
    <div className={`flex min-h-full flex-col ${phone ? 'gap-4' : 'gap-3.5'}`}>
      <div className="flex items-start gap-3">
        {showArt && !phone && (
          <CardImage
            card={card}
            printing={printing}
            size="normal"
            className="h-[86px] w-auto shrink-0 rounded-[4px]"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className={t.name}>{card.name}</h2>
          <div className={t.type}>{typeWithStats(card)}</div>
          {card.manaCost && (
            <div>
              <ManaCost cost={card.manaCost} />
            </div>
          )}
        </div>
        {onClose && (
          <button
            ref={closeButton}
            type="button"
            className={
              phone
                ? 'min-h-11 shrink-0 px-1 text-[0.9375rem] font-medium text-ink'
                : `${ui.quiet} shrink-0 px-1 text-[16px] leading-none`
            }
            onClick={onClose}
            aria-label="Close card detail"
          >
            {phone ? 'Done' : '✕'}
          </button>
        )}
      </div>

      {showArt && phone && (
        <CardImage
          card={card}
          printing={printing}
          size="normal"
          className="mx-auto w-full max-w-xs rounded-[12px]"
        />
      )}

      <div className={`flex flex-col gap-3 border-t border-line pt-3 ${t.body}`}>
        {multiFace
          ? card.faces!.map((f, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.name}</span>
                  <ManaCost cost={f.manaCost} size={15} />
                </div>
                <div className={t.type}>{typeWithStats(f)}</div>
                {f.text && <p className="whitespace-pre-line">{f.text}</p>}
              </div>
            ))
          : card.text && <p className="whitespace-pre-line">{card.text}</p>}
      </div>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((tag) => (
            <li
              key={tag.label}
              className={
                phone ? 'rounded bg-surface-2 px-2 py-[0.1875rem] text-[0.75rem] text-fg-1' : ui.tag
              }
            >
              {tag.label}
            </li>
          ))}
        </ul>
      )}

      {qty !== undefined && props.onQtyChange && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3.5">
          <span className={phone ? 'text-[0.9375rem] text-fg-1' : 'text-[13px] text-fg-1'}>
            Quantity
          </span>
          <Stepper
            label="Quantity"
            value={qty}
            min={1}
            onChange={props.onQtyChange}
            variant={variant}
          />
        </div>
      )}

      {props.inDecks && (
        <p className={t.small}>
          {props.inDecks.length > 0
            ? `In saved decks: ${props.inDecks.length} (${props.inDecks.join(', ')})`
            : 'Not in any saved deck.'}
        </p>
      )}

      {card.unset && <p className={t.small}>Un-set card. Used only when the setting allows.</p>}

      <details className={t.small}>
        <summary className="cursor-pointer">Scryfall tags ({card.tags.length})</summary>
        <p className="mt-1 break-words">{card.tags.join(', ') || 'none'}</p>
      </details>

      {props.onRemove && (
        <div className="mt-auto pt-2">
          <button
            type="button"
            className={
              phone ? `${phoneStyles.secondary} text-fg-1` : `${ui.secondary} w-full text-fg-1`
            }
            onClick={props.onRemove}
          >
            Remove from pool
          </button>
        </div>
      )}
    </div>
  );
}
