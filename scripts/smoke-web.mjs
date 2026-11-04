#!/usr/bin/env node
// End-to-end smoke test of the web app in a headless Chromium browser (Edge
// or Chrome) over the DevTools protocol. Drives the main loop a person uses:
// load, paste a list, import it, open the Bulk List, open the strongest deck
// option, leave and come back, accept it (which removes its cards), confirm
// the list shrank, and see the deck on Decks.
//
// Usage: node scripts/smoke-web.mjs [appUrl] [poolFile] [outDir]
//   appUrl   default http://localhost:4173/ (a `vite preview` of the web build)
//   poolFile default eval/pools/white-bulk.txt
//   outDir   default .smoke/ (screenshots and a throwaway browser profile)
// Set BULK_BREW_BROWSER to a browser executable to override the search.
// SMOKE_COLORS (such as "White,Blue"), SMOKE_STYLE, and SMOKE_SECONDARY pick
// other choices; SMOKE_SIZE=100 with SMOKE_COMMANDER (part of a name) runs
// Commander.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = process.argv[2] ?? 'http://localhost:4173/';
const poolFile = path.resolve(ROOT, process.argv[3] ?? 'eval/pools/white-bulk.txt');
const outDir = path.resolve(ROOT, process.argv[4] ?? '.smoke');
const PORT = 9333;

const BROWSERS = [
  process.env.BULK_BREW_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browserPath = BROWSERS.find((p) => existsSync(p));
if (!browserPath) {
  console.error('No Chromium browser found. Set BULK_BREW_BROWSER to its executable.');
  process.exit(1);
}

// A fresh profile each run so the pool and decks start empty.
const profile = path.join(outDir, 'browser-profile');
rmSync(profile, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let nextId = 1;
const pending = new Map();
let ws;
let pageErrors = 0;

async function waitForDevtools() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      // browser still starting
    }
    await sleep(250);
  }
  throw new Error('browser DevTools did not come up');
}

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page script failed: ${r.exceptionDetails.text}`);
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(r.data, 'base64'));
}

const pageText = () => evaluate('document.body.innerText');

async function waitForText(re, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const t = await pageText();
    if (re.test(t)) return t;
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${re}`);
}

/** Click the first (or last) button whose trimmed text matches the pattern. */
async function click(pattern, which = 'first') {
  const ok = await evaluate(`(() => {
    const re = new RegExp(${JSON.stringify(pattern)});
    const all = [...document.querySelectorAll('button')].filter((b) => re.test(b.textContent.trim()));
    const b = ${JSON.stringify(which)} === 'last' ? all[all.length - 1] : all[0];
    if (!b) return false;
    b.click();
    return true;
  })()`);
  if (!ok) throw new Error(`no button matching /${pattern}/`);
  await sleep(300);
}

function log(step, info) {
  console.log(`[${step}] ${info}`);
}

const oneLine = (t, n) => t.replace(/\s*\n+\s*/g, ' | ').slice(0, n);

try {
  const page = await waitForDevtools();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors++;
      log('page-error', msg.params.exceptionDetails.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors++;
      log('console-error', msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: appUrl });
  await waitForText(/Your bulk list is empty|unique/, 30000);
  log('load', `card data loaded from ${appUrl}`);

  const pool = readFileSync(poolFile, 'utf8');
  // The sidebar reads "Bulk List 1,234".
  const poolCount = async () => {
    const m = (await waitForText(/Bulk List\s+[\d,]+/)).match(/Bulk List\s+([\d,]+)/);
    return Number(m[1].replace(/,/g, ''));
  };
  // The empty Bulk List offers Import.
  await click('^Import$', 'last');
  await evaluate(`(() => {
    const ta = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, ${JSON.stringify(pool)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  log(
    'check',
    oneLine((await waitForText(/cards matched/)).match(/[\d,]+\s+cards matched/)[0], 80),
  );
  await click('^Import [\\d,]+ cards?$');
  log('import', (await waitForText(/Added [\d,]+ cards?/)).match(/Added[^\n]*/)[0]);
  await shot('1-import');

  await click('^Bulk List');
  await waitForText(/unique/);
  const before = await poolCount();
  log('pool', `${before} cards`);
  await shot('2-pool');

  await click('^Build$');
  // SMOKE_SIZE=100 builds Commander: pick SMOKE_COMMANDER (part of a name) from the list.
  const size = process.env.SMOKE_SIZE ?? '60';
  await click(`^${size}$`);
  if (size === '100') {
    await waitForText(/Pick a commander/, 30000);
    await shot('3-commanders');
    await click(process.env.SMOKE_COMMANDER ?? 'Dion');
  } else {
    // Color tiles read like "W White 754 cards". SMOKE_COLORS picks several, such as "White,Blue".
    const colorNames = (process.env.SMOKE_COLORS ?? 'White').split(',');
    for (const name of colorNames) await click(`${name}\\d`);
  }
  // Open the rarity drop-down so the form screenshot shows it, then close it.
  await click('^All rarities');
  await waitForText(/Mythic/, 5000);
  await click('^All rarities');
  // SMOKE_STYLE and SMOKE_SECONDARY pick styles from the drop-downs, such as "Tokens" and "Aggro".
  if (process.env.SMOKE_STYLE) {
    await click('^Best fit');
    await click(`^${process.env.SMOKE_STYLE}`);
    if (process.env.SMOKE_SECONDARY) {
      await click('^None');
      await click(`^${process.env.SMOKE_SECONDARY}`);
    }
  }
  // Options build in the background; wait for them to finish, then open the strongest.
  log('options', oneLine(await waitForText(/options?, strongest first/, 60000), 160));
  await shot('3-build-options');
  await click('strength', 'first');
  log('deck', oneLine(await waitForText(/Accept/, 30000), 160));
  await shot('3-deck');

  await click('^Bulk List');
  await waitForText(/unique/);
  await click('^Build$');
  await waitForText(/Back to options/, 5000);
  log('navigation', 'opened deck survived a trip to the Bulk List');

  await click('^Accept$');
  // The confirmation's own Accept button comes last.
  await waitForText(/save the deck and remove the cards/);
  await click('^Accept$', 'last');
  log('accept', oneLine((await waitForText(/Saved "/)).match(/Saved "[^\n]*/)[0], 160));
  // The commander left the pool with its deck, so the commander list comes back.
  if (size === '100') log('commander-cleared', (await waitForText(/Pick a commander/)).length > 0);

  await click('^Bulk List');
  await waitForText(/unique/);
  const after = await poolCount();
  log('pool-after', `${before} before, ${after} after`);
  if (after >= before) throw new Error('the bulk list did not shrink after Accept');

  await click('^Decks');
  log('decks', oneLine(await waitForText(/1 saved/), 160));
  await shot('4-decks');

  if (pageErrors > 0) throw new Error(`${pageErrors} page or console errors`);
  log('done', `ok, screenshots in ${path.relative(ROOT, outDir) || '.'}`);
} catch (err) {
  log('FAIL', err instanceof Error ? err.message : String(err));
  try {
    await shot('fail');
  } catch {
    // page may be gone
  }
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    // already closed
  }
  browser.kill();
}
