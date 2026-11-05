// Commander Spellbook's bulk combo file (variants.json.gz) is about 700 MB of
// JSON, too big for one JSON.parse. This reader walks the text once, counting
// braces and brackets and skipping over strings, and hands each element of
// the top-level arrays (variants, aliases) to JSON.parse on its own, along
// with the top-level scalars (timestamp, version).

import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { ROOT } from './corpus.ts';

export const SPELLBOOK_DIR = path.join(ROOT, 'data', 'spellbook');
export const SPELLBOOK_FILE = path.join(SPELLBOOK_DIR, 'variants.json.gz');
export const SPELLBOOK_URL = 'https://json.commanderspellbook.com/variants.json.gz';

/** A top-level scalar (`item` false) or one element of a top-level array (`item` true). */
export interface TopLevelPart {
  key: string;
  item: boolean;
  value: unknown;
}

const SPACE = /\s/;

/** Parse a JSON object's top level from text chunks, one array element at a time. */
export async function* readTopLevel(chunks: AsyncIterable<string>): AsyncGenerator<TopLevelPart> {
  let depth = 0;
  let inString = false;
  let escaped = false;
  // Where the top-level object is: before a key, before its colon, or before its value.
  let state: 'key' | 'colon' | 'value' | 'other' = 'other';
  let key = '';
  let keyParts: string[] | undefined;
  let keyFrom: number;
  let inArray = false;
  // The value being collected: a top-level scalar (depth 1) or an array element (depth 2).
  let piece: string[] | undefined;
  let pieceFrom: number;
  let pieceDepth = 0;
  let pieceScalar = false;
  const out: TopLevelPart[] = [];
  const done = (text: string) => {
    out.push({ key, item: pieceDepth === 2, value: JSON.parse(text) });
    piece = undefined;
  };
  for await (const chunk of chunks) {
    pieceFrom = 0;
    keyFrom = 0;
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') {
          inString = false;
          if (keyParts) {
            keyParts.push(chunk.slice(keyFrom, i));
            key = JSON.parse(`"${keyParts.join('')}"`) as string;
            keyParts = undefined;
            state = 'colon';
          } else if (piece && pieceScalar && depth === pieceDepth) {
            piece.push(chunk.slice(pieceFrom, i + 1));
            done(piece.join(''));
          }
        }
        continue;
      }
      if (SPACE.test(ch)) continue;
      if (!piece) {
        if (depth === 1 && state === 'value') {
          state = 'other';
          if (ch === '[') {
            inArray = true;
            depth = 2;
            continue;
          }
          piece = [];
          pieceFrom = i;
          pieceDepth = 1;
          pieceScalar = ch !== '{';
        } else if (depth === 2 && inArray && ch !== ',' && ch !== ']') {
          piece = [];
          pieceFrom = i;
          pieceDepth = 2;
          pieceScalar = ch !== '{' && ch !== '[';
        }
      }
      if (ch === '"') {
        inString = true;
        if (depth === 1 && state === 'key') {
          keyParts = [];
          keyFrom = i + 1;
        }
      } else if (ch === ':') {
        if (depth === 1 && state === 'colon') state = 'value';
      } else if (ch === '{' || ch === '[') {
        depth++;
        if (depth === 1) state = 'key';
      } else if (ch === '}' || ch === ']') {
        // A scalar ends before its container's closing bracket, a container at its own.
        if (piece && pieceScalar && depth === pieceDepth) {
          piece.push(chunk.slice(pieceFrom, i));
          done(piece.join(''));
        }
        depth--;
        if (piece && !pieceScalar && depth === pieceDepth) {
          piece.push(chunk.slice(pieceFrom, i + 1));
          done(piece.join(''));
        }
        if (inArray && depth === 1) inArray = false;
      } else if (ch === ',') {
        if (piece && pieceScalar && depth === pieceDepth) {
          piece.push(chunk.slice(pieceFrom, i));
          done(piece.join(''));
        }
        if (depth === 1 && !inArray) state = 'key';
      }
      while (out.length) yield out.shift()!;
    }
    if (piece) piece.push(chunk.slice(pieceFrom));
    if (keyParts) keyParts.push(chunk.slice(keyFrom));
  }
}

/** Stream the gzipped bulk file as text chunks. */
export async function* gunzipText(file: string): AsyncGenerator<string> {
  const input = createReadStream(file).pipe(createGunzip());
  input.setEncoding('utf8');
  for await (const chunk of input) yield chunk as string;
}

/** The parts of a Spellbook variant the learning script reads. */
export interface SpellbookVariant {
  id: string;
  status: string;
  spoiler?: boolean;
  uses: {
    card: { oracleId: string; name: string };
    zoneLocations?: string[];
    mustBeCommander?: boolean;
  }[];
  requires: unknown[];
  produces: { feature: { id: number; name: string; status?: string } }[];
  identity: string;
  bracketTag?: string;
  legalities?: Record<string, boolean>;
  manaNeeded?: string;
}
