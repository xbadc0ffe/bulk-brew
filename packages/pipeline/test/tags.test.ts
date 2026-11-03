import { describe, expect, it } from 'vitest';
import { buildTagMap } from '../src/tags.ts';
import { applyOverlay } from '../src/overlay.ts';
import type { TaggerTag } from '../src/scryfall.ts';

function tag(id: string, slug: string, parents: string[], cards: string[]): TaggerTag {
  return {
    id,
    slug,
    type: 'oracle',
    parent_ids: parents,
    taggings: cards.map((oracle_id) => ({ oracle_id, weight: 'median' })),
  };
}

describe('buildTagMap', () => {
  it('adds ancestor tags and drops noise subtrees', () => {
    const map = buildTagMap([
      tag('r', 'removal', [], []),
      tag('sr', 'spot-removal', ['r'], ['card-a']),
      tag('cy', 'cycle', [], []),
      tag('cyx', 'cycle-xyz-lords', ['cy'], ['card-a']),
      tag('ev', 'evasion', [], ['card-b']),
    ]);
    expect([...map.get('card-a')!].sort()).toEqual(['removal', 'spot-removal']);
    expect([...map.get('card-b')!]).toEqual(['evasion']);
  });

  it('ignores non-oracle tag types', () => {
    const map = buildTagMap([{ ...tag('a', 'art-thing', [], ['card-a']), type: 'illustration' }]);
    expect(map.size).toBe(0);
  });
});

describe('applyOverlay', () => {
  it('adds and removes tags by card name and reports unknown names', () => {
    const map = buildTagMap([tag('ev', 'evasion', [], ['id-1'])]);
    const report = applyOverlay(
      map,
      { version: 'test', add: { Bolt: ['burn'], Ghost: ['x'] }, remove: { Bird: ['evasion'] } },
      new Map([
        ['Bolt', 'id-2'],
        ['Bird', 'id-1'],
      ]),
    );
    expect([...map.get('id-2')!]).toEqual(['burn']);
    expect(map.get('id-1')!.size).toBe(0);
    expect(report).toEqual({ applied: 2, unknownNames: ['Ghost'] });
  });
});
