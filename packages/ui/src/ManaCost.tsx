const SYMBOL = /\{([^}]+)\}/g;

export type PipSize = 14 | 15 | 16 | 18 | 20 | 22 | 24;

const SIZE: Record<PipSize, string> = {
  14: 'h-[14px] min-w-[14px] text-[8px]',
  15: 'h-[15px] min-w-[15px] text-[8.5px]',
  16: 'h-4 min-w-4 text-[9px]',
  18: 'h-[18px] min-w-[18px] text-[10px]',
  20: 'h-5 min-w-5 text-[10.5px]',
  22: 'h-[22px] min-w-[22px] text-[11px]',
  24: 'h-6 min-w-6 text-[11px]',
};

const FILL: Record<string, string> = {
  W: 'bg-pip-w text-pip-w-fg',
  U: 'bg-pip-u text-pip-u-fg',
  B: 'bg-pip-b text-pip-b-fg',
  R: 'bg-pip-r text-pip-r-fg',
  G: 'bg-pip-g text-pip-g-fg',
};

/**
 * One mana symbol: a lettered circle, so color is never the only signal.
 * Generic, colorless, and the undesigned hybrid and Phyrexian symbols use the
 * neutral fill; longer symbols widen into a pill.
 */
export function Pip({
  symbol,
  size = 16,
  label,
}: {
  symbol: string;
  size?: PipSize;
  /** Accessible name when the pip stands alone; otherwise it is hidden from screen readers. */
  label?: string | undefined;
}) {
  const fill = FILL[symbol] ?? 'bg-surface-2 text-fg-1';
  const wide = symbol.length > 2 ? 'px-[3px]' : '';
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-fg-3 leading-none font-bold ${SIZE[size]} ${fill} ${wide}`}
    >
      {symbol}
    </span>
  );
}

/** Renders a Scryfall mana cost string like "{1}{G}{G}" as inline symbols. */
export function ManaCost({ cost, size = 16 }: { cost: string | undefined; size?: PipSize }) {
  if (!cost) return null;
  const symbols = Array.from(cost.matchAll(SYMBOL), (m) => m[1] ?? '');
  return (
    <span role="img" className="inline-flex items-center gap-[3px]" aria-label={cost}>
      {symbols.map((s, i) => (
        <Pip key={i} symbol={s} size={size} />
      ))}
    </span>
  );
}
