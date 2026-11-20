import { describe, expect, it } from 'vitest';
import { DATA_SCHEMA_VERSION, LEARNED_SCHEMA } from '@bulk-brew/core';
import {
  checkDue,
  choosePack,
  CHECK_INTERVAL_MS,
  matchesFile,
  parsePackManifest,
  toHex,
  updateVerdict,
  type PackManifest,
} from '../src/data/packUpdate.ts';

const SHA = 'ab'.repeat(32);

function manifest(version: string, over: Partial<PackManifest> = {}): PackManifest {
  return {
    schema: DATA_SCHEMA_VERSION,
    version,
    cardCount: 3,
    learned: { schema: LEARNED_SCHEMA, version: 'x1' },
    files: {
      'cards.json': { bytes: 100, sha256: SHA },
      'learned.json': { bytes: 10, sha256: SHA },
    },
    ...over,
  };
}

describe('parsePackManifest', () => {
  it('reads a manifest the build writes', () => {
    const m = manifest('2026-11-23');
    expect(parsePackManifest(JSON.stringify(m))).toEqual(m);
  });

  it('refuses text that is not a whole manifest', () => {
    expect(parsePackManifest('not json')).toBeUndefined();
    expect(parsePackManifest('null')).toBeUndefined();
    expect(
      parsePackManifest(JSON.stringify({ ...manifest('2026-11-23'), version: '../x' })),
    ).toBeUndefined();
    const noLearned = manifest('2026-11-23');
    delete (noLearned.files as Partial<PackManifest['files']>)['learned.json'];
    expect(parsePackManifest(JSON.stringify(noLearned))).toBeUndefined();
    const badSha = manifest('2026-11-23');
    badSha.files['cards.json'].sha256 = 'XYZ';
    expect(parsePackManifest(JSON.stringify(badSha))).toBeUndefined();
  });
});

describe('updateVerdict', () => {
  it('downloads only a newer data date than every pack the app has', () => {
    expect(updateVerdict(manifest('2026-11-23'), ['2026-11-16'])).toEqual({ download: true });
    expect(updateVerdict(manifest('2026-11-16'), ['2026-11-16']).download).toBe(false);
    expect(updateVerdict(manifest('2026-11-23'), ['2026-11-16', '2026-11-23']).download).toBe(
      false,
    );
    expect(updateVerdict(manifest('2026-11-09'), ['2026-11-16']).download).toBe(false);
  });

  it('refuses a schema this app does not read', () => {
    expect(updateVerdict(manifest('2026-11-23', { schema: 99 }), ['2026-11-16']).download).toBe(
      false,
    );
    expect(
      updateVerdict(manifest('2026-11-23', { learned: { schema: 99, version: 'x' } }), [
        '2026-11-16',
      ]).download,
    ).toBe(false);
    expect(updateVerdict(undefined, ['2026-11-16']).download).toBe(false);
  });
});

describe('choosePack', () => {
  it('takes a download only when it is newer than the bundled pack', () => {
    expect(choosePack(manifest('2026-11-16'), manifest('2026-11-23'))).toBe('downloaded');
    expect(choosePack(manifest('2026-11-23'), manifest('2026-11-16'))).toBe('bundled');
    expect(choosePack(manifest('2026-11-16'), manifest('2026-11-16'))).toBe('bundled');
    expect(choosePack(manifest('2026-11-16'), undefined)).toBe('bundled');
    expect(choosePack(undefined, manifest('2026-11-16'))).toBe('downloaded');
  });

  it('never takes a download in an unknown schema', () => {
    expect(choosePack(manifest('2026-11-16'), manifest('2026-11-23', { schema: 99 }))).toBe(
      'bundled',
    );
  });
});

describe('checkDue', () => {
  const now = 1_800_000_000_000;
  it('checks at most once a day', () => {
    expect(checkDue(undefined, now)).toBe(true);
    expect(checkDue(now - 1000, now)).toBe(false);
    expect(checkDue(now - CHECK_INTERVAL_MS, now)).toBe(true);
    expect(checkDue(Number.NaN, now)).toBe(true);
  });

  it('checks when the clock went back', () => {
    expect(checkDue(now + 1000, now)).toBe(true);
  });
});

describe('matchesFile', () => {
  it('needs both the size and the checksum', () => {
    const info = { bytes: 100, sha256: SHA };
    expect(matchesFile(info, 100, SHA)).toBe(true);
    expect(matchesFile(info, 100, SHA.toUpperCase())).toBe(true);
    expect(matchesFile(info, 99, SHA)).toBe(false);
    expect(matchesFile(info, 100, 'cd'.repeat(32))).toBe(false);
  });

  it('formats a digest as hex', () => {
    expect(toHex(new Uint8Array([0, 15, 255]).buffer)).toBe('000fff');
  });
});
