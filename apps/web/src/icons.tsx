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

/**
 * A stack of cards lying flat, seen from an angle: the top card's face and,
 * under it, one edge line per card below, like the Decks icon tipped back.
 */
function AngledStack({ x, base, cards }: { x: number; base: number; cards: number }) {
  const w = 8.5;
  const depth = 5;
  const skew = 3.5;
  const gap = 2.7;
  const top = base - (cards - 1) * gap;
  return (
    <>
      {Array.from({ length: cards - 1 }, (_, k) => (
        <path key={k} d={`M${x} ${top + k * gap} v${gap} h${w} l${skew} ${-depth} v${-gap}`} />
      ))}
      <path d={`M${x} ${top} h${w} l${skew} ${-depth} h${-w} Z`} fill="var(--icon-fill)" />
    </>
  );
}

/** Bulk List: three stacks of cards, the tallest at the back. */
export function StacksIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <AngledStack x={10} base={20.5} cards={4} />
      <AngledStack x={1.2} base={30} cards={2} />
      <AngledStack x={18.8} base={30} cards={3} />
    </Svg>
  );
}

/** Build: three cards fanned out. */
export function FanIcon({ size = 28 }: { size?: number }) {
  const card = { x: 11, y: 4, width: 10, height: 15, rx: 1.6, fill: 'var(--icon-fill)' };
  return (
    <Svg size={size}>
      <rect {...card} transform="rotate(-28 16 27)" />
      <rect {...card} transform="rotate(28 16 27)" />
      <rect {...card} />
    </Svg>
  );
}

/** Decks: a single stack of cards. */
export function StackIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Stack x={9} y={10} w={14} h={19} />
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
