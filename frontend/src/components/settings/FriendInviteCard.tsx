"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { useChat } from "@/context/ChatContext";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Server snapshot for `useSyncExternalStore`. The server has no location, so it
 * must report the same value every time and let React re-render with the real
 * origin after hydration. Reading `window.location` during render or in a
 * `useState` initializer would instead bake a mismatched value into the markup.
 */
const getServerOrigin = (): string => "";
const getOrigin = (): string => window.location.origin;
/** The origin cannot change without a full page load, so there is nothing to observe. */
const subscribeToOrigin = (): (() => void) => () => {};

/**
 * Shareable "add me as a friend" link and its QR code, shown under the friend list.
 *
 * The link carries the owner's user id rather than a separate opaque token. A user
 * id is not a secret here: `GET /users/:id` serves any signed-in caller, and the
 * user-search endpoint already returns ids in bulk for a name query, which is what
 * the existing "add by user id" search mode is built on. The link therefore grants
 * nothing beyond `POST /friend-requests`, which the recipient still has to accept
 * and which already refuses blocked, duplicate and self-directed requests.
 */
export function FriendInviteCard() {
  const { user } = useChat();
  const { t } = useTranslation();
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);
  const [feedback, setFeedback] = useState("");

  const userId = user.userId;
  if (!userId || !origin) return null;

  const link = `${origin}/friend-invite/${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback(t("friends.inviteLinkCopied"));
    } catch {
      // Clipboard access is denied outside a secure context and in some
      // embedded browsers; fall back to a selectable prompt, as GroupSettings does.
      window.prompt(t("friends.inviteLinkManualCopy"), link);
    }
  };

  return (
    <div className="p-4 border-t border-border-secondary">
      <p className="text-xs font-semibold text-foreground mb-1">{t("friends.inviteLinkTitle")}</p>
      <p className="text-[10px] text-text-muted mb-3">{t("friends.inviteLinkDesc")}</p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0 self-center sm:self-start rounded-sm border border-border-secondary p-2 bg-white">
          <QrCode value={link} size={132} label={t("friends.inviteQrLabel")} />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <p className="text-[10px] text-text-muted font-mono break-all select-all">{link}</p>
          <Button type="button" variant="secondary" className="text-xs py-1 px-2 self-start" onClick={() => void handleCopy()}>
            {t("friends.copyInviteLink")}
          </Button>
          {feedback && <p className="text-[10px] text-text-muted">{feedback}</p>}
        </div>
      </div>
    </div>
  );
}
