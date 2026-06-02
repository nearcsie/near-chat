"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UiLanguage, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import FeedbackMessage, { SettingsFeedback } from "@/components/settings/FeedbackMessage";
import SectionTitle from "@/components/settings/SectionTitle";
import { useTranslation } from "@/hooks/useTranslation";

export default function ProfileSettings() {
  const router = useRouter();
  const { user, rooms, uiLanguage, handleSavePersonalSettings, setUiLanguage } = useChat();
  const [personalUsername, setPersonalUsername] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalAvatar, setPersonalAvatar] = useState("");
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [personalTheme, setPersonalTheme] = useState("light");
  const [personalLanguage, setPersonalLanguage] = useState<UiLanguage>("zh-TW");
  const [personalNewPassword, setPersonalNewPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);

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

    setPersonalTheme(localStorage.getItem("theme") || "light");
    setPersonalLanguage(uiLanguage);
    setDesktopNotifications(localStorage.getItem("notify-desktop") !== "false");
    setMessageSounds(localStorage.getItem("notify-sound") !== "false");
  }, [uiLanguage, user]);

  const { t } = useTranslation();

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

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (personalNewPassword && personalNewPassword.length < 8) {
      setFeedback({ type: "error", text: t("profile.passwordTooShort") });
      return;
    }

    if (personalNewPassword !== personalConfirmPassword) {
      setFeedback({ type: "error", text: t("profile.passwordMismatch") });
      return;
    }

    try {
      await handleSavePersonalSettings({
        username: personalUsername,
        email: personalEmail,
        avatar: personalAvatar,
        theme: personalTheme,
        language: personalLanguage,
        notifyDesktop: desktopNotifications,
        notifySound: messageSounds,
      });
      setFeedback({ type: "success", text: t("profile.profileSaved") });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    }
  };

  return (
    <>
      <FeedbackMessage feedback={feedback} />

      <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6 max-w-4xl">
        <SectionTitle title={t("profile.profile")} />
        <div className="flex items-center gap-6 py-2">
          <Avatar name={personalUsername} src={personalAvatar} size="lg" />
          <Button type="button" variant="secondary" onClick={handlePersonalAvatarChange}>
            {t("profile.changeAvatar")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t("profile.username")} value={personalUsername} onChange={(event) => setPersonalUsername(event.target.value)} required />
          <Input label={t("profile.email")} type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} required />
        </div>

        <SectionTitle title={t("profile.notifications")} />
        <div className="flex flex-col gap-3">
          <Checkbox label={t("profile.desktopNotifications")} checked={desktopNotifications} onChange={(event) => setDesktopNotifications(event.target.checked)} />
          <Checkbox label={t("profile.messageSounds")} checked={messageSounds} onChange={(event) => setMessageSounds(event.target.checked)} />
        </div>

        <SectionTitle title={t("profile.appearance")} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="radio" name="theme" checked={personalTheme === "light"} onChange={() => handlePersonalThemeChange("light")} className="accent-primary" />
            {t("profile.light")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="radio" name="theme" checked={personalTheme === "dark"} onChange={() => handlePersonalThemeChange("dark")} className="accent-primary" />
            {t("profile.dark")}
          </label>
        </div>

        <SectionTitle title={t("profile.language")} />
        <select
          value={personalLanguage}
          onChange={(event) => handleLanguageChange(event.target.value as UiLanguage)}
          className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors max-w-xs cursor-pointer"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
        </select>

        <SectionTitle title={t("profile.security")} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t("profile.newPassword")} type="password" value={personalNewPassword} onChange={(event) => setPersonalNewPassword(event.target.value)} />
          <Input label={t("profile.confirmPassword")} type="password" value={personalConfirmPassword} onChange={(event) => setPersonalConfirmPassword(event.target.value)} />
        </div>

        <div className="border-t border-border-primary pt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleBack}>
            {t("profile.cancel")}
          </Button>
          <Button type="submit" variant="primary">
            {t("profile.saveProfile")}
          </Button>
        </div>
      </form>
    </>
  );
}
