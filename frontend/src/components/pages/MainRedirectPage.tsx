"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useIsMobile } from "@/hooks/useMediaQuery";

export default function MainRedirectPage() {
  const router = useRouter();
  const { rooms } = useChat();
  const isMobile = useIsMobile();

  useEffect(() => {
    // On phones, `/` is the standalone chat-list screen (rendered by the
    // sidebar), so we must not auto-open the first room. On tablet/desktop the
    // list lives in the sidebar permanently, so jump straight into a chat.
    if (!isMobile && rooms.length > 0) {
      router.replace(`/chat/${rooms[0].id}`);
    }
  }, [rooms, router, isMobile]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans animate-pulse">
      載入聊天室中...
    </div>
  );
}
