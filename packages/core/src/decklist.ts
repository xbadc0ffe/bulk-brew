// Decklist text parsing. Accepts the common export formats (Arena, MTGO,
// Moxfield, Archidekt, plain "4 Lightning Bolt" lists) and keeps the set code
// and collector number when present, purely as an art hint.

export interface ParsedLine {
  /** 1-based line number in the input. */
  line: number;
  raw: string;
  qty: number;
  name: string;
  set?: string;
  collectorNumber?: string;
  /** Section header the line sits under (deck, sideboard, commander, ...). */
  section: string;
}

export interface ParseResult {
  lines: ParsedLine[];
  /** Lines that looked like cards but could not be read. */
  skipped: { line: number; raw: string }[];
}

const SECTION_HEADERS = new Set([
  'deck',
  'main',
  'mainboard',
  'main deck',
  'sideboard',
  'side',
  'commander',
  'companion',
  'maybeboard',
  'maybe',
  'tokens',
  'token',
]);

// "4 Name", "4x Name", "4  Name (SET) 123 *F*"
const LEADING_QTY = /^(\d+)\s*[xX]?\s+(.+)$/;
// "Name x4"
const TRAILING_QTY = /^(.+?)\s+[xX](\d+)$/;
// "(M10) 146", "(m10)", "[M10] 146", "(PLST) M10-146"
const PRINTING = /\s*[([]([A-Za-z0-9]{2,6})[)\]]\s*([A-Za-z0-9-]+\S*)?\s*$/;
// Foil and tag markers some exporters append.
const MARKERS = /\s*(\*F\*|\*E\*|\(F\)|\[F\]|#\S*|\^[^^]*\^)\s*$/i;

/** Parse decklist text into quantities and names. Never throws. */
export function parseDecklist(text: string): ParseResult {
  const lines: ParsedLine[] = [];
  const skipped: { line: number; raw: string }[] = [];
  let section = 'deck';

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    let s = raw.trim();
    if (s === '' || s.startsWith('//') || s.startsWith('#')) return;

    const header = s.replace(/[:\s]+$/, '').toLowerCase();
    if (SECTION_HEADERS.has(header)) {
      section = header;
      return;
    }
    // "Sideboard (15)" style headers
    const headerWithCount = /^([A-Za-z ]+?)\s*\(\d+\)$/.exec(s);
    if (headerWithCount && SECTION_HEADERS.has(headerWithCount[1]!.toLowerCase())) {
      section = headerWithCount[1]!.toLowerCase();
      return;
    }

    // Strip trailing markers like *F* (foil) or ^Tags^ until none remain.
    let prev = '';
    while (prev !== s) {
      prev = s;
      s = s.replace(MARKERS, '');
    }

    let qty = 1;
    let rest = s;
    const lead = LEADING_QTY.exec(s);
    if (lead) {
      qty = Number(lead[1]);
      rest = lead[2]!;
    } else {
      const trail = TRAILING_QTY.exec(s);
      if (trail) {
        qty = Number(trail[2]);
        rest = trail[1]!;
      }
    }

    let set: string | undefined;
    let collectorNumber: string | undefined;
    const printing = PRINTING.exec(rest);
    if (printing) {
      set = printing[1]!.toLowerCase();
      if (printing[2]) collectorNumber = printing[2];
      rest = rest.slice(0, printing.index);
    }

    const name = rest.trim();
    if (!name || /^\d+$/.test(name) || !Number.isFinite(qty) || qty <= 0) {
      skipped.push({ line: lineNo, raw });
      return;
    }

    const parsed: ParsedLine = { line: lineNo, raw, qty, name, section };
    if (set) parsed.set = set;
    if (collectorNumber) parsed.collectorNumber = collectorNumber;
    lines.push(parsed);
  });

  return { lines, skipped };
}
