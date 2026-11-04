import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { RARITIES, RARITY_LABELS, type Rarity } from '@bulk-brew/core';
import { curveBuckets, viabilityLabel, type Viability } from '../data/analysis.ts';

export type Variant = 'desktop' | 'phone';

export interface SegmentOption<T extends string | number> {
  id: T;
  label: ReactNode;
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string | number>(props: {
  options: SegmentOption<T>[];
  value: T | undefined;
  onChange(value: T): void;
  label: string;
  variant?: Variant;
  /** Equal-width segments across the full width. */
  full?: boolean;
  /** The small form used inside settings rows. */
  compact?: boolean;
  disabled?: boolean;
}) {
  const { options, value, onChange, label, variant = 'desktop', full, compact, disabled } = props;
  const phone = variant === 'phone';
  const outer = phone ? 'rounded-lg' : 'rounded-md';
  const seg = phone
    ? 'flex-1 py-2 text-[0.8125rem]'
    : compact
      ? 'px-2.5 py-[3px] text-[12px]'
      : full
        ? 'flex-1 py-2 text-[13px]'
        : 'px-3 py-1.5 text-[12.5px]';
  return (
    <div
      role="group"
      aria-label={label}
      className={`${full || phone ? 'flex w-full' : 'inline-flex'} overflow-hidden border border-line-strong ${outer}`}
    >
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`${seg} ${i > 0 ? 'border-l border-line-strong' : ''} ${
              on ? 'bg-ink text-on-ink' : 'bg-surface text-fg-1 hover:bg-surface-2'
            } disabled:opacity-50`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch. */
export function Toggle(props: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  variant?: Variant;
  disabled?: boolean;
}) {
  const { checked, onChange, label, variant = 'desktop', disabled } = props;
  const phone = variant === 'phone';
  // The desktop switch overhangs its row by 4px top and bottom, so rows keep their height.
  const track = phone ? 'h-6 w-10 rounded-full' : '-my-1 h-[26px] w-[46px] rounded-[13px]';
  const knob = phone ? 'size-5' : 'size-[22px]';
  const shift = phone ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 ${track} ${checked ? 'bg-ink' : 'bg-line-strong'} disabled:opacity-50`}
    >
      <span
        className={`absolute top-1/2 left-0.5 -translate-y-1/2 rounded-full bg-surface transition-transform ${knob} ${checked ? shift : ''}`}
      />
    </button>
  );
}

/** "− | 4 | +" number control. */
export function Stepper(props: {
  value: number;
  onChange(value: number): void;
  label: string;
  min?: number;
  max?: number;
  variant?: Variant;
  disabled?: boolean;
}) {
  const { value, onChange, label, min = 0, max = 99, variant = 'desktop', disabled } = props;
  const phone = variant === 'phone';
  const btn = phone
    ? 'min-h-11 min-w-11 text-[1rem] text-fg-1 active:bg-surface-2'
    : 'px-2.5 py-[3px] text-[14px] text-fg-1 hover:bg-surface-2';
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className={`${btn} disabled:opacity-40`}
        aria-label={`${label}: one fewer`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output
        aria-live="polite"
        className={`flex items-center justify-center border-x border-line-strong font-mono text-ink tabular-nums ${phone ? 'min-w-11 text-[0.875rem]' : 'min-w-9 px-2 text-[13px]'}`}
      >
        {value}
      </output>
      <button
        type="button"
        className={`${btn} disabled:opacity-40`}
        aria-label={`${label}: one more`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

/** The 8px state dot. Always pair it with a label. */
export function ViabilityDot({ state }: { state: Viability }) {
  const fill = state === 'viable' ? 'bg-ink' : state === 'near' ? 'bg-fg-3' : 'bg-surface';
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full border border-fg-2 ${fill}`}
    />
  );
}

/** Dot, label, and an optional detail line below. */
export function ViabilityMark({
  state,
  detail,
  label,
}: {
  state: Viability;
  detail?: string | undefined;
  /** Overrides the default label ("Viable", "Near miss", "Not enough"). */
  label?: string | undefined;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={`flex items-center gap-1.5 text-[12.5px] ${state === 'none' ? 'text-fg-2' : 'text-ink'}`}
      >
        <ViabilityDot state={state} />
        {label ?? viabilityLabel(state)}
      </span>
      {detail && <span className="text-[11.5px] text-fg-2">{detail}</span>}
    </div>
  );
}

/**
 * Role coverage: label, track, and "have/want". Lays out as three cells of
 * the parent grid, so put several inside a RoleBars and the tracks line up.
 */
export function RoleBar({ label, have, want }: { label: string; have: number; want: number }) {
  const pct = want <= 0 ? (have > 0 ? 100 : 0) : Math.min(100, (have / want) * 100);
  return (
    <div className="contents">
      <span className="text-fg-1">{label}</span>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(want, have)}
        aria-valuenow={have}
        className="h-1.5 overflow-hidden rounded-[3px] bg-line"
      >
        <span className="block h-full bg-ink" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right font-mono text-[12px] tabular-nums">
        {have}/{want}
      </span>
    </div>
  );
}

