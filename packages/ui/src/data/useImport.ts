import { useCallback, useMemo, useState } from 'react';
import {
  parseDecklist,
  resolveLines,
  toPoolEntries,
  type CardIndex,
  type ImportReport,
  type ParseResult,
  type PoolEntry,
  type UnresolvedLine,
} from '@bulk-brew/core';

export interface ImportState {
  text: string;
  setText(text: string): void;
  parsed: ParseResult;
  /** Set after "Add to pool"; cleared when the text changes. */
  report: ImportReport | undefined;
  /** Parse, resolve, and add every resolved line to the pool. */
  addToPool(): void;
  /** Accept a suggestion for an unresolved line and add that card instead. */
  acceptSuggestion(unresolved: UnresolvedLine, name: string): void;
  canAdd: boolean;
}

export function useImport(
  index: CardIndex | undefined,
  add: (entries: PoolEntry[]) => void,
  includeUnsets = false,
): ImportState {
  const [text, setTextRaw] = useState('');
  const [report, setReport] = useState<ImportReport>();
  const parsed = useMemo(() => parseDecklist(text), [text]);

  const setText = useCallback((t: string) => {
    setTextRaw(t);
    setReport(undefined);
  }, []);

  const addToPool = useCallback(() => {
    if (!index) return;
    const r = resolveLines(parsed.lines, index, { includeUnsets });
    add(toPoolEntries(r.resolved));
    setReport(r);
  }, [index, parsed, add, includeUnsets]);

  const acceptSuggestion = useCallback(
    (unresolved: UnresolvedLine, name: string) => {
      if (!index) return;
      const card = index.find(name, { includeUnsets: true });
      if (!card) return;
      add(toPoolEntries([{ line: unresolved.line, card }]));
      setReport((r) =>
        r
          ? {
              ...r,
              resolved: [...r.resolved, { line: unresolved.line, card }],
              unresolved: r.unresolved.filter((u) => u !== unresolved),
              cardCount: r.cardCount + unresolved.line.qty,
            }
          : r,
      );
    },
    [index, add],
  );

  return {
    text,
    setText,
    parsed,
    report,
    addToPool,
    acceptSuggestion,
    canAdd: Boolean(index) && parsed.lines.length > 0,
  };
}
