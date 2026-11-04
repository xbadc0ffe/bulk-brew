// Scryfall's symbol images, fetched by scripts/fetch-symbols.mjs.
import SYMBOLS from './symbols/symbols.json';

// Each symbol stays its own file, fetched when first shown and cached by the service worker.
const URLS = import.meta.glob<string>('./symbols/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
});

const INDEX: Record<string, { file: string; name: string } | undefined> = SYMBOLS;

/** Scryfall's image for a symbol such as "W", "2/U", or "T", when one exists. */
export function symbolUrl(symbol: string): string | undefined {
  const entry = INDEX[symbol];
  return entry ? URLS[`./symbols/${entry.file}`] : undefined;
}

/** Plain-language name of a symbol, such as "one white mana". */
export function symbolName(symbol: string): string {
  return INDEX[symbol]?.name ?? `{${symbol}}`;
}
