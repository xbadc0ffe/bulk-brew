import type { CardRecord } from '@bulk-brew/core';
import { ManaCost, SymbolText } from '../ManaCost.tsx';

/**
 * A card's front face as text laid out in card proportions: name and cost,
 * type line, rules text, and power and toughness or loyalty. Rules text that
 * does not fit fades out at the bottom; `title` carries all of it. `full`
 * lets the card grow so all the text shows.
 */
export function TextCard({
  card,
  full = false,
  className = '',
}: {
  card: CardRecord;
  full?: boolean;
  className?: string;
}) {
  const face = card.faces && card.faces.length > 1 ? card.faces[0]! : card;
  const stats = face.loyalty
    ? `Loyalty ${face.loyalty}`
    : face.power !== undefined || face.toughness !== undefined
      ? `${face.power ?? '?'}/${face.toughness ?? '?'}`
      : undefined;
  const back = card.faces && card.faces.length > 1 ? card.faces[1]!.name : undefined;
  return (
    <div
      title={face.text}
      className={`flex w-full flex-col gap-1.5 overflow-hidden border-2 border-fg-2 bg-surface p-[4%] text-left ${full ? 'min-h-[380px] rounded-[14px]' : 'aspect-[63/88] rounded-[4.75%/3.4%]'} ${className}`}
    >
      <div className="flex items-start justify-between gap-2 rounded-md border border-line-strong bg-surface-2 px-2 py-1.5">
        <span className="text-[13.5px] leading-tight font-semibold">{face.name}</span>
        <span className="shrink-0 pt-px">
          <ManaCost cost={face.manaCost} size={15} />
        </span>
      </div>
      <div className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-[12px] leading-tight font-semibold">
        {face.typeLine}
      </div>
      <div
        className={`relative flex-1 rounded-md border border-line px-2 py-1.5 text-[12px] leading-[1.45] ${full ? '' : 'min-h-0 overflow-hidden'}`}
      >
        {(face.text ?? '').split('\n').map((p, i) => (
          <p key={i} className="mb-1.5 last:mb-0">
            <SymbolText text={p} />
          </p>
        ))}
        {/* Long rules text fades out rather than spilling past the card. */}
        {!full && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent"
          />
        )}
      </div>
      {(stats || back) && (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-fg-2">{back && `Back: ${back}`}</span>
          {stats && (
            <span className="shrink-0 rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 text-[12.5px] font-semibold tabular-nums">
              {stats}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
