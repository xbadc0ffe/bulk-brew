import type { Deck } from '@bulk-brew/core';
import { deckFilename, downloadText } from '@bulk-brew/ui';
import type { SheetAction } from './parts.tsx';

/** Copy and download actions for a deck's Export sheet. */
export function exportActions(
  deck: Deck,
  text: () => string,
  onStatus: (s: string) => void,
): SheetAction[] {
  return [
    {
      label: 'Copy as text',
      onSelect: () =>
        void navigator.clipboard.writeText(text()).then(
          () => onStatus('Copied the list.'),
          () => onStatus('Copy failed. Try Download .txt instead.'),
        ),
    },
    { label: 'Download .txt', onSelect: () => downloadText(deckFilename(deck.name), text()) },
  ];
}
