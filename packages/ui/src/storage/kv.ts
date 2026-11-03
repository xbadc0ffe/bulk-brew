// Tiny promise-based key-value store on IndexedDB, with an in-memory fallback
// for environments that have no IndexedDB (tests, private windows that block it).

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = 'bulk-brew';
const STORE = 'kv';

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
