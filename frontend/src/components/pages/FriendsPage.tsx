"use client";

import { useEffect } from "react";
import FriendsPanel from "@/components/settings/FriendsPanel";
import FriendInfoPanel from "@/components/chat/FriendInfoPanel";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useChat } from "@/context/ChatContext";

export default function FriendsPage() {
  const { t } = useTranslation();
  const { selectedFriendForSidebar, setSelectedFriendForSidebar } = useChat();

  useEffect(() => {
    setSelectedFriendForSidebar(null);
  }, [setSelectedFriendForSidebar]);

  return (
    <div className="relative flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={t("friendsPage.title")} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-card">
        <FriendsPanel />
      </div>

      {/* On phones the sidebar is hidden, so the selected friend's info opens
          as a full-screen overlay instead of in the sidebar pane. */}
      {selectedFriendForSidebar && (
        <div className="absolute inset-0 z-40 flex flex-col bg-surface-card md:hidden animate-slide-in-right">
          <FriendInfoPanel
            friendName={selectedFriendForSidebar.name}
            showChatButton={true}
            onClose={() => setSelectedFriendForSidebar(null)}
          />
        </div>
      )}
    </div>
  );
}
