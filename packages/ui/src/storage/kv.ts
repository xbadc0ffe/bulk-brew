// Tiny promise-based key-value store on IndexedDB, with an in-memory fallback
// for environments that have no IndexedDB (tests, private windows that block it).

import { STORAGE_KEYS } from './keys.ts';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  /** Write several keys so that either all or none land. */
  setMany(entries: [key: string, value: unknown][]): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = 'bulk-brew';
const STORE = 'kv';

let persistAsked = false;

/**
 * Safari can clear a site's storage after seven days without a visit, so once
 * the bulk list or the decks are saved, ask once per session to keep it.
 */
function askToPersist(keys: string[]): void {
  if (persistAsked || !keys.some((k) => k === STORAGE_KEYS.pool || k === STORAGE_KEYS.decks))
    return;
  persistAsked = true;
  try {
    // Missing in workers, tests, and older browsers.
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (typeof storage?.persist === 'function') storage.persist().catch(() => {});
  } catch {
    // Saving works without it.
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
  });
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'));
  });
}

class IndexedDbStore implements KeyValueStore {
  private db: Promise<IDBDatabase> | undefined;

  private tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    this.db ??= openDb();
    return this.db.then((db) => db.transaction(STORE, mode).objectStore(STORE));
  }

  async get<T>(key: string): Promise<T | undefined> {
    const store = await this.tx('readonly');
    return (await request(store.get(key))) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const store = await this.tx('readwrite');
    await request(store.put(value, key));
    askToPersist([key]);
  }

  async setMany(entries: [string, unknown][]): Promise<void> {
    const store = await this.tx('readwrite');
    for (const [key, value] of entries) store.put(value, key);
    await complete(store.transaction);
    askToPersist(entries.map(([key]) => key));
  }

  async delete(key: string): Promise<void> {
    const store = await this.tx('readwrite');
    await request(store.delete(key));
  }
}

class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }
  async setMany(entries: [string, unknown][]): Promise<void> {
    for (const [key, value] of entries) this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export function openKv(): KeyValueStore {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDbStore();
  } catch {
    // fall through
  }
  return new MemoryStore();
}
