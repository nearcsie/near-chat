"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
      <div className="flex flex-1 items-center justify-center bg-background font-sans text-foreground">
        {t("mainRedirect.emptyChats")}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background font-sans text-foreground animate-pulse">
      {t("common.loading")}
    </div>
  );
}
