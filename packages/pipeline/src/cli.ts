// Entry point for `npm run data:build`. Runs directly under Node 24 (type
// stripping), so this file and its imports must use erasable TypeScript only.
//
// Planned steps (see SPEC.md, "Data pipeline"):
//   1. Read data/raw/oracle_cards.jsonl.gz and data/raw/oracle_tags.jsonl.gz.
//   2. Filter out non-paper cards and non-playable layouts.
//   3. Trim to the CardRecord fields and derive types, entersTapped, unset.
//   4. Join Tagger tags and the local overlay in config/tag-overlay.json.
//   5. Write data/packs/cards.v1.json(.gz) and data/manifest.json.

import { DATA_SCHEMA_VERSION } from '@bulk-brew/core';

function main(): number {
  console.error(`bulk-brew pipeline (schema v${DATA_SCHEMA_VERSION}): not implemented yet.`);
  console.error('Run `npm run data:fetch` first to download the Scryfall bulk files.');
  return 1;
}

process.exitCode = main();
