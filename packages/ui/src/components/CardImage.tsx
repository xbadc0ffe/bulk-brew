import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  hasBackImage,
  imageUrl,
  printingImageUrl,
  type CardRecord,
  type ImageFace,
  type ImageSize,
  type PrintingHint,
} from '@bulk-brew/core';
import { useModal } from './useModal.ts';
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

type ArtProps = Omit<CardImageProps, 'face'> & {
  variant?: Variant;
  /** Classes for the box around the image, which the buttons sit in. */
  frameClassName?: string;
  /** Whether clicking the image shows it full screen. */
  zoom?: boolean;
};

/** The round turn-over button, laid over the right edge of the art, halfway down. */
function FlipButton(props: {
  card: CardRecord;
  back: boolean;
  /** Phone-sized, or on the full-screen card. */
  big: boolean;
  onFlip(): void;
}) {
  const { card, back, big, onFlip } = props;
  const other = card.faces?.[back ? 0 : 1]?.name;
  return (
    <button
      type="button"
      aria-label={other ? `Turn over to ${other}` : 'Turn the card over'}
      title="Turn over"
      onClick={onFlip}
      className={`absolute top-1/2 right-2 z-10 grid -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface/90 text-ink shadow-md hover:bg-surface ${big ? 'size-11' : 'size-8'}`}
    >
      <FlipIcon size={big ? 18 : 16} />
    </button>
  );
}

/**
 * A card's image. Once it shows, clicking it opens it full screen, and a
 * card printed on both sides gets a button over the art's right edge that
 * turns it over (the image itself is never changed). A newly shown card
 * starts face up.
 */
export function CardArt(props: ArtProps) {
  const { variant = 'desktop', frameClassName = '', zoom = true, ...image } = props;
  const { card } = image;
  // Which card this state belongs to; another card starts face up with no image seen yet.
  const [side, setSide] = useState({ id: card.id, back: false, loaded: false });
  const [full, setFull] = useState(false);
  if (side.id !== card.id) setSide({ id: card.id, back: false, loaded: false });
  const mine = side.id === card.id;
  const back = mine && side.back;
  // Without an image there is nothing to enlarge or turn over; the text shows both faces.
  const loaded = mine && side.loaded;
  const flip = () => setSide((s) => ({ ...s, back: !back }));
  const phone = variant === 'phone';
  const name = card.faces?.[back ? 1 : 0]?.name ?? card.name;
  return (
    <>
      <div className={`relative ${frameClassName}`}>
        <CardImage
          {...image}
          face={back ? 'back' : 'front'}
          onLoad={() =>
            setSide((s) => (s.id === card.id && !s.loaded ? { ...s, loaded: true } : s))
          }
        />
        {zoom && loaded && (
          <button
            type="button"
            aria-label={`Show ${name} full screen`}
            onClick={() => setFull(true)}
            className="absolute inset-0 cursor-zoom-in rounded-[inherit]"
          />
        )}
        {loaded && hasBackImage(card) && (
          <FlipButton card={card} back={back} big={phone} onFlip={flip} />
        )}
      </div>
      {full && (
        <CardViewer
          card={card}
          printing={image.printing}
          back={back}
          onFlip={flip}
          onClose={() => setFull(false)}
          phone={phone}
        />
      )}
    </>
  );
}

/**
 * The card as large as the window allows, over a dark backdrop. Escape, the
 * close button, or a click outside the card closes it.
 */
function CardViewer(props: {
  card: CardRecord;
  printing: PrintingHint | undefined;
  back: boolean;
  onFlip(): void;
  onClose(): void;
  phone: boolean;
}) {
  const { card, printing, back, onFlip, onClose, phone } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancel = useModal(true, onClose, closeRef);
  const face = back ? 'back' : 'front';
  const name = card.faces?.[back ? 1 : 0]?.name ?? card.name;
  // Tall enough to fill the window's height, unless the width runs out first.
  const fit = 'h-[min(calc(100dvh_-_2rem),calc((100vw_-_2rem)*88/63))] w-auto rounded-[4.75%/3.4%]';
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}, full screen`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel.current();
      }}
    >
      <div className="relative">
        <CardImage
          card={card}
          printing={printing}
          size="large"
          face={face}
          className={`block ${fit}`}
          fallback={
            <CardImage
              card={card}
              printing={printing}
              size="normal"
              face={face}
              className={`block ${fit}`}
            />
          }
        />
        {hasBackImage(card) && <FlipButton card={card} back={back} big onFlip={onFlip} />}
      </div>
      <button
        ref={closeRef}
        type="button"
        aria-label="Close full screen"
        onClick={() => cancel.current()}
        className={`absolute top-3 right-3 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 ${phone ? 'size-11 text-[20px]' : 'size-9 text-[18px]'}`}
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
