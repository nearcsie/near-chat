"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useTranslation } from "@/hooks/useTranslation";

type NavItem = {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  icon: React.ReactNode;
};

/**
 * Persistent bottom tab bar shown only on phone-sized viewports (< md).
 * On larger screens the equivalent navigation lives in the sidebar rail, so
 * this is hidden via `md:hidden` by the parent layout.
 */
export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { friendRequests, setSelectedFriendForSidebar } = useChat();
  const { t } = useTranslation();

  const pendingIncoming =
    friendRequests?.filter((request) => request.direction === "incoming").length || 0;

  const items: NavItem[] = [
    {
      label: t("rail.chats"),
      active: pathname === "/" || pathname.startsWith("/chat"),
      onClick: () => router.push("/"),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l3.5-3H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v6a3 3 0 003 3h.5L5 19z" />
        </svg>
      ),
    },
    {
      label: t("rail.friends"),
      active: pathname === "/friends",
      onClick: () => {
        setSelectedFriendForSidebar(null);
        router.push("/friends");
      },
      badge: pendingIncoming,
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
        </svg>
      ),
    },
    {
      label: t("rail.emergency"),
      active: pathname === "/emergency",
      onClick: () => router.push("/emergency"),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 15H4L12 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01" />
        </svg>
      ),
    },
    {
      label: t("sidebar.settings"),
      active: pathname === "/settings",
      onClick: () => router.push("/settings"),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="md:hidden shrink-0 border-t border-border-primary bg-surface-muted flex items-stretch h-16 select-none">
      {items.map((item, idx) => (
        <button
          key={idx}
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          aria-current={item.active ? "page" : undefined}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
            item.active
              ? "text-primary bg-surface-card"
              : "text-text-muted hover:text-foreground active:bg-surface-card/60"
          }`}
        >
          <span className="relative">
            {item.icon}
            {!!item.badge && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                {item.badge}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
          {item.active && <span className="absolute left-0 right-0 top-0 h-[3px] bg-primary" />}
        </button>
      ))}
    </nav>
  );
}
