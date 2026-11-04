import { useMemo, useState, type ReactNode } from 'react';
import {
  hasBackImage,
  imageUrl,
  printingImageUrl,
  type CardRecord,
  type ImageFace,
  type ImageSize,
  type PrintingHint,
} from '@bulk-brew/core';
import type { Variant } from './controls.tsx';

export interface CardImageProps {
  card: CardRecord;
  /** Printing to show when known; falls back to the default printing, then to nothing. */
  printing?: PrintingHint | undefined;
  size?: ImageSize;
  /** The printed side to show; only two-sided cards have a back image. */
  face?: ImageFace;
  className?: string;
  /** Shown instead when no image loads. */
  fallback?: ReactNode;
  /** Called when an image has loaded. */
  onLoad?(): void;
}

/**
 * A Scryfall card image, always shown whole. Sources are tried in order and
 * failures are remembered per URL, so a missing printing degrades quietly.
 */
export function CardImage({
  card,
  printing,
  size = 'normal',
  face = 'front',
  className,
  fallback = null,
  onLoad,
}: CardImageProps) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  const sources = useMemo(() => {
    const list: string[] = [];
    if (printing) list.push(printingImageUrl(printing, card.name, size, face));
    list.push(imageUrl(card.img, size, face));
    return list;
  }, [card, printing, size, face]);
  const src = sources.find((s) => !failed[s]);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={(face === 'back' ? card.faces?.[1]?.name : undefined) ?? card.name}
      loading="lazy"
      decoding="async"
      className={className}
      onLoad={onLoad}
      onError={() => setFailed((f) => ({ ...f, [src]: true }))}
    />
  );
}

/** Two curved arrows: turn the card over. */
function FlipIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/**
 * A card's image, and for a card printed on both sides a button that turns
 * it over. The button sits beside the image, halfway down, so nothing is
 * ever drawn over the card. A newly shown card starts face up.
 */
export function CardArt(props: Omit<CardImageProps, 'face'> & { variant?: Variant }) {
  const { variant = 'desktop', ...image } = props;
  const { card } = image;
  // Which card this state belongs to; another card starts face up with no image seen yet.
  const [side, setSide] = useState({ id: card.id, back: false, loaded: false });
  if (side.id !== card.id) setSide({ id: card.id, back: false, loaded: false });
  const back = side.id === card.id && side.back;
  const art = (
    <CardImage
      {...image}
      face={back ? 'back' : 'front'}
      onLoad={() => setSide((s) => (s.id === card.id && !s.loaded ? { ...s, loaded: true } : s))}
    />
  );
  // Without an image there is nothing to turn over; the text shows both faces.
  if (!hasBackImage(card) || !(side.id === card.id && side.loaded)) return art;
  const other = card.faces?.[back ? 0 : 1]?.name;
  const phone = variant === 'phone';
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{art}</div>
      <button
        type="button"
        aria-label={other ? `Turn over to ${other}` : 'Turn the card over'}
        title="Turn over"
        onClick={() => setSide((s) => ({ ...s, back: !back }))}
        className={`relative z-10 grid shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink hover:bg-surface-2 ${phone ? 'size-11' : 'size-8'}`}
      >
        <FlipIcon size={phone ? 18 : 16} />
      </button>
    </div>
  );
}
