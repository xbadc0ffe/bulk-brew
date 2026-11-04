// Orchestrates one pipeline run: raw bulk files in, data pack and manifest out.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  DATA_SCHEMA_VERSION,
  type CardRecord,
  type DataManifest,
  type DataPack,
} from '@bulk-brew/core';
import { readJsonl, readAll } from './read.ts';
import type { ScryfallCard, TaggerTag } from './scryfall.ts';
import { isPlayable, toCardRecord } from './transform.ts';
import { buildTagMap } from './tags.ts';
import { applyOverlay, type TagOverlay } from './overlay.ts';

export interface BuildOptions {
  rawDir: string;
  outDir: string;
  overlayPath: string;
  /** GitHub "owner/repo" used to form the release asset URL in the manifest. */
  repo: string;
  /** Pack version (YYYY-MM-DD). Defaults to the oracle_cards date from bulk-meta.json, else today. */
  version?: string;
  log?: (msg: string) => void;
}

export interface BuildReport {
  version: string;
  cardCount: number;
  skipped: number;
  unset: number;
  taggedCards: number;
  overlayUnknown: string[];
  packPath: string;
  gzPath: string;
  manifest: DataManifest;
}

/** Name the pack is installed and served under, whatever its schema. */
export const PACK_FILE = 'cards.json';

/** Release asset name. It carries the schema so packs of different schemas never collide. */
export const RELEASE_ASSET = `cards.v${DATA_SCHEMA_VERSION}.json.gz`;

async function resolveVersion(rawDir: string, explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    const meta = JSON.parse(await readFile(path.join(rawDir, 'bulk-meta.json'), 'utf8'));
    const updated = meta?.oracle_cards?.updated_at as string | undefined;
    if (updated) return updated.slice(0, 10);
  } catch {
    // no meta file: fall through
  }
  return new Date().toISOString().slice(0, 10);
}

export async function buildPack(opts: BuildOptions): Promise<BuildReport> {
  const log = opts.log ?? (() => {});
  const version = await resolveVersion(opts.rawDir, opts.version);

  log('reading tags');
  const tags = await readAll<TaggerTag>(path.join(opts.rawDir, 'oracle_tags.jsonl.gz'));
  const tagMap = buildTagMap(tags);

  log('reading cards');
  const cards: CardRecord[] = [];
  const idByName = new Map<string, string>();
  let skipped = 0;
  for await (const card of readJsonl<ScryfallCard>(
    path.join(opts.rawDir, 'oracle_cards.jsonl.gz'),
  )) {
    if (!isPlayable(card)) {
      skipped++;
      continue;
    }
    const rec = toCardRecord(card, []);
    cards.push(rec);
    // First playable, non-Un-set card wins a name; Un-set only fills a gap.
    const existing = idByName.get(rec.name);
    if (!existing || (!rec.unset && cards.find((c) => c.id === existing)?.unset)) {
      idByName.set(rec.name, rec.id);
    }
  }

  log('applying overlay');
  const overlay = JSON.parse(await readFile(opts.overlayPath, 'utf8')) as TagOverlay;
  const overlayReport = applyOverlay(tagMap, overlay, idByName);

  let taggedCards = 0;
  let unset = 0;
  for (const rec of cards) {
    const set = tagMap.get(rec.id);
    if (set && set.size > 0) {
      rec.tags = [...set].sort();
      taggedCards++;
    }
    if (rec.unset) unset++;
  }
  cards.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));

  const pack: DataPack = {
    schema: DATA_SCHEMA_VERSION,
    version,
    builtAt: new Date().toISOString(),
    cardCount: cards.length,
    cards,
  };

  log('writing pack');
  await mkdir(opts.outDir, { recursive: true });
  const packPath = path.join(opts.outDir, PACK_FILE);
  const gzPath = path.join(opts.outDir, RELEASE_ASSET);
  const json = JSON.stringify(pack);
  await writeFile(packPath, json);
  const gz = gzipSync(Buffer.from(json), { level: 9 });
  await writeFile(gzPath, gz);

  const manifest: DataManifest = {
    schema: DATA_SCHEMA_VERSION,
    version,
    url: `https://github.com/${opts.repo}/releases/download/data-${version}/${RELEASE_ASSET}`,
    sha256: createHash('sha256').update(gz).digest('hex'),
    bytes: gz.length,
    cardCount: cards.length,
  };
  await writeFile(
    path.join(opts.outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  return {
    version,
    cardCount: cards.length,
    skipped,
    unset,
    taggedCards,
    overlayUnknown: overlayReport.unknownNames,
    packPath,
    gzPath,
    manifest,
  };
}
