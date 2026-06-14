"use client";

import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsHeader({ title }: { title: string }) {
  const router = useRouter();
  const { rooms, hasUnsavedChanges } = useChat();
  const { t } = useTranslation();

  return (
    <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
      <h1 className="text-sm font-bold text-foreground tracking-wider">{title}</h1>
      <Button
        type="button"
        variant="secondary"
        onClick={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("trigger-unsaved-alert"));
            return;
          }
          router.push(rooms[0] ? `/chat/${rooms[0].id}` : "/");
        }}
        className="text-xs py-1 px-3"
      >
        {t("settingsHeader.backToChat")}
      </Button>
    </div>
  );
}
