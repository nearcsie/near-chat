"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useTranslation } from "@/hooks/useTranslation";

export default function MainRedirectPage() {
  const router = useRouter();
  const { rooms, roomsInitialized } = useChat();
  const { t } = useTranslation();

  useEffect(() => {
    if (roomsInitialized && rooms.length > 0) {
      router.replace(`/chat/${rooms[0].id}`);
    }
  }, [rooms, roomsInitialized, router]);

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
