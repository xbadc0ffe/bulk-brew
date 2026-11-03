import { describe, expect, it } from 'vitest';
import shipped from '../../../config/display-tags.json';
import { factsFor } from '../src/candidates.ts';
import {
  displayTagReferences,
  displayTagsFor,
  validateDisplayTags,
  type DisplayTagsConfig,
} from '../src/display-tags.ts';
import { CardIndex } from '../src/pack.ts';
import { CONFIG_BUNDLE as CONFIG, PACK } from './builder-fixtures.ts';

const SHIPPED = shipped as unknown as DisplayTagsConfig;
const index = new CardIndex(PACK);
const labels = (id: string) =>
  displayTagsFor(index.get(id)!, factsFor(index, CONFIG, index.get(id)!), SHIPPED).map(
    (t) => t.label,
  );

describe('display tags', () => {
  it('ships a valid file', () => {
    expect(validateDisplayTags(SHIPPED, CONFIG)).toEqual([]);
    expect(displayTagReferences(SHIPPED).size).toBeGreaterThan(10);
  });

  it('tags cards from roles, styles, and Tagger slugs', () => {
    expect(labels('w-removal-0')).toContain('Removal');
    expect(labels('w-draw-0')).toContain('Draw');
    expect(labels('w-dork-0')).toContain('Ramp');
    expect(labels('w-creature-1-0')).toContain('Tokens');
  });

  it('reports unknown roles, styles, and empty tags', () => {
    const bad: DisplayTagsConfig = {
      version: 'x',
      tags: [
        { id: 'a', label: 'A', description: '', roles: ['nope'] },
        { id: 'b', label: 'B', description: '', styles: ['nope'] },
        { id: 'c', label: 'C', description: '' },
        { id: 'a', label: 'A', description: '', roles: ['removal'] },
      ],
    };
    const problems = validateDisplayTags(bad, CONFIG).join('\n');
    expect(problems).toMatch(/unknown role nope/);
    expect(problems).toMatch(/unknown style nope/);
    expect(problems).toMatch(/c: needs roles, styles, or match/);
    expect(problems).toMatch(/duplicate id/);
  });
});
