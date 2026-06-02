"use client";

import React from "react";
import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/layout/Sidebar";
import { useTranslation } from "@/hooks/useTranslation";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isMounted } = useChat();
  const { t } = useTranslation();

  if (!isMounted || !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground font-sans">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans transition-colors">
      <Sidebar />
      {children}
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
