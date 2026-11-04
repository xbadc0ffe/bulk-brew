import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  parseImportText,
  resolveLines,
  suggestNames,
  toPoolEntries,
  type CardIndex,
  type CardRecord,
  type CsvFormat,
  type ParsedLine,
  type ParseResult,
  type PoolEntry,
  type ResolvedLine,
} from '@bulk-brew/core';
import { readFileText } from '../util/files.ts';
import { colorKey, type ColorKey } from './poolView.ts';

export type ImportFormat = CsvFormat | 'decklist';

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  decklist: 'decklist',
  manabox: 'ManaBox CSV',
  moxfield: 'Moxfield CSV',
  deckbox: 'Deckbox CSV',
  generic: 'CSV',
};

/** A line the card data could not match, with the name as the user last typed it. */
export interface OpenLine {
  line: ParsedLine;
  /** Key for fixes and skips: the line's text, so edits elsewhere do not disturb it. */
  key: string;
  name: string;
}

export interface ImportPreview {
  /** Lines that will be added, fixed lines included. */
  resolved: ResolvedLine[];
  unresolved: OpenLine[];
  /** Copies that will be added. */
  cards: number;
  /** Distinct cards that will be added. */
  distinct: number;
  /** Lines the user skipped. */
  skipped: number;
  /** Copies by color class, for the live breakdown. */
  byColor: Record<ColorKey, number>;
}

export interface ImportState {
  text: string;
  setText(text: string): void;
  /** Add chosen or dropped files to the bottom of the text box. */
  addFiles(files: readonly File[]): Promise<void>;
  parsed: ParseResult;
  format: ImportFormat;
  /** Copies across all readable lines. */
  totalCards: number;
  /** Live check of the text; undefined until there are lines and card data. */
  preview: ImportPreview | undefined;
  /** Try a new name for an unresolved line. */
  editLine(key: string, name: string): void;
  /** Swap in a suggested name. */
  acceptSuggestion(key: string, name: string): void;
  skip(key: string): void;
  skipAll(): void;
  /** Close matches for a name, cached. */
  suggestionsFor(name: string): string[];
  /** Add the matched cards to the pool. Unmatched lines stay in the box. Returns copies added. */
  commit(): number;
  /** The last import, for a confirmation line. */
  done: { cards: number; left: number } | undefined;
  canImport: boolean;
}

const keyOf = (line: ParsedLine) => line.raw.trim();

function lineText(line: ParsedLine, name: string): string {
  const printing = line.set
    ? ` (${line.set.toUpperCase()})${line.collectorNumber ? ` ${line.collectorNumber}` : ''}`
    : '';
  return `${line.qty} ${name}${printing}`;
}

/** A CSV export rewritten as decklist lines, so it can sit next to other text. */
function asDecklist(text: string): string {
  const parsed = parseImportText(text);
  if (parsed.format === 'decklist') return text.trimEnd();
  return [
    ...parsed.lines.map((l) => ({ at: l.line, text: lineText(l, l.name) })),
    ...parsed.skipped.map((l) => ({ at: l.line, text: l.raw })),
  ]
    .sort((a, b) => a.at - b.at)
    .map((l) => l.text)
    .join('\n');
}

/**
 * The text box after adding files: each text goes below the last. One text
 * alone stays as it is; several are joined as decklist lines, because the
 * format is read from the whole box and a CSV header mid-box would break it.
 */
export function combineImportTexts(texts: readonly string[]): string {
  const parts = texts.filter((t) => t.trim() !== '');
  if (parts.length <= 1) return parts[0] ?? '';
  return parts.map(asDecklist).join('\n');
}

