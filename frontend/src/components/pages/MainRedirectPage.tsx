"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChat } from "@/context/ChatContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/hooks/useTranslation";

export default function MainRedirectPage() {
  const router = useRouter();
  const { rooms, roomsInitialized } = useChat();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  useEffect(() => {
    // On phones, `/` is the standalone chat-list screen (rendered by the
    // sidebar), so we must not auto-open the first room. On tablet/desktop the
    // list lives in the sidebar permanently, so jump straight into a chat.
    if (!isMobile && roomsInitialized && rooms.length > 0) {
      router.replace(`/chat/${rooms[0].id}`);
    }
  }, [rooms, roomsInitialized, router, isMobile]);

  if (!roomsInitialized) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background font-sans text-foreground animate-pulse">
        {t("common.loading")}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background font-sans text-foreground px-6 text-center">
        <svg className="h-12 w-12 text-text-muted opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{t("mainRedirect.emptyChats")}</p>
          <p className="text-xs text-text-muted max-w-xs">{t("mainRedirect.emptyChatsDesc")}</p>
        </div>
        <Link
          href="/friends"
          className="mt-1 inline-flex items-center gap-1.5 border border-border-primary bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-card transition-colors"
        >
          {t("mainRedirect.goToFriends")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background font-sans text-foreground animate-pulse">
      {t("common.loading")}
    </div>
  );
}
