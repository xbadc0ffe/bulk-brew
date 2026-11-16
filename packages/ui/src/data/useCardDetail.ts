import { useCallback, useRef, useState } from 'react';
import type { PrintingHint } from '@bulk-brew/core';

export interface OpenCard {
  cardId: string;
  printing?: PrintingHint | undefined;
}

export interface CardDetailState {
  current: OpenCard | undefined;
  /** `opener` takes focus on close; by default the element that has focus now. */
  open(cardId: string, printing?: PrintingHint | undefined, opener?: HTMLElement | null): void;
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
    (cardId: string, printing?: PrintingHint | undefined, from?: HTMLElement | null) => {
      const active = document.activeElement;
      opener.current = from !== undefined ? from : active instanceof HTMLElement ? active : null;
      setCurrent(printing ? { cardId, printing } : { cardId });
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
