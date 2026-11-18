import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../src/data/useAppearance.ts';
import mobileHtml from '../../../apps/mobile/index.html?raw';
import webHtml from '../../../apps/web/index.html?raw';

describe('parseAppearance', () => {
  it('reads a value saved before the text size existed as 100%', () => {
    expect(parseAppearance(JSON.stringify({ mode: 'dark', theme: 'U' }))).toEqual({
      mode: 'dark',
      theme: 'U',
      textSize: 100,
    });
  });

  it('keeps a known text size', () => {
    const saved = JSON.stringify({ mode: 'system', theme: 'G', textSize: 140 });
    expect(parseAppearance(saved).textSize).toBe(140);
    expect(parseAppearance(JSON.stringify({ textSize: 90 })).textSize).toBe(90);
  });

  it('reads an unknown or malformed text size as 100%', () => {
    for (const textSize of [120, '125', 0, null, 'big'])
      expect(parseAppearance(JSON.stringify({ mode: 'light', textSize })).textSize).toBe(100);
  });

  it('falls back to the defaults for nothing stored or unreadable text', () => {
    const defaults = { mode: 'light', theme: 'grey', textSize: 100 };
    expect(parseAppearance(null)).toEqual(defaults);
    expect(parseAppearance('not json')).toEqual(defaults);
    expect(parseAppearance('7')).toEqual(defaults);
  });
});

/** Runs an index.html pre-paint script against a stored value; returns what it set on the root. */
function prePaint(html: string, stored: string | null) {
  const source = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
  const attrs: Record<string, string> = {};
  const style = { colorScheme: '', setProperty: (k: string, v: string) => (attrs[k] = v) };
  const root = { style, setAttribute: (k: string, v: string) => (attrs[k] = v) };
  const document = { documentElement: root, querySelector: () => null };
  const window = { matchMedia: () => ({ matches: false }) };
  new Function('window', 'document', 'localStorage', source)(window, document, {
    getItem: () => stored,
  });
  return attrs;
}

describe('the pre-paint scripts', () => {
  const stored = [
    null,
    '{}',
    'not json',
    '{"textSize":140}',
    '{"textSize":"140"}',
    '{"textSize":120}',
    '{"mode":"dark","theme":"U","textSize":90}',
    '{"mode":"system","theme":"x"}',
  ];
  it.each([
    ['web', webHtml],
    ['mobile', mobileHtml],
  ])('%s agrees with parseAppearance', (_, html) => {
    for (const s of stored) {
      const a = parseAppearance(s);
      expect(prePaint(html, s), s ?? 'null').toEqual({
        'data-mode': a.mode === 'dark' ? 'dark' : 'light',
        'data-theme': a.theme,
        '--root-scale': String(a.textSize / 100),
      });
    }
  });
});
