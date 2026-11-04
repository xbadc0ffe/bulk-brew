/* global self, caches, fetch, URL, Response */
// Bulk Brew service worker. Each build gets its own shell cache (index,
// manifest, icon, and every emitted asset, so the app opens offline after a
// single visit); the card data pack lives in one shared cache that is
// refreshed in the background, so a deploy does not re-download it. Requests
// to other origins (Scryfall images) are left alone.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const BUILD_CACHE = `bulk-brew-${VERSION}`;
const DATA_CACHE = 'bulk-brew-data';
// The directory the worker lives in: "/" in dev, "/bulk-brew/" on GitHub Pages.
const BASE = new URL('./', self.location.href).pathname;
const INDEX = `${BASE}index.html`;
// Replaced at build time by the Vite plugin in vite.config.ts.
const ASSETS = /* @assets */ [];
const SHELL = [BASE, INDEX, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`, ...ASSETS];

/** Store a response, ignoring quota and other storage failures. */
function safePut(cache, request, response) {
  return cache.put(request, response).catch(() => undefined);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(BUILD_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

// Runs only after install filled the new shell cache, so the old one can go.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('bulk-brew-') && k !== BUILD_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(dropOldPacks)
      .then(() => self.clients.claim()),
  );
});

// Packs were once served as cards.v1.json; drop those so the old copy does not sit in storage.
async function dropOldPacks() {
  const cache = await caches.open(DATA_CACHE);
  for (const request of await cache.keys()) {
    if (/\/data\/cards\.v\d+\.json$/.test(new URL(request.url).pathname)) {
      await cache.delete(request);
    }
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(BUILD_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await safePut(cache, request, response.clone());
  return response;
}

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(BUILD_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await safePut(cache, fallbackKey, response.clone());
    return response;
  } catch {
    return (await cache.match(fallbackKey)) || Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) await safePut(cache, request, response.clone());
      return response;
    })
    .catch(() => undefined);
  // Keep the worker alive until the background refresh lands.
  event.waitUntil(refresh);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith(`${BASE}data/`)) {
    event.respondWith(staleWhileRevalidate(event, DATA_CACHE));
  } else if (request.mode === 'navigate' || url.pathname === BASE || url.pathname === INDEX) {
    event.respondWith(networkFirst(request, INDEX));
  } else if (url.pathname.startsWith(BASE)) {
    event.respondWith(staleWhileRevalidate(event, BUILD_CACHE));
  }
});
