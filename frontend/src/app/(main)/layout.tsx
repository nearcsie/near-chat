"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { useTranslation } from "@/hooks/useTranslation";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isMounted } = useChat();
  const { t } = useTranslation();
  const pathname = usePathname();

  if (!isMounted || !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground font-sans">
        {t("common.loading")}
      </div>
    );
  }

  // On phones only one pane fits at a time. The chat-list root (`/`) shows the
  // sidebar; every other route shows its content pane. Tablet and desktop keep
  // both panes side by side (md:flex).
  const isListRoot = pathname === "/";

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground font-sans transition-colors">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className={`${isListRoot ? "flex" : "hidden"} md:flex h-full w-full md:w-auto`}>
          <Sidebar />
        </div>
        <div className={`${isListRoot ? "hidden" : "flex"} md:flex flex-1 min-w-0 h-full overflow-hidden`}>
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </ChatProvider>
  );
}
