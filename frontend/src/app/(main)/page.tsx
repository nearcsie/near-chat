"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";

export default function MainPage() {
  const router = useRouter();
  const { rooms } = useChat();

  useEffect(() => {
    if (rooms.length > 0) {
      router.replace(`/chat/${rooms[0].id}`);
    }
  }, [rooms, router]);

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        <div className="border border-border-primary rounded-sm bg-surface-card px-6 py-5 text-center">
          <p className="text-sm font-semibold">No rooms yet</p>
          <p className="mt-1 text-xs text-text-muted">Create a room from the sidebar to start chatting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans animate-pulse">
      載入聊天室中...
    </div>
  );
}
