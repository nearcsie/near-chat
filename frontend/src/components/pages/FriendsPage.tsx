"use client";

import { useChat } from "@/context/ChatContext";
import FriendsPanel from "@/components/settings/FriendsPanel";
import SettingsHeader from "@/components/settings/SettingsHeader";

const pageCopy = {
  "zh-TW": { title: "好友列表" },
  en: { title: "Friend list" },
} as const;

export default function FriendsPage() {
  const { uiLanguage } = useChat();

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={pageCopy[uiLanguage].title} />
      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <FriendsPanel />
      </div>
    </div>
  );
}
