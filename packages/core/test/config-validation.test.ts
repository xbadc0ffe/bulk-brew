import { describe, expect, it } from 'vitest';
import { validateConfig, type BulkBrewConfig } from '../src/config.ts';
import { CONFIG } from './config.test.ts';

function clone(): BulkBrewConfig {
  return JSON.parse(JSON.stringify(CONFIG)) as BulkBrewConfig;
}

describe('validateConfig', () => {
  it('rejects unknown clause keys, which would otherwise match every card', () => {
    const c = clone();
    (c.roles.roles[0]!.match[0] as Record<string, unknown>)['anyTag'] = ['spot-removal'];
    expect(validateConfig(c).some((p) => p.includes('unknown key "anyTag"'))).toBe(true);
  });

  it('rejects empty clauses and negative curve shares', () => {
    const c = clone();
    c.roles.roles[0]!.match = [{}];
    c.curveProfiles.profiles[0]!.shape = [1.2, -0.2, 0, 0, 0, 0, 0];
    const problems = validateConfig(c);
    expect(problems.some((p) => p.includes('empty clause'))).toBe(true);
    expect(problems.some((p) => p.includes('negative'))).toBe(true);
  });

  it('checks archetype type mix overrides against the merged template values', () => {
    const c = clone();
    const a = c.archetypes.archetypes.find((x) => x.kind === 'composition')!;
    a.typeMixOverrides = { creatureMin: 0.95 };
    expect(validateConfig(c).some((p) => p.includes('creatureMin exceeds creatureMax'))).toBe(true);
  });

  it('rejects deck score weights that are all zero and fractional or negative best fit counts', () => {
    const c = clone();
    c.builderWeights.deckScore.weights = {
      strength: 0,
      roles: 0,
      curve: 0,
      typeMix: 0,
      synergy: 0,
    };
    c.builderWeights.bestFit = { synergyCandidates: -1, compositionCandidates: 2.5 };
    const problems = validateConfig(c);
    expect(problems.some((p) => p.includes('must not all be zero'))).toBe(true);
    expect(problems.some((p) => p.includes('builderWeights.bestFit'))).toBe(true);
  });

  it('checks card strength keywords, ranges, and copy caps', () => {
    const c = clone();
    delete (c.cardStrength as Partial<typeof c.cardStrength>).keywords;
    c.cardStrength.body.min = 3;
    c.cardStrength.body.max = -3;
    delete (c.deckTemplates.templates['60'] as Partial<(typeof c.deckTemplates.templates)['60']>)
      .copyCaps;
    const problems = validateConfig(c);
    expect(problems.some((p) => p.includes('cardStrength.keywords'))).toBe(true);
    expect(problems.some((p) => p.includes('cardStrength.body: min'))).toBe(true);
    expect(problems.some((p) => p.includes('copyCaps'))).toBe(true);
  });

  it('reports unknown role ids in quotas', () => {
    const c = clone();
    c.deckTemplates.templates['60']!.roles['notARole'] = { min: 1, target: 1 };
    expect(validateConfig(c).some((p) => p.includes('unknown role "notARole"'))).toBe(true);
  });
});
