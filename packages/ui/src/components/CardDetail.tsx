import { useEffect, useMemo, useRef } from 'react';
import {
  archetypeById,
  factsFor,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type PrintingHint,
} from '@bulk-brew/core';
import { CardImage } from './CardImage.tsx';
import { ManaCost } from '../ManaCost.tsx';

export interface CardDetailProps {
  card: CardRecord;
  printing?: PrintingHint | undefined;
  /** Copies in the pool, when shown from the pool. */
  qty?: number | undefined;
  index: CardIndex;
  config: BulkBrewConfig;
  showArt: boolean;
  onClose?: (() => void) | undefined;
}

const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';

function archetypeLabel(config: BulkBrewConfig, id: string): string {
  try {
    return archetypeById(config, id).label;
  } catch {
    return id;
  }
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

function Face({ face }: { face: FaceLike }) {
  const stats = face.loyalty
    ? `Loyalty ${face.loyalty}`
    : face.power !== undefined || face.toughness !== undefined
      ? `${face.power ?? '?'}/${face.toughness ?? '?'}`
      : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{face.name}</span>
        <ManaCost cost={face.manaCost} />
      </div>
      <div className={muted}>{face.typeLine}</div>
      {face.text && <p className="whitespace-pre-line text-sm">{face.text}</p>}
      {stats && <div className="text-sm font-medium">{stats}</div>}
    </div>
  );
}

/** Everything the app knows about one card. Presentational; the host supplies the panel or sheet. */
export function CardDetail(props: CardDetailProps) {
  const { card, printing, qty, index, config, showArt, onClose } = props;
  const facts = useMemo(() => factsFor(index, config, card), [index, config, card]);
  const roles = facts.roles.map((id) => config.roles.roles.find((r) => r.id === id)?.label ?? id);
  const enables = facts.enablerOf.map((id) => archetypeLabel(config, id));
  const paysOff = facts.payoffOf.map((id) => archetypeLabel(config, id));
  const faces: FaceLike[] = card.faces?.length ? card.faces : [card];
  const closeButton = useRef<HTMLButtonElement>(null);

  // Keyboard users land on Close when a card opens and can leave with Escape.
  useEffect(() => {
    closeButton.current?.focus();
  }, [card.id]);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{card.name}</h2>
        {onClose && (
          <button
            ref={closeButton}
            type="button"
            className={button}
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        )}
      </div>
      {showArt && (
        <CardImage
          card={card}
          printing={printing}
          size="normal"
          className="mx-auto w-full max-w-xs"
        />
      )}
      {qty !== undefined && <div className={muted}>{qty} in your pool</div>}
      <div className="flex flex-col gap-3">
        {faces.map((f, i) => (
          <Face key={i} face={f} />
        ))}
      </div>
      {(roles.length > 0 || enables.length > 0 || paysOff.length > 0) && (
        <dl className="flex flex-col gap-1 text-sm">
          {roles.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-zinc-500">Roles</dt>
              <dd>{roles.join(', ')}</dd>
            </div>
          )}
          {enables.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-zinc-500">Enables</dt>
              <dd>{enables.join(', ')}</dd>
            </div>
          )}
          {paysOff.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-zinc-500">Pays off</dt>
              <dd>{paysOff.join(', ')}</dd>
            </div>
          )}
        </dl>
      )}
      {card.unset && <p className={muted}>Un-set card. Included only when the setting allows.</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">Tags ({card.tags.length})</summary>
        <p className={`mt-1 break-words ${muted}`}>{card.tags.join(', ') || 'none'}</p>
      </details>
    </div>
  );
}
