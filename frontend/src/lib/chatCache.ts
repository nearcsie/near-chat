/**
 * Local chat storage (#678). Everything the client keeps between sessions
 * lives here, in IndexedDB, and nowhere else.
 *
 * IndexedDB rather than localStorage: not for size, but because localStorage
 * shares one origin quota with the session keys (`user`, `theme`, `notify-*`).
 * A cache that fills that quota would take the login flow down with it.
 *
 * Layout: one database per (schema version, user), named by
 * `chatCacheDbName`. Isolation between accounts and between schema versions is
 * therefore structural — code for version N never opens a version N-1
 * database, it only deletes it — and purging is a `deleteDatabase` by name
 * rather than a scan over records.
 *
 * Nothing here ever rejects or throws. When IndexedDB is missing, disabled,
 * slow to open, over quota or closed underneath us, reads answer "nothing
 * stored" and writes are dropped, so realtime chat keeps working on the
 * in-memory state it already has.
 *
 * Credentials never belong in here: the access token is module state in
 * `api.ts` and the refresh token is an HttpOnly cookie.
 */

export const CHAT_CACHE_SCHEMA_VERSION = 1;

const DB_PREFIX = "near-chat-cache:";
// The IndexedDB version stays at 1 for every schema version: a schema change
// gets a new database name instead of an in-place upgrade.
const DB_VERSION = 1;
const META_STORE = "meta";
const SYNC_CURSOR_KEY = "syncCursor";
const OPEN_TIMEOUT_MS = 2_000;
// Where the cursor lived before this module existed.
const LEGACY_SESSION_CURSOR_PREFIX = "near:syncCursor:";

export const chatCacheDbName = (
  userId: string,
  schemaVersion: number = CHAT_CACHE_SCHEMA_VERSION,
): string => `${DB_PREFIX}v${schemaVersion}:${userId}`;

export interface ChatCacheHandle {
  /** False when there is no usable database behind this handle. */
  available: boolean;
  db: IDBDatabase | null;
}

const unavailable = (): ChatCacheHandle => ({ available: false, db: null });

const getFactory = (): IDBFactory | null => {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    // Some privacy modes throw on mere access.
    return null;
  }
};

const settle = (request: IDBRequest | IDBTransaction, done: () => void): void => {
  if ("oncomplete" in request) {
    request.oncomplete = done;
  } else {
    request.onsuccess = done;
  }
  request.onerror = (event) => {
    event.preventDefault();
    done();
  };
  if ("onabort" in request) request.onabort = done;
};

/**
 * Opens the current-schema database for one user. A handle that comes back
 * `available: false` is still safe to pass to every other function here.
 */
export const openChatCache = (
  userId: string,
  timeoutMs: number = OPEN_TIMEOUT_MS,
): Promise<ChatCacheHandle> => {
  const factory = getFactory();
  if (!factory) return Promise.resolve(unavailable());

  return new Promise((resolve) => {
    let settled = false;
    const finish = (handle: ChatCacheHandle) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(handle);
    };
    // A connection that never opens (another tab stuck in an upgrade, a
    // deletion that cannot finish) must not hold up the sync that waits on it.
    const timer = setTimeout(() => finish(unavailable()), timeoutMs);

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(chatCacheDbName(userId), DB_VERSION);
    } catch {
      finish(unavailable());
      return;
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(META_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        // Timed out already; nobody holds this connection, and a leaked one
        // would block every later deletion of this database.
        db.close();
        return;
      }
      const handle: ChatCacheHandle = { available: true, db };
      // Another tab deleting this database (logout, or its startup purge)
      // needs this connection gone. Once closed the handle stays closed:
      // reopening it here would recreate the database that was just purged.
      const retire = () => {
        handle.available = false;
        db.close();
      };
      db.onversionchange = retire;
      db.onclose = retire;
      finish(handle);
    };
    request.onerror = (event) => {
      event.preventDefault();
      finish(unavailable());
    };
  });
};

export const closeChatCache = (handle: ChatCacheHandle): void => {
  handle.available = false;
  handle.db?.close();
};

const toCursor = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** The stored sync cursor, or 0 when there is none or it cannot be read. */
export const readSyncCursor = (handle: ChatCacheHandle): Promise<number> => {
  const db = handle.db;
  if (!handle.available || !db) return Promise.resolve(0);

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(META_STORE, "readonly");
      const request = transaction.objectStore(META_STORE).get(SYNC_CURSOR_KEY);
      settle(request, () => resolve(request.error ? 0 : toCursor(request.result)));
      settle(transaction, () => resolve(0));
    } catch {
      resolve(0);
    }
  });
};

/**
 * Stores the sync cursor. The transaction is created synchronously, so writes
 * issued one after another on the same handle commit in that order. A failed
 * write (quota, closed connection) is dropped: the caller's in-memory cursor
 * stays authoritative for the session and the next write tries again.
 */
export const writeSyncCursor = (handle: ChatCacheHandle, cursor: number): Promise<void> => {
  const db = handle.db;
  if (!handle.available || !db) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(META_STORE, "readwrite");
      settle(transaction, () => resolve());
      transaction.objectStore(META_STORE).put(cursor, SYNC_CURSOR_KEY);
    } catch {
      resolve();
    }
  });
};

const dropLegacySessionCursors = (): void => {
  try {
    const stale: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(LEGACY_SESSION_CURSOR_PREFIX)) stale.push(key);
    }
    for (const key of stale) sessionStorage.removeItem(key);
  } catch {
    // sessionStorage unavailable: nothing was ever written there either.
  }
};

const deleteDatabase = (factory: IDBFactory, name: string): Promise<void> =>
  new Promise((resolve) => {
    try {
      // `blocked` is left alone on purpose: every connection this module
      // opens closes itself on `versionchange`, so the deletion proceeds.
      settle(factory.deleteDatabase(name), () => resolve());
    } catch {
      resolve();
    }
  });

const deleteCacheDatabases = async (
  shouldDelete: (name: string) => boolean,
  alsoDelete: string[] = [],
): Promise<void> => {
  const factory = getFactory();
  if (!factory) return;

  const names = new Set(alsoDelete);
  // `databases()` is missing in older browsers. Without it only the names the
  // caller already knows get deleted; the per-user names keep the rest apart.
  if (typeof factory.databases === "function") {
    try {
      for (const { name } of await factory.databases()) {
        if (name?.startsWith(DB_PREFIX) && shouldDelete(name)) names.add(name);
      }
    } catch {
      // Listing failed; fall through with what we have.
    }
  }
  await Promise.all([...names].map((name) => deleteDatabase(factory, name)));
};

/**
 * Deletes every cached database except the current-schema one of `userId`:
 * other accounts that used this browser, and this account's older schema
 * versions. Run once the signed-in user is verified.
 */
export const purgeAllExcept = (userId: string): Promise<void> => {
  dropLegacySessionCursors();
  const keep = chatCacheDbName(userId);
  return deleteCacheDatabases((name) => name !== keep);
};

/**
 * Deletes everything this module has stored, for an explicit logout. The
 * caller's `userId`, when known, is deleted by name even where the browser
 * cannot list databases.
 */
export const purgeChatCache = (userId?: string): Promise<void> => {
  dropLegacySessionCursors();
  return deleteCacheDatabases(() => true, userId ? [chatCacheDbName(userId)] : []);
};