export function useImport(
  index: CardIndex | undefined,
  add: (entries: PoolEntry[]) => void,
  opts: { includeUnsets: boolean },
): ImportState {
  const { includeUnsets } = opts;
  const [text, setTextRaw] = useState('');
  /** Lines fixed by an edit or a suggestion, by line text. */
  const [fixed, setFixed] = useState<Map<string, CardRecord>>(new Map());
  /** Edited names that still did not match. */
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ cards: number; left: number }>();
  const suggestions = useRef(new Map<string, string[]>());

  // Parsing and matching follow the text a beat behind, so typing stays smooth.
  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => parseImportText(deferred), [deferred]);
  const totalCards = useMemo(() => parsed.lines.reduce((n, l) => n + l.qty, 0), [parsed]);
  const report = useMemo(
    () =>
      index && parsed.lines.length
        ? resolveLines(parsed.lines, index, { includeUnsets, suggest: false })
        : undefined,
    [index, parsed, includeUnsets],
  );

  const setText = useCallback((t: string) => {
    setTextRaw(t);
    setDone(undefined);
  }, []);

  const addFiles = useCallback(async (files: readonly File[]) => {
    if (files.length === 0) return;
    const texts = await Promise.all(files.map(readFileText));
    setTextRaw((current) => combineImportTexts([current, ...texts]));
    setDone(undefined);
  }, []);

  const preview = useMemo((): ImportPreview | undefined => {
    if (!report) return undefined;
    const resolved: ResolvedLine[] = [...report.resolved];
    const unresolved: OpenLine[] = [];
    let skips = 0;
    for (const u of report.unresolved) {
      const key = keyOf(u.line);
      if (skipped.has(key)) {
        skips += 1;
        continue;
      }
      const card = fixed.get(key);
      if (card) resolved.push({ line: u.line, card });
      else unresolved.push({ line: u.line, key, name: edits.get(key) ?? u.line.name });
    }
    resolved.sort((a, b) => a.line.line - b.line.line);
    const byColor: Record<ColorKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 };
    const ids = new Set<string>();
    let cards = 0;
    for (const r of resolved) {
      cards += r.line.qty;
      ids.add(r.card.id);
      byColor[colorKey(r.card)] += r.line.qty;
    }
    return { resolved, unresolved, cards, distinct: ids.size, skipped: skips, byColor };
  }, [report, fixed, edits, skipped]);

  const suggestionsFor = useCallback(
    (name: string): string[] => {
      if (!index) return [];
      let s = suggestions.current.get(name);
      if (!s) suggestions.current.set(name, (s = suggestNames(index, name)));
      return s;
    },
    [index],
  );

  const editLine = useCallback(
    (key: string, name: string) => {
      if (!index) return;
      const card = index.find(name, includeUnsets ? { includeUnsets: true } : {});
      if (card) setFixed((m) => new Map(m).set(key, card));
      else setEdits((m) => new Map(m).set(key, name));
    },
    [index, includeUnsets],
  );

  const acceptSuggestion = useCallback(
    (key: string, name: string) => {
      // Suggestions come from the whole index, so Un-set names are allowed here.
      const card = index?.find(name, { includeUnsets: true });
      if (card) setFixed((m) => new Map(m).set(key, card));
    },
    [index],
  );

  const skip = useCallback((key: string) => setSkipped((s) => new Set(s).add(key)), []);

  const skipAll = useCallback(() => {
    if (!preview) return;
    setSkipped((s) => {
      const next = new Set(s);
      for (const u of preview.unresolved) next.add(u.key);
      return next;
    });
  }, [preview]);

  const commit = useCallback((): number => {
    // Only import what the user sees: wait for the preview to catch up with the text.
    if (!preview || preview.cards === 0 || deferred !== text) return 0;
    add(toPoolEntries(preview.resolved));
    // Unmatched and unreadable lines stay in the box so they can be fixed
    // and imported next. An edited name is written back as edited.
    const leftover = [
      ...preview.unresolved.map((u) => ({
        at: u.line.line,
        text:
          parsed.format === 'decklist' && u.name === u.line.name
            ? u.line.raw
            : lineText(u.line, u.name),
      })),
      ...parsed.skipped.map((l) => ({ at: l.line, text: l.raw })),
    ]
      .sort((a, b) => a.at - b.at)
      .map((l) => l.text);
    setTextRaw(leftover.join('\n'));
    setFixed(new Map());
    setEdits(new Map());
    setSkipped(new Set());
    setDone({ cards: preview.cards, left: leftover.length });
    return preview.cards;
  }, [preview, parsed.format, parsed.skipped, add, deferred, text]);

  return {
    text,
    setText,
    addFiles,
    parsed,
    format: parsed.format,
    totalCards,
    preview,
    editLine,
    acceptSuggestion,
    skip,
    skipAll,
    suggestionsFor,
    commit,
    done,
    canImport: Boolean(preview && preview.cards > 0 && deferred === text),
  };
}
