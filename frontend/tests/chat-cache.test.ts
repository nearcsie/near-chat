/**
 * Local chat storage (#678): the module on its own, then the sync cursor as
 * its first consumer through the real ChatProvider.
 */
import { createElement, useEffect } from "react";
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useChat } from "@/context/ChatContext";
import {
  CHAT_CACHE_SCHEMA_VERSION,
  chatCacheDbName,
  closeChatCache,
  openChatCache,
  purgeAllExcept,
  purgeChatCache,
  readSyncCursor,
  writeSyncCursor,
} from "@/lib/chatCache";
import { ME_ID } from "./fixtures";
import { mountChatApp } from "./harness";
import { __getApiCallLog, __queueSyncAdvance } from "./mocks/api";

const OTHER_USER = "u-someone-else";

const seedCursor = async (userId: string, cursor: number): Promise<void> => {
  const cache = await openChatCache(userId);
  await writeSyncCursor(cache, cursor);
  closeChatCache(cache);
};

const storedCursor = async (userId: string): Promise<number> => {
  const cache = await openChatCache(userId);
  try {
    return await readSyncCursor(cache);
  } finally {
    closeChatCache(cache);
  }
};

const cacheDatabases = async (): Promise<string[]> =>
  (await indexedDB.databases())
    .map(({ name }) => name ?? "")
    .filter((name) => name.startsWith("near-chat-cache:"))
    .sort();

/** Writes a cursor the way a build with an older schema version would have. */
const seedOlderSchemaCursor = (userId: string, cursor: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(chatCacheDbName(userId, CHAT_CACHE_SCHEMA_VERSION - 1), 1);
    request.onupgradeneeded = () => request.result.createObjectStore("meta");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("meta", "readwrite");
      transaction.objectStore("meta").put(cursor, "syncCursor");
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });

const syncCursorsSent = (): number[] =>
  __getApiCallLog("syncChanges").map((call) => call.args[0] as number);

const reconnect = (socket: { disconnect: () => unknown; connect: () => unknown }) => {
  act(() => {
    socket.disconnect();
    socket.connect();
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chatCache module", () => {
  test("reads back the cursor it stored for the same user", async () => {
    await seedCursor(ME_ID, 42);
    expect(await storedCursor(ME_ID)).toBe(42);
  });

  test("keeps users apart: another user reads 0", async () => {
    await seedCursor(ME_ID, 42);
    expect(await storedCursor(OTHER_USER)).toBe(0);
    expect(await storedCursor(ME_ID)).toBe(42);
  });

  test("never opens an older schema version, and the startup purge deletes it", async () => {
    await seedOlderSchemaCursor(ME_ID, 900);

    expect(await storedCursor(ME_ID)).toBe(0);

    await purgeAllExcept(ME_ID);
    expect(await cacheDatabases()).toEqual([chatCacheDbName(ME_ID)]);
  });

  test("the startup purge keeps only the signed-in user's current database", async () => {
    await seedCursor(ME_ID, 42);
    await seedCursor(OTHER_USER, 7);

    await purgeAllExcept(ME_ID);

    expect(await cacheDatabases()).toEqual([chatCacheDbName(ME_ID)]);
    expect(await storedCursor(ME_ID)).toBe(42);
  });

  test("purgeChatCache deletes every user's database and the legacy session keys", async () => {
    await seedCursor(ME_ID, 42);
    await seedCursor(OTHER_USER, 7);
    sessionStorage.setItem(`near:syncCursor:${ME_ID}`, "42");
    sessionStorage.setItem("unrelated", "kept");

    await purgeChatCache(ME_ID);

    expect(await cacheDatabases()).toEqual([]);
    expect(sessionStorage.getItem(`near:syncCursor:${ME_ID}`)).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("kept");
  });

  test("a deletion from elsewhere is not blocked by an open handle", async () => {
    const cache = await openChatCache(ME_ID);
    await writeSyncCursor(cache, 42);

    // Another tab logging out: this handle has to let go, and stay let go.
    await purgeChatCache(ME_ID);

    expect(cache.available).toBe(false);
    expect(await readSyncCursor(cache)).toBe(0);
    await writeSyncCursor(cache, 43);
    expect(await cacheDatabases()).toEqual([]);
  });

  test("degrades to no-ops when IndexedDB is missing", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error -- simulating a browser without IndexedDB
    globalThis.indexedDB = undefined;
    try {
      const cache = await openChatCache(ME_ID);
      expect(cache.available).toBe(false);
      expect(await readSyncCursor(cache)).toBe(0);
      await expect(writeSyncCursor(cache, 5)).resolves.toBeUndefined();
      await expect(purgeAllExcept(ME_ID)).resolves.toBeUndefined();
      await expect(purgeChatCache(ME_ID)).resolves.toBeUndefined();
    } finally {
      globalThis.indexedDB = original;
    }
  });

  test("swallows a quota error on write", async () => {
    await seedCursor(ME_ID, 42);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    const cache = await openChatCache(ME_ID);
    await expect(writeSyncCursor(cache, 43)).resolves.toBeUndefined();
    closeChatCache(cache);

    vi.restoreAllMocks();
    expect(await storedCursor(ME_ID)).toBe(42);
  });
});

