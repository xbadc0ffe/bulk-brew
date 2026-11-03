import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { phone, ui } from '../styles.ts';
import type { Variant } from './controls.tsx';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
  /** Which button has focus when the dialog opens; Cancel by default. */
  focus?: 'confirm' | 'cancel';
  variant?: Variant;
}

/** A modal question with two named answers. Escape and the backdrop cancel. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, message, confirmLabel, cancelLabel = 'Cancel', variant = 'desktop' } = props;
  const id = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Keep the latest handler without re-running the focus effect.
  const cancel = useRef(props.onCancel);
  useEffect(() => {
    cancel.current = props.onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    // The page behind is inert while the dialog is open: no tabbing or
    // shortcuts reach it. The dialog itself is portaled outside #root.
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    (props.focus === 'confirm' ? confirmRef : cancelRef).current?.focus();
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
      // Return focus unless the confirmed action removed or disabled that control.
      const usable = before?.isConnected && !(before as HTMLButtonElement).disabled;
      if (usable) before.focus({ preventScroll: true });
    };
  }, [open, props.focus]);

  if (!open) return null;
  const isPhone = variant === 'phone';
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={() => cancel.current()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-xl border border-line bg-surface p-5"
      >
        <h2
          id={`${id}-title`}
          className={isPhone ? 'text-[1.0625rem] font-semibold' : 'text-[16px] font-semibold'}
        >
          {title}
        </h2>
        <div
          id={`${id}-message`}
          className={
            isPhone
              ? 'text-[0.875rem] leading-[1.5] text-fg-1'
              : 'text-[13px] leading-[1.5] text-fg-1'
          }
        >
          {message}
        </div>
        <div className={isPhone ? 'mt-2 grid grid-cols-2 gap-2' : 'mt-2 flex justify-end gap-2'}>
          <button
            ref={cancelRef}
            type="button"
            className={isPhone ? phone.secondary : ui.secondary}
            onClick={() => cancel.current()}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={isPhone ? phone.primary : ui.primary}
            onClick={props.onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
