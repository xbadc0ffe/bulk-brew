// Charts for the Analyze pane: a color pie with its legend, shaded count
// tables whose rows can be picked, and mana value bars.

import type { ReactNode } from 'react';
import {
  MV_BUCKETS,
  Pip,
  symbolUrl,
  type ColorCounts,
  type ColorKey,
  type PipSize,
} from '@bulk-brew/ui';
import { COLOR_KEY_LABELS, fmt } from './analysisLabels.ts';

const pct = (share: number) =>
  share > 0 && share < 0.005
    ? '<1%'
    : share < 1 && share > 0.995
      ? '>99%'
      : `${Math.round(share * 100)}%`;

const FILL: Record<ColorKey, string> = {
  W: 'var(--pip-w)',
  U: 'var(--pip-u)',
  B: 'var(--pip-b)',
  R: 'var(--pip-r)',
  G: 'var(--pip-g)',
  C: 'var(--pip-c)',
  M: 'var(--pip-m)',
};

/** A color class's mark: its mana symbol, or a gold dot for multicolor. */
export function ColorMark({ id, size = 14 }: { id: ColorKey; size?: PipSize }) {
  if (id !== 'M') return <Pip symbol={id} size={size} />;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full border border-line-strong"
      style={{ width: size, height: size, background: FILL.M }}
    />
  );
}

/** A point on the circle around (c, c), clockwise from the top. */
const point = (c: number, r: number, a: number) => ({
  x: c + r * Math.sin(a),
  y: c - r * Math.cos(a),
});
const at = (c: number, r: number, a: number) => {
  const p = point(c, r, a);
  return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
};

/**
 * Copies per color class as a pie, with a legend of each color's share and
 * count under it. Slices big enough carry their mana symbol, so color is
 * never the only cue.
 */
