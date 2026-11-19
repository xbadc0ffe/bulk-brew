#!/usr/bin/env node
// End-to-end smoke test of the web app in a headless Chromium browser (Edge
// or Chrome) over the DevTools protocol. Drives the main loop a person uses:
// load, paste a list, import it, open the Bulk List, open the strongest deck
// option, leave and come back, open a card (its detail must leave Accept in
// view), replace it from the picker (whose picked card shows large), check
// that Back asks before it drops the change, accept the deck (which removes
// its cards), confirm the list shrank, see the deck on Decks and its Export
// popup, then open the Analyze pane and open its strongest deck.
//
// Usage: node scripts/smoke-web.mjs [appUrl] [poolFile] [outDir]
//   appUrl   default http://localhost:4173/ (a `vite preview` of the web build)
//   poolFile default eval/pools/white-bulk.txt
//   outDir   default .smoke/ (screenshots and a throwaway browser profile)
// Set BULK_BREW_BROWSER to a browser executable to override the search.
// SMOKE_COLORS (such as "White,Blue"), SMOKE_STYLE, and SMOKE_SECONDARY pick
// other choices; SMOKE_SIZE=100 with SMOKE_COMMANDER (part of a name) runs
// Commander, where SMOKE_STYLE filters the commander list first, so it must be
// a style that commander leads. SMOKE_EXPECT_NOTE=1 checks that the first
// option, once open, says the style asked for was short and what was built
// instead ("Asked for Graveyard: ... Built Aristocrats instead."), for a style
// the list marks Short. SMOKE_ART=1 turns card art on before the deck checks,
// and SMOKE_WIDTH sets the window width (default 1280; 420 gives the narrow
// layout, where the picked replacement covers the list until Back to the list).
// SMOKE_PHONE=1 emulates a 390 by 844 touch phone, for the phone layout.
// SMOKE_TEXT (90, 100, 110, 125, or 140) picks that Text size on Settings
// first, checks it survives a reload, and runs the rest at that size.

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
    `--window-size=${process.env.SMOKE_WIDTH ?? 1280},900`,
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
  // A headless window will not go below about 500px wide; emulation does.
  if (process.env.SMOKE_PHONE === '1') {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  }
  await send('Page.navigate', { url: appUrl });
  await waitForText(/Your bulk list is empty|unique/, 30000);
  log('load', `card data loaded from ${appUrl}`);

  // SMOKE_TEXT picks a Text size with the Settings control; the root text scales from 16px.
  const textSize = process.env.SMOKE_TEXT;
  if (textSize) {
    const rootSize = () =>
      evaluate(`parseFloat(getComputedStyle(document.documentElement).fontSize)`);
    const want = (16 * Number(textSize)) / 100;
    await click('^Settings');
    await waitForText(/Text size/, 5000);
    const picked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('[role="group"][aria-label="Text size"] button')].find(
        (x) => x.textContent.trim() === ${JSON.stringify(`${textSize}%`)},
      );
      b?.click();
      return !!b;
    })()`);
    if (!picked) throw new Error(`Settings offers no ${textSize}% text size`);
    await sleep(300);
    if (Math.abs((await rootSize()) - want) > 0.05)
      throw new Error(`Text size ${textSize}% gave ${await rootSize()}px text, not ${want}px`);
    await shot('0-settings');
    await send('Page.reload');
    await sleep(1000);
    await waitForText(/Your bulk list is empty|unique/, 30000);
    if (Math.abs((await rootSize()) - want) > 0.05)
      throw new Error(`Text size ${textSize}% was lost on reload`);
    log('text-size', `${textSize}%: root text ${want}px, kept after a reload`);
  }

  const phone = process.env.SMOKE_PHONE === '1';
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

  // On a phone the Bulk List has two-line rows, and a card, the filters, and the sort
  // each roll up in a sheet that its handle closes.
  if (phone) {
    const closeSheet = async (label) => {
      await evaluate(
        `document.querySelector('[role="dialog"] button[aria-label="Close ${label}"]').click()`,
      );
      await sleep(400);
      if (await evaluate(`!!document.querySelector('[role="dialog"]')`))
        throw new Error(`the ${label} sheet stayed open`);
    };
    const name = await evaluate(`(() => {
      const b = document.querySelector('[data-row] button');
      const r = b.getBoundingClientRect();
      b.click();
      return { text: b.textContent, width: Math.round(r.width) };
    })()`);
    await sleep(500);
    if (!(await evaluate(`!!document.querySelector('[role="dialog"][aria-label="Card detail"]')`)))
      throw new Error('a card did not open in a sheet');
    if (name.width < 150) throw new Error(`card names get only ${name.width}px`);
    await shot('2-pool-card');
    // Next and previous step through the list and go around its ends.
    const openName = () => evaluate(`document.querySelector('[role="dialog"] h2').textContent`);
    await evaluate(
      `document.querySelector('[role="dialog"] button[aria-label="Next card"]').click()`,
    );
    await sleep(300);
    const second = await openName();
    if (second === name.text) throw new Error('Next card did not move to another card');
    for (let i = 0; i < 2; i++) {
      await evaluate(
        `document.querySelector('[role="dialog"] button[aria-label="Previous card"]').click()`,
      );
      await sleep(300);
    }
    const last = await openName();
    if (last === name.text || last === second)
      throw new Error('Previous card from the first card did not go to the last');
    // A swipe to the right goes back one, here from the last card to the one before it.
    const touch = (type, x) =>
      send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y: 500 }],
      });
    await touch('touchStart', 80);
    for (const x of [120, 180, 240, 300]) await touch('touchMove', x);
    await touch('touchEnd');
    await sleep(300);
    const swiped = await openName();
    if (swiped === last) throw new Error('a swipe did not move to another card');
    log('phone-step', `${name.text}, ${second}, around to ${last}, a swipe back to ${swiped}`);
    await closeSheet('Card detail');
    await evaluate(`document.querySelector('button[aria-label^="Filters"]').click()`);
    await sleep(500);
    await click('^Creature\\d');
    await shot('2-pool-filters');
    const badge = await evaluate(
      `document.querySelector('button[aria-label^="Filters"]').getAttribute('aria-label')`,
    );
    if (badge !== 'Filters, 1 on') throw new Error(`the Filters button reads "${badge}"`);
    await click('^Clear filters$');
    await closeSheet('Filters');
    await evaluate(`document.querySelector('button[aria-label="Sort and select"]').click()`);
    await sleep(500);
    await shot('2-pool-sort');
    await closeSheet('Sort and select');
    // The phone's Back closes a sheet and stays in the app, and closed sheets leave no
    // history entry behind.
    const sheetEntry = () => evaluate(`history.state?.sheet === true`);
    if (await sheetEntry()) throw new Error('a closed sheet left its history entry');
    await evaluate(`document.querySelector('[data-row] button').click()`);
    await sleep(500);
    if (!(await sheetEntry())) throw new Error('an open sheet has no history entry');
    await evaluate(`history.back()`);
    await sleep(600);
    if (await evaluate(`!!document.querySelector('[role="dialog"]')`))
      throw new Error('Back left the card sheet open');
    if ((await sheetEntry()) || !/unique/.test(await pageText()))
      throw new Error('Back with a sheet open left the Bulk List');
    const wide = await evaluate(`document.documentElement.scrollWidth > innerWidth`);
    if (wide) throw new Error('the Bulk List scrolls sideways');
    log('phone', `${name.text} gets ${name.width}px; card, filter, and sort sheets open and close`);
  }

  await click('^Build$');
  // SMOKE_SIZE=100 builds Commander: pick SMOKE_COMMANDER (part of a name) from the list.
  const size = process.env.SMOKE_SIZE ?? '60';
  await click(`^${size}$`);
  // SMOKE_STYLE and SMOKE_SECONDARY pick styles from the drop-downs, such as "Tokens" and "Aggro".
  const pickStyles = async () => {
    if (!process.env.SMOKE_STYLE) return;
    await click('^Best fit');
    // The list fills once the color scans are in.
    await waitForText(new RegExp(`\\n${process.env.SMOKE_STYLE}\\n`), 30000);
    // The primary list as offered: each style's name and its label (Viable, Short, Near miss).
    const offered = await evaluate(`[...document.querySelectorAll(
      '[role="menu"][aria-label="Primary archetype"] [role="menuitemradio"]',
    )].map((b) => {
      const [name, state] = [b.querySelector('span span'), b.lastElementChild];
      return name.textContent + (state && state.textContent ? ' (' + state.textContent + ')' : '');
    }).join(', ')`);
    log('styles', offered);
    await shot('3-styles');
    await click(`^${process.env.SMOKE_STYLE}`);
    if (process.env.SMOKE_SECONDARY) {
      await click('^None');
      await click(`^${process.env.SMOKE_SECONDARY}`);
    }
  };
  if (size === '100') {
    const commander = process.env.SMOKE_COMMANDER ?? 'Dion';
    await waitForText(/Pick a commander/, 30000);
    await shot('3-commanders');
    // Styles go first: a setting changed under a picked commander returns to the list.
    await pickStyles();
    await click(commander);
    await waitForText(/Change Commander/, 10000);
    // Add a color the commander lacks: the list comes back with the commander still in it.
    const added = await evaluate(`(() => {
      const b = [...document.querySelectorAll('[aria-label="Colors"] button')].find(
        (x) => x.getAttribute('aria-pressed') === 'false' && x.getAttribute('aria-disabled') === 'false',
      );
      if (!b) return '';
      b.click();
      return b.textContent.replace(/[\\d\\s].*$/, '');
    })()`);
    if (added) {
      await waitForText(/Pick a commander/, 10000);
      log('commander-settings', `adding ${added} returned to the commander list`);
      await click(commander);
      await waitForText(/Change Commander/, 10000);
    } else {
      log('commander-settings', 'skipped: no color left to add for this pool');
    }
  } else {
    // Color tiles read like "W White 754 cards". SMOKE_COLORS picks several, such as "White,Blue".
    const colorNames = (process.env.SMOKE_COLORS ?? 'White').split(',');
    for (const name of colorNames) await click(`${name}\\d`);
  }
  // Open the rarity drop-down so the form screenshot shows it, then close it.
  await click('^All rarities');
  await waitForText(/Mythic/, 5000);
  await click('^All rarities');
  if (size !== '100') await pickStyles();
  // Options build in the background; wait for them to finish, then open the strongest.
  // A screen-reader line announces the finished list.
  log('options', oneLine(await waitForText(/deck options? ready/, 60000), 160));
  await shot('3-build-options');
  // On a phone the options sit under the form; bring the first card into view.
  if (phone) {
    await evaluate(`document.getElementById('options-title').scrollIntoView()`);
    await sleep(300);
    await shot('3-option-card');
  }
  // Each option card has an Open button over it; the first card is the strongest.
  const openStrongest = async () => {
    await click('^Open ', 'first');
    return waitForText(/Accept/, 30000);
  };
  log('deck', oneLine(await openStrongest(), 160));
  await shot('3-deck');
  if (process.env.SMOKE_EXPECT_NOTE === '1') {
    const note = (await pageText()).match(
      /Asked for [^:\n]+: your bulk list has [^\n]+?\. Built [^\n]+? instead\./,
    );
    if (!note) throw new Error('the deck view does not say the style asked for was short');
    log('note', note[0]);
  }

  // Build while a deck is open goes back to the options, like Back.
  await click('^Build$');
  await waitForText(/Deck options/, 5000);
  log('navigation', 'Build went back to the options');
  await openStrongest();

  await click('^Bulk List');
  await waitForText(/unique/);
  await click('^Build$');
  await waitForText(/Accept/, 5000);
  log('navigation', 'opened deck survived a trip to the Bulk List');
  if (process.env.SMOKE_ART === '1') {
    await click('^Settings');
    await sleep(500);
    await evaluate(`document.querySelector('[aria-label="Show card art"]').click()`);
    await sleep(300);
    await click('^Build$');
    await waitForText(/Accept/, 5000);
    log('art', 'card art on');
  }

  // A card opens below the deck header, so Accept, Back, and Export stay in view.
  const opened = await evaluate(`(() => {
    const group = [...document.querySelectorAll('section[aria-label]')].find(
      (s) => !['Lands', 'Commander'].includes(s.getAttribute('aria-label')) && s.querySelector('li button'),
    );
    const b = group?.querySelector('li button');
    if (!b) return '';
    b.click();
    return b.textContent.trim();
  })()`);
  if (!opened) throw new Error('no card to open in the deck list');
  await sleep(300);
  // A phone shows the card in a sheet over the page instead.
  const cardOpen = phone
    ? '[role="dialog"][aria-label="Card detail"]'
    : 'aside[aria-label="Card detail"]';
  const layout = await evaluate(`(() => {
    const pane = document.querySelector('${cardOpen}');
    const accept = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Accept');
    if (!pane || !accept) return undefined;
    const a = accept.getBoundingClientRect();
    const hit = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
    return { paneTop: pane.getBoundingClientRect().top, acceptBottom: a.bottom, onTop: accept.contains(hit) };
  })()`);
  if (!layout) throw new Error(`opening ${opened} showed no card detail`);
  if (!phone && (layout.paneTop < layout.acceptBottom || !layout.onTop))
    throw new Error('the card detail covers the deck actions');
  await shot('3-card-detail');
  // Replace offers cards from the bulk list; picking one swaps it in.
  await click('^Replace this card$');
  await waitForText(/Pick a card to swap in\./, 5000);
  await evaluate(`document.querySelector('[role="dialog"] li button').click()`);
  await sleep(600);
  // The picked card shows large: beside the list, or over it on a narrow window.
  const preview = await evaluate(`(() => {
    const s = document.querySelector('[role="dialog"] section[aria-label^="Coming in: "]');
    const card = s?.querySelector('img, div[title]');
    return s ? { label: s.getAttribute('aria-label'), width: card?.getBoundingClientRect().width ?? 0 } : undefined;
  })()`);
  if (!preview || preview.width < 300)
    throw new Error(`picking a card showed no large view of it (${JSON.stringify(preview)})`);
  log('replace', `${preview.label}, ${Math.round(preview.width)}px wide`);
  await shot('3-replace');
  // On a narrow window the large card covers the list until Back to the list.
  const narrow = await evaluate(`(() => {
    const b = [...document.querySelectorAll('[role="dialog"] section button')].find(
      (x) => x.textContent.trim() === 'Back to the list',
    );
    b?.click();
    return !!b;
  })()`);
  if (narrow) {
    await sleep(300);
    if (
      await evaluate(
        `!!document.querySelector('[role="dialog"] section[aria-label^="Coming in: "]')`,
      )
    )
      throw new Error('Back to the list left the large card up');
    log('replace', 'Back to the list returned to the options');
  }
  await click('^Replace$');
  log(
    'replace',
    (await waitForText(/Replaced [^\n]+ with [^\n]+\./, 5000)).match(/Replaced[^\n]*/)[0],
  );
  // Back asks before it drops the change, and a header button closes the card detail.
  // On a phone the card's sheet covers the actions, so it is closed first.
  if (phone) {
    await evaluate(
      `document.querySelector('[role="dialog"] button[aria-label="Close Card detail"]').click()`,
    );
    await sleep(400);
  }
  await click('^Back$');
  await waitForText(/Discard your changes\?/, 5000);
  if (await evaluate(`!!document.querySelector('${cardOpen}')`))
    throw new Error('the card detail stayed open after Back');
  await click('^Keep editing$');
  if (!/Accept/.test(await pageText())) throw new Error('Keep editing left the deck');
  log('replace', 'Back asked first; the deck and its change stayed');

  await click('^Accept$');
  // The dialog stacks Confirm (remove), Confirm (keep), and Decline.
  await waitForText(/Remove cards from bulk list/);
  await shot('3-accept-dialog');
  // The label and its detail line run together in textContent.
  await click('^ConfirmRemove cards from bulk list$');
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

  // A row's Export asks in a popup, as Remove does, and a choice there leaves the list showing.
  await click('^Export$');
  await waitForText(/Export "[^"\n]+"/, 5000);
  const choices = await evaluate(
    `[...document.querySelectorAll('[role="alertdialog"] button')].map((b) => b.textContent.trim())`,
  );
  for (const want of ['Copy as text', 'Download .txt', 'Cancel'])
    if (!choices.some((t) => t.startsWith(want))) throw new Error(`Export popup lacks ${want}`);
  await shot('4-export');
  await click('^Copy as text');
  // Headless browsers may refuse the clipboard; either line shows the choice ran.
  const copied = (await waitForText(/Copied "|Copy failed/)).match(/(Copied "|Copy failed)[^\n]*/);
  if (await evaluate(`!!document.querySelector('[role="alertdialog"]')`))
    throw new Error('the Export popup stayed open');
  if (!/1 saved/.test(await pageText())) throw new Error('Export opened the deck behind it');
  log('export', oneLine(copied[0], 120));

  // Analyze searches for the best decks in a worker while it shows; open the strongest one.
  await click('^Bulk List');
  await waitForText(/unique/);
  await click('^Analyze$');
  log('analyze', (await waitForText(/Checked [\d,]+ decks?/, 180000)).match(/Checked[^\n]*/)[0]);
  await shot('5-analyze');
  // Deck rows read like "1White Tokens": the rank, then the name.
  await click('^1[A-Za-z]');
  log('analyze-deck', oneLine(await waitForText(/Accept/, 10000), 160));
  await click('^Back$');
  log('analyze-back', oneLine(await waitForText(/Deck options/, 10000), 120));

  // The learned card data loads beside the pack, and About credits its sources.
  const learned = await evaluate(`(() => {
    const e = performance.getEntriesByType('resource').find((r) => /data\\/learned\\.json/.test(r.name));
    return e ? (e.responseStatus || 200) : 0;
  })()`);
  if (!learned) throw new Error('data/learned.json was never requested');
  log('learned', `data/learned.json answered ${learned}`);
  await click('^About$');
  const about = await waitForText(/Commander Spellbook/, 10000);
  if (!/EDHREC/.test(about)) throw new Error('About does not credit EDHREC');
  log('about', 'credits EDHREC and Commander Spellbook');

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