describe("sync cursor through ChatProvider", () => {
  test("survives a remount for the same user", async () => {
    const first = await mountChatApp("/chat/room-1");
    __queueSyncAdvance(700);
    reconnect(first.socket());
    await first.settle();
    await waitFor(async () => expect(await storedCursor(ME_ID)).toBe(700));
    first.view.unmount();

    await mountChatApp("/chat/room-1");
    expect(syncCursorsSent()[0]).toBe(700);
  });

  test("starts from 0 when only an older schema version has a cursor", async () => {
    await seedOlderSchemaCursor(ME_ID, 900);

    await mountChatApp("/chat/room-1");

    expect(syncCursorsSent()[0]).toBe(0);
    await waitFor(async () => {
      expect(await cacheDatabases()).toEqual([chatCacheDbName(ME_ID)]);
    });
  });

  test("purges another account's data once the signed-in user is verified", async () => {
    await seedCursor(OTHER_USER, 7);

    await mountChatApp("/chat/room-1");

    await waitFor(async () => {
      expect(await cacheDatabases()).toEqual([chatCacheDbName(ME_ID)]);
    });
  });

  test("explicit logout leaves nothing behind for the old user", async () => {
    let logout: (() => void) | undefined;
    function LogoutProbe() {
      const { handleLogout } = useChat();
      useEffect(() => {
        logout = handleLogout;
      });
      return null;
    }
    const app = await mountChatApp("/chat/room-1", { probe: createElement(LogoutProbe) });
    __queueSyncAdvance(700);
    reconnect(app.socket());
    await app.settle();
    await waitFor(async () => expect(await storedCursor(ME_ID)).toBe(700));

    act(() => logout!());

    await waitFor(async () => expect(await cacheDatabases()).toEqual([]));
  });

  test("an expired token keeps the stored cursor", async () => {
    await seedCursor(ME_ID, 500);
    const app = await mountChatApp("/chat/room-1");

    act(() => {
      window.dispatchEvent(new Event("auth:token-expired"));
    });
    await app.settle();

    expect(await cacheDatabases()).toEqual([chatCacheDbName(ME_ID)]);
    expect(await storedCursor(ME_ID)).toBe(500);
  });

  test("keeps syncing from the in-memory cursor when the store is over quota", async () => {
    await seedCursor(ME_ID, 500);
    const app = await mountChatApp("/chat/room-1");
    expect(syncCursorsSent()[0]).toBe(500);

    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    __queueSyncAdvance(700);
    reconnect(app.socket());
    await app.settle();
    expect(put).toHaveBeenCalled();

    reconnect(app.socket());
    await app.settle();

    // The write failed, the session did not: the next sync still carries the
    // cursor this tab reached, not 0 and not the stale stored one.
    expect(syncCursorsSent().at(-1)).toBe(700);
    vi.restoreAllMocks();
    expect(await storedCursor(ME_ID)).toBe(500);
  });
});
