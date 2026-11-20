// Card data updates in the iOS app: at most once a day, on opening and on coming back,
// it asks the site for its pack manifest and downloads a newer pack in the background,
// to be used from the next launch. Only data is downloaded, never code. The web app
// never calls any of this; its pack comes with each deploy.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import {
  checkDue,
  choosePack,
  matchesFile,
  parsePackManifest,
  toHex,
  updateVerdict,
  PACK_FILES,
  PACK_MANIFEST_FILE,
  type PackManifest,
} from '@bulk-brew/ui';

/** The site the web app is deployed to, which serves the newest pack. */
const SITE_DATA = 'https://xbadc0ffe.github.io/bulk-brew/data/';
const BUNDLED_DATA = `${import.meta.env.BASE_URL}data/`;

// Library/NoCloud: kept by iOS and left out of backups, since it can be downloaded again.
const STORE = Directory.LibraryNoCloud;
const PACKS = 'packs';
// Points at the verified pack in use from the next launch; written last.
const CURRENT = `${PACKS}/current.json`;
// downloadFile writes only to Documents, Library, or Caches; Caches is not backed up.
// Not Caches/shared, which each export clears.
const STAGING = 'pack-download';
const CHECKED_KEY = 'bulk-brew.packCheckedAt';

export interface PackSource {
  cards: string;
  learned: string;
  /** The data date of a downloaded pack; undefined for the bundled one. */
  downloaded?: string;
}

export const BUNDLED_PACK: PackSource = {
  cards: `${BUNDLED_DATA}cards.json`,
  learned: `${BUNDLED_DATA}learned.json`,
};

async function readManifest(url: string): Promise<PackManifest | undefined> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? parsePackManifest(await res.text()) : undefined;
  } catch {
    return undefined;
  }
}

/** The downloaded pack waiting or in use, from its record. */
async function readCurrent(): Promise<PackManifest | undefined> {
  try {
    const { data } = await Filesystem.readFile({
      path: CURRENT,
      directory: STORE,
      encoding: Encoding.UTF8,
    });
    return parsePackManifest(data as string);
  } catch {
    return undefined;
  }
}

function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function removeQuietly(path: string, directory: Directory): Promise<void> {
  await Filesystem.rmdir({ path, directory, recursive: true }).catch(() => undefined);
}

// The last drop, which the update check waits for so it cannot read a record being deleted.
let dropping: Promise<void> = Promise.resolve();

/** Forget every downloaded pack, so the bundled one is used. */
export function dropDownloadedPacks(): Promise<void> {
  dropping = removeQuietly(PACKS, STORE);
  return dropping;
}

/**
 * The pack to load this session: a download when it is newer than the bundled pack
 * and its files are all there, else the bundled pack. Reads only local files, so it
 * never waits on the network. A stale or broken download is deleted.
 */
export async function nativePackSource(): Promise<PackSource> {
  try {
    const [bundled, current] = await Promise.all([
      readManifest(`${BUNDLED_DATA}${PACK_MANIFEST_FILE}`),
      readCurrent(),
    ]);
    if (!current) return BUNDLED_PACK;
    if (choosePack(bundled, current) === 'bundled') {
      console.info(`card data: the bundled pack ${bundled?.version} replaces ${current.version}`);
      await dropDownloadedPacks();
      return BUNDLED_PACK;
    }
    const urls: string[] = [];
    for (const file of PACK_FILES) {
      const path = `${PACKS}/${current.version}/${file}`;
      // A file cut short since it was checked would fail to parse; the size is cheap to see.
      const { size, uri } = await Filesystem.stat({ path, directory: STORE });
      if (size !== current.files[file].bytes) throw new Error(`${file} is ${size} bytes`);
      urls.push(Capacitor.convertFileSrc(uri));
    }
    return { cards: urls[0]!, learned: urls[1]!, downloaded: current.version };
  } catch (err) {
    console.warn(
      `card data: the downloaded pack is not usable (${why(err)}); using the bundled one`,
    );
    await dropDownloadedPacks();
    return BUNDLED_PACK;
  }
}

function lastChecked(): number | undefined {
  try {
    const v = localStorage.getItem(CHECKED_KEY);
    return v === null ? undefined : Number(v);
  } catch {
    return undefined;
  }
}