/** The grid RoleBar rows sit in: label column sized to the longest label. */
export function RoleBars({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(80px,max-content)_1fr_44px] items-center gap-x-2.5 gap-y-1.5">
      {children}
    </div>
  );
}

/** Mana curve bars. Desktop shows counts above the bars; phone is shorter and bare. */
export function CurveChart({ curve, variant = 'desktop' }: { curve: number[]; variant?: Variant }) {
  const buckets = curveBuckets(curve);
  const max = Math.max(1, ...buckets);
  const phone = variant === 'phone';
  const height = phone ? 44 : 72;
  const name = (i: number) => (i === 6 ? '6+' : String(i));
  const summary = buckets.map((n, i) => `${n} at ${name(i)}`).join(', ');
  return (
    <div role="img" aria-label={`Mana curve: ${summary}`} className="flex flex-col gap-1">
      <div className={`flex items-end ${phone ? 'gap-[5px]' : 'gap-1.5'}`} style={{ height }}>
        {buckets.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
            {!phone && <span className="text-[10.5px] text-fg-1 tabular-nums">{n}</span>}
            <div
              className="w-full rounded-t-[2px] bg-bar"
              style={{
                height: `${Math.max(n > 0 ? 3 : 2, (n / max) * (height - (phone ? 0 : 16)))}px`,
              }}
            />
          </div>
        ))}
      </div>
      <div className={`flex ${phone ? 'gap-[5px]' : 'gap-1.5'}`}>
        {buckets.map((_, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-fg-2 ${phone ? 'text-[0.625rem]' : 'text-[10.5px]'}`}
          >
            {name(i)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A button that opens a small menu panel. The panel closes on Escape, on an
 * outside click, and when an item calls `close`.
 */
export function Dropdown(props: {
  label: ReactNode;
  /** Accessible name when the label is not plain text. */
  ariaLabel?: string;
  buttonClassName: string;
  align?: 'left' | 'right';
  children(close: () => void): ReactNode;
}) {
  const { label, ariaLabel, buttonClassName, align = 'left', children } = props;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const buttonId = `${id}-button`;

  // Looked up by id rather than a ref so `close` can be handed to children during render.
  const close = () => {
    setOpen(false);
    document.getElementById(buttonId)?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        document.getElementById(buttonId)?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    wrap.current?.querySelector<HTMLElement>('[data-menu] input, [data-menu] button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, buttonId]);

  return (
    <div ref={wrap} className="relative inline-block">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        className={buttonClassName}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div
          id={id}
          data-menu
          className={`absolute top-full z-30 mt-1 flex max-h-80 min-w-44 flex-col overflow-y-auto rounded-md border border-line-strong bg-surface p-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** A plain menu action. */
export function MenuItem({ children, onSelect }: { children: ReactNode; onSelect(): void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap text-ink hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

/**
 * A drop-down with a checkbox per rarity. At least one stays checked, since
 * building from no rarities can only fail.
 */
export function RarityPicker(props: {
  value: readonly Rarity[];
  onChange(next: Rarity[]): void;
  buttonClassName: string;
  align?: 'left' | 'right';
}) {
  const { value, onChange, buttonClassName, align = 'right' } = props;
  const on = new Set(value);
  const missing = RARITIES.filter((r) => !on.has(r));
  const summary =
    missing.length === 0
      ? 'All rarities'
      : missing.length === 1
        ? `All but ${RARITY_LABELS[missing[0]!]}`
        : RARITIES.filter((r) => on.has(r))
            .map((r) => RARITY_LABELS[r])
            .join(', ');
  return (
    <Dropdown
      label={`${summary} ▾`}
      ariaLabel={`Rarities: ${summary}`}
      buttonClassName={buttonClassName}
      align={align}
    >
      {() =>
        RARITIES.map((r) => (
          <MenuCheck
            key={r}
            checked={on.has(r)}
            disabled={on.has(r) && value.length === 1}
            onToggle={() => {
              const next = RARITIES.filter((x) => (x === r ? !on.has(x) : on.has(x)));
              if (next.length > 0) onChange(next);
            }}
          >
            {RARITY_LABELS[r]}
          </MenuCheck>
        ))
      }
    </Dropdown>
  );
}

/** A menu entry that toggles; the menu stays open. */
export function MenuCheck({
  children,
  checked,
  onToggle,
  disabled = false,
}: {
  children: ReactNode;
  checked: boolean;
  onToggle(): void;
  /** Shown but not toggleable, such as the last checked entry of a set that cannot be empty. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onToggle}
      className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap text-ink ${disabled ? 'cursor-default opacity-60' : 'hover:bg-surface-2'}`}
    >
      <span
        aria-hidden
        className={`flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border border-line-strong text-[10px] ${checked ? 'bg-ink text-on-ink' : 'bg-surface'}`}
      >
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}
