import { COLOR_LABELS } from '@bulk-brew/core';
import { Pip } from '../ManaCost.tsx';
import { symbolUrl } from '../symbols.ts';
import type { ColorShare, TypeCount } from '../data/deckStats.ts';

const FILL: Record<string, string> = {
  W: 'var(--pip-w)',
  U: 'var(--pip-u)',
  B: 'var(--pip-b)',
  R: 'var(--pip-r)',
  G: 'var(--pip-g)',
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** A ring segment from angle a0 to a1, clockwise from the top. */
function segment(c: number, outer: number, inner: number, a0: number, a1: number): string {
  const at = (r: number, a: number) =>
    `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${at(outer, a0)} A${outer} ${outer} 0 ${large} 1 ${at(outer, a1)} L${at(inner, a1)} A${inner} ${inner} 0 ${large} 0 ${at(inner, a0)} Z`;
}

/**
 * The deck's colors as a ring, one segment per color by share of colored
 * mana symbols. Segments big enough carry their mana symbol, so color is
 * never the only cue; the legend beside it carries the numbers.
 */
export function ColorWheel({ shares, size = 88 }: { shares: ColorShare[]; size?: number }) {
  const c = size / 2;
  const outer = c - 1;
  const thick = Math.round(size * 0.22);
  const inner = outer - thick;
  const mid = (outer + inner) / 2;
  const icon = thick * 0.78;
  // Each segment starts where the shares before it end.
  const parts = shares.map((s, i) => {
    const a0 = shares.slice(0, i).reduce((t, x) => t + x.share, 0) * Math.PI * 2;
    return { ...s, a0, a1: a0 + s.share * Math.PI * 2 };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={
        shares.length
          ? `Colors: ${shares.map((s) => `${COLOR_LABELS[s.color]} ${pct(s.share)}`).join(', ')}`
          : 'No colored mana symbols'
      }
      className="shrink-0"
    >
      {parts.length <= 1 ? (
        <circle
          cx={c}
          cy={c}
          r={mid}
          fill="none"
          stroke={parts[0] ? FILL[parts[0].color] : 'var(--surface2)'}
          strokeWidth={thick}
        >
          {parts[0] && <title>{`${COLOR_LABELS[parts[0].color]}: 100%`}</title>}
        </circle>
      ) : (
        parts.map((p) => (
          <path
            key={p.color}
            d={segment(c, outer, inner, p.a0, p.a1)}
            fill={FILL[p.color]}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            <title>{`${COLOR_LABELS[p.color]}: ${pct(p.share)} (${p.pips} symbols)`}</title>
          </path>
        ))
      )}
      {/* A hairline edge, so the white segment holds up on a light page. */}
      <circle cx={c} cy={c} r={outer} fill="none" stroke="var(--border2)" strokeWidth={1} />
      <circle cx={c} cy={c} r={inner} fill="none" stroke="var(--border2)" strokeWidth={1} />
      {parts.map((p) => {
        const url = symbolUrl(p.color);
        if (!url || p.share < 0.12) return null;
        const a = (p.a0 + p.a1) / 2;
        return (
          <image
            key={p.color}
            href={url}
            x={c + mid * Math.sin(a) - icon / 2}
            y={c - mid * Math.cos(a) - icon / 2}
            width={icon}
            height={icon}
            aria-hidden
            className="pointer-events-none"
          />
        );
      })}
    </svg>
  );
}

/** The legend beside the wheel: symbol, color name, and share. */
export function ColorShareList({ shares }: { shares: ColorShare[] }) {
  if (shares.length === 0) {
    return <p className="text-[12px] text-fg-2">No colored mana symbols.</p>;
  }
  return (
    <ul className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-2.5 gap-y-1 text-[12.5px]">
      {shares.map((s) => (
        <li key={s.color} className="contents" title={`${s.pips} colored symbols`}>
          <Pip symbol={s.color} size={16} />
          <span className="text-fg-1">{COLOR_LABELS[s.color]}</span>
          <span className="min-w-[4ch] pl-2 text-right font-mono text-[12px] text-ink tabular-nums">
            {pct(s.share)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Wheel and legend side by side. */
export function ColorBreakdown({ shares, size = 88 }: { shares: ColorShare[]; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <ColorWheel shares={shares} size={size} />
      <div className="min-w-0 flex-1">
        <ColorShareList shares={shares} />
      </div>
    </div>
  );
}

/** Copies of each card type: label, bar, count, and share of the deck. */
export function TypeBreakdown({ counts }: { counts: TypeCount[] }) {
  const total = counts.reduce((n, t) => n + t.count, 0);
  const max = Math.max(1, ...counts.map((t) => t.count));
  return (
    <div className="grid grid-cols-[minmax(76px,max-content)_1fr_auto] items-center gap-x-2.5 gap-y-1.5 text-[12.5px]">
      {counts.map((t) => (
        <div key={t.label} className="contents">
          <span className="text-fg-1">{t.label}</span>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-line">
            <span className="block h-full bg-bar" style={{ width: `${(t.count / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-[12px] text-ink tabular-nums">
            {t.count}
            <span className="ml-1.5 inline-block w-[4ch] text-fg-2">
              {pct(total ? t.count / total : 0)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
