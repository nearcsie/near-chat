"use client";

import { useChat } from "@/context/ChatContext";
import EmergencySettingsPanel from "@/components/settings/EmergencySettingsPanel";
import SettingsHeader from "@/components/settings/SettingsHeader";

const pageCopy = {
  "zh-TW": { title: "緊急聯絡設定" },
  en: { title: "Emergency settings" },
} as const;

export default function EmergencySettingsPage() {
  const { uiLanguage } = useChat();

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={pageCopy[uiLanguage].title} />
      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <EmergencySettingsPanel />
      </div>
    </div>
  );
}
