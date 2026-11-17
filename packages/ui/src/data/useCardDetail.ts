import { useCallback, useRef, useState } from 'react';
import type { Deck, PrintingHint } from '@bulk-brew/core';

export interface OpenCard {
  cardId: string;
  printing?: PrintingHint | undefined;
  /** The deck the card was opened from, so its tags show what it earns there. */
  deck?: Deck | undefined;
}

export interface CardDetailState {
  current: OpenCard | undefined;
  /**
   * `opener` takes focus on close; by default the element that has focus now.
   * `deck` is the deck view the card was opened from, if any.
   */
  open(
    cardId: string,
    printing?: PrintingHint | undefined,
    opener?: HTMLElement | null,
    deck?: Deck | undefined,
  ): void;
  /** Close and return focus to the element that opened the card. */
  close(): void;
  /** Close and leave focus where it is, for another control that was just used. */
  dismiss(): void;
}

/**
 * Which card the detail panel or sheet is showing. Lives in app state so any
 * screen can open it. Remembers the element that opened it and returns focus
 * there on close.
 */
export function useCardDetail(): CardDetailState {
  const [current, setCurrent] = useState<OpenCard>();
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (
      cardId: string,
      printing?: PrintingHint | undefined,
      from?: HTMLElement | null,
      deck?: Deck | undefined,
    ) => {
      const active = document.activeElement;
      opener.current = from !== undefined ? from : active instanceof HTMLElement ? active : null;
      setCurrent({ cardId, ...(printing ? { printing } : {}), ...(deck ? { deck } : {}) });
    },
    [],
  );

  const close = useCallback(() => {
    setCurrent(undefined);
    const el = opener.current;
    opener.current = null;
    if (el && el.isConnected) el.focus();
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(undefined);
    opener.current = null;
  }, []);

  return { current, open, close, dismiss };
}
