import { useEffect, useRef, type ReactNode } from 'react';
import { phone } from '@bulk-brew/ui';

// Phone building blocks. Sizes are in rem so they follow the system text size.

export interface TitleAction {
  label: string;
  onClick(): void;
  disabled?: boolean;
}

/** Large title at the top of a tab's root screen. */
export function LargeTitle({ title, action }: { title: string; action?: TitleAction }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-3 pb-2">
      <h1 tabIndex={-1} className="text-[1.375rem] leading-tight font-bold outline-none">
        {title}
      </h1>
      {action && (
        <button
          type="button"
          className="-mb-2 min-h-11 text-[0.9375rem] text-ink disabled:opacity-50"
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </header>
  );
}

/**
 * A screen pushed over a tab: back label, centered title, optional trailing
 * action, scrolling content, and an optional bottom bar. Covers the tab bar.
 */
export function Pushed(props: {
  back: TitleAction;
  title: string;
  action?: TitleAction | undefined;
  bottom?: ReactNode;
  children: ReactNode;
}) {
  const { back, title, action, bottom, children } = props;
  const backRef = useRef<HTMLButtonElement>(null);
  // Focus the back button on open; on close, return to where focus was, or
  // to the screen title when that element is gone.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    backRef.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        if (before?.isConnected && before !== document.body) before.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-30 flex flex-col bg-canvas pt-[env(safe-area-inset-top)] md:left-48"
    >
      <div className="grid min-h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2">
        <button
          ref={backRef}
          type="button"
          className="min-h-11 justify-self-start px-2 text-[0.9375rem] text-fg-1"
          onClick={back.onClick}
        >
          ‹ {back.label}
        </button>
        <h1 className="max-w-[55vw] truncate text-center text-[1rem] font-semibold">{title}</h1>
        {action ? (
          <button
            type="button"
            className="min-h-11 justify-self-end px-2 text-[0.9375rem] text-ink disabled:opacity-50"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {bottom && (
        <div className="shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {bottom}
        </div>
      )}
    </div>
  );
}

export function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      {label && <h2 className={phone.groupLabel}>{label}</h2>}
      <div className={phone.group}>{children}</div>
    </section>
  );
}

/** A grouped-list row. With onClick it is a button with a chevron. */
export function Row(props: {
  label: ReactNode;
  hint?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { label, hint, value, children, onClick, disabled } = props;
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-[0.9375rem]">{label}</span>
        {hint && <span className="text-[0.75rem] text-fg-2">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-[0.8125rem] text-fg-2">{value}</span>}
      {children}
      {onClick && (
        <span aria-hidden className="shrink-0 text-[1.125rem] leading-none text-fg-3">
          ›
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${phone.row} w-full active:bg-surface-2 disabled:opacity-55`}
      >
        {body}
      </button>
    );
  }
  return <div className={phone.row}>{body}</div>;
}

/** Closes on Escape and moves focus into the panel when it opens. */
function useModal(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass inline functions; keep the latest without re-running the effect.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, input, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [open]);
  return panel;
}

/** A bottom sheet with a title row and Done. */
export function Sheet(props: {
  open: boolean;
  onClose(): void;
  title: string;
  lead?: TitleAction;
  children: ReactNode;
}) {
  const { open, onClose, title, lead, children } = props;
  const panel = useModal(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid min-h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2">
          {lead ? (
            <button
              type="button"
              className="min-h-11 justify-self-start px-2 text-[0.9375rem] text-fg-1"
              onClick={lead.onClick}
            >
              {lead.label}
            </button>
          ) : (
            <span />
          )}
          <h2 className="text-[1rem] font-semibold">{title}</h2>
          <button
            type="button"
            className="min-h-11 justify-self-end px-2 text-[0.9375rem] font-medium text-ink"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

export interface SheetAction {
  label: string;
  onSelect(): void;
}

/** A list of actions from the bottom, with Cancel. */
export function ActionSheet(props: {
  open: boolean;
  onClose(): void;
  title: string;
  actions: SheetAction[];
}) {
  const { open, onClose, title, actions } = props;
  const panel = useModal(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex flex-col gap-2 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className={phone.group}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="flex min-h-12 w-full items-center justify-center border-b border-surface-2 text-[1rem] text-ink last:border-b-0 active:bg-surface-2"
              onClick={() => {
                onClose();
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${phone.group} min-h-12 text-[1rem] font-semibold text-ink`}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** A toggle chip for filter choices. */
export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.8125rem] ${
        on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-fg-1'
      }`}
    >
      {children}
    </button>
  );
}

export type TabIconName = 'pool' | 'build' | 'decks' | 'settings';

/** Small inline icons for the tab bar: outline when inactive, filled when active. */
export function TabIcon({ name, filled }: { name: TabIconName; filled: boolean }) {
  const fill = filled ? 'currentColor' : 'none';
  const cut = 'var(--surface2)';
  return (
    <svg
      aria-hidden
      viewBox="0 0 22 22"
      className="size-[1.375rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'pool' && (
        <>
          <rect x="3.5" y="7" width="13" height="11.5" rx="2" fill={fill} />
          <path d="M6.5 4h10a2 2 0 0 1 2 2v9" />
        </>
      )}
      {name === 'build' && (
        <>
          <rect x="3.5" y="3.5" width="15" height="15" rx="3.5" fill={fill} />
          <path d="M11 7.5v7M7.5 11h7" stroke={filled ? cut : 'currentColor'} />
        </>
      )}
      {name === 'decks' && (
        <>
          <rect x="2.5" y="5.5" width="9" height="12.5" rx="1.5" fill={fill} />
          <rect
            x="10.5"
            y="4"
            width="9"
            height="12.5"
            rx="1.5"
            transform="rotate(10 15 10.25)"
            fill={fill}
            stroke={filled ? cut : 'currentColor'}
          />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M11 2.5v2.5M11 17v2.5M2.5 11H5M17 11h2.5M5 5l1.8 1.8M15.2 15.2 17 17M5 17l1.8-1.8M15.2 6.8 17 5" />
          <circle cx="11" cy="11" r="4.5" fill={fill} />
        </>
      )}
    </svg>
  );
}
