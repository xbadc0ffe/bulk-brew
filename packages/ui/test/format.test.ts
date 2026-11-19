import { describe, expect, it } from 'vitest';
import { compactCount } from '../src/util/format.ts';

describe('compactCount', () => {
  it('keeps small counts exact', () => {
    expect(compactCount(0)).toBe('0');
    expect(compactCount(999)).toBe('999');
  });
  it('shortens thousands and millions', () => {
    expect(compactCount(1000)).toBe('1k');
    expect(compactCount(1234)).toBe('1.2k');
    expect(compactCount(12_345)).toBe('12k');
    expect(compactCount(999_999)).toBe('999k');
    expect(compactCount(1_000_000)).toBe('1m');
    expect(compactCount(2_560_000)).toBe('2.5m');
    expect(compactCount(999_000_000)).toBe('999m');
  });
});
