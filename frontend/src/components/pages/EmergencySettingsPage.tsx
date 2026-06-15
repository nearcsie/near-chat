"use client";

import { useEffect } from "react";
import EmergencySettingsPanel from "@/components/settings/EmergencySettingsPanel";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { useTranslation } from "@/hooks/useTranslation";

export default function EmergencySettingsPage() {
  const { t } = useTranslation();
  const pageTitle = t("emergencyPage.title");

  useEffect(() => {
    document.title = `Near | ${pageTitle}`;
  }, [pageTitle]);

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <SettingsHeader title={t("emergencyPage.title")} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-card">
        <EmergencySettingsPanel />
      </div>
    </div>
  );
}
