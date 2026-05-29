"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmergencyContact, EmergencySettings, UiLanguage, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import FriendsPanel from "@/components/settings/FriendsPanel";

type SettingsTab = "profile" | "friends" | "emergency";

const settingsCopy = {
  "zh-TW": {
    settings: "設定",
    backToChat: "返回聊天",
    profile: "個人資料",
    friends: "好友",
    emergency: "緊急聯絡",
    changeAvatar: "更換頭像",
    username: "使用者名稱",
    email: "Email",
    notifications: "通知",
    desktopNotifications: "桌面通知",
    messageSounds: "訊息音效",
    appearance: "外觀",
    light: "淺色",
    dark: "深色",
    language: "語言",
    traditionalChinese: "繁體中文",
    english: "英文",
    security: "安全性",
    newPassword: "新密碼",
    confirmPassword: "確認密碼",
    cancel: "取消",
    saveProfile: "儲存個人資料",
    profileSaved: "個人設定已儲存。",
    passwordTooShort: "密碼至少需要 8 個字元。",
    passwordMismatch: "兩次輸入的密碼不一致。",
    emergencyReporting: "離線警示",
    enableOfflineWarning: "啟用離線警示",
    warningDays: "警示天數",
    defaultAlertMessage: "預設警示訊息",
    defaultMessage: "我已經多日未上線，請協助確認我的狀況。",
    emergencyContacts: "緊急聯絡人",
    addFriendAsContact: "加入好友為緊急聯絡人",
    selectFriend: "選擇好友",
    alertMessage: "警示訊息",
    remove: "移除",
    noEmergencyContacts: "尚未選擇緊急聯絡人。",
    saveEmergency: "儲存緊急設定",
    emergencySaved: "緊急聯絡設定已儲存。",
  },
  en: {
    settings: "Settings",
    backToChat: "Back to chat",
    profile: "Profile",
    friends: "Friends",
    emergency: "Emergency",
    changeAvatar: "Change avatar",
    username: "Username",
    email: "Email",
    notifications: "Notifications",
    desktopNotifications: "Desktop notifications",
    messageSounds: "Message sounds",
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    language: "Language",
    traditionalChinese: "Traditional Chinese",
    english: "English",
    security: "Security",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    cancel: "Cancel",
    saveProfile: "Save profile",
    profileSaved: "Profile settings saved.",
    passwordTooShort: "Password must be at least 8 characters.",
    passwordMismatch: "Password confirmation does not match.",
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
    saveEmergency: "Save emergency settings",
    emergencySaved: "Emergency contact settings saved.",
  },
} as const;