export function ColorPie(props: { counts: ColorCounts; keys: readonly ColorKey[]; size?: number }) {
  const { counts, keys, size = 150 } = props;
  const shown = keys.filter((k) => counts[k] > 0);
  const total = shown.reduce((n, k) => n + counts[k], 0);
  const c = size / 2;
  const r = c - 1;
  const icon = size * 0.13;
  // Each slice starts where the shares before it end.
  const shares = shown.map((k) => counts[k] / total);
  const slices = shown.map((k, i) => {
    const a0 = shares.slice(0, i).reduce((t, x) => t + x, 0) * Math.PI * 2;
    return { k, share: shares[i]!, a0, a1: a0 + shares[i]! * Math.PI * 2 };
  });
  const describe = shown.map((k) => `${COLOR_KEY_LABELS[k]} ${pct(counts[k] / total)}`).join(', ');
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={total ? `Colors: ${describe}` : 'No cards'}
        className="shrink-0"
      >
        {slices.length <= 1 ? (
          <circle cx={c} cy={c} r={r} fill={slices[0] ? FILL[slices[0].k] : 'var(--surface2)'} />
        ) : (
          slices.map((s) => (
            <path
              key={s.k}
              d={`M${c} ${c} L${at(c, r, s.a0)} A${r} ${r} 0 ${s.a1 - s.a0 > Math.PI ? 1 : 0} 1 ${at(c, r, s.a1)} Z`}
              fill={FILL[s.k]}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <title>{`${COLOR_KEY_LABELS[s.k]}: ${pct(s.share)}, ${fmt(counts[s.k])}`}</title>
            </path>
          ))
        )}
        {/* A hairline edge, so the white slice holds up on a light page. */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border2)" strokeWidth={1} />
        {slices.map((s) => {
          const url = s.k === 'M' ? undefined : symbolUrl(s.k);
          if (!url || s.share < 0.07) return null;
          // A lone slice is the whole pie, so its symbol sits in the middle.
          const { x, y } =
            slices.length <= 1 ? { x: c, y: c } : point(c, r * 0.62, (s.a0 + s.a1) / 2);
          return (
            <image
              key={s.k}
              href={url}
              x={x - icon / 2}
              y={y - icon / 2}
              width={icon}
              height={icon}
              aria-hidden
              className="pointer-events-none"
            />
          );
        })}
      </svg>
      <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-1 text-[12.5px]">
        {shown.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <ColorMark id={k} />
            <span className="text-fg-1">{COLOR_KEY_LABELS[k]}</span>
            <span className="ml-auto font-mono text-[12px] text-ink tabular-nums">
              {pct(counts[k] / total)}
            </span>
            <span className="min-w-[5ch] text-right font-mono text-[12px] text-fg-2 tabular-nums">
              {fmt(counts[k])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shade for a cell holding `share` of the table's largest value. */
function shade(share: number): string | undefined {
  if (share <= 0) return undefined;
  return `color-mix(in oklch, var(--bar) ${Math.round(10 + 45 * share)}%, transparent)`;
}

const PICKED =
  'outline-2 outline-offset-1 outline-info shadow-[0_0_8px_color-mix(in_oklch,var(--info)_45%,transparent)]';

export interface HeatColumn {
  key: string;
  head: ReactNode;
  label: string;
}

export interface HeatRow {
  key: string;
  label: ReactNode;
  values: number[];
}

/**
 * Counts in a grid, each cell shaded by its size so the deep spots stand
 * out; the number is always printed, so the shade is never the only cue.
 * With `onPick`, rows toggle on click and picked rows get a blue outline;
 * picking the footer clears the picks.
 */
export function HeatTable(props: {
  caption: string;
  /** What the rows are, such as "Role", for screen readers. */
  rowHead: string;
  columns: HeatColumn[];
  rows: HeatRow[];
  footer?: { label: string; values: number[] };
  picked?: ReadonlySet<string>;
  onPick?(key: string | undefined): void;
}) {
  const { caption, rowHead, columns, rows, footer, picked, onPick } = props;
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const rowClass = (on: boolean) =>
    `col-span-full grid grid-cols-subgrid items-center rounded-[5px] ${onPick ? 'cursor-pointer' : ''} ${on ? `relative z-[1] ${PICKED}` : ''}`;
  // The button carries the row's pressed state and keyboard access; a click anywhere on
  // the row reaches the row's handler, so the button needs none of its own.
  const head = (label: ReactNode, on: boolean, bold = false) => (
    <span
      role="rowheader"
      className={`pr-2 pl-1 text-left whitespace-nowrap text-fg-1 ${bold ? 'font-semibold' : ''}`}
    >
      {onPick ? (
        <button type="button" aria-pressed={on} className="text-left">
          {label}
        </button>
      ) : (
        label
      )}
    </span>
  );
  return (
    <div className="-mx-2 overflow-x-auto px-2 py-1">
      <div
        role="table"
        aria-label={caption}
        className="grid gap-[3px] text-[12px] tabular-nums"
        style={{
          gridTemplateColumns: `max-content repeat(${columns.length}, minmax(2rem, 1fr)) max-content`,
        }}
      >
        <div role="row" className="col-span-full grid grid-cols-subgrid">
          <span role="columnheader">
            <span className="sr-only">{rowHead}</span>
          </span>
          {columns.map((c) => (
            <span
              key={c.key}
              role="columnheader"
              aria-label={c.label}
              className="flex justify-center pb-1 font-semibold text-fg-2"
            >
              {c.head}
            </span>
          ))}
          <span role="columnheader" className="pb-1 pl-2 text-right font-semibold text-fg-2">
            Total
          </span>
        </div>
        {rows.map((r) => {
          const on = picked?.has(r.key) ?? false;
          return (
            <div
              key={r.key}
              role="row"
              className={rowClass(on)}
              onClick={onPick ? () => onPick(r.key) : undefined}
            >
              {head(r.label, on)}
              {r.values.map((v, i) => (
                <span
                  key={columns[i]!.key}
                  role="cell"
                  className={`flex h-7 items-center justify-center rounded-[3px] ${v > 0 ? 'text-ink' : 'text-fg-3'}`}
                  style={{ background: shade(v / max) }}
                >
                  {fmt(v)}
                </span>
              ))}
              <span role="cell" className="pr-1 pl-2 text-right font-semibold text-ink">
                {fmt(sum(r.values))}
              </span>
            </div>
          );
        })}
        {footer && (
          <div
            role="row"
            className={`${rowClass(Boolean(onPick) && (picked?.size ?? 0) === 0)} min-h-7`}
            onClick={onPick ? () => onPick(undefined) : undefined}
          >
            {head(footer.label, (picked?.size ?? 0) === 0, true)}
            {footer.values.map((v, i) => (
              <span
                key={columns[i]!.key}
                role="cell"
                className="text-center font-semibold text-ink"
              >
                {fmt(v)}
              </span>
            ))}
            <span role="cell" className="pr-1 pl-2 text-right font-semibold text-ink">
              {fmt(sum(footer.values))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Copies at each mana value as bars, each with its mana value and count under it. */
export function ManaValueBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const height = 110;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[12.5px] font-semibold text-fg-1">{label}</figcaption>
      <div
        role="img"
        aria-label={`${label}: ${values.map((n, i) => `${fmt(n)} at mana value ${MV_BUCKETS[i]}`).join(', ')}`}
        className="grid grid-cols-7 gap-2"
      >
        {values.map((n, i) => (
          <div key={MV_BUCKETS[i]} className="flex flex-col items-center">
            <div className="flex w-full items-end border-b border-line" style={{ height }}>
              <div
                className="w-full rounded-t-[3px] bg-bar"
                style={{ height: `${n > 0 ? Math.max(3, (n / max) * height) : 0}px` }}
              />
            </div>
            <span className="pt-1 text-[12px] font-semibold text-fg-1">{MV_BUCKETS[i]}</span>
            <span className="text-[11.5px] text-fg-2 tabular-nums">{fmt(n)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
