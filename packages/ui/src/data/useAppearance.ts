import { useCallback, useEffect, useState } from 'react';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'grey' | 'W' | 'U' | 'B' | 'R' | 'G';

export interface Appearance {
  mode: AppearanceMode;
  theme: ThemeColor;
}

export const THEME_COLORS: { id: ThemeColor; label: string }[] = [
  { id: 'grey', label: 'Grey' },
  { id: 'W', label: 'White' },
  { id: 'U', label: 'Blue' },
  { id: 'B', label: 'Black' },
  { id: 'R', label: 'Red' },
  { id: 'G', label: 'Green' },
];

export const APPEARANCE_MODES: { id: AppearanceMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// Kept in localStorage, not the key-value store, because the inline script in
// each index.html must read it synchronously before first paint. The key and
// shape are duplicated there; keep them in step.
export const APPEARANCE_KEY = 'bulk-brew.appearance';
const DEFAULT_APPEARANCE: Appearance = { mode: 'light', theme: 'grey' };

function isMode(v: unknown): v is AppearanceMode {
  return v === 'light' || v === 'dark' || v === 'system';
}
function isTheme(v: unknown): v is ThemeColor {
  return THEME_COLORS.some((t) => t.id === v);
}

export function readAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null') as Partial<Appearance>;
    return {
      mode: isMode(saved?.mode) ? saved.mode : DEFAULT_APPEARANCE.mode,
      theme: isTheme(saved?.theme) ? saved.theme : DEFAULT_APPEARANCE.theme,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

const darkQuery = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;

function apply(a: Appearance): void {
  const dark = a.mode === 'dark' || (a.mode === 'system' && darkQuery()?.matches === true);
  const root = document.documentElement;
  root.dataset.mode = dark ? 'dark' : 'light';
  root.dataset.theme = a.theme;
  // The pre-paint script sets this inline, so it has to follow here too.
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export interface AppearanceState {
  appearance: Appearance;
  setMode(mode: AppearanceMode): void;
  setTheme(theme: ThemeColor): void;
  reset(): void;
}

/** Light, dark, or system mode plus a theme color, applied to the html element. */
export function useAppearance(): AppearanceState {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);

  useEffect(() => {
    apply(appearance);
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch {
      // storage blocked; the choice still applies for this visit
    }
    if (appearance.mode !== 'system') return;
    const query = darkQuery();
    if (!query) return;
    const onChange = () => apply(appearance);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [appearance]);

  return {
    appearance,
    setMode: useCallback((mode: AppearanceMode) => setAppearance((a) => ({ ...a, mode })), []),
    setTheme: useCallback((theme: ThemeColor) => setAppearance((a) => ({ ...a, theme })), []),
    reset: useCallback(() => setAppearance(DEFAULT_APPEARANCE), []),
  };
}
