import { useCallback, useMemo, useState } from 'react';
import {
  isBasicLand,
  parseImportText,
  resolveLines,
  suggestNames,
  toPoolEntries,
  type CardIndex,
  type CardRecord,
  type CsvFormat,
  type ImportReport,
  type ParsedLine,
  type ParseResult,
  type PoolEntry,
  type ResolvedLine,
} from '@bulk-brew/core';
import { readFileText } from '../util/files.ts';

export type ImportFormat = CsvFormat | 'decklist';
export type ImportMode = 'add' | 'replace';

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  decklist: 'decklist',
  manabox: 'ManaBox CSV',
  moxfield: 'Moxfield CSV',
  deckbox: 'Deckbox CSV',
  generic: 'CSV',
};

/** A line the index could not match, with the name as the user last typed it. */
export interface OpenLine {
  line: ParsedLine;
  /** Current text of the editable name field. */
  name: string;
  suggestions: string[];
}

export interface ImportPreview {
  /** Lines that will be added, fixed lines included, basics excluded when not stored. */
  resolved: ResolvedLine[];
  unresolved: OpenLine[];
  /** Copies that will be added. */
  cards: number;
  /** Copies of basic lands left out because basics are unlimited. */
  basics: number;
}

export interface ImportState {
  text: string;
  setText(text: string): void;
  /** Read a chosen or dropped file into the text box. */
  loadFile(file: File): Promise<void>;
  parsed: ParseResult;
  format: ImportFormat;
  /** Copies across all readable lines, for the live count. */
  totalCards: number;
  mode: ImportMode;
  setMode(mode: ImportMode): void;
  /** Set after resolve(); cleared when the text changes or the cards are added. */
  preview: ImportPreview | undefined;
  /** Match the text against the card data without touching the pool. */
  resolve(): void;
  /** Try a new name for an unresolved line. */
  editLine(lineNo: number, name: string): void;
  /** Swap in a suggested name. */
  acceptSuggestion(lineNo: number, name: string): void;
  skip(lineNo: number): void;
  skipAll(): void;
  /** Add (or replace the pool with) the resolved cards. Returns the copies added. */
  commit(): number;
  /** The last commit, for a confirmation line. */
  done: { cards: number; mode: ImportMode } | undefined;
  canResolve: boolean;
}

export interface ImportTarget {
  add(entries: PoolEntry[]): void;
  replace(entries: PoolEntry[]): void;
}

export function useImport(
  index: CardIndex | undefined,
  target: ImportTarget,
  opts: { includeUnsets: boolean; unlimitedBasics: boolean },
): ImportState {
  const { includeUnsets, unlimitedBasics } = opts;
  const [text, setTextRaw] = useState('');
  const [mode, setMode] = useState<ImportMode>('add');
  const [report, setReport] = useState<ImportReport>();
  /** Lines fixed by an edit or a suggestion, by line number. */
  const [fixed, setFixed] = useState<Map<number, CardRecord>>(new Map());
  /** Edited names that still did not match, with fresh suggestions. */
  const [edits, setEdits] = useState<Map<number, { name: string; suggestions: string[] }>>(
    new Map(),
  );
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<{ cards: number; mode: ImportMode }>();
  const parsed = useMemo(() => parseImportText(text), [text]);
  const totalCards = useMemo(() => parsed.lines.reduce((n, l) => n + l.qty, 0), [parsed]);

  const clearReport = useCallback(() => {
    setReport(undefined);
    setFixed(new Map());
    setEdits(new Map());
    setSkipped(new Set());
  }, []);

  const setText = useCallback(
    (t: string) => {
      setTextRaw(t);
      clearReport();
      setDone(undefined);
    },
    [clearReport],
  );

  const loadFile = useCallback(
    async (file: File) => {
      setText(await readFileText(file));
    },
    [setText],
  );

  const resolve = useCallback(() => {
    if (!index) return;
    clearReport();
    setDone(undefined);
    setReport(resolveLines(parsed.lines, index, { includeUnsets }));
  }, [index, parsed, includeUnsets, clearReport]);

  const preview = useMemo((): ImportPreview | undefined => {
    if (!report) return undefined;
    const all: ResolvedLine[] = [...report.resolved];
    const unresolved: OpenLine[] = [];
    for (const u of report.unresolved) {
      const n = u.line.line;
      if (skipped.has(n)) continue;
      const card = fixed.get(n);
      if (card) {
        all.push({ line: u.line, card });
        continue;
      }
      const edit = edits.get(n);
      unresolved.push({
        line: u.line,
        name: edit?.name ?? u.line.name,
        suggestions: edit?.suggestions ?? u.suggestions,
      });
    }
    let basics = 0;
    let cards = 0;
    const resolved: ResolvedLine[] = [];
    for (const r of all) {
      if (unlimitedBasics && isBasicLand(r.card)) {
        basics += r.line.qty;
        continue;
      }
      cards += r.line.qty;
      resolved.push(r);
    }
    resolved.sort((a, b) => a.line.line - b.line.line);
    return { resolved, unresolved, cards, basics };
  }, [report, fixed, edits, skipped, unlimitedBasics]);

  const fix = useCallback((lineNo: number, card: CardRecord) => {
    setFixed((m) => new Map(m).set(lineNo, card));
    setEdits((m) => {
      const next = new Map(m);
      next.delete(lineNo);
      return next;
    });
  }, []);

  const editLine = useCallback(
    (lineNo: number, name: string) => {
      if (!index) return;
      const card = index.find(name, includeUnsets ? { includeUnsets: true } : {});
      if (card) fix(lineNo, card);
      else
        setEdits((m) => new Map(m).set(lineNo, { name, suggestions: suggestNames(index, name) }));
    },
    [index, includeUnsets, fix],
  );

  const acceptSuggestion = useCallback(
    (lineNo: number, name: string) => {
      // Suggestions come from the whole index, so Un-set names are allowed here.
      const card = index?.find(name, { includeUnsets: true });
      if (card) fix(lineNo, card);
    },
    [index, fix],
  );

  const skip = useCallback((lineNo: number) => {
    setSkipped((s) => new Set(s).add(lineNo));
  }, []);

  const skipAll = useCallback(() => {
    if (!preview) return;
    setSkipped((s) => {
      const next = new Set(s);
      for (const u of preview.unresolved) next.add(u.line.line);
      return next;
    });
  }, [preview]);

  const commit = useCallback((): number => {
    if (!preview) return 0;
    const entries = toPoolEntries(preview.resolved);
    if (mode === 'replace') target.replace(entries);
    else target.add(entries);
    setDone({ cards: preview.cards, mode });
    setTextRaw('');
    clearReport();
    return preview.cards;
  }, [preview, mode, target, clearReport]);

  return {
    text,
    setText,
    loadFile,
    parsed,
    format: parsed.format,
    totalCards,
    mode,
    setMode,
    preview,
    resolve,
    editLine,
    acceptSuggestion,
    skip,
    skipAll,
    commit,
    done,
    canResolve: Boolean(index) && parsed.lines.length > 0,
  };
}
