// Shared by sheets and dialogs, which can sit on top of each other: who holds the
// page inert, and what the phone's Back gesture or button does while a sheet is open.

let inertHolds = 0;

/** Make the page behind inert until the returned release is called; holds stack. */
export function holdInert(): () => void {
  // Sheets and dialogs are portaled outside #root.
  const root = document.getElementById('root');
  inertHolds++;
  root?.setAttribute('inert', '');
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    inertHolds--;
    if (inertHolds === 0) root?.removeAttribute('inert');
  };
}

// Back closes the top sheet instead of leaving the app. Open sheets share one
// history entry. history.back() lands later while pushState lands at once, so the
// entry is settled a tick after the sheets change and never while a back is on its way.
const sheets: { close(): void }[] = [];
let entry = false;
let backPending = false;
let settling = false;
let listening = false;

function settle() {
  settling = false;
  if (backPending) return;
  if (sheets.length > 0 && !entry) {
    history.pushState({ ...(history.state as object | null), sheet: true }, '');
    entry = true;
  } else if (sheets.length === 0 && entry) {
    entry = false;
    backPending = true;
    history.back();
  }
}

function settleSoon() {
  if (settling) return;
  settling = true;
  setTimeout(settle, 0);
}

function onPop() {
  if (backPending) {
    // Our own step back, after the last sheet closed.
    backPending = false;
    settleSoon();
    return;
  }
  if (!entry) return;
  entry = false;
  // A dialog over the sheet keeps both; Back does nothing then.
  const dialog = document.querySelector('[role="alertdialog"], [role="dialog"]:not([data-sheet])');
  if (!dialog) sheets.pop()?.close();
  settleSoon();
}

/** Register an open sheet; Back calls `close`. Returns the release for when it closes. */
export function holdBack(close: () => void): () => void {
  if (!listening) {
    window.addEventListener('popstate', onPop);
    listening = true;
  }
  const sheet = { close };
  sheets.push(sheet);
  settleSoon();
  return () => {
    const i = sheets.indexOf(sheet);
    // Already gone when Back closed it.
    if (i >= 0) sheets.splice(i, 1);
    settleSoon();
  };
}
