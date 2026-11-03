// Collection CSV imports (ManaBox, Moxfield, Deckbox, and a generic fallback)
// producing the same ParseResult shape as the decklist parser, so the rest of
// the import flow does not care where the lines came from.

import { parseDecklist, type ParsedLine, type ParseResult } from './decklist.ts';

/** Split CSV text into rows of fields. Handles quoted fields, doubled quotes, and newlines inside quotes. */
export function parseCsvRows(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const NAME_HEADERS = /^(card ?)?name$/i;
const COUNT_HEADERS = /^(count|quantity|qty|amount|copies)$/i;
// Code-like headers win over plain "Set" or "Edition", which some apps use for the set name.
const SET_CODE_HEADERS = /^(set ?code|set_code|setcode|edition ?code|edition_code)$/i;
const SET_HEADERS = /^(set|edition)$/i;
const NUMBER_HEADERS = /^(collector ?number|card ?number|collector_number|number|cn)$/i;

export type CsvFormat = 'manabox' | 'moxfield' | 'deckbox' | 'generic';

interface Columns {
  format: CsvFormat;
  name: number;
  count: number;
  set: number;
  number: number;
}

function findColumn(headers: string[], re: RegExp): number {
  return headers.findIndex((h) => re.test(h.trim()));
}

function detectColumns(headers: string[]): Columns | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const name = findColumn(headers, NAME_HEADERS);
  const count = findColumn(headers, COUNT_HEADERS);
  if (name < 0 || count < 0) return undefined;
  const code = findColumn(headers, SET_CODE_HEADERS);
  let set = code >= 0 ? code : findColumn(headers, SET_HEADERS);
  const number = findColumn(headers, NUMBER_HEADERS);
  let format: CsvFormat = 'generic';
  if (lower.includes('scryfall id') || lower.includes('manabox id')) format = 'manabox';
  else if (lower.includes('edition') && lower.includes('collector number')) format = 'moxfield';
  else if (lower.includes('edition') && lower.includes('card number')) format = 'deckbox';
  else if (lower.includes('set code') && lower.includes('collector number')) format = 'manabox';
  // Deckbox's Edition column holds the set name, which is no use for art lookups.
  if (format === 'deckbox') set = -1;
  return { format, name, count, set, number };
}

/** The delimiter the header row uses: comma, tab, or semicolon. */
function detectDelimiter(firstLine: string): string {
  const counts: [string, number][] = [
    [',', (firstLine.match(/,/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}

/** Drop a byte order mark some exporters put at the start of the file. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** True when the text starts with a header row naming a card column and a count column. */
export function looksLikeCsv(text: string): boolean {
  const first = stripBom(text)
    .split(/\r?\n/)
    .find((l) => l.trim() !== '');
  if (!first) return false;
  const delimiter = detectDelimiter(first);
  if (!first.includes(delimiter)) return false;
  const headers = parseCsvRows(first, delimiter)[0] ?? [];
  return detectColumns(headers) !== undefined;
}

export interface CsvParseResult extends ParseResult {
  format: CsvFormat;
}

/** Parse a collection export. Never throws; unreadable rows land in `skipped`. */
export function parseCollectionCsv(input: string): CsvParseResult {
  const text = stripBom(input);
  const first = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const delimiter = detectDelimiter(first);
  const rows = parseCsvRows(text, delimiter);
  const headers = rows[0] ?? [];
  const cols = detectColumns(headers);
  const result: CsvParseResult = { format: cols?.format ?? 'generic', lines: [], skipped: [] };
  if (!cols) {
    result.skipped.push({ line: 1, raw: first });
    return result;
  }
  rows.slice(1).forEach((row, i) => {
    const lineNo = i + 2;
    const raw = row.join(delimiter);
    const name = (row[cols.name] ?? '').trim();
    const qty = Number.parseInt((row[cols.count] ?? '').trim(), 10);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      result.skipped.push({ line: lineNo, raw });
      return;
    }
    const parsed: ParsedLine = { line: lineNo, raw, qty, name, section: 'deck' };
    const set = cols.set >= 0 ? (row[cols.set] ?? '').trim().toLowerCase() : '';
    const number = cols.number >= 0 ? (row[cols.number] ?? '').trim() : '';
    if (set) parsed.set = set;
    if (set && number) parsed.collectorNumber = number;
    result.lines.push(parsed);
  });
  return result;
}

/** Route pasted or uploaded text to the CSV or decklist parser. */
export function parseImportText(text: string): ParseResult & { format: CsvFormat | 'decklist' } {
  if (looksLikeCsv(text)) return parseCollectionCsv(text);
  return { ...parseDecklist(text), format: 'decklist' };
}
