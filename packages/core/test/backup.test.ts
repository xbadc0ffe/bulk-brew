import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup } from '../src/backup.ts';
import { addToPool, emptyPool } from '../src/pool.ts';
import type { Deck, Settings } from '../src/types.ts';

const T = '2026-03-03T00:00:00Z';
const settings: Settings = {
  maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
  unlimitedBasics: true,
  includeUnsets: false,
  showArt: false,
};
const deck: Deck = {
  id: 'd1',
  name: 'Test',
  size: 40,
  color: 'R',
  archetype: 'aggro',
  cards: [{ cardId: 'bolt', qty: 4, printing: { set: 'm10', collectorNumber: '146' } }],
  basics: { R: 17 },
  committed: true,
  createdAt: T,
  configVersion: 'x',
  dataVersion: '2026-01-01',
};

const base = {
  schema: 1,
  app: 'bulk-brew',
  exportedAt: T,
  settings: { maxCopies: {} },
  decks: [] as unknown[],
  pool: { entries: {} as Record<string, unknown> },
};
const withDeck = (d: Record<string, unknown>) => JSON.stringify({ ...base, decks: [d] });
const goodDeck = { id: 'd', name: 'n', size: 60, color: 'R', cards: [], basics: {} };

describe('backup', () => {
  it('round trips pool, decks, and settings', () => {
    const pool = addToPool(emptyPool(T), [{ cardId: 'bolt', qty: 4, printing: { set: 'm10' } }], T);
    const json = exportBackup({ pool, decks: [deck], settings, dataVersion: '2026-01-01' }, T);
    const back = parseBackup(json);
    expect(back.exportedAt).toBe(T);
    expect(back.pool).toEqual(pool);
    expect(back.decks).toEqual([deck]);
    expect(back.settings).toEqual(settings);
    expect(back.dataVersion).toBe('2026-01-01');
  });

  it('exports and reads back any of the parts alone', () => {
    const pool = addToPool(emptyPool(T), [{ cardId: 'bolt', qty: 4 }], T);
    const onlyPool = parseBackup(exportBackup({ pool, dataVersion: 'v' }, T));
    expect(onlyPool.pool).toEqual(pool);
    expect('decks' in onlyPool || 'settings' in onlyPool).toBe(false);
    const onlyDecks = parseBackup(exportBackup({ decks: [deck], dataVersion: 'v' }, T));
    expect(onlyDecks.decks).toEqual([deck]);
    expect('pool' in onlyDecks).toBe(false);
    // A deck list may be empty; that still counts as the decks part.
    expect(parseBackup(exportBackup({ decks: [], dataVersion: 'v' }, T)).decks).toEqual([]);
    expect(() =>
      parseBackup(JSON.stringify({ schema: 1, app: 'bulk-brew', exportedAt: T })),
    ).toThrow(/no bulk list, decks, or settings/);
  });

  it('keeps only known rarities and drops an empty or unusable list', () => {
    const parse = (rarities: unknown) =>
      parseBackup(JSON.stringify({ ...base, settings: { maxCopies: {}, rarities } })).settings!;
    expect(parse(['rare', 'bogus', 'common']).rarities).toEqual(['common', 'rare']);
    expect('rarities' in parse([])).toBe(false);
    expect('rarities' in parse('rare')).toBe(false);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
    expect(() => parseBackup('[]')).toThrow(/object/);
    expect(() => parseBackup('{"schema":2,"app":"bulk-brew"}')).toThrow(/schema 2/);
    expect(() => parseBackup('{"schema":1,"app":"other"}')).toThrow(/different app/);
  });

  it('rejects malformed pool entries and printings', () => {
    const entry = (e: unknown) => JSON.stringify({ ...base, pool: { entries: { x: e } } });
    expect(() => parseBackup(entry({ cardId: 'y', qty: 1 }))).toThrow(/malformed/);
    expect(() => parseBackup(entry({ cardId: 'x', qty: 0 }))).toThrow(/quantity/);
    expect(() => parseBackup(entry({ cardId: 'x', qty: 1.5 }))).toThrow(/quantity/);
    expect(() => parseBackup(entry({ cardId: 'x', qty: 1, printing: { set: 7 } }))).toThrow(
      /bad printing/,
    );
    expect(() =>
      parseBackup(entry({ cardId: 'x', qty: 1, printing: { set: 'm10', collectorNumber: 146 } })),
    ).toThrow(/collector number/);
    expect(
      parseBackup(entry({ cardId: 'x', qty: 1, printing: { set: 'm10' } })).pool?.entries['x']?.qty,
    ).toBe(1);
    expect(() => parseBackup(JSON.stringify({ ...base, pool: { entries: 3 } }))).toThrow(
      /malformed/,
    );
    expect(() => parseBackup(JSON.stringify({ ...base, decks: {} }))).toThrow(/malformed/);
  });

  it('rejects malformed decks, cards, and basics', () => {
    expect(() => parseBackup(withDeck({ ...goodDeck, size: 99 }))).toThrow(/bad size/);
    expect(() => parseBackup(withDeck({ ...goodDeck, color: 'X' }))).toThrow(/bad color/);
    expect(() => parseBackup(withDeck({ ...goodDeck, cards: [{ cardId: 'a', qty: 0 }] }))).toThrow(
      /malformed card/,
    );
    expect(() => parseBackup(withDeck({ ...goodDeck, cards: [{ qty: 1 }] }))).toThrow(
      /malformed card/,
    );
    expect(() =>
      parseBackup(withDeck({ ...goodDeck, cards: [{ cardId: 'a', qty: 1, printing: {} }] })),
    ).toThrow(/bad printing/);
    expect(() => parseBackup(withDeck({ ...goodDeck, basics: { X: 1 } }))).toThrow(/unknown color/);
    expect(() => parseBackup(withDeck({ ...goodDeck, basics: { R: -1 } }))).toThrow(
      /basic land count/,
    );
    expect(() => parseBackup(withDeck({ ...goodDeck, basics: undefined }))).toThrow(/no basics/);
    expect(parseBackup(withDeck({ ...goodDeck, basics: { R: 17 } })).decks).toHaveLength(1);
  });
});