export default function PersonalSettings() {
  const router = useRouter();
  const {
    user,
    rooms,
    friends,
    emergencySettings,
    uiLanguage,
    handleSavePersonalSettings,
    saveEmergencySettings,
    setUiLanguage,
  } = useChat();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [personalUsername, setPersonalUsername] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalAvatar, setPersonalAvatar] = useState("");
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [personalTheme, setPersonalTheme] = useState("light");
  const [personalLanguage, setPersonalLanguage] = useState<UiLanguage>("zh-TW");
  const [personalNewPassword, setPersonalNewPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [warningEnabled, setWarningEnabled] = useState(true);
  const [warningDays, setWarningDays] = useState(7);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [defaultEmergencyMessage, setDefaultEmergencyMessage] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setPersonalUsername(parsed.username || user.username);
        setPersonalEmail(parsed.email || user.email);
        setPersonalAvatar(parsed.avatar || user.avatar);
      } catch (error) {
        console.error(error);
      }
    } else {
      setPersonalUsername(user.username);
      setPersonalEmail(user.email);
      setPersonalAvatar(user.avatar);
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    setPersonalTheme(savedTheme);
    setPersonalLanguage(uiLanguage);
    setDesktopNotifications(localStorage.getItem("notify-desktop") !== "false");
    setMessageSounds(localStorage.getItem("notify-sound") !== "false");
  }, [uiLanguage, user]);

  const t = settingsCopy[personalLanguage];

  useEffect(() => {
    setWarningEnabled(emergencySettings.warningEnabled);
    setWarningDays(emergencySettings.warningDays);
    setEmergencyContacts(emergencySettings.contacts);
    setDefaultEmergencyMessage(
      emergencySettings.contacts[0]?.message ||
        settingsCopy[personalLanguage].defaultMessage
    );
  }, [emergencySettings, personalLanguage]);

  const availableEmergencyFriends = useMemo(
    () => friends.filter((friend) => !emergencyContacts.some((contact) => contact.contactId === friend.id)),
    [friends, emergencyContacts]
  );

  const handleBack = () => {
    router.push(rooms[0] ? `/chat/${rooms[0].id}` : "/");
  };

  const handlePersonalThemeChange = (newTheme: string) => {
    setPersonalTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleLanguageChange = (newLanguage: UiLanguage) => {
    setPersonalLanguage(newLanguage);
    setUiLanguage(newLanguage);
  };

  const handlePersonalAvatarChange = () => {
    const avatars = [
      "",
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
    ];
    const currentIndex = avatars.indexOf(personalAvatar);
    setPersonalAvatar(avatars[(currentIndex + 1) % avatars.length]);
  };

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (personalNewPassword && personalNewPassword.length < 8) {
      setFeedback({ type: "error", text: t.passwordTooShort });
      return;
    }

    if (personalNewPassword !== personalConfirmPassword) {
      setFeedback({ type: "error", text: t.passwordMismatch });
      return;
    }

    handleSavePersonalSettings({
      username: personalUsername,
      email: personalEmail,
      avatar: personalAvatar,
      theme: personalTheme,
      language: personalLanguage,
      notifyDesktop: desktopNotifications,
      notifySound: messageSounds,
    });
    setFeedback({ type: "success", text: t.profileSaved });
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
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <h1 className="text-sm font-bold text-foreground tracking-wider">{t.settings}</h1>
        <Button type="button" variant="secondary" onClick={handleBack} className="text-xs py-1 px-3">
          {t.backToChat}
        </Button>
      </div>

      <div className="border-b border-border-primary bg-surface-muted px-6 flex gap-2 shrink-0">
        <TabButton label={t.profile} active={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
        <TabButton label={t.friends} active={activeTab === "friends"} onClick={() => setActiveTab("friends")} />
        <TabButton label={t.emergency} active={activeTab === "emergency"} onClick={() => setActiveTab("emergency")} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        {feedback && (
          <div
            className={`mb-4 border rounded-sm px-4 py-3 text-xs font-semibold ${
              feedback.type === "error"
                ? "border-red-600 text-red-700 bg-red-50"
                : "border-primary text-primary bg-surface-muted"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {activeTab === "profile" && (
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6 max-w-4xl">
            <SectionTitle title={t.profile} />
            <div className="flex items-center gap-6 py-2">
              <Avatar name={personalUsername} src={personalAvatar} size="lg" />
              <Button type="button" variant="secondary" onClick={handlePersonalAvatarChange}>
                {t.changeAvatar}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t.username} value={personalUsername} onChange={(event) => setPersonalUsername(event.target.value)} required />
              <Input label={t.email} type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} required />
            </div>

            <SectionTitle title={t.notifications} />
            <div className="flex flex-col gap-3">
              <Checkbox label={t.desktopNotifications} checked={desktopNotifications} onChange={(event) => setDesktopNotifications(event.target.checked)} />
              <Checkbox label={t.messageSounds} checked={messageSounds} onChange={(event) => setMessageSounds(event.target.checked)} />
            </div>

            <SectionTitle title={t.appearance} />
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="radio" name="theme" checked={personalTheme === "light"} onChange={() => handlePersonalThemeChange("light")} className="accent-primary" />
                {t.light}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="radio" name="theme" checked={personalTheme === "dark"} onChange={() => handlePersonalThemeChange("dark")} className="accent-primary" />
                {t.dark}
              </label>
            </div>

            <SectionTitle title={t.language} />
            <select
              value={personalLanguage}
              onChange={(event) => handleLanguageChange(event.target.value as UiLanguage)}
              className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors max-w-xs cursor-pointer"
            >
              <option value="zh-TW">{t.traditionalChinese}</option>
              <option value="en">{t.english}</option>
            </select>

            <SectionTitle title={t.security} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t.newPassword} type="password" value={personalNewPassword} onChange={(event) => setPersonalNewPassword(event.target.value)} />
              <Input label={t.confirmPassword} type="password" value={personalConfirmPassword} onChange={(event) => setPersonalConfirmPassword(event.target.value)} />
            </div>

            <div className="border-t border-border-primary pt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={handleBack}>
                {t.cancel}
              </Button>
              <Button type="submit" variant="primary">
                {t.saveProfile}
              </Button>
            </div>
          </form>
        )}

        {activeTab === "friends" && <FriendsPanel />}

        {activeTab === "emergency" && (
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
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-x border-transparent ${
        active ? "bg-surface-card text-primary border-border-primary" : "text-text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
      {title}
    </h2>
  );
}
