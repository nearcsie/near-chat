import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QrCode } from "@/components/ui/QrCode";
import { __resetNavigation } from "./mocks/next-navigation";

const ME_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const FRIEND_ID = "33333333-3333-4333-8333-333333333333";

// A local double rather than the shared `tests/mocks/api.ts` fixture: the page
// rejects ids that are not UUIDs before it calls anything, and the shared
// fixtures use short ids like "f-1".
const api = vi.hoisted(() => ({
  activeToken: "test-token" as string | null,
  refreshFails: false,
  friends: [] as { friend: { userId: string; name: string } }[],
  requests: [] as { requesterId: string; addresseeId: string }[],
  knownProfiles: {} as Record<string, { userId: string; name: string }>,
  profileLookups: [] as string[],
  sendFails: false,
  /** When set, `sendFriendRequest` rejects with this HTTP status attached. */
  sendFailStatus: undefined as number | undefined,
  /** Mimics the backend accepting both sides when a reciprocal request exists. */
  sendAutoAccepts: false,
  sent: [] as Array<[string, string]>,
  meFails: false,
  friendsFail: false,
}));

vi.mock("@/lib/api", () => ({
  getActiveAccessToken: () => api.activeToken,
  refreshTokensExclusive: async () => {
    if (api.refreshFails) throw new Error("no session");
    return { token: "refreshed-token" };
  },
  getMySettings: async () => ({ language: "en" }),
  getMe: async () => {
    if (api.meFails) throw new Error("getMe unavailable");
    return { userId: ME_ID, name: "Me" };
  },
  getUserProfile: async (userId: string) => {
    api.profileLookups.push(userId);
    const profile = api.knownProfiles[userId];
    if (!profile) throw new Error(`Unknown user ${userId}`);
    return profile;
  },
  listFriends: async () => {
    if (api.friendsFail) throw new Error("presence read failed");
    return api.friends;
  },
  listFriendRequests: async () => api.requests,
  sendFriendRequest: async (token: string, targetUserId: string) => {
    if (api.sendFails) {
      const err = new Error("Friend request already sent") as Error & { status?: number };
      if (api.sendFailStatus !== undefined) err.status = api.sendFailStatus;
      throw err;
    }
    api.sent.push([token, targetUserId]);
    return { status: api.sendAutoAccepts ? "accepted" : "pending" };
  },
}));

// Imported after the mock so the component picks the double up.
const { default: FriendInviteAcceptPageContent } = await import(
  "@/components/pages/FriendInviteAcceptPageContent"
);

const renderAt = (userId: string) => {
  __resetNavigation(`/friend-invite/${userId}`);
  return render(<FriendInviteAcceptPageContent />);
};

describe("QrCode", () => {
  test("encodes the value as a non-empty path under an accessible name", () => {
    render(<QrCode value="https://near.test/friend-invite/abc" label="invite qr" />);

    const svg = screen.getByRole("img", { name: "invite qr" });
    const path = svg.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("d") ?? "").not.toBe("");
  });

  test("different values produce different codes", () => {
    const { container: a } = render(<QrCode value="https://near.test/a" label="a" />);
    const { container: b } = render(<QrCode value="https://near.test/b" label="b" />);

    expect(a.querySelector("path")?.getAttribute("d")).not.toBe(
      b.querySelector("path")?.getAttribute("d"),
    );
  });
});

