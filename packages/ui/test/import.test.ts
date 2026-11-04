import { describe, expect, it } from 'vitest';
import { parseImportText } from '@bulk-brew/core';
import { combineImportTexts } from '../src/data/useImport.ts';

const MANABOX = [
  'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency',
  'Llanowar Elves,M19,Core Set 2019,314,normal,common,3,1,abc,0.1,false,false,near_mint,en,USD',
].join('\n');

describe('combineImportTexts', () => {
  it('keeps a single text as it is, CSV included', () => {
    expect(combineImportTexts(['', MANABOX])).toBe(MANABOX);
    expect(combineImportTexts(['4 Lightning Bolt'])).toBe('4 Lightning Bolt');
  });

  it('adds each text below the last', () => {
    expect(combineImportTexts(['4 Lightning Bolt\n', '2 Shock', '  ', '1 Opt'])).toBe(
      '4 Lightning Bolt\n2 Shock\n1 Opt',
    );
  });

  it('rewrites CSV exports as decklist lines when texts are combined', () => {
    const text = combineImportTexts(['4 Lightning Bolt', MANABOX]);
    expect(text).toBe('4 Lightning Bolt\n3 Llanowar Elves (M19) 314');
    const parsed = parseImportText(text);
    expect(parsed.format).toBe('decklist');
    expect(parsed.lines.map((l) => [l.qty, l.name])).toEqual([
      [4, 'Lightning Bolt'],
      [3, 'Llanowar Elves'],
    ]);
  });
});
