import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { holdBack, holdInert } from './overlay.ts';

const CLOSE_MS = 200;
// A step between cards: out fast, in a little slower.
const OUT_MS = 130;
const IN_MS = 240;
// Clear of the home bar.
const BOTTOM = 'pb-[max(1.25rem,env(safe-area-inset-bottom))]';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  /** Names the sheet for screen readers. */
  label: string;
  /** A heading that stays above the scrolling content. */
  title?: ReactNode;
  /** Always the full height, for long content such as Analyze. */
  full?: boolean;
  /** No side padding, for content that brings its own. */
  flush?: boolean;
  /** Content, or a function of `close`, which rolls the sheet down first. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Stays under the scrolling content, such as the button that applies it. */
  footer?: (close: () => void) => ReactNode;
  /**
   * Makes the sheet one of a series: a swipe left or the next button calls it
   * with 1, a swipe right or the previous button with -1.
   */
  onStep?: ((direction: 1 | -1) => void) | undefined;
  /** What a step moves between, for the button names: "card" gives "Next card". */
  stepName?: string;
}

/**
 * A panel that rolls up from the bottom over a dimmed page. The handle, the
 * dimmed area, Escape, Back, and a drag down all close it; its content
 * scrolls inside it, and a pull down from the top of the content drags it.
 */
export function Sheet(props: SheetProps) {
  return props.open ? <OpenSheet {...props} /> : null;
}

