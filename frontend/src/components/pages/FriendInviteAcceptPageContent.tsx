"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  getActiveAccessToken,
  getMe,
  getMySettings,
  getUserProfile,
  listFriendRequests,
  listFriends,
  refreshTokensExclusive,
  sendFriendRequest,
} from "@/lib/api";
import {
  getServerLocale,
  getStoredLocale,
  isLocale,
  setStoredLocale,
  subscribeToLocale,
  translate,
} from "@/lib/i18n";
import type { UserProfile } from "@shared/types";

// Mirrors `InviteAcceptPageContent`: this page renders outside the `(main)` route
// group (like `login`/`register`) so a signed-out visitor can reach it and be sent
// to `/login?redirect=...` without mounting the chat app shell. `useTranslation`
// depends on `ChatProvider` and is therefore unavailable here, so the persisted
// locale is read directly.
type Status =
  | "checking"
  | "loading"
  | "ready"
  | "sending"
  | "sent"
  | "nowFriends"
  | "alreadyFriends"
  | "alreadyRequested"
  | "self"
  | "error";

/** Outcome screens that replace the confirm step, mapped to their message key. */
const OUTCOME_KEYS: Partial<Record<Status, string>> = {
  sent: "requestSent",
  nowFriends: "nowFriends",
  alreadyFriends: "alreadyFriends",
  alreadyRequested: "alreadyRequested",
  self: "ownLink",
};

