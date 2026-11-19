// Class strings for the shared look, so both apps and packages/ui agree.
// Text sizes are in rem (the design's px / 16), so they follow the Text size
// setting and, on the phone, the system text size.

export const ui = {
  primary:
    'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md bg-ink px-4 py-[7px] text-[0.8125rem] font-semibold text-on-ink hover:opacity-90 disabled:cursor-default disabled:opacity-50',
  secondary:
    'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md border border-line-strong bg-surface px-3 py-[6px] text-[0.8125rem] text-ink hover:bg-surface-2 disabled:cursor-default disabled:opacity-50',
  /** Solid action buttons: Accept, Back, and Export on a deck. */
  go: 'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md bg-go px-4 py-[7px] text-[0.8125rem] font-semibold text-on-solid hover:brightness-110 disabled:cursor-default disabled:opacity-50',
  stop: 'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md bg-stop px-4 py-[7px] text-[0.8125rem] font-semibold text-on-solid hover:brightness-110 disabled:cursor-default disabled:opacity-50',
  neutral:
    'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md bg-neutral px-4 py-[7px] text-[0.8125rem] font-semibold text-on-solid hover:brightness-110 disabled:cursor-default disabled:opacity-50',
  /** Solid blue, for Analyze. */
  info: 'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md bg-info px-4 py-[7px] text-[0.8125rem] font-semibold text-on-solid hover:brightness-110 disabled:cursor-default disabled:opacity-50',
  small:
    'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-[5px] border border-line-strong bg-surface px-2.5 py-[4px] text-[0.75rem] text-ink hover:bg-surface-2 disabled:cursor-default disabled:opacity-50',
  /** The small button for a destructive action, such as Clear all data. */
  smallStop:
    'pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-[5px] border border-stop bg-stop px-2.5 py-[4px] text-[0.75rem] font-semibold text-on-solid hover:brightness-110 disabled:cursor-default disabled:opacity-50',
  /** The main line of a setting or a row with a line of detail under it. */
  label: 'text-[0.8125rem] font-semibold',
  /** The detail line under a label. */
  hint: 'text-[0.71875rem] font-normal text-fg-2',
  quiet: 'text-fg-1 hover:text-ink disabled:cursor-default disabled:opacity-50',
  link: 'text-ink underline underline-offset-2 hover:text-fg-1',
  field:
    'pointer-coarse:min-h-11 rounded-md border border-line-strong bg-surface px-2.5 py-[6px] text-[0.8125rem] text-ink placeholder:text-fg-3',
  sectionLabel: 'text-[0.6875rem] font-semibold tracking-[0.04em] text-fg-2 uppercase',
  /** Card group headings in a decklist: larger than a section label, to read at a glance. */
  deckGroup: 'text-[0.8125rem] font-semibold tracking-[0.04em] text-fg-2 uppercase',
  tag: 'inline-flex items-center rounded bg-surface-2 px-2 py-[3px] text-[0.71875rem] text-fg-1',
  badge:
    'inline-flex items-center rounded bg-surface-2 px-2 py-[2px] text-[0.71875rem] whitespace-nowrap text-fg-1',
  box: 'rounded-lg border border-line bg-surface',
  code: 'rounded-[3px] bg-surface-2 px-[5px] py-px font-mono text-[0.75rem]',
  /** Inline message for errors and empty results, 13px. */
  note: 'text-[0.8125rem] text-fg-2',
  error: 'rounded-md bg-surface-2 px-3 py-2 text-[0.8125rem] text-ink',
} as const;

export const phone = {
  primary:
    'flex h-12 w-full items-center justify-center rounded-xl bg-ink text-[0.9375rem] font-semibold text-on-ink active:opacity-90 disabled:opacity-50',
  secondary:
    'flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-surface text-[0.9375rem] text-ink active:bg-surface-2 disabled:opacity-50',
  field:
    'rounded-lg border border-line-strong bg-surface px-3 py-[0.5625rem] text-[0.875rem] text-ink placeholder:text-fg-3',
  group: 'overflow-hidden rounded-[10px] border border-line bg-surface',
  groupLabel: 'px-1 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.04em] text-fg-2 uppercase',
  row: 'flex min-h-11 items-center gap-3 border-b-1 border-surface-2 px-4 py-2.5 last:border-b-0',
  badge:
    'inline-flex items-center rounded bg-surface-2 px-[0.4375rem] py-0.5 text-[0.6875rem] whitespace-nowrap text-fg-1',
  note: 'text-[0.8125rem] text-fg-2',
  error: 'rounded-lg bg-surface-2 px-3 py-2 text-[0.8125rem] text-ink',
} as const;
