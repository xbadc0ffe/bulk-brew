import { useCallback, useMemo, useState } from 'react';
import {
  parseImportText,
  resolveLines,
  toPoolEntries,
  type CardIndex,
  type CsvFormat,
  type ImportReport,
  type ParseResult,
  type PoolEntry,
  type UnresolvedLine,
} from '@bulk-brew/core';
import { readFileText } from '../util/files.ts';

export type ImportFormat = CsvFormat | 'decklist';

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  decklist: 'decklist',
  manabox: 'ManaBox CSV',
  moxfield: 'Moxfield CSV',
  deckbox: 'Deckbox CSV',
  generic: 'CSV',
};

export interface ImportState {
  text: string;
  setText(text: string): void;
  /** Read a chosen file into the text box. */
  loadFile(file: File): Promise<void>;
  parsed: ParseResult;
  /** Which parser handled the text. */
  format: ImportFormat;
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
  const parsed = useMemo(() => parseImportText(text), [text]);

  const setText = useCallback((t: string) => {
    setTextRaw(t);
    setReport(undefined);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setText(await readFileText(file));
    },
    [setText],
  );

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
    loadFile,
    parsed,
    format: parsed.format,
    report,
    addToPool,
    acceptSuggestion,
    canAdd: Boolean(index) && parsed.lines.length > 0,
  };
}