/**
 * Ids reach the backend as `uuid` comparisons, where a non-UUID makes PostgreSQL
 * raise 22P02 and surface as a 500 — a mistyped link reported as a server fault.
 * `GET /users/:id` does not validate the shape today (unlike the message routes,
 * see the note in `backend/src/routes/messageSchemas.ts`), so rejecting it here
 * keeps a mistyped link a local error instead of a logged server error.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FriendInviteAcceptPageContent() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const [status, setStatus] = useState<Status>("checking");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Held as a translation key, not a translated string: the load effect must not
  // depend on `t`, or changing the locale would re-run it (see the effect below).
  const [errorKey, setErrorKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  // The server cannot see the visitor's stored language, so it renders the
  // default locale and React re-renders with the real one right after hydration.
  // Reading localStorage in a `useState` initializer would make the server and
  // client markup disagree instead.
  const locale = useSyncExternalStore(subscribeToLocale, getStoredLocale, getServerLocale);
  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) =>
      translate(locale, `friendInvite.${key}`, replacements),
    [locale],
  );

  useEffect(() => {
    document.title = t("pageTitle");
  }, [t]);

  // A browser that has never run the main app has no stored language, and this
  // page never mounts the ChatProvider that would load it, so pull the account
  // preference directly. Kept out of the load effect below: `setStoredLocale`
  // notifies its listeners synchronously, so a locale change there would give
  // `t` a new identity and re-run the load — discarding a completed outcome.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void getMySettings(token)
      .then((settings) => {
        if (!cancelled && isLocale(settings?.language)) setStoredLocale(settings.language);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      if (!UUID_PATTERN.test(userId)) {
        setErrorKey("invalidInvite");
        setStatus("error");
        return;
      }

      let activeToken = getActiveAccessToken();
      if (!activeToken) {
        try {
          // Must hold the cross-tab lock: two invite tabs bootstrapping at once
          // would otherwise present the same pre-rotation cookie and trip the
          // server's reuse detection, revoking every session.
          activeToken = (await refreshTokensExclusive()).token;
        } catch {
          if (!cancelled) {
            window.location.replace(
              `/login?redirect=${encodeURIComponent(`/friend-invite/${userId}`)}`,
            );
          }
          return;
        }
      }
      if (cancelled) return;
      setToken(activeToken);
      setStatus("loading");

      let target: UserProfile;
      try {
        // Only this read decides whether the link is valid.
        target = await getUserProfile(userId, activeToken);
      } catch (err) {
        if (cancelled) return;
        // The API layer surfaces the backend's English text, so show a localized
        // message and keep the original for debugging only.
        console.error("Failed to load friend invite:", err);
        setErrorKey("invalidInvite");
        setStatus("error");
        return;
      }
      if (cancelled) return;
      setProfile(target);

      // The relationship comes from typed reads rather than from the failure of a
      // speculative POST: a self-request and an existing friendship both come back
      // as VALIDATION_ERROR, so the error code cannot tell them apart and only the
      // English message could. These three reads are an optimisation of the
      // wording, though — `listFriends` also performs a Redis presence read, and a
      // blip there must not turn a good invite into "this link is invalid". On
      // failure, fall through to the confirm step and let the POST enforce the
      // rules, which it does regardless.
      const [meResult, friendsResult, requestsResult] = await Promise.allSettled([
        getMe(activeToken),
        listFriends(activeToken),
        listFriendRequests(activeToken),
      ]);
      if (cancelled) return;

      const me = meResult.status === "fulfilled" ? meResult.value : null;
      if (me && me.userId === userId) {
        setStatus("self");
        return;
      }
      if (
        friendsResult.status === "fulfilled" &&
        friendsResult.value.some((entry) => entry?.friend?.userId === userId)
      ) {
        setStatus("alreadyFriends");
        return;
      }
      // Only an outgoing request is "already sent". An incoming one from this
      // same person is left alone: confirming then trips the backend's
      // reciprocal branch, which accepts both sides at once.
      if (
        me &&
        requestsResult.status === "fulfilled" &&
        requestsResult.value.some(
          (req) => req.requesterId === me.userId && req.addresseeId === userId,
        )
      ) {
        setStatus("alreadyRequested");
        return;
      }
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleConfirm = useCallback(async () => {
    if (!token || !userId) return;
    setStatus("sending");
    setErrorKey("");
    try {
      const result = await sendFriendRequest(token, userId);
      // If this person had already requested us, the backend accepts both sides
      // instead of queueing a request and reopens the private room. Saying
      // "request sent" there would be wrong: we are friends as of now.
      setStatus(result?.status === "accepted" ? "nowFriends" : "sent");
    } catch (err) {
      console.error("Failed to send friend request from invite:", err);
      // A 409 means the request landed between this page loading and the click —
      // the desired state, not a failure.
      if ((err as { status?: number })?.status === 409) {
        setStatus("alreadyRequested");
        return;
      }
      // Anything else — blocked, a fresh friendship, a self-request the degraded
      // read above could not rule out — leaves the same thing to say: it did not
      // go through. The backend's reason is English prose, so it stays in the log.
      setErrorKey("sendFailed");
      setStatus("ready");
    }
  }, [token, userId]);

  const displayName = profile?.name ?? t("thisUser");
  const outcomeKey = OUTCOME_KEYS[status];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 bg-background transition-colors overflow-y-auto">
      <div className="w-full max-w-sm border border-border-primary rounded-sm bg-surface-card p-8 flex flex-col items-center">
        <div className="size-16 bg-surface-muted rounded-sm flex items-center justify-center mb-6 overflow-hidden">
          <Image src="/near.png" alt="Near logo" width={128} height={128} className="object-contain size-full" />
        </div>

        {(status === "checking" || status === "loading") && (
          <p className="text-sm text-text-muted font-sans">{t("loading")}</p>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-red-600 font-sans text-center mb-6">{t(errorKey)}</p>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
              {t("backToNear")}
            </Button>
          </>
        )}

        {(status === "ready" || status === "sending") && (
          <>
            <Avatar name={displayName} src={profile?.avatarUrl} size="lg" className="mb-4" />
            <h1 className="text-lg font-bold text-foreground mb-1 text-center font-sans">{displayName}</h1>
            <p className="text-xs text-text-muted select-none font-sans mb-8 text-center">{t("prompt")}</p>

            {errorKey && (
              <p className="text-xs text-red-600 font-sans text-center mb-4">{t(errorKey)}</p>
            )}

            <div className="w-full flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={status === "sending"}
                onClick={() => router.push("/")}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={status === "sending"}
                onClick={handleConfirm}
              >
                {status === "sending" ? t("sending") : t("confirm")}
              </Button>
            </div>
          </>
        )}

        {outcomeKey && (
          <>
            <Avatar name={displayName} src={profile?.avatarUrl} size="lg" className="mb-4" />
            <h1 className="text-lg font-bold text-foreground mb-1 text-center font-sans">{displayName}</h1>
            <p className="text-sm text-foreground font-sans text-center mb-6">
              {t(outcomeKey, { name: displayName })}
            </p>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
              {t("backToNear")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