function markChecked(now: number): void {
  try {
    localStorage.setItem(CHECKED_KEY, String(now));
  } catch {
    // Without storage the app checks again next time, which is harmless.
  }
}

/** Download one file into the staging folder and check it against the manifest. */
async function downloadFile(file: (typeof PACK_FILES)[number], m: PackManifest): Promise<void> {
  const path = `${STAGING}/${file}`;
  // Written to disk natively, so the 25 MB pack never crosses the bridge as a string.
  await Filesystem.downloadFile({ url: `${SITE_DATA}${file}`, path, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  // One copy of the file in memory, and only until it is hashed.
  const res = await fetch(Capacitor.convertFileSrc(uri));
  if (!res.ok) throw new Error(`reading the downloaded ${file} failed (${res.status})`);
  const bytes = await res.arrayBuffer();
  const sha = toHex(await crypto.subtle.digest('SHA-256', bytes));
  if (!matchesFile(m.files[file], bytes.byteLength, sha))
    throw new Error(`${file} does not match the manifest (${bytes.byteLength} bytes, ${sha})`);
}

/** Download, check, and then make current, so a failure leaves the packs as they were. */
// downloadFile replaces a file left in staging by an earlier attempt, and the caller has
// pruned every pack folder but the current one, so nothing needs clearing first.
async function install(m: PackManifest): Promise<void> {
  let moved = false;
  try {
    for (const file of PACK_FILES) await downloadFile(file, m);
    const dir = `${PACKS}/${m.version}`;
    await Filesystem.mkdir({ path: PACKS, directory: STORE, recursive: true }).catch(
      () => undefined,
    );
    // One rename moves the checked folder into place; the record then points at it.
    await Filesystem.rename({
      from: STAGING,
      directory: Directory.Cache,
      to: dir,
      toDirectory: STORE,
    });
    moved = true;
    const tmp = `${PACKS}/current.tmp`;
    await Filesystem.writeFile({
      path: tmp,
      directory: STORE,
      data: JSON.stringify(m),
      encoding: Encoding.UTF8,
    });
    await Filesystem.rename({ from: tmp, directory: STORE, to: CURRENT, toDirectory: STORE });
    console.info(`card data: ${m.version} downloaded; it is used from the next launch`);
  } finally {
    if (!moved) await removeQuietly(STAGING, Directory.Cache);
  }
}

/** Delete the packs the record does not point at: superseded ones and any half-moved folder. */
async function pruneOldPacks(keep: string | undefined): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({ path: PACKS, directory: STORE });
    for (const f of files)
      if (f.type === 'directory' && f.name !== keep)
        await removeQuietly(`${PACKS}/${f.name}`, STORE);
  } catch {
    // No packs folder yet.
  }
}

let checking = false;

async function checkForPack(inUse: string): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    await dropping;
    const now = Date.now();
    if (!checkDue(lastChecked(), now)) return;
    let res: Response;
    try {
      res = await fetch(`${SITE_DATA}${PACK_MANIFEST_FILE}`, { cache: 'no-store' });
    } catch (err) {
      // Offline: try again the next time the app opens.
      console.info(`card data: no connection for the update check (${why(err)})`);
      return;
    }
    markChecked(now);
    if (!res.ok) throw new Error(`the manifest request failed (${res.status})`);
    const remote = parsePackManifest(await res.text());
    const current = await readCurrent();
    await pruneOldPacks(current?.version);
    const verdict = updateVerdict(remote, current ? [inUse, current.version] : [inUse]);
    if (!verdict.download) {
      console.info(`card data: no download, ${verdict.reason}`);
      return;
    }
    await install(remote!);
    await pruneOldPacks(remote!.version);
  } catch (err) {
    console.warn(`card data: the update failed (${why(err)}); the current pack stays`);
  } finally {
    checking = false;
  }
}

let started = false;

/**
 * Check for new card data now and each time the app comes back, at most once a day.
 * Called once the pack in use has loaded, so nothing competes with the launch and no
 * file it read is removed while it is read.
 */
export function startPackUpdates(inUse: string): void {
  if (started) return;
  started = true;
  void checkForPack(inUse);
  void App.addListener('resume', () => void checkForPack(inUse));
}
