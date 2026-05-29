"use client";

import { useChat } from "@/context/ChatContext";
import ProfileSettings from "@/components/settings/ProfileSettings";
import SettingsHeader from "@/components/settings/SettingsHeader";

const pageCopy = {
  "zh-TW": { title: "個人設定" },
  en: { title: "Profile settings" },
} as const;

export default function ProfileSettingsPage() {
  const { uiLanguage } = useChat();

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={pageCopy[uiLanguage].title} />
      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <ProfileSettings />
      </div>
    </div>
  );
}
