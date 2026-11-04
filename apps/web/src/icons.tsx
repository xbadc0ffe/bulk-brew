import type { ReactNode } from 'react';

// Outline icons for the sidebar. They draw in currentColor; card shapes fill
// with --icon-fill so a card in front hides the outline of the one behind.

const GEAR =
  'M25.17 13.16 L28.20 13.27 L28.20 18.73 L25.17 18.84 L24.49 20.48 L26.55 22.70 L22.70 26.55 L20.48 24.49 L18.84 25.17 L18.73 28.20 L13.27 28.20 L13.16 25.17 L11.52 24.49 L9.30 26.55 L5.45 22.70 L7.51 20.48 L6.83 18.84 L3.80 18.73 L3.80 13.27 L6.83 13.16 L7.51 11.52 L5.45 9.30 L9.30 5.45 L11.52 7.51 L13.16 6.83 L13.27 3.80 L18.73 3.80 L18.84 6.83 L20.48 7.51 L22.70 5.45 L26.55 9.30 L24.49 11.52 Z';

function Svg({ children, size }: { children: ReactNode; size: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** One stack: a card with the edges of the cards under it. */
function Stack({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <path d={`M${x + 2} ${y - 4.5}h${w - 4}`} />
      <path d={`M${x + 1} ${y - 2.25}h${w - 2}`} />
      <rect x={x} y={y} width={w} height={h} rx={1.6} />
    </>
  );
}

type Point = [number, number];

/** A path through the points with every corner rounded by r. */
function rounded(points: Point[], r: number, closed: boolean): string {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n]!;
  // The point r along the way from a toward b, at most halfway.
  const toward = (a: Point, b: Point): Point => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.min(r, Math.hypot(dx, dy) / 2) / Math.hypot(dx, dy);
    return [a[0] + dx * t, a[1] + dy * t];
  };
  const f = (p: Point) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
  const corner = (i: number) => {
    const c = at(i);
    return ` L${f(toward(c, at(i - 1)))} Q${f(c)} ${f(toward(c, at(i + 1)))}`;
  };
  if (closed) {
    let d = `M${f(toward(at(0), at(1)))}`;
    for (let i = 1; i <= n; i++) d += corner(i);
    return `${d} Z`;
  }
  let d = `M${f(points[0]!)}`;
  for (let i = 1; i < n - 1; i++) d += corner(i);
  return `${d} L${f(points[n - 1]!)}`;
}

/**
 * A stack of cards lying flat, seen from an angle: the top card's face over
 * the stack's body, with a line per card edge wrapping the front and side.
 * The body is filled so a stack in front hides the ones behind it.
 */
function AngledStack({ x, base, cards }: { x: number; base: number; cards: number }) {
  const w = 10;
  const depth = 5;
  const skew = 4;
  const gap = 4;
  const r = 1.2;
  const top = base - (cards - 1) * gap;
  const back = (y: number): Point => [x + w + skew, y - depth];
  const edge = (y: number): Point[] => [[x, y], [x + w, y], back(y)];
  return (
    <>
      <path
        d={rounded(
          [[x, top], [x + skew, top - depth], back(top), back(base), [x + w, base], [x, base]],
          r,
          true,
        )}
        fill="var(--icon-fill)"
        stroke="none"
      />
      <path d={rounded([[x, top], ...edge(base), back(top)], r, false)} />
      {Array.from({ length: cards - 2 }, (_, i) => (
        <path key={i} d={rounded(edge(top + (i + 1) * gap), r, false)} />
      ))}
      <path
        d={rounded([[x, top], [x + w, top], back(top), [x + skew, top - depth]], r, true)}
        fill="var(--icon-fill)"
      />
    </>
  );
}

/** Bulk List: two stacks of cards at the back, a third in front of them. */
export function StacksIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <AngledStack x={1} base={18.5} cards={3} />
      <AngledStack x={17} base={18.5} cards={3} />
      <AngledStack x={8.8} base={28.5} cards={3} />
    </Svg>
  );
}

/** Build: three cards fanned out. */
export function FanIcon({ size = 28 }: { size?: number }) {
  const card = { x: 10.5, y: 4.5, width: 11, height: 17, rx: 1.6, fill: 'var(--icon-fill)' };
  return (
    <Svg size={size}>
      <rect {...card} transform="rotate(-24 16 30)" />
      <rect {...card} transform="rotate(24 16 30)" />
      <rect {...card} />
    </Svg>
  );
}

/** Decks: a single stack of cards. */
export function StackIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Stack x={8} y={8.5} w={16} h={21} />
    </Svg>
  );
}

export function GearIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d={GEAR} />
      <circle cx={16} cy={16} r={4} />
    </Svg>
  );
}

export function InfoIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx={16} cy={16} r={12.5} />
      <path d="M16 14.5v8" />
      <circle cx={16} cy={10} r={0.6} fill="currentColor" />
    </Svg>
  );
}
