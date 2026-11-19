import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { holdBack, holdInert } from './overlay.ts';

const CLOSE_MS = 200;
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
}

/**
 * A panel that rolls up from the bottom over a dimmed page. The handle, the
 * dimmed area, Escape, Back, and a drag down all close it; its content
 * scrolls inside it, and a pull down from the top of the content drags it.
 */
export function Sheet(props: SheetProps) {
  return props.open ? <OpenSheet {...props} /> : null;
}

function OpenSheet({ onClose, label, title, full, flush, children, footer }: SheetProps) {
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState<number>();
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

  // Drag down to close. Touch events, not pointer events, so the content keeps its own scrolling.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let state: 'idle' | 'maybe' | 'dragging' = 'idle';
    let dy = 0;
    const onStart = (e: TouchEvent) => {
      state = 'idle';
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) return;
      // Inside the content, only a pull from the very top drags the sheet.
      const box = scroller.current;
      let node = e.target as HTMLElement | null;
      if (box?.contains(node)) {
        if (node?.closest('input, textarea, select')) return;
        for (; node && node !== box.parentElement; node = node.parentElement)
          if (node.scrollTop > 0) return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = e.timeStamp;
      state = 'maybe';
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (state === 'idle' || !touch) return;
      dy = touch.clientY - startY;
      if (state === 'maybe') {
        const dx = touch.clientX - startX;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Up or sideways is a scroll, not a drag.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          state = 'idle';
          return;
        }
        state = 'dragging';
      }
      if (e.cancelable) e.preventDefault();
      setDrag(Math.max(0, dy));
    };
    const onEnd = (e: TouchEvent) => {
      if (state === 'dragging') {
        const speed = dy / Math.max(1, e.timeStamp - startTime);
        if (dy > 120 || (dy > 40 && speed > 0.5)) requestClose();
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
  }, [requestClose]);

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
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[640px] flex-col rounded-t-2xl border border-b-0 border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.25)] ease-out motion-reduce:transition-none ${
          full ? 'h-[92dvh]' : 'max-h-[92dvh]'
        } ${drag === undefined ? 'transition-transform duration-200' : ''}`}
      >
        <button
          ref={handle}
          type="button"
          aria-label={`Close ${label}`}
          onClick={requestClose}
          className="flex h-8 shrink-0 touch-none items-center justify-center rounded-t-2xl"
        >
          <span aria-hidden className="h-[5px] w-11 rounded-full bg-line-strong" />
        </button>
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
