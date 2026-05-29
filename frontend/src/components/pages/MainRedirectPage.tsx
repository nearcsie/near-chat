"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";

export default function MainRedirectPage() {
  const router = useRouter();
  const { rooms } = useChat();

  useEffect(() => {
    if (rooms.length > 0) {
      router.replace(`/chat/${rooms[0].id}`);
    }
  }, [rooms, router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans animate-pulse">
      載入聊天室中...
    </div>
  );
}
