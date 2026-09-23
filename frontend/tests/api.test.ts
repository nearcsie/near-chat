import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as api from "../src/lib/api";

type ApiCase = {
  name: string;
  invoke: () => Promise<unknown>;
  path: string;
  method?: string;
  body?: unknown;
  authorization?: string | null;
};

const token = "access-token";
const file = () => new File(["hello"], "hello.txt", { type: "text/plain" });

const requestCases: ApiCase[] = [
  { name: "gets admin health", invoke: () => api.getAdminHealth(token), path: "/admin/health" },
  { name: "gets admin metrics", invoke: () => api.getAdminMetrics(token), path: "/admin/metrics" },
  { name: "gets admin logs", invoke: () => api.getAdminLogs(token), path: "/admin/logs" },
  { name: "gets slow queries", invoke: () => api.getAdminSlowQueries(token), path: "/admin/slow-queries" },
  {
    name: "registers an account",
    invoke: () => api.register({ name: "Ada", email: "ada@example.test", password: "password123" }),
    path: "/auth/register",
    method: "POST",
    body: { name: "Ada", email: "ada@example.test", password: "password123" },
    authorization: null,
  },
  {
    name: "logs in",
    invoke: () => api.login({ email: "ada@example.test", password: "password123" }),
    path: "/auth/login",
    method: "POST",
    body: { email: "ada@example.test", password: "password123" },
    authorization: null,
  },
  { name: "logs out", invoke: () => api.logout(token), path: "/auth/logout", method: "POST" },
  { name: "gets the current user", invoke: () => api.getMe(token), path: "/users/me" },
  { name: "gets a user profile", invoke: () => api.getUserProfile("user/1", token), path: "/users/user/1" },
  {
    name: "updates the current user",
    invoke: () => api.updateMe(token, { name: "Grace" }),
    path: "/users/me",
    method: "PATCH",
    body: { name: "Grace" },
  },
  { name: "deletes the current user", invoke: () => api.deleteMe(token), path: "/users/me", method: "DELETE" },
  { name: "gets user settings", invoke: () => api.getMySettings(token), path: "/users/me/settings" },
  {
    name: "updates user settings",
    invoke: () => api.updateMySettings(token, { language: "en", warningEnabled: true }),
    path: "/users/me/settings",
    method: "PATCH",
    body: { language: "en", warningEnabled: true },
  },
  {
    name: "searches users with optional filters",
    invoke: () => api.searchUsers(token, { query: "Ada Lovelace", mode: "name", friendsOnly: true }),
    path: "/users?q=Ada+Lovelace&mode=name&friendsOnly=true",
  },
  { name: "lists friends", invoke: () => api.listFriends(token), path: "/friends" },
  { name: "deletes a friend", invoke: () => api.deleteFriend(token, "friend-1"), path: "/friends/friend-1", method: "DELETE" },
  { name: "lists friend requests", invoke: () => api.listFriendRequests(token), path: "/friend-requests" },
  {
    name: "sends a friend request",
    invoke: () => api.sendFriendRequest(token, "user-2"),
    path: "/friend-requests",
    method: "POST",
    body: { targetUserId: "user-2" },
  },
  {
    name: "responds to a friend request",
    invoke: () => api.respondFriendRequest(token, "user-2", "accepted"),
    path: "/friend-requests/user-2",
    method: "PATCH",
    body: { status: "accepted" },
  },
  { name: "lists blocked users", invoke: () => api.getBlockedUsers(token), path: "/blocks" },
  {
    name: "blocks a user",
    invoke: () => api.blockUser(token, "user-2"),
    path: "/blocks",
    method: "POST",
    body: { targetUserId: "user-2" },
  },
  { name: "unblocks a user", invoke: () => api.unblockUser(token, "user-2"), path: "/blocks/user-2", method: "DELETE" },
  { name: "lists rooms", invoke: () => api.listRooms(token), path: "/rooms" },
  {
    name: "creates a group",
    invoke: () => api.createGroup(token, { name: "Study" }),
    path: "/rooms",
    method: "POST",
    body: { name: "Study", type: "group" },
  },
  {
    name: "creates a private room",
    invoke: () => api.createPrivateRoom(token, { targetUserId: "user-2" }),
    path: "/rooms",
    method: "POST",
    body: { targetUserId: "user-2", type: "private" },
  },
  {
    name: "joins a room by invite code",
    invoke: () => api.joinRoomByCode(token, "invite/code"),
    path: "/rooms/join",
    method: "POST",
    body: { inviteCode: "invite/code" },
  },
  {
    name: "gets an encoded room invite preview",
    invoke: () => api.getRoomInvitePreview(token, "invite/code"),
    path: "/rooms/invite/invite%2Fcode",
  },
  {
    name: "updates a room",
    invoke: () => api.updateRoom(token, "room-1", { name: "Renamed" }),
    path: "/rooms/room-1",
    method: "PATCH",
    body: { name: "Renamed" },
  },
  { name: "deletes a room", invoke: () => api.deleteRoom(token, "room-1"), path: "/rooms/room-1", method: "DELETE" },
  { name: "leaves a room", invoke: () => api.leaveRoom(token, "room-1"), path: "/rooms/room-1/members/me", method: "DELETE" },
  { name: "lists room members", invoke: () => api.listRoomMembers(token, "room-1"), path: "/rooms/room-1/members" },
  {
    name: "approves a room member",
    invoke: () => api.approveRoomMember(token, "room-1", "user-2"),
    path: "/rooms/room-1/members/user-2",
    method: "PATCH",
    body: { status: "approved" },
  },
  {
    name: "updates a room member",
    invoke: () => api.updateRoomMember(token, "room-1", "user-2", { role: "admin", isMuted: true }),
    path: "/rooms/room-1/members/user-2",
    method: "PATCH",
    body: { role: "admin", isMuted: true },
  },
  { name: "kicks a room member", invoke: () => api.kickRoomMember(token, "room-1", "user-2"), path: "/rooms/room-1/members/user-2", method: "DELETE" },
  {
    name: "transfers room ownership",
    invoke: () => api.transferRoomOwner(token, "room-1", "user-2"),
    path: "/rooms/room-1",
    method: "PATCH",
    body: { ownerId: "user-2" },
  },
  {
    name: "lists a bounded message page",
    invoke: () => api.listMessages(token, "room-1", { beforeId: "message-9", limit: 25 }),
    path: "/rooms/room-1/messages?before_id=message-9&limit=25",
  },
  {
    name: "creates a message with an idempotency key",
    invoke: () => api.createMessage(token, "room-1", { content: "hello" }, "command-1"),
    path: "/rooms/room-1/messages",
    method: "POST",
    body: { content: "hello" },
  },
  {
    name: "edits a message with its revision",
    invoke: () => api.editMessage(token, "room-1", "message-1", "edited", 3, "command-1"),
    path: "/rooms/room-1/messages/message-1",
    method: "PATCH",
    body: { content: "edited" },
  },
  {
    name: "recalls a message with its revision",
    invoke: () => api.recallMessage(token, "room-1", "message-1", 3, "command-1"),
    path: "/rooms/room-1/messages/message-1/recall",
    method: "POST",
    body: {},
  },
  {
    name: "marks a room read with an idempotency key",
    invoke: () => api.markRoomRead(token, "room-1", "message-1", "command-1"),
    path: "/rooms/room-1/read-position",
    method: "PUT",
    body: { messageId: "message-1" },
  },
  { name: "syncs changes", invoke: () => api.syncChanges(token, 42, 20), path: "/sync?cursor=42&limit=20" },
  { name: "lists folders", invoke: () => api.listFolders(token), path: "/folders" },
  {
    name: "creates a folder",
    invoke: () => api.createFolder(token, "Important"),
    path: "/folders",
    method: "POST",
    body: { name: "Important" },
  },
  { name: "deletes a folder", invoke: () => api.deleteFolder(token, "folder-1"), path: "/folders/folder-1", method: "DELETE" },
  {
    name: "renames a folder",
    invoke: () => api.renameFolder(token, "folder-1", "Renamed"),
    path: "/folders/folder-1",
    method: "PATCH",
    body: { name: "Renamed" },
  },
  {
    name: "updates folder rooms",
    invoke: () => api.updateFolderRooms(token, "folder-1", ["room-1", "room-2"]),
    path: "/folders/folder-1/rooms",
    method: "PUT",
    body: { roomIds: ["room-1", "room-2"] },
  },
  { name: "lists emergency contacts", invoke: () => api.listEmergencyContacts(token), path: "/users/me/emergency-contacts" },
  {
    name: "upserts an emergency contact",
    invoke: () => api.upsertEmergencyContact(token, { contactId: "user-2", message: "Please check in" }),
    path: "/users/me/emergency-contacts",
    method: "POST",
    body: { contactId: "user-2", message: "Please check in" },
  },
  { name: "deletes an emergency contact", invoke: () => api.deleteEmergencyContact(token, "user-2"), path: "/users/me/emergency-contacts/user-2", method: "DELETE" },
  {
    name: "checks emergency inactivity at a supplied time",
    invoke: () => api.checkEmergencyInactivity(token, "2026-09-21T00:00:00.000Z"),
    path: "/users/me/emergency-alert/check-inactivity",
    method: "POST",
    body: { now: "2026-09-21T00:00:00.000Z" },
  },
];

