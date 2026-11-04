import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
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

/**
 * While open: the page behind is inert, `first` takes focus, Escape cancels,
 * and focus goes back where it was on close.
 */
function useModal(open: boolean, onCancel: () => void, first: RefObject<HTMLElement | null>) {
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

function Shell(props: {
  id: string;
  title: string;
  message: ReactNode;
  cancelLabel: string;
  onBackdrop(): void;
  isPhone: boolean;
  children: ReactNode;
}) {
  const { id, title, message, cancelLabel, onBackdrop, isPhone, children } = props;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={onBackdrop}
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
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A modal question with two named answers. Escape and the backdrop cancel. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, message, confirmLabel, cancelLabel = 'Cancel', variant = 'desktop' } = props;
  const id = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useModal(open, props.onCancel, props.focus === 'confirm' ? confirmRef : cancelRef);

  if (!open) return null;
  const isPhone = variant === 'phone';
  return (
    <Shell
      id={id}
      title={title}
      message={message}
      cancelLabel={cancelLabel}
      onBackdrop={() => cancel.current()}
      isPhone={isPhone}
    >
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
    </Shell>
  );
}

export interface Choice {
  label: string;
  /** A smaller line under the label. */
  detail?: string;
  tone: 'go' | 'go-soft' | 'stop' | 'stop-soft' | 'neutral';
  onSelect(): void;
}

const TONE: Record<Choice['tone'], string> = {
  go: 'bg-go text-on-solid',
  'go-soft': 'border border-go bg-go-soft text-go-soft-fg',
  stop: 'bg-stop text-on-solid',
  'stop-soft': 'border border-stop bg-stop-soft text-stop-soft-fg',
  neutral: 'bg-neutral text-on-solid',
};

/**
 * A modal question with answers stacked full width, each in its own color.
 * The answer at `focus` (the first by default) takes focus; Escape and the
 * backdrop pick `onCancel`.
 */
export function ChoiceDialog(props: {
  open: boolean;
  title: string;
  message: ReactNode;
  choices: Choice[];
  onCancel(): void;
  /** Index of the answer that takes focus, such as a safe Cancel. */
  focus?: number;
  variant?: Variant;
}) {
  const { open, title, message, choices, focus = 0, variant = 'desktop' } = props;
  const id = useId();
  const focusRef = useRef<HTMLButtonElement>(null);
  const cancel = useModal(open, props.onCancel, focusRef);
  if (!open) return null;
  const isPhone = variant === 'phone';
  return (
    <Shell
      id={id}
      title={title}
      message={message}
      cancelLabel="Cancel"
      onBackdrop={() => cancel.current()}
      isPhone={isPhone}
    >
      <div className="mt-2 flex flex-col gap-2">
        {choices.map((c, i) => (
          <button
            key={`${c.label}-${c.detail ?? ''}`}
            ref={i === focus ? focusRef : undefined}
            type="button"
            onClick={c.onSelect}
            className={`flex w-full flex-col items-center justify-center rounded-lg px-4 hover:brightness-110 ${TONE[c.tone]} ${isPhone ? 'min-h-12 py-2' : 'min-h-11 py-2'}`}
          >
            <span
              className={isPhone ? 'text-[0.9375rem] font-semibold' : 'text-[14px] font-semibold'}
            >
              {c.label}
            </span>
            {c.detail && (
              <span className={isPhone ? 'text-[0.75rem] opacity-90' : 'text-[11.5px] opacity-90'}>
                {c.detail}
              </span>
            )}
          </button>
        ))}
      </div>
    </Shell>
  );
}
