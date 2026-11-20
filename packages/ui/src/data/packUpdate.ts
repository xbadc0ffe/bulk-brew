// Decisions for the iOS app's card data updates, kept free of any platform call so
// they can be tested. The app (apps/web/src/packUpdates.ts) does the fetching and
// the files; the web app never uses this.

import { LEARNED_SCHEMA, SUPPORTED_DATA_SCHEMAS } from '@bulk-brew/core';

/** Written by the web build beside the data files it describes (apps/web/vite.config.ts). */
export const PACK_MANIFEST_FILE = 'pack-manifest.json';
/** The files of one pack, always taken together so cards and learned data never mix. */
export const PACK_FILES = ['cards.json', 'learned.json'] as const;
export type PackFileName = (typeof PACK_FILES)[number];

/** A day, the least time between two checks for new card data. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface PackFileInfo {
  bytes: number;
  sha256: string;
}

/** What the site says about the data files beside it. */
export interface PackManifest {
  /** The pack's schema and version (its Scryfall data date), as in cards.json. */
  schema: number;
  version: string;
  cardCount: number;
  /** The schema and version of learned.json. */
  learned: { schema: number; version: string };
  files: Record<PackFileName, PackFileInfo>;
}

// Pack versions are data dates; they also name the folder a download is kept in.
const VERSION = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function isFileInfo(v: unknown): v is PackFileInfo {
  const f = v as PackFileInfo;
  return (
    typeof f === 'object' &&
    f !== null &&
    Number.isInteger(f.bytes) &&
    f.bytes > 0 &&
    typeof f.sha256 === 'string' &&
    SHA256.test(f.sha256)
  );
}

/** The manifest, or undefined when the text is not one this app can read. */
export function parsePackManifest(text: string): PackManifest | undefined {
  let m: PackManifest;
  try {
    m = JSON.parse(text) as PackManifest;
  } catch {
    return undefined;
  }
  if (typeof m !== 'object' || m === null) return undefined;
  if (!Number.isInteger(m.schema) || typeof m.version !== 'string' || !VERSION.test(m.version))
    return undefined;
  if (!Number.isInteger(m.cardCount)) return undefined;
  if (typeof m.learned !== 'object' || m.learned === null || !Number.isInteger(m.learned.schema))
    return undefined;
  if (typeof m.files !== 'object' || m.files === null) return undefined;
  if (!PACK_FILES.every((f) => isFileInfo(m.files[f]))) return undefined;
  return m;
}

/** True when this app build reads both the pack's schema and the learned data's. */
export function knowsSchemas(m: PackManifest): boolean {
  return SUPPORTED_DATA_SCHEMAS.includes(m.schema) && m.learned.schema === LEARNED_SCHEMA;
}

/** True when the last check was a day ago or more, or never happened, or the clock went back. */
export function checkDue(lastChecked: number | undefined, now: number): boolean {
  if (lastChecked === undefined || !Number.isFinite(lastChecked)) return true;
  return now - lastChecked >= CHECK_INTERVAL_MS || now < lastChecked;
}

/**
 * Whether to download the site's pack: only a newer data date than every pack the
 * app already has (the one in use and any download waiting for the next launch),
 * and only in schemas it reads. Otherwise the reason not to, for the console.
 */
export function updateVerdict(
  remote: PackManifest | undefined,
  have: readonly string[],
): { download: true } | { download: false; reason: string } {
  if (!remote) return { download: false, reason: 'the manifest is not readable' };
  if (!knowsSchemas(remote))
    return {
      download: false,
      reason: `pack schema ${remote.schema} or learned schema ${remote.learned.schema} is unknown to this app`,
    };
  const newest = have.reduce((a, b) => (b > a ? b : a), '');
  if (remote.version <= newest)
    return { download: false, reason: `${newest} is current (the site has ${remote.version})` };
  return { download: true };
}

/**
 * Which pack to load at launch: a download only when it is readable and newer than
 * the pack bundled in the app. A new app build can bundle a newer pack than an old
 * download, and on a tie the bundle wins since it needs no files of its own.
 */
export function choosePack(
  bundled: PackManifest | undefined,
  downloaded: PackManifest | undefined,
): 'bundled' | 'downloaded' {
  if (!downloaded || !knowsSchemas(downloaded)) return 'bundled';
  return downloaded.version > (bundled?.version ?? '') ? 'downloaded' : 'bundled';
}

/** True when the bytes on disk are the file the manifest describes. */
export function matchesFile(info: PackFileInfo, bytes: number, sha256: string): boolean {
  return bytes === info.bytes && sha256.toLowerCase() === info.sha256;
}

/** Lower-case hex of a digest. */
export function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
