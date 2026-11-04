import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { hasBackImage, type CardRecord, type PrintingHint } from '@bulk-brew/core';
import {
  clampView,
  panView,
  pinchView,
  UNZOOMED,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  zoomAround,
  type Point,
  type ZoomBox,
  type ZoomView,
} from '../data/zoom.ts';
import { CardImage, type CardImageProps } from './CardImage.tsx';
import type { Variant } from './controls.tsx';
import { useModal } from './useModal.ts';

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

/** The round turn-over button, laid over the right edge of the art, halfway down. */
function FlipButton(props: {
  card: CardRecord;
  back: boolean;
  /** Phone-sized, or on the full-screen card. */
  big: boolean;
  /** Undoes the card's zoom, so the button keeps its size. */
  unscale?: number;
  onFlip(): void;
}) {
  const { card, back, big, unscale = 1, onFlip } = props;
  const other = card.faces?.[back ? 0 : 1]?.name;
  return (
    <button
      type="button"
      aria-label={other ? `Turn over to ${other}` : 'Turn the card over'}
      title="Turn over"
      onClick={onFlip}
      style={
        unscale !== 1 ? { scale: String(unscale), transformOrigin: 'right center' } : undefined
      }
      className={`absolute top-1/2 right-2 z-10 grid -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface/90 text-ink shadow-md hover:bg-surface ${big ? 'size-11' : 'size-8'}`}
    >
      <FlipIcon size={big ? 18 : 16} />
    </button>
  );
}

type ArtProps = Omit<CardImageProps, 'face'> & {
  variant?: Variant;
  /** Classes for the box around the image, which the buttons sit in. */
  frameClassName?: string;
  /** Whether clicking the image shows it full screen. */
  zoom?: boolean;
};

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

/** The card's size at 100% and the window's, for keeping it in view. */
function boxOf(frame: HTMLElement | null): ZoomBox {
  return {
    width: frame?.offsetWidth ?? 0,
    height: frame?.offsetHeight ?? 0,
    viewWidth: window.innerWidth,
    viewHeight: window.innerHeight,
  };
}

/** A pointer's place measured from the middle of the window, where the card sits. */
const fromCenter = (e: { clientX: number; clientY: number }): Point => ({
  x: e.clientX - window.innerWidth / 2,
  y: e.clientY - window.innerHeight / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * The card as large as the window allows, over a dark backdrop. The wheel,
 * the zoom buttons, the + and - keys, or a pinch zoom it; dragging moves a
 * zoomed card. Escape, the close button, or a click outside the card closes it.
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
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cancel = useModal(true, onClose, closeRef);
  const [view, setView] = useState<ZoomView>(UNZOOMED);
  // Button and key zooms ease in; the wheel, pinches, and drags follow the hand directly.
  const [smooth, setSmooth] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ start: ZoomView; distance: number; mid: Point }>(undefined);
  const drag = useRef<{ last: Point; from: Point }>(undefined);
  // A drag that ends over the backdrop must not count as a click that closes.
  const moved = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Lines (some mice) step further than pixels (trackpads).
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002));
      setSmooth(false);
      setView((v) => zoomAround(v, factor, fromCenter(e), boxOf(frameRef.current)));
    };
    const onResize = () => setView((v) => clampView(v, boxOf(frameRef.current)));
    // On the window, since clicking the backdrop takes focus out of the viewer.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const factor =
        e.key === '+' || e.key === '='
          ? ZOOM_STEP
          : e.key === '-' || e.key === '_'
            ? 1 / ZOOM_STEP
            : undefined;
      if (factor === undefined && e.key !== '0') return;
      e.preventDefault();
      setSmooth(true);
      setView((v) =>
        factor === undefined
          ? UNZOOMED
          : zoomAround(v, factor, { x: 0, y: 0 }, boxOf(frameRef.current)),
      );
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const zoomBy = (factor: number) => {
    setSmooth(true);
    setView((v) => zoomAround(v, factor, { x: 0, y: 0 }, boxOf(frameRef.current)));
  };
  const reset = () => {
    setSmooth(true);
    setView(UNZOOMED);
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = fromCenter(e);
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(e.pointerId, p);
    const [a, b] = [...pointers.current.values()];
    if (a && b) {
      pinch.current = { start: view, distance: distance(a, b), mid: midpoint(a, b) };
      drag.current = undefined;
    } else {
      drag.current = { last: p, from: p };
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = fromCenter(e);
    pointers.current.set(e.pointerId, p);
    const [a, b] = [...pointers.current.values()];
    const box = boxOf(frameRef.current);
    if (pinch.current && a && b) {
      moved.current = true;
      setSmooth(false);
      const { start, distance: d0, mid: m0 } = pinch.current;
      setView(pinchView(start, d0, distance(a, b), m0, midpoint(a, b), box));
    } else if (drag.current) {
      const { last, from } = drag.current;
      drag.current = { last: p, from };
      if (distance(p, from) > 5) moved.current = true;
      if (view.scale > 1) {
        setSmooth(false);
        setView((v) => panView(v, p.x - last.x, p.y - last.y, box));
      }
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = undefined;
    // With one finger left, it carries on as a drag from where it is.
    const [rest] = [...pointers.current.values()];
    drag.current = rest ? { last: rest, from: rest } : undefined;
  };

  const face = back ? 'back' : 'front';
  const name = card.faces?.[back ? 1 : 0]?.name ?? card.name;
  const zoomed = view.scale > 1;
  // Tall enough to fill the window's height, unless the width runs out first.
  const fit =
    'pointer-events-none block h-[min(calc(100dvh_-_2rem),calc((100vw_-_2rem)*88/63))] w-auto rounded-[4.75%/3.4%] select-none';
  const control = `grid place-items-center rounded-full text-white hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent ${phone ? 'size-11 text-[22px]' : 'size-9 text-[20px]'}`;
  return createPortal(
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${name}, full screen`}
      className={`fixed inset-0 z-[70] flex touch-none items-center justify-center overflow-hidden bg-black/85 p-4 ${zoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={(e) => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        if (e.target === e.currentTarget) cancel.current();
      }}
    >
      <div
        ref={frameRef}
        className="relative will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: smooth ? 'transform 150ms ease-out' : 'none',
        }}
      >
        <CardImage
          card={card}
          printing={printing}
          size="large"
          face={face}
          className={fit}
          fallback={
            <CardImage card={card} printing={printing} size="normal" face={face} className={fit} />
          }
        />
        {hasBackImage(card) && (
          <FlipButton card={card} back={back} big unscale={1 / view.scale} onFlip={onFlip} />
        )}
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
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 p-1 text-white">
        <button
          type="button"
          aria-label="Zoom out"
          className={control}
          disabled={view.scale <= ZOOM_MIN}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Zoom ${Math.round(view.scale * 100)} percent; reset`}
          title="Reset zoom"
          className="min-w-14 rounded-full px-2 py-1.5 text-[13px] text-white tabular-nums hover:bg-white/20"
          onClick={reset}
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          className={control}
          disabled={view.scale >= ZOOM_MAX}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          +
        </button>
      </div>
    </div>,
    document.body,
  );
}
