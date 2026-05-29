"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmergencyContact, EmergencySettings, useChat } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import FeedbackMessage, { SettingsFeedback } from "@/components/settings/FeedbackMessage";
import SectionTitle from "@/components/settings/SectionTitle";

const emergencyCopy = {
  "zh-TW": {
    emergencyReporting: "離線警示",
    enableOfflineWarning: "啟用離線警示",
    warningDays: "警示天數",
    defaultAlertMessage: "預設警示訊息",
    defaultMessage: "我已經離線好幾天，請協助確認我的狀況。",
    emergencyContacts: "緊急聯絡人",
    addFriendAsContact: "加入好友為緊急聯絡人",
    selectFriend: "選擇好友",
    alertMessage: "警示訊息",
    remove: "移除",
    noEmergencyContacts: "尚未選擇緊急聯絡人。",
    cancel: "取消",
    saveEmergency: "儲存緊急設定",
    emergencySaved: "緊急聯絡設定已儲存。",
  },
  en: {
    emergencyReporting: "Emergency reporting",
    enableOfflineWarning: "Enable offline warning",
    warningDays: "Warning days",
    defaultAlertMessage: "Default alert message",
    defaultMessage: "I have been offline for several days. Please check in with me.",
    emergencyContacts: "Emergency contacts",
    addFriendAsContact: "Add friend as contact",
    selectFriend: "Select a friend",
    alertMessage: "Alert message",
    remove: "Remove",
    noEmergencyContacts: "No emergency contacts selected.",
    cancel: "Cancel",
    saveEmergency: "Save emergency settings",
    emergencySaved: "Emergency contact settings saved.",
  },
} as const;

export default function EmergencySettingsPanel() {
  const router = useRouter();
  const { rooms, friends, emergencySettings, uiLanguage, saveEmergencySettings } = useChat();
  const [warningEnabled, setWarningEnabled] = useState(true);
  const [warningDays, setWarningDays] = useState(7);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [defaultEmergencyMessage, setDefaultEmergencyMessage] = useState("");
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const t = emergencyCopy[uiLanguage];

  useEffect(() => {
    setWarningEnabled(emergencySettings.warningEnabled);
    setWarningDays(emergencySettings.warningDays);
    setEmergencyContacts(emergencySettings.contacts);
    setDefaultEmergencyMessage(emergencySettings.contacts[0]?.message || emergencyCopy[uiLanguage].defaultMessage);
  }, [emergencySettings, uiLanguage]);

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

  const handleEmergencySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const settings: EmergencySettings = {
      warningEnabled,
      warningDays: Math.max(1, warningDays),
      contacts: emergencyContacts,
    };
    saveEmergencySettings(settings);
    setFeedback({ type: "success", text: t.emergencySaved });
  };

  return (
    <>
      <FeedbackMessage feedback={feedback} />

      <form onSubmit={handleEmergencySubmit} className="flex flex-col gap-6 max-w-5xl">
        <SectionTitle title={t.emergencyReporting} />
        <div className="border border-border-primary rounded-sm bg-surface-card p-4 flex flex-col gap-4">
          <Checkbox
            label={t.enableOfflineWarning}
            checked={warningEnabled}
            onChange={(event) => setWarningEnabled(event.target.checked)}
          />
          <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
            <Input
              label={t.warningDays}
              type="number"
              min={1}
              value={warningDays}
              onChange={(event) => setWarningDays(Number(event.target.value))}
            />
            <Input
              label={t.defaultAlertMessage}
              value={defaultEmergencyMessage}
              onChange={(event) => setDefaultEmergencyMessage(event.target.value)}
            />
          </div>
        </div>

        <SectionTitle title={t.emergencyContacts} />
        <div className="border border-border-primary rounded-sm bg-surface-card">
          <div className="p-4 border-b border-border-secondary flex flex-col md:flex-row md:items-end gap-4">
            <label className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t.addFriendAsContact}</span>
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
                <option value="">{t.selectFriend}</option>
                {availableEmergencyFriends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name} ({friend.email})
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
                  label={t.alertMessage}
                  value={contact.message}
                  onChange={(event) => updateEmergencyContactMessage(contact.id, event.target.value)}
                />
                <Button type="button" variant="secondary" className="text-xs py-2 px-3 text-red-600" onClick={() => removeEmergencyContact(contact.id)}>
                  {t.remove}
                </Button>
              </div>
            ))}
            {emergencyContacts.length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted">{t.noEmergencyContacts}</div>
            )}
          </div>
        </div>

        <div className="border-t border-border-primary pt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleBack}>
            {t.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {t.saveEmergency}
          </Button>
        </div>
      </form>
    </>
  );
}
