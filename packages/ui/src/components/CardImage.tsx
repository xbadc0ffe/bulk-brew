import { useMemo, useState } from 'react';
import {
  imageUrl,
  printingImageUrl,
  type CardRecord,
  type ImageSize,
  type PrintingHint,
} from '@bulk-brew/core';

export interface CardImageProps {
  card: CardRecord;
  /** Printing to show when known; falls back to the default printing, then to nothing. */
  printing?: PrintingHint | undefined;
  size?: ImageSize;
  className?: string;
}

/**
 * A Scryfall card image, always shown whole. Sources are tried in order and
 * failures are remembered per URL, so a missing printing degrades quietly.
 */
export function CardImage({ card, printing, size = 'normal', className }: CardImageProps) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  const sources = useMemo(() => {
    const list: string[] = [];
    if (printing) list.push(printingImageUrl(printing, card.name, size));
    list.push(imageUrl(card.img, size));
    return list;
  }, [card, printing, size]);
  const src = sources.find((s) => !failed[s]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={card.name}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed((f) => ({ ...f, [src]: true }))}
    />
  );
}
