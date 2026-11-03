// Card name normalization. Used to match imported names against the data pack
// regardless of case, punctuation, accents, or which face was written.

/** Normalize a name for lookup: lower case, no accents, plain quotes, single spaces. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/æ/gi, 'ae')
    .replace(/\s*\/\/?\s*/g, ' // ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Split a normalized "a // b" name into its faces. Single-face names return one entry. */
export function splitFaces(normalized: string): string[] {
  return normalized
    .split(' // ')
    .map((s) => s.trim())
    .filter(Boolean);
}
