import { useCallback, useEffect, useState } from 'react';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'grey' | 'W' | 'U' | 'B' | 'R' | 'G';
/** Percent of the normal text size. */
export type TextSize = 90 | 100 | 110 | 125 | 140;

export interface Appearance {
  mode: AppearanceMode;
  theme: ThemeColor;
  textSize: TextSize;
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

export const TEXT_SIZES: { id: TextSize; label: string }[] = [
  { id: 90, label: '90%' },
  { id: 100, label: '100%' },
  { id: 110, label: '110%' },
  { id: 125, label: '125%' },
  { id: 140, label: '140%' },
];

// Kept in localStorage, not the key-value store, because the inline script in
// each index.html must read it synchronously before first paint. The key and
// shape are duplicated there; keep them in step.
export const APPEARANCE_KEY = 'bulk-brew.appearance';
const DEFAULT_APPEARANCE: Appearance = { mode: 'light', theme: 'grey', textSize: 100 };

function isMode(v: unknown): v is AppearanceMode {
  return v === 'light' || v === 'dark' || v === 'system';
}
function isTheme(v: unknown): v is ThemeColor {
  return THEME_COLORS.some((t) => t.id === v);
}
function isTextSize(v: unknown): v is TextSize {
  return TEXT_SIZES.some((t) => t.id === v);
}

/** The stored text, from this or an older version; a missing or unknown field reads as its default. */
export function parseAppearance(stored: string | null): Appearance {
  try {
    const saved = JSON.parse(stored ?? 'null') as Partial<Appearance> | null;
    return {
      mode: isMode(saved?.mode) ? saved.mode : DEFAULT_APPEARANCE.mode,
      theme: isTheme(saved?.theme) ? saved.theme : DEFAULT_APPEARANCE.theme,
      textSize: isTextSize(saved?.textSize) ? saved.textSize : DEFAULT_APPEARANCE.textSize,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function readAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(APPEARANCE_KEY));
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
  // Sizes are in rem, so the root font size (theme.css) scales the whole app.
  const scale = String(a.textSize / 100);
  if (root.style.getPropertyValue('--root-scale') !== scale) {
    root.style.setProperty('--root-scale', scale);
    // Lists that measure rows listen for resize.
    window.dispatchEvent(new Event('resize'));
  }
  // A page whose icon link names a light and a dark file shows the one for the mode.
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dark]');
  const href = icon?.dataset[dark ? 'dark' : 'light'];
  if (icon && href) icon.href = href;
}

export interface AppearanceState {
  appearance: Appearance;
  setMode(mode: AppearanceMode): void;
  setTheme(theme: ThemeColor): void;
  setTextSize(textSize: TextSize): void;
  reset(): void;
}

/** Light, dark, or system mode, a theme color, and a text size, applied to the html element. */
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
    setTextSize: useCallback(
      (textSize: TextSize) => setAppearance((a) => ({ ...a, textSize })),
      [],
    ),
    reset: useCallback(() => setAppearance(DEFAULT_APPEARANCE), []),
  };
}