function OpenSheet(props: SheetProps) {
  const { onClose, label, title, full, flush, children, footer, onStep, stepName = 'one' } = props;
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState<number>();
  const latestStep = useRef(onStep);
  useEffect(() => {
    latestStep.current = onStep;
  });
  // Where the content sits during a swipe. Set on the element, not through state, so a
  // finger's every move costs no render.
  const slide = useCallback((x: string, fade: number, ms: number, ease = 'ease-out') => {
    const el = scroller.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${ease}, opacity ${ms}ms ${ease}` : 'none';
    el.style.transform = x === '0' ? '' : `translateX(${x})`;
    el.style.opacity = fade === 1 ? '' : String(fade);
  }, []);
  const stepping = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stepFrame = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(stepping.current);
      cancelAnimationFrame(stepFrame.current);
    },
    [],
  );
  // The content slides off one side and the next slides in from the other, scrolled to the
  // same place, so a look through the cards' text or tags stays on the text or tags.
  const step = useCallback(
    (direction: 1 | -1) => {
      const el = scroller.current;
      if (!latestStep.current || !el || stepping.current !== undefined) return;
      const change = () => latestStep.current?.(direction);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        slide('0', 1, 0);
        change();
        return;
      }
      slide(`${-direction * 100}%`, 0, OUT_MS, 'ease-in');
      stepping.current = setTimeout(() => {
        change();
        slide(`${direction * 100}%`, 0, 0);
        // Two frames: one for the next card to render, one for its start place to apply.
        stepFrame.current = requestAnimationFrame(() => {
          stepFrame.current = requestAnimationFrame(() => {
            slide('0', 1, IN_MS, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
            stepping.current = undefined;
          });
        });
      }, OUT_MS);
    },
    [slide],
  );
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const releaseInert = useRef<() => void>(undefined);
  const recover = useRef(0);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  // Roll down first, then tell the host.
  const requestClose = useCallback(() => {
    if (closing.current !== undefined) return;
    setShown(false);
    closing.current = setTimeout(() => {
      // The page comes back first, so the host can return focus to it.
      releaseInert.current?.();
      latestClose.current();
      // A host that keeps the sheet open, say for another card, gets it back in view.
      recover.current = requestAnimationFrame(() => {
        closing.current = undefined;
        releaseInert.current = holdInert();
        setShown(true);
      });
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(recover.current);
      clearTimeout(closing.current);
      closing.current = undefined;
    };
  }, []);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    releaseInert.current = holdInert();
    handle.current?.focus({ preventScroll: true });
    // Bubble phase: a dialog over the sheet catches Escape first and stops it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Escape in a text field belongs to the field (a search box clears itself).
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      requestClose();
    };
    document.addEventListener('keydown', onKey);
    const releaseBack = holdBack(requestClose);
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseInert.current?.();
      releaseBack();
      // Unless the host already moved focus, it goes back where it was.
      const active = document.activeElement;
      if ((!active || active === document.body) && before?.isConnected)
        before.focus({ preventScroll: true });
    };
  }, [requestClose]);

  // Drag down to close, and swipe sideways to step. Touch events, not pointer events, so
  // the content keeps its own scrolling.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let state: 'idle' | 'maybe' | 'dragging' | 'swiping' = 'idle';
    let canDrag = false;
    let dx = 0;
    let dy = 0;
    const onStart = (e: TouchEvent) => {
      state = 'idle';
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) return;
      // Inside the content, only a pull from the very top drags the sheet.
      const box = scroller.current;
      let node = e.target as HTMLElement | null;
      canDrag = true;
      if (box?.contains(node)) {
        if (node?.closest('input, textarea, select')) return;
        for (; node && node !== box.parentElement; node = node.parentElement)
          if (node.scrollTop > 0) canDrag = false;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = e.timeStamp;
      state = 'maybe';
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (state === 'idle' || !touch) return;
      dx = touch.clientX - startX;
      dy = touch.clientY - startY;
      if (state === 'maybe') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) state = latestStep.current ? 'swiping' : 'idle';
        // Up is a scroll, not a drag.
        else state = dy > 0 && canDrag ? 'dragging' : 'idle';
        if (state === 'idle') return;
      }
      if (e.cancelable) e.preventDefault();
      if (state === 'dragging') setDrag(Math.max(0, dy));
      // The content follows the finger, fading as it goes.
      else slide(`${dx}px`, Math.max(0.35, 1 - Math.abs(dx) / el.clientWidth), 0);
    };
    const onEnd = (e: TouchEvent) => {
      if (state === 'dragging') {
        const speed = dy / Math.max(1, e.timeStamp - startTime);
        if (dy > 120 || (dy > 40 && speed > 0.5)) requestClose();
      }
      if (state === 'swiping') {
        const speed = Math.abs(dx) / Math.max(1, e.timeStamp - startTime);
        // Far enough or fast enough goes on; anything less settles back.
        if (e.type === 'touchend' && (Math.abs(dx) > 70 || (Math.abs(dx) > 25 && speed > 0.4)))
          step(dx < 0 ? 1 : -1);
        else slide('0', 1, 200);
      }
      state = 'idle';
      setDrag(undefined);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [requestClose, step, slide]);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={`Close ${label}`}
        tabIndex={-1}
        onClick={requestClose}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panel}
        role="dialog"
        data-sheet
        aria-modal="true"
        aria-label={label}
        style={{
          transform: !shown ? 'translateY(100%)' : drag ? `translateY(${drag}px)` : 'none',
        }}
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.25)] ease-out motion-reduce:transition-none ${
          // A series keeps one height, so a step never moves the sheet.
          full || onStep ? 'h-[92dvh]' : 'max-h-[92dvh]'
        } ${drag === undefined ? 'transition-transform duration-200' : ''}`}
      >
        <div className="flex shrink-0 items-stretch">
          {onStep && (
            <button
              type="button"
              aria-label={`Previous ${stepName}`}
              onClick={() => step(-1)}
              className="flex h-11 w-14 items-center justify-center rounded-tl-2xl text-[1.375rem] leading-none text-fg-1"
            >
              ‹
            </button>
          )}
          <button
            ref={handle}
            type="button"
            aria-label={`Close ${label}`}
            onClick={requestClose}
            className={`flex flex-1 touch-none items-center justify-center rounded-t-2xl ${onStep ? 'h-11' : 'h-8'}`}
          >
            <span aria-hidden className="h-[5px] w-11 rounded-full bg-line-strong" />
          </button>
          {onStep && (
            <button
              type="button"
              aria-label={`Next ${stepName}`}
              onClick={() => step(1)}
              className="flex h-11 w-14 items-center justify-center rounded-tr-2xl text-[1.375rem] leading-none text-fg-1"
            >
              ›
            </button>
          )}
        </div>
        {title && <div className="shrink-0 px-5 pb-3 text-[1.0625rem] font-semibold">{title}</div>}
        <div
          ref={scroller}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-none ${footer ? 'pb-4' : BOTTOM} ${flush ? '' : 'px-5'}`}
        >
          {typeof children === 'function' ? children(requestClose) : children}
        </div>
        {footer && (
          <div className={`shrink-0 border-t border-line px-5 pt-3 ${BOTTOM}`}>
            {footer(requestClose)}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
