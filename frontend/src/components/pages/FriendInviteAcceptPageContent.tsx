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
  | "alreadyFriends"
  | "alreadyRequested"
  | "self"
  | "error";

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
  const [errorMessage, setErrorMessage] = useState("");
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      if (!UUID_PATTERN.test(userId)) {
        setErrorMessage(t("invalidInvite"));
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

      // A browser that has never run the main app has no stored language, and
      // this page never mounts the ChatProvider that would load it, so pull the
      // account preference directly. Failure here only affects wording.
      void getMySettings(activeToken)
        .then((settings) => {
          if (!cancelled && isLocale(settings?.language)) setStoredLocale(settings.language);
        })
        .catch(() => {});

      try {
        // Resolve the relationship from typed reads rather than from the error
        // text of a speculative POST: `api.ts` keeps only a failure's message
        // string, so branching on it would be string-matching English prose.
        const [target, me, friends, requests] = await Promise.all([
          getUserProfile(userId, activeToken),
          getMe(activeToken),
          listFriends(activeToken),
          listFriendRequests(activeToken),
        ]);
        if (cancelled) return;
        setProfile(target);

        if (me.userId === userId) {
          setStatus("self");
          return;
        }
        if (friends.some((entry) => entry.friend.userId === userId)) {
          setStatus("alreadyFriends");
          return;
        }
        // Only an outgoing request is "already sent". An incoming one from this
        // same person is left alone: confirming then trips the backend's
        // reciprocal branch, which accepts both sides at once.
        if (requests.some((req) => req.requesterId === me.userId && req.addresseeId === userId)) {
          setStatus("alreadyRequested");
          return;
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        // The API layer surfaces the backend's English text, so show a localized
        // message and keep the original for debugging only.
        console.error("Failed to load friend invite:", err);
        setErrorMessage(t("invalidInvite"));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const handleConfirm = useCallback(async () => {
    if (!token || !userId) return;
    setStatus("sending");
    setErrorMessage("");
    try {
      await sendFriendRequest(token, userId);
      setStatus("sent");
    } catch (err) {
      // Every rejection here — already friends, already sent, blocked, a race
      // with the other side — leaves the same thing to do: say it did not go
      // through. The backend's reason is English prose, so it stays in the log.
      console.error("Failed to send friend request from invite:", err);
      setErrorMessage(t("sendFailed"));
      setStatus("ready");
    }
  }, [token, userId, t]);

  const displayName = profile?.name ?? t("thisUser");

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
            <p className="text-sm text-red-600 font-sans text-center mb-6">{errorMessage}</p>
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

            {errorMessage && (
              <p className="text-xs text-red-600 font-sans text-center mb-4">{errorMessage}</p>
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

        {(status === "sent" ||
          status === "alreadyFriends" ||
          status === "alreadyRequested" ||
          status === "self") && (
          <>
            <Avatar name={displayName} src={profile?.avatarUrl} size="lg" className="mb-4" />
            <h1 className="text-lg font-bold text-foreground mb-1 text-center font-sans">{displayName}</h1>
            <p className="text-sm text-foreground font-sans text-center mb-6">
              {t(
                status === "sent"
                  ? "requestSent"
                  : status === "alreadyFriends"
                    ? "alreadyFriends"
                    : status === "alreadyRequested"
                      ? "alreadyRequested"
                      : "ownLink",
                { name: displayName },
              )}
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
