import { useCallback, useRef, useState } from 'react';
import type { PrintingHint } from '@bulk-brew/core';

export interface OpenCard {
  cardId: string;
  printing?: PrintingHint | undefined;
}

export interface CardDetailState {
  current: OpenCard | undefined;
  open(cardId: string, printing?: PrintingHint | undefined): void;
  close(): void;
}

/**
 * Which card the detail panel or sheet is showing. Lives in app state so any
 * screen can open it. Remembers the element that opened it and returns focus
 * there on close.
 */
export function useCardDetail(): CardDetailState {
  const [current, setCurrent] = useState<OpenCard>();
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((cardId: string, printing?: PrintingHint | undefined) => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    setCurrent(printing ? { cardId, printing } : { cardId });
  }, []);

  const close = useCallback(() => {
    setCurrent(undefined);
    const el = opener.current;
    opener.current = null;
    if (el && el.isConnected) el.focus();
  }, []);

  return { current, open, close };
}