const jsonResponse = (body: unknown = { token: "response-token" }, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("API client HTTP contract", () => {
  beforeEach(() => {
    api.setActiveAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "locks");
  });

  test.each(requestCases)("$name", async ({ invoke, path, method = "GET", body, authorization = `Bearer ${token}` }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse());
    vi.stubGlobal("fetch", fetchMock);

    await invoke();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${api.getApiBaseUrl()}/api/v1${path}`);
    expect(init?.method ?? "GET").toBe(method);
    expect(init?.credentials).toBe("include");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(authorization);
    if (body !== undefined) {
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(JSON.parse(String(init?.body))).toEqual(body);
    }
  });

  test("uploads avatar, room avatar, and attachment files as multipart bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse());
    vi.stubGlobal("fetch", fetchMock);

    await api.uploadAvatar(token, file());
    await api.uploadRoomAvatar(token, "room-1", file());
    await api.uploadAttachment(token, file());

    const expectedPaths = ["/users/me/avatar", "/rooms/room-1/avatar", "/attachments"];
    fetchMock.mock.calls.forEach(([url, init], index) => {
      expect(url).toBe(`${api.getApiBaseUrl()}/api/v1${expectedPaths[index]}`);
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    });
  });

  test("uses the active token when an endpoint does not receive an explicit one", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ userId: "user-1" }));
    vi.stubGlobal("fetch", fetchMock);
    api.setActiveAccessToken("active-token");

    await api.getUserProfile("user-1");

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer active-token");
  });

  test("serializes concurrent 401 refreshes and retries both requests with the rotated token", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse({ token: "rotated-token" });
      const callCount = fetchMock.mock.calls.filter(([called]) => String(called) === url).length;
      if (callCount === 1) return jsonResponse({ message: "expired" }, 401);
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([api.getMe(token), api.getMySettings(token)]);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
    const retried = fetchMock.mock.calls.filter(([, init]) =>
      new Headers(init?.headers).get("Authorization") === "Bearer rotated-token",
    );
    expect(retried).toHaveLength(2);
    expect(api.getActiveAccessToken()).toBe("rotated-token");
  });

  test("rejects queued requests and emits expiration when refresh fails", async () => {
    const expired = vi.fn();
    window.addEventListener("auth:token-expired", expired, { once: true });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith("/auth/refresh")) return jsonResponse({ message: "refresh denied" }, 401);
      return jsonResponse({ message: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.allSettled([api.getMe(token), api.getMySettings(token)]);

    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  test("uses the Web Locks boundary for an explicit exclusive refresh", async () => {
    const requestLock = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: requestLock },
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ token: "locked-token" })));

    await api.refreshTokensExclusive();

    expect(requestLock).toHaveBeenCalledWith("auth:refresh", expect.any(Function));
    expect(api.getActiveAccessToken()).toBe("locked-token");
  });

  test("throws a typed API error with server details and a fallback for invalid JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: "invalid", code: "VALIDATION_ERROR" }, 422))
      .mockResolvedValueOnce(new Response("not-json", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.listRooms(token)).rejects.toMatchObject({
      name: "ApiError",
      message: "invalid",
      status: 422,
      code: "VALIDATION_ERROR",
    });
    await expect(api.listRooms(token)).rejects.toMatchObject({
      name: "ApiError",
      message: "Request failed with status 500",
      status: 500,
    });
  });

  test("handles empty message pages, generated command IDs, and omitted inactivity time", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse());
    vi.stubGlobal("fetch", fetchMock);
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("generated-command");

    await api.listMessages(token, "room-1");
    await api.createMessage(token, "room-1", { content: "hello" });
    await api.syncChanges(token, 5);
    await api.checkEmergencyInactivity(token);

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/rooms\/room-1\/messages$/);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Idempotency-Key")).toBe("generated-command");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/sync?cursor=5&limit=100");
    expect(fetchMock.mock.calls[3][1]?.body).toBe("{}");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  test("resolves attachment URLs and blob downloads through their public helpers", async () => {
    const blob = new Blob(["attachment"], { type: "text/plain" });
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(blob));
    const createObjectURL = vi.fn(() => "blob:attachment");
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL });

    expect(api.attachmentDownloadUrl("/api/v1/attachments/file-1/content"))
      .toBe(`${api.getApiBaseUrl()}/api/v1/attachments/file-1/content`);
    await expect(api.fetchAttachmentBlob("https://cdn.example.test/file-1")).resolves.toBeInstanceOf(Blob);
    await expect(api.fetchAttachmentBlobUrl("https://cdn.example.test/file-1")).resolves.toBe("blob:attachment");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