describe("FriendInviteAcceptPageContent", () => {
  beforeEach(() => {
    api.activeToken = "test-token";
    api.refreshFails = false;
    api.friends = [];
    api.requests = [];
    api.knownProfiles = { [TARGET_ID]: { userId: TARGET_ID, name: "Target User" } };
    api.profileLookups = [];
    api.sendFails = false;
    api.sendFailStatus = undefined;
    api.sendAutoAccepts = false;
    api.sent = [];
    api.meFails = false;
    api.friendsFail = false;
    // Pin the language: the page only learns the account preference after it
    // authenticates, so paths that bail earlier would otherwise fall back to the
    // default locale and assertions on wording would depend on which path ran.
    window.localStorage.setItem("language", "en");
  });

  test("asks for confirmation and sends the request only once confirmed", async () => {
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send a friend request to this person?")).toBeTruthy();
    });
    expect(screen.getByText("Target User")).toBeTruthy();
    // Nothing is sent by merely opening the link.
    expect(api.sent).toEqual([]);

    fireEvent.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText("Your friend request to Target User has been sent.")).toBeTruthy();
    });
    expect(api.sent).toEqual([["test-token", TARGET_ID]]);
  });

  test("says the two are now friends when the backend accepts both sides at once", async () => {
    // The target already had a request out to us, so the backend accepts rather
    // than queueing. "Request sent" would be wrong: the friendship exists now.
    api.requests = [{ requesterId: TARGET_ID, addresseeId: ME_ID }];
    api.sendAutoAccepts = true;
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText(/You and Target User are now friends/)).toBeTruthy();
    });
    expect(screen.queryByText(/has been sent/)).toBeNull();
  });

  test("still offers to confirm when an enrichment read fails", async () => {
    // `listFriends` also performs a Redis presence read. A blip there must not
    // turn a perfectly good invite into "this link is invalid".
    api.friendsFail = true;
    api.meFails = true;
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
    expect(screen.queryByText(/invalid/)).toBeNull();
  });

  test("tolerates a friend entry with no friend payload", async () => {
    // `friendService.getFriends` guards `f && f.friend`, so the field is nullable
    // on the wire; a TypeError here would surface as a bogus invalid-link screen.
    api.friends = [{} as { friend: { userId: string; name: string } }];
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
  });

  test("treats a 409 on confirm as the request already being in flight", async () => {
    api.sendFails = true;
    api.sendFailStatus = 409;
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(
        screen.getByText("You have already sent Target User a friend request."),
      ).toBeTruthy();
    });
  });

  test("recognises the visitor's own link instead of sending to themselves", async () => {
    api.knownProfiles[ME_ID] = { userId: ME_ID, name: "Me" };
    renderAt(ME_ID);

    await waitFor(() => {
      expect(screen.getByText(/This is your own invite link/)).toBeTruthy();
    });
    expect(screen.queryByText("Send Request")).toBeNull();
    expect(api.sent).toEqual([]);
  });

  test("reports an existing friendship rather than offering to send again", async () => {
    api.knownProfiles[FRIEND_ID] = { userId: FRIEND_ID, name: "Old Friend" };
    api.friends = [{ friend: { userId: FRIEND_ID, name: "Old Friend" } }];
    renderAt(FRIEND_ID);

    await waitFor(() => {
      expect(screen.getByText("You and Old Friend are already friends.")).toBeTruthy();
    });
    expect(screen.queryByText("Send Request")).toBeNull();
  });

  test("reports an outgoing request that is already pending", async () => {
    api.requests = [{ requesterId: ME_ID, addresseeId: TARGET_ID }];
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(
        screen.getByText("You have already sent Target User a friend request."),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Send Request")).toBeNull();
  });

  test("still offers to confirm when the other person's request is the pending one", async () => {
    // The backend accepts both sides when the reciprocal request arrives, so
    // this must not be mistaken for "already sent".
    api.requests = [{ requesterId: TARGET_ID, addresseeId: ME_ID }];
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
  });

  test("rejects a malformed id locally without calling the API", async () => {
    renderAt("not-a-uuid");

    await waitFor(() => {
      expect(
        screen.getByText("This invite link is invalid or the account no longer exists."),
      ).toBeTruthy();
    });
    // A non-UUID reaching `GET /users/:id` makes PostgreSQL raise 22P02, which
    // the generic error handler reports as a 500. The guard must stop it here.
    expect(api.profileLookups).toEqual([]);
  });

  test("shows a localized failure and stays on the confirm step when sending fails", async () => {
    api.sendFails = true;
    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(screen.getByText("Send Request")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText("Failed to send the friend request.")).toBeTruthy();
    });
    // The confirm button is still there to retry with.
    expect(screen.getByText("Send Request")).toBeTruthy();
  });

  test("sends a signed-out visitor to login carrying the invite as the redirect target", async () => {
    api.activeToken = null;
    api.refreshFails = true;
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace },
    });

    renderAt(TARGET_ID);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent(`/friend-invite/${TARGET_ID}`)}`,
      );
    });
  });
});
