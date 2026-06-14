"use client";

import ProfileSettings from "@/components/settings/ProfileSettings";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { useTranslation } from "@/hooks/useTranslation";

export default function ProfileSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={t("profilePage.title")} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-card">
        <ProfileSettings />
      </div>
    </div>
  );
}
