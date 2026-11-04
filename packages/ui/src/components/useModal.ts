import { useEffect, useRef, type RefObject } from 'react';

/**
 * While open: the page behind is inert, `first` takes focus, Escape cancels,
 * and focus goes back where it was on close.
 */
export function useModal(
  open: boolean,
  onCancel: () => void,
  first: RefObject<HTMLElement | null>,
) {
  // Keep the latest handler without re-running the focus effect.
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    // The dialog itself is portaled outside #root.
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      root?.removeAttribute('inert');
      // Return focus unless the chosen action removed or disabled that control.
      const usable = before?.isConnected && !(before as HTMLButtonElement).disabled;
      if (usable) before.focus({ preventScroll: true });
    };
  }, [open, first]);
  return cancel;
}
