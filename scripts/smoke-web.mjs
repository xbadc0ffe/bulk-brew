#!/usr/bin/env node
// End-to-end smoke test of the web app in a headless Chromium browser (Edge
// or Chrome) over the DevTools protocol. Drives the main loop a person uses:
// load, paste a pool, add it, open Pool, build a 60-card deck, leave and come
// back, accept, confirm the pool shrank, and see the deck on Decks.
//
// Usage: node scripts/smoke-web.mjs [appUrl] [poolFile] [outDir]
//   appUrl   default http://localhost:4173/ (a `vite preview` of the web build)
//   poolFile default eval/pools/white-bulk.txt
//   outDir   default .smoke/ (screenshots and a throwaway browser profile)
// Set BULK_BREW_BROWSER to a browser executable to override the search.

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
  await waitForText(/Card data \d{4}-\d{2}-\d{2}/, 30000);
  log('load', `card data loaded from ${appUrl}`);

  const pool = readFileSync(poolFile, 'utf8');
  await evaluate(`(() => {
    const ta = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, ${JSON.stringify(pool)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  await click('^Add to pool$');
  log('import', (await waitForText(/Added \d+ cards/)).match(/Added[^\n]*/)[0]);
  await shot('1-import');

  await click('^Pool$');
  const before = (await waitForText(/distinct/)).match(/All \d+/)?.[0];
  log('pool', before ?? 'no pool total found');
  await shot('2-pool');

  await click('^Build$');
  await click('^60');
  await click('^White');
  await click('^Build', 'last');
  log('deck', oneLine(await waitForText(/Accept/, 30000), 160));
  await shot('3-deck');

  await click('^Pool$');
  await waitForText(/distinct/);
  await click('^Build$');
  await waitForText(/Accept/, 5000);
  log('navigation', 'built deck survived a trip to Pool');

  await click('^Accept');
  log('accept', oneLine((await waitForText(/Saved "/)).match(/Saved "[^\n]*/)[0], 160));

  await click('^Pool$');
  const after = (await waitForText(/distinct/)).match(/All \d+/)?.[0];
  log('pool-after', `${before} before, ${after} after`);
  if (before === after) throw new Error('pool did not shrink after Accept');

  await click('^Decks');
  log('decks', oneLine(await waitForText(/committed/), 160));
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
