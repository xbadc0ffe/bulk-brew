import { describe, expect, it } from 'vitest';
import { looksLikeCsv, parseCollectionCsv, parseCsvRows, parseImportText } from '../src/csv.ts';

const MANABOX = [
  'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency',
  'High-Flying Ace,TMT,Teenage Mutant Ninja Turtles,9,normal,common,3,12345,0a1b2c3d-0000-0000-0000-000000000001,0.05,false,false,near_mint,en,USD',
  '"Jennika, Bad Apple Big Sister",TMT,Teenage Mutant Ninja Turtles,203,foil,rare,1,12346,0a1b2c3d-0000-0000-0000-000000000002,1.00,false,false,near_mint,en,USD',
].join('\n');

const MOXFIELD = [
  '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"',
  '"4","0","Lightning Bolt","m10","Near Mint","English","","","2026-01-01 10:00:00.000000","146","False","False",""',
  '"1","0","Fire // Ice","apc","Near Mint","English","foil","","2026-01-01 10:00:00.000000","128","False","False",""',
].join('\n');

const DECKBOX = [
  'Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil,Signed,Artist Proof,Altered Art,Misprint,Promo,Textless,Printing Id,Printing Note,Tags,My Price',
  '2,0,Llanowar Elves,Dominaria,168,Near Mint,English,,,,,,,,,,,',
  '0,0,Giant Growth,Dominaria,163,Near Mint,English,,,,,,,,,,,',
].join('\n');

const TCGPLAYER = [
  'Quantity,Name,Simple Name,Set,Set Code,Card Number,Rarity,Condition',
  '3,Counterspell,Counterspell,Modern Horizons 2,MH2,267,Common,Near Mint',
].join('\n');

describe('parseCsvRows', () => {
  it('handles quotes, doubled quotes, and newlines inside quotes', () => {
    const rows = parseCsvRows('a,"b, c","say ""hi""","multi\nline"\n1,2,3,4');
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"', 'multi\nline'],
      ['1', '2', '3', '4'],
    ]);
  });
});

describe('parseCollectionCsv', () => {
  it('reads ManaBox exports with set codes and collector numbers', () => {
    const r = parseCollectionCsv(MANABOX);
    expect(r.format).toBe('manabox');
    expect(r.lines).toEqual([
      expect.objectContaining({
        qty: 3,
        name: 'High-Flying Ace',
        set: 'tmt',
        collectorNumber: '9',
      }),
      expect.objectContaining({
        qty: 1,
        name: 'Jennika, Bad Apple Big Sister',
        set: 'tmt',
        collectorNumber: '203',
      }),
    ]);
    expect(r.skipped).toHaveLength(0);
  });

  it('reads Moxfield exports', () => {
    const r = parseCollectionCsv(MOXFIELD);
    expect(r.format).toBe('moxfield');
    expect(r.lines.map((l) => [l.qty, l.name, l.set, l.collectorNumber])).toEqual([
      [4, 'Lightning Bolt', 'm10', '146'],
      [1, 'Fire // Ice', 'apc', '128'],
    ]);
  });

  it('reads Deckbox exports without a set, since Edition is a set name', () => {
    const r = parseCollectionCsv(DECKBOX);
    expect(r.format).toBe('deckbox');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ qty: 2, name: 'Llanowar Elves' });
    expect(r.lines[0]?.set).toBeUndefined();
    expect(r.lines[0]?.collectorNumber).toBeUndefined();
    expect(r.skipped.map((s) => s.line)).toEqual([3]);
  });

  it('prefers a code-like header when a file has both Set and Set Code', () => {
    const r = parseCollectionCsv(TCGPLAYER);
    expect(r.format).toBe('generic');
    expect(r.lines[0]).toMatchObject({
      qty: 3,
      name: 'Counterspell',
      set: 'mh2',
      collectorNumber: '267',
    });
  });

  it('falls back to any name and quantity columns, including tab-separated files', () => {
    const r = parseCollectionCsv('Qty\tCard Name\tNotes\n3\tCounterspell\tkeep\n');
    expect(r.format).toBe('generic');
    expect(r.lines[0]).toMatchObject({ qty: 3, name: 'Counterspell' });
    expect(r.lines[0]?.set).toBeUndefined();
  });

  it('accepts CRLF line endings, a byte order mark, and semicolon delimiters', () => {
    const crlf = parseCollectionCsv(MANABOX.replace(/\n/g, '\r\n'));
    expect(crlf.lines).toHaveLength(2);
    expect(crlf.lines[1]?.name).toBe('Jennika, Bad Apple Big Sister');

    const bom = parseCollectionCsv('﻿' + MOXFIELD);
    expect(bom.format).toBe('moxfield');
    expect(bom.lines[0]?.qty).toBe(4);
    expect(looksLikeCsv('﻿' + MOXFIELD)).toBe(true);

    const semi = parseCollectionCsv('Count;Name;Set Code\n2;Giant Growth;dom\n');
    expect(semi.lines[0]).toMatchObject({ qty: 2, name: 'Giant Growth', set: 'dom' });
  });

  it('reports a file with no usable header', () => {
    const r = parseCollectionCsv('foo,bar\n1,2');
    expect(r.lines).toHaveLength(0);
    expect(r.skipped).toHaveLength(1);
  });
});

describe('looksLikeCsv and parseImportText', () => {
  it('tells CSV from decklist text', () => {
    expect(looksLikeCsv(MANABOX)).toBe(true);
    expect(looksLikeCsv(MOXFIELD)).toBe(true);
    expect(
      looksLikeCsv('4 Lightning Bolt (M10) 146\n1 Jennika, Bad Apple Big Sister (TMT) 203'),
    ).toBe(false);
    expect(looksLikeCsv('')).toBe(false);
  });

  it('routes to the right parser', () => {
    expect(parseImportText(MOXFIELD).format).toBe('moxfield');
    const d = parseImportText('4 Lightning Bolt');
    expect(d.format).toBe('decklist');
    expect(d.lines[0]?.qty).toBe(4);
  });
});
