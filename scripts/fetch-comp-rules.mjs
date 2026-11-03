#!/usr/bin/env node
// Downloads the current Magic Comprehensive Rules as plain text into
// docs/rules/. The rules are reference material for development only; they
// are not shipped in the app and not committed to the repo.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = path.join(ROOT, 'docs', 'rules');
const RULES_PAGE = 'https://magic.wizards.com/en/rules';
const USER_AGENT = 'bulk-brew/0.1 (+https://github.com/xbadc0ffe/bulk-brew)';

async function main() {
  const page = await fetch(RULES_PAGE, { headers: { 'User-Agent': USER_AGENT } });
  if (!page.ok) throw new Error(`rules page failed: ${page.status} ${page.statusText}`);
  const html = await page.text();

  const match = /https:\/\/media\.wizards\.com\/[^"']*MagicCompRules[^"']*\.txt/i.exec(html);
  if (!match) throw new Error('could not find the MagicCompRules .txt link on the rules page');
  const url = match[0].replace(/ /g, '%20');
  const version = /(\d{8})\.txt$/.exec(url)?.[1] ?? 'unknown';

  console.log(`downloading rules ${version} from ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`rules download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();

  await mkdir(RULES_DIR, { recursive: true });
  await writeFile(path.join(RULES_DIR, 'MagicCompRules.txt'), text);
  await writeFile(path.join(RULES_DIR, 'VERSION'), `${version}\n${url}\n`);
  console.log(`saved docs/rules/MagicCompRules.txt (version ${version})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
