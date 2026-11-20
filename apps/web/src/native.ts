// What differs in the iOS app. The web app never takes these paths.
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { downloadText, fileNameFromUrl, type AppearanceMode } from '@bulk-brew/ui';

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

// Files waiting in the share sheet, in the app's cache. Cleared before the next one.
const SHARED = 'shared';

/**
 * Save a text file: a download on the web; in the app, the share sheet, from which
 * it can go to Files, AirDrop, Mail, and so on. False when the user closed the sheet.
 */
export async function saveText(filename: string, text: string, type?: string): Promise<boolean> {
  if (!isNative) {
    downloadText(filename, text, type);
    return true;
  }
  await Filesystem.rmdir({ path: SHARED, directory: Directory.Cache, recursive: true }).catch(
    () => undefined,
  );
  const { uri } = await Filesystem.writeFile({
    path: `${SHARED}/${filename}`,
    directory: Directory.Cache,
    data: text,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  try {
    await Share.share({ files: [uri] });
    return true;
  } catch (err) {
    // The plugin rejects with this message when the sheet is closed without a choice.
    if (err instanceof Error && /cancel/i.test(err.message)) return false;
    throw err;
  }
}

/** A short tap of the phone for a change that is now saved; nothing on the web. */
export function hapticSuccess(): void {
  if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
}

/** A lighter tap for a smaller change, such as a card swapped in a deck. */
export function hapticLight(): void {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

/**
 * Calls back with each file the user opens in or shares to the app from another app.
 * iOS hands the app its own copy in Documents/Inbox (Info.plist does not ask to open
 * files in place), so it needs no security scope; the copy is deleted once read.
 * A file opened before the page loaded is kept by the App plugin until this listens.
 */
export function listenForOpenedFiles(
  onFile: (file: File) => void,
  onError: (message: string) => void,
): () => void {
  if (!isNative) return () => undefined;
  const handle = App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('file:')) return;
    const name = fileNameFromUrl(url);
    Filesystem.readFile({ path: url })
      .then(({ data }) => {
        // Bytes, decoded by File.text() as a file picked in the page would be.
        const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
        onFile(new File([bytes], name));
        return Filesystem.deleteFile({ path: url }).catch(() => undefined);
      })
      .catch((err: unknown) =>
        onError(`Could not open ${name}: ${err instanceof Error ? err.message : String(err)}`),
      );
  });
  return () => void handle.then((h) => h.remove());
}
