// What differs in the iOS app. The web app never takes these paths.
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppearanceMode } from '@bulk-brew/ui';

/** True inside the iOS app. */
export const isNative = Capacitor.isNativePlatform();

// AppearancePlugin in ios/App/App/AppViewController.swift.
const Appearance = registerPlugin<{ setMode(options: { mode: AppearanceMode }): Promise<void> }>(
  'Appearance',
);

/** Gives the status bar, keyboard, and system sheets the page's Light, Dark, or System mode. */
export function setNativeAppearance(mode: AppearanceMode): void {
  if (!isNative) return;
  Appearance.setMode({ mode }).catch((err: unknown) =>
    console.error('setting the native appearance failed', err),
  );
}

/**
 * Follow the iOS text size. -apple-system-body is 17 px at the default size, so its
 * ratio to 17 is the system scale; theme.css multiplies it by the Text size setting
 * and clamps the result to the range the layout is tested at.
 */
function followSystemTextSize(): void {
  const probe = document.createElement('span');
  probe.style.font = '-apple-system-body';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const body = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  if (!(body > 0)) return;
  const base = `${((100 * body) / 17).toFixed(2)}%`;
  const root = document.documentElement;
  if (root.style.getPropertyValue('--root-base') === base) return;
  root.style.setProperty('--root-base', base);
  // Lists that measure rows listen for resize.
  window.dispatchEvent(new Event('resize'));
}

/** Run before the first render: the app's CSS hooks and the system text size. */
export function startNative(): void {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  followSystemTextSize();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') followSystemTextSize();
  });
  // Sent by AppViewController when the size changes while the app is open.
  window.addEventListener('systemtextsize', followSystemTextSize);
}
