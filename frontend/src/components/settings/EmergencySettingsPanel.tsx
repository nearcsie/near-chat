"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmergencyContact, EmergencySettings, useChat } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import FeedbackMessage, { SettingsFeedback } from "@/components/settings/FeedbackMessage";
import SectionTitle from "@/components/settings/SectionTitle";
import { useTranslation } from "@/hooks/useTranslation";

export default function EmergencySettingsPanel() {
  const router = useRouter();
  const {
    rooms,
    friends,
    emergencySettings,
    saveEmergencySettings,
    triggerEmergencyAlertNow,
  } = useChat();
  const [warningEnabled, setWarningEnabled] = useState(true);
  const [warningDays, setWarningDays] = useState<number | "">(7);
  const [demoWarningEnabled, setDemoWarningEnabled] = useState(false);
  const [demoWarningSeconds, setDemoWarningSeconds] = useState<number | "">(30);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [defaultEmergencyMessage, setDefaultEmergencyMessage] = useState("");
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [isTriggeringAlert, setIsTriggeringAlert] = useState(false);
  const { t, locale } = useTranslation();


  // Sync the form when emergency settings (or the locale) change
  // (adjust state during render instead of a cascading effect).
  const [prevSettingsSync, setPrevSettingsSync] = useState<{
    settings: typeof emergencySettings;
    locale: string;
  } | null>(null);
  if (!prevSettingsSync || prevSettingsSync.settings !== emergencySettings || prevSettingsSync.locale !== locale) {
    setPrevSettingsSync({ settings: emergencySettings, locale });
    setWarningEnabled(emergencySettings.warningEnabled);
    setWarningDays(emergencySettings.warningDays);
    setDemoWarningEnabled(emergencySettings.demoWarningEnabled);
    setDemoWarningSeconds(emergencySettings.demoWarningSeconds);
    setEmergencyContacts(emergencySettings.contacts);
    setDefaultEmergencyMessage(emergencySettings.contacts[0]?.message || t("emergency.defaultMessage"));
  }

  const availableEmergencyFriends = useMemo(
    () => friends.filter((friend) => !emergencyContacts.some((contact) => contact.contactId === friend.id)),
    [friends, emergencyContacts]
  );

  const handleBack = () => {
    router.push(rooms[0] ? `/chat/${rooms[0].id}` : "/");
  };

  const addEmergencyContact = (friendId: string) => {
    const friend = friends.find((item) => item.id === friendId);
    if (!friend) return;
    setEmergencyContacts((prev) => [
      ...prev,
      {
        id: `ec-${Date.now()}`,
        contactId: friend.id,
        name: friend.name,
        email: friend.email,
        message: defaultEmergencyMessage,
      },
    ]);
  };

  const updateEmergencyContactMessage = (contactId: string, message: string) => {
    setEmergencyContacts((prev) =>
      prev.map((contact) => (contact.id === contactId ? { ...contact, message } : contact))
    );
  };

  const removeEmergencyContact = (contactId: string) => {
    setEmergencyContacts((prev) => prev.filter((contact) => contact.id !== contactId));
  };

  const handleEmergencySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const settings: EmergencySettings = {
      warningEnabled,
      warningDays: warningDays === "" ? 14 : Math.max(1, Number(warningDays)),
      demoWarningEnabled,
      demoWarningSeconds: demoWarningSeconds === "" ? 30 : Math.max(1, Number(demoWarningSeconds)),
      contacts: emergencyContacts,
    };
    try {
      await saveEmergencySettings(settings);
      setFeedback({ type: "success", text: t("emergency.emergencySaved") });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save emergency settings.",
      });
    }
  };

  const handleTriggerAlert = async () => {
    setFeedback(null);
    setIsTriggeringAlert(true);

    try {
      const result = await triggerEmergencyAlertNow(defaultEmergencyMessage);

      if (result.alerted) {
        setFeedback({
          type: "success",
          text: t("emergency.alertSent", { count: result.recipients.length }),
        });
        return;
      }

      if (result.reason === "NO_CONTACTS") {
        setFeedback({ type: "error", text: t("emergency.noContactsForAlert") });
        return;
      }

      setFeedback({
        type: "error",
        text: t("emergency.alertNotSent", { reason: result.reason ?? "UNKNOWN" }),
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : t("emergency.alertFailed"),
      });
    } finally {
      setIsTriggeringAlert(false);
    }
  };

  return (
    <>
      <FeedbackMessage feedback={feedback} />

      <form onSubmit={handleEmergencySubmit} className="flex flex-col gap-6 max-w-5xl">
        <SectionTitle title={t("emergency.emergencyReporting")} />
        <div className="border border-border-primary rounded-sm bg-surface-card p-4 flex flex-col gap-4">
          <Checkbox
            label={t("emergency.enableOfflineWarning")}
            checked={warningEnabled}
            onChange={(event) => setWarningEnabled(event.target.checked)}
          />
          <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
            <Input
              label={t("emergency.warningDays")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={warningDays}
              onChange={(event) => {
                const val = event.target.value;
                if (/^[0-9]*$/.test(val)) {
                  setWarningDays(val === "" ? "" : Number(val));
                }
              }}
            />
            <Input
              label={t("emergency.defaultAlertMessage")}
              value={defaultEmergencyMessage}
              onChange={(event) => setDefaultEmergencyMessage(event.target.value)}
            />
          </div>
        </div>

        <SectionTitle title={"[Demo] 離線警示（秒數版）"} />
        <div className="border border-border-primary rounded-sm bg-surface-card p-4 flex flex-col gap-4">
          <Checkbox
            label={"啟用示範離線警示"}
            checked={demoWarningEnabled}
            onChange={(event) => setDemoWarningEnabled(event.target.checked)}
          />
          <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
            <Input
              label={"警示秒數"}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={demoWarningSeconds}
              onChange={(event) => {
                const val = event.target.value;
                if (/^[0-9]*$/.test(val)) {
                  setDemoWarningSeconds(val === "" ? "" : Number(val));
                }
              }}
            />
            <Input
              label={t("emergency.defaultAlertMessage")}
              value={defaultEmergencyMessage}
              onChange={(event) => setDefaultEmergencyMessage(event.target.value)}
            />
          </div>
        </div>

        <SectionTitle title={t("emergency.manualAlert")} />
        <div className="border border-border-primary rounded-sm bg-surface-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-foreground">{t("emergency.manualAlert")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("emergency.manualAlertDescription")}</p>
          </div>
          <Button type="button" variant="primary" disabled={isTriggeringAlert} onClick={() => void handleTriggerAlert()}>
            {isTriggeringAlert ? t("emergency.sendingAlert") : t("emergency.sendAlertNow")}
          </Button>
        </div>

        <SectionTitle title={t("emergency.emergencyContacts")} />
        <div className="border border-border-primary rounded-sm bg-surface-card">
          <div className="p-4 border-b border-border-secondary flex flex-col md:flex-row md:items-end gap-4">
            <label className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t("emergency.addFriendAsContact")}</span>
              <select
                className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    addEmergencyContact(event.target.value);
                    event.target.value = "";
                  }
                }}
              >
                <option value="">{t("emergency.selectFriend")}</option>
                {availableEmergencyFriends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name}{friend.email ? ` (${friend.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="divide-y divide-border-secondary">
            {emergencyContacts.map((contact) => (
              <div key={contact.id} className="p-4 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_auto] gap-4 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                  <p className="text-[10px] text-text-muted font-mono truncate">{contact.email}</p>
                </div>
                <Input
                  label={t("emergency.alertMessage")}
                  value={contact.message}
                  onChange={(event) => updateEmergencyContactMessage(contact.id, event.target.value)}
                />
                <Button type="button" variant="secondary" className="text-xs py-2 px-3 text-red-600" onClick={() => removeEmergencyContact(contact.id)}>
                  {t("emergency.remove")}
                </Button>
              </div>
            ))}
            {emergencyContacts.length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted">{t("emergency.noEmergencyContacts")}</div>
            )}
          </div>
        </div>

        <div className="border-t border-border-primary pt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleBack}>
            {t("emergency.cancel")}
          </Button>
          <Button type="submit" variant="primary">
            {t("emergency.saveEmergency")}
          </Button>
        </div>
      </form>
    </>
  );
}
