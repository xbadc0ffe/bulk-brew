import { describe, expect, it } from 'vitest';
import { CardIndex, parsePack } from '../src/pack.ts';
import { PACK } from './fixtures.ts';

const index = new CardIndex(PACK);

describe('CardIndex.find', () => {
  it('finds by exact and loosely formatted names', () => {
    expect(index.find('Lightning Bolt')?.id).toBe('bolt');
    expect(index.find('  lightning   bolt ')?.id).toBe('bolt');
  });

  it('finds multi-face cards by full name, front face, or back face', () => {
    expect(index.find('Fire // Ice')?.id).toBe('fireice');
    expect(index.find('Fire/Ice')?.id).toBe('fireice');
    expect(index.find('Fire')?.id).toBe('fireice');
    expect(index.find('Ice')?.id).toBe('fireice');
    expect(index.find('Delver of Secrets')?.id).toBe('delver');
    expect(index.find('Insectile Aberration')?.id).toBe('delver');
  });

  it('prefers the real card over an Un-set card with the same name', () => {
    expect(index.find('Twin Name')?.id).toBe('dup-real');
  });

  it('hides Un-set cards unless asked', () => {
    expect(index.find('Plot Armor')).toBeUndefined();
    expect(index.find('Plot Armor', { includeUnsets: true })?.id).toBe('silly');
  });

  it('returns undefined for unknown or empty names', () => {
    expect(index.find('Not A Card')).toBeUndefined();
    expect(index.find('')).toBeUndefined();
  });
});

describe('parsePack', () => {
  it('accepts the current schema and rejects others', () => {
    expect(parsePack(JSON.stringify(PACK)).cardCount).toBe(PACK.cardCount);
    expect(() => parsePack(JSON.stringify({ ...PACK, schema: 99 }))).toThrow(/schema/);
  });
});
