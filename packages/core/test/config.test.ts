import { describe, expect, it } from 'vitest';
import deckTemplates from '../../../config/deck-templates.json';
import curveProfiles from '../../../config/curve-profiles.json';
import roles from '../../../config/roles.json';
import archetypes from '../../../config/archetypes.json';
import synergyRules from '../../../config/synergy-rules.json';
import landRules from '../../../config/land-rules.json';
import builderWeights from '../../../config/builder-weights.json';
import cardStrength from '../../../config/card-strength.json';
import learnedPlans from '../../../config/learned/plans.json';
import learnedTags from '../../../config/learned/tags.json';
import {
  archetypeById,
  configVersion,
  collectTagReferences,
  curveProfileFor,
  templateFor,
  validateConfig,
  type BulkBrewConfig,
} from '../src/config.ts';

export const CONFIG = {
  deckTemplates,
  curveProfiles,
  roles,
  archetypes,
  synergyRules,
  landRules,
  builderWeights,
  cardStrength,
  learned: { plans: learnedPlans, tags: learnedTags },
} as unknown as BulkBrewConfig;

describe('shipped config', () => {
  it('validates with no problems', () => {
    expect(validateConfig(CONFIG)).toEqual([]);
  });

  it('has a template, default curve profile, and fallback archetype for every size', () => {
    for (const size of [60, 40, 20] as const) {
      const t = templateFor(CONFIG, size);
      expect(t.size).toBe(size);
      expect(curveProfileFor(CONFIG, t.curveProfile).shape).toHaveLength(7);
      expect(t.baseLands).toBeGreaterThanOrEqual(t.landFormula.min);
      expect(t.baseLands).toBeLessThanOrEqual(t.landFormula.max);
    }
    expect(archetypeById(CONFIG, 'midrange').kind).toBe('composition');
  });

  it('references tags in every synergy archetype', () => {
    expect(collectTagReferences(CONFIG).size).toBeGreaterThan(40);
  });

  it('joins file versions into one string', () => {
    expect(configVersion(CONFIG)).toMatch(
      /^t\d+\.c\d+\.r\d+\.a\d+\.s\d+\.l\d+\.w\d+\.k\d+\.p[0-9a-z]+\.g[0-9a-z]+$/,
    );
  });
});

/** Deep copy without DOM or Node globals, since the core targets plain ES. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('validateConfig', () => {
  it('reports unknown roles, bad shapes, and missing versions', () => {
    const broken = clone(CONFIG);
    broken.deckTemplates.templates['60']!.roles['notARole'] = { min: 1, target: 2 };
    broken.curveProfiles.profiles[0]!.shape = [1, 0, 0];
    broken.archetypes.archetypes[0]!.curveProfile = 'nope';
    const problems = validateConfig(broken);
    expect(problems.some((p) => p.includes('unknown role "notARole"'))).toBe(true);
    expect(problems.some((p) => p.includes('shape needs 7 numbers'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown curve profile "nope"'))).toBe(true);

    const noVersion = clone(CONFIG);
    noVersion.roles.version = '';
    expect(validateConfig(noVersion)).toEqual(['roles: version must be a non-empty string']);
  });

  it('rejects clauses that only exclude', () => {
    const broken = clone(CONFIG);
    broken.roles.roles[0]!.match = [{ excludeTags: ['x'] }];
    expect(validateConfig(broken).some((p) => p.includes('needs a positive condition'))).toBe(true);
  });
});
