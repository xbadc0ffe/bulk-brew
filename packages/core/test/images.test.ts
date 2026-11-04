import { describe, expect, it } from 'vitest';
import { hasBackImage, imageUrl, printingImageUrl } from '../src/images.ts';

describe('card images', () => {
  it('builds front and back image URLs', () => {
    expect(imageUrl('0dbaef61-fa39', 'normal')).toBe(
      'https://cards.scryfall.io/normal/front/0/d/0dbaef61-fa39.jpg',
    );
    expect(imageUrl('0dbaef61-fa39', 'small', 'back')).toBe(
      'https://cards.scryfall.io/small/back/0/d/0dbaef61-fa39.jpg',
    );
    const hint = { set: 'MID', collectorNumber: '7' };
    expect(printingImageUrl(hint, 'X', 'normal')).toBe(
      'https://api.scryfall.com/cards/mid/7?format=image&version=normal',
    );
    expect(printingImageUrl(hint, 'X', 'normal', 'back')).toBe(
      'https://api.scryfall.com/cards/mid/7?format=image&version=normal&face=back',
    );
  });

  it('knows which layouts have a back image', () => {
    expect(hasBackImage({ layout: 'transform' })).toBe(true);
    expect(hasBackImage({ layout: 'modal_dfc' })).toBe(true);
    // Split, adventure, and flip cards print both halves on one image.
    for (const layout of ['normal', 'split', 'adventure', 'flip', 'meld', 'prepare'])
      expect(hasBackImage({ layout })).toBe(false);
  });
});
