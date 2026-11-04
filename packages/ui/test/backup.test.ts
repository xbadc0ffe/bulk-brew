import { describe, expect, it } from 'vitest';
import type { Backup, Deck } from '@bulk-brew/core';
import { restoreQuestion } from '../src/data/backup.ts';

const deck = { id: 'd', name: 'D' } as Deck;
const full: Backup = {
  schema: 1,
  app: 'bulk-brew',
  exportedAt: '2026-11-04T10:00:00Z',
  dataVersion: '',
  pool: { entries: { a: { cardId: 'a', qty: 3 }, b: { cardId: 'b', qty: 1 } }, updatedAt: '' },
  decks: [deck, deck],
  settings: {
    maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
    unlimitedBasics: true,
    includeUnsets: false,
    showArt: false,
  },
};

describe('restoreQuestion', () => {
  it('names every part it replaces', () => {
    expect(restoreQuestion(full)).toBe(
      'Replace your bulk list with its 4 cards, your decks with its 2 decks, and your settings, from the backup of 2026-11-04?',
    );
  });

  it('names only the chosen parts, and warns that deck cards stay out of the bulk list', () => {
    expect(restoreQuestion(full, { pool: true, decks: false, settings: false })).toBe(
      'Replace your bulk list with its 4 cards, from the backup of 2026-11-04?',
    );
    expect(restoreQuestion(full, { pool: false, decks: true, settings: false })).toMatch(
      /^Replace your decks with its 2 decks, from the backup of 2026-11-04\? Cards in the decks/,
    );
  });

  it('leaves out parts the file lacks and handles an empty deck list', () => {
    const { pool: _pool, settings: _settings, ...rest } = full;
    expect(restoreQuestion({ ...rest, decks: [] })).toMatch(/^Replace your decks with none,/);
  });
});
