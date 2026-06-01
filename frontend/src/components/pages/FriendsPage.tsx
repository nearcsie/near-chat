"use client";

import FriendsPanel from "@/components/settings/FriendsPanel";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { useTranslation } from "@/hooks/useTranslation";

export default function FriendsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={t("friendsPage.title")} />
      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <FriendsPanel />
      </div>
    </div>
  );
}
