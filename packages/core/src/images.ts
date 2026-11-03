// Scryfall image URL helpers. Images are never bundled; the app loads them on
// demand from Scryfall's image host and the device caches them.
// Rules: never crop, distort, recolor, or watermark card images.

import type { PrintingHint } from './types.ts';

export type ImageSize = 'small' | 'normal' | 'large';

/** Image of the default printing stored in the data pack. */
export function imageUrl(printingId: string, size: ImageSize = 'normal'): string {
  const a = printingId.charAt(0);
  const b = printingId.charAt(1);
  return `https://cards.scryfall.io/${size}/front/${a}/${b}/${printingId}.jpg`;
}

/**
 * Image of a specific printing named by set code and collector number, used
 * when an import line carried one. Resolves through the Scryfall API, which
 * redirects to the image host. Callers fall back to imageUrl() on failure.
 */
export function printingImageUrl(
  hint: PrintingHint,
  cardName: string,
  size: ImageSize = 'normal',
): string {
  const set = encodeURIComponent(hint.set.toLowerCase());
  if (hint.collectorNumber) {
    const num = encodeURIComponent(hint.collectorNumber);
    return `https://api.scryfall.com/cards/${set}/${num}?format=image&version=${size}`;
  }
  const exact = encodeURIComponent(cardName);
  return `https://api.scryfall.com/cards/named?exact=${exact}&set=${set}&format=image&version=${size}`;
}
