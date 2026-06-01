"use client";

import type React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { Badge } from "@/components/ui/Badge";

const railCopy = {
  "zh-TW": {
    chats: "聊天室",
    friends: "好友列表",
    emergency: "緊急聯絡設定",
  },
  en: {
    chats: "Chats",
    friends: "Friends",
    emergency: "Emergency",
  },
} as const;

type RailItemKey = "chats" | "friends" | "emergency";

export default function AppRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { rooms, friendRequests, uiLanguage } = useChat();
  const t = railCopy[uiLanguage];

  const pendingIncoming = friendRequests.filter((request) => request.direction === "incoming").length;
  const firstChatPath = rooms[0] ? `/chat/${rooms[0].id}` : "/";

  const items: {
    key: RailItemKey;
    label: string;
    path: string;
    active: boolean;
    badge?: number;
    icon: React.ReactNode;
  }[] = [
    {
      key: "chats",
      label: t.chats,
      path: firstChatPath,
      active: pathname === "/" || pathname.startsWith("/chat"),
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l3.5-3H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v6a3 3 0 003 3h.5L5 19z" />
        </>
      ),
    },
    {
      key: "friends",
      label: t.friends,
      path: "/friends",
      active: pathname === "/friends",
      badge: pendingIncoming,
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
        </>
      ),
    },
    {
      key: "emergency",
      label: t.emergency,
      path: "/emergency",
      active: pathname === "/emergency",
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 15H4L12 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01" />
        </>
      ),
    },
  ];

  return (
    <nav className="h-full w-[84px] shrink-0 border-r border-border-primary bg-surface-muted flex flex-col items-stretch py-3 select-none">
      <div className="flex flex-col">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => router.push(item.path)}
            className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 border border-transparent px-1 py-2 text-[10px] font-bold leading-tight transition-colors ${
              item.active
                ? "bg-surface-card text-primary"
                : "text-text-muted hover:bg-surface-card hover:text-foreground"
            }`}
          >
            {item.active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {item.icon}
            </svg>
            <span className="w-full text-center">{item.label}</span>
            {!!item.badge && (
              <Badge variant="danger" className="absolute right-1 top-1 scale-90">
                {item.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
