import { useMemo, useState, type ReactNode } from 'react';
import {
  imageUrl,
  printingImageUrl,
  type CardRecord,
  type ImageFace,
  type ImageSize,
  type PrintingHint,
} from '@bulk-brew/core';

export interface CardImageProps {
  card: CardRecord;
  /** Printing to show when known; falls back to the default printing, then to nothing. */
  printing?: PrintingHint | undefined;
  size?: ImageSize;
  /** The printed side to show; only two-sided cards have a back image. */
  face?: ImageFace;
  className?: string;
  /** Shown instead when no image loads. */
  fallback?: ReactNode;
  /** Called when an image has loaded. */
  onLoad?(): void;
}

/**
 * A Scryfall card image, always shown whole. Sources are tried in order and
 * failures are remembered per URL, so a missing printing degrades quietly.
 */
export function CardImage({
  card,
  printing,
  size = 'normal',
  face = 'front',
  className,
  fallback = null,
  onLoad,
}: CardImageProps) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  const sources = useMemo(() => {
    const list: string[] = [];
    if (printing) list.push(printingImageUrl(printing, card.name, size, face));
    list.push(imageUrl(card.img, size, face));
    return list;
  }, [card, printing, size, face]);
  const src = sources.find((s) => !failed[s]);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={(face === 'back' ? card.faces?.[1]?.name : undefined) ?? card.name}
      loading="lazy"
      decoding="async"
      className={className}
      onLoad={onLoad}
      onError={() => setFailed((f) => ({ ...f, [src]: true }))}
    />
  );
}
