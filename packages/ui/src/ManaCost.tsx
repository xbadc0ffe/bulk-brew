import { Fragment } from 'react';
import { symbolName, symbolUrl } from './symbols.ts';

const SYMBOL = /\{([^}]+)\}/g;
const SPLIT = /(\{[^}]+\})/;
// The small offset shadow Scryfall itself uses, so light symbols hold up on light backgrounds.
const SHADOW = '[filter:drop-shadow(-1px_1px_0_rgb(0_0_0/0.8))]';

export type PipSize = 14 | 15 | 16 | 18 | 20 | 22 | 24 | 28 | 32;

const SIZE: Record<PipSize, string> = {
  14: 'h-[14px] min-w-[14px] text-[8px]',
  15: 'h-[15px] min-w-[15px] text-[8.5px]',
  16: 'h-4 min-w-4 text-[9px]',
  18: 'h-[18px] min-w-[18px] text-[10px]',
  20: 'h-5 min-w-5 text-[10.5px]',
  22: 'h-[22px] min-w-[22px] text-[11px]',
  24: 'h-6 min-w-6 text-[11px]',
  28: 'h-7 min-w-7 text-[12px]',
  32: 'h-8 min-w-8 text-[13px]',
};

/**
 * One symbol, drawn with Scryfall's image. A symbol Scryfall does not have
 * falls back to a lettered circle.
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
  const url = symbolUrl(symbol);
  if (url) {
    return (
      <img
        src={url}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        draggable={false}
        style={{ height: size }}
        className={`inline-block w-auto shrink-0 select-none ${SHADOW}`}
      />
    );
  }
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-fg-3 bg-surface-2 px-[3px] leading-none font-bold text-fg-1 ${SIZE[size]}`}
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
    <span
      role="img"
      className="inline-flex items-center gap-[2px]"
      aria-label={symbols.map(symbolName).join(', ')}
    >
      {symbols.map((s, i) => (
        <Pip key={i} symbol={s} size={size} />
      ))}
    </span>
  );
}

/** Rules text with each {X} drawn as its symbol, sized to the text. */
export function SymbolText({ text }: { text: string }) {
  return (
    <>
      {text.split(SPLIT).map((part, i) => {
        const m = /^\{([^}]+)\}$/.exec(part);
        const url = m ? symbolUrl(m[1]!) : undefined;
        if (!m || !url) return <Fragment key={i}>{part}</Fragment>;
        return (
          <img
            key={i}
            src={url}
            alt={symbolName(m[1]!)}
            draggable={false}
            className={`mx-px inline-block h-[0.95em] w-auto align-[-0.12em] select-none ${SHADOW}`}
          />
        );
      })}
    </>
  );
}
