"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UiLanguage, useChat, PreferencesInput } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import FeedbackMessage, { SettingsFeedback } from "@/components/settings/FeedbackMessage";
import SectionTitle from "@/components/settings/SectionTitle";
import { useTranslation } from "@/hooks/useTranslation";

export default function ProfileSettings() {
  const router = useRouter();
  const { user, rooms, uiLanguage, handleUpdateProfile, handleUpdatePreferences, handleDeleteAccount } = useChat();
  const [personalUsername, setPersonalUsername] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalAvatar, setPersonalAvatar] = useState("");
  const [personalBio, setPersonalBio] = useState("");
  const [personalNewPassword, setPersonalNewPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<SettingsFeedback | null>(null);

  // localStorage is only available after mount, so this hydration must stay in
  // an effect; reading it during render would break SSR/hydration.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- post-mount localStorage hydration */
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setPersonalUsername(parsed.username || user.username);
        setPersonalEmail(parsed.email || user.email);
        setPersonalAvatar(parsed.avatar || user.avatar);
        setPersonalBio(parsed.bio || user.bio || "");
      } catch (error) {
        console.error(error);
      }
    } else {
      setPersonalUsername(user.username);
      setPersonalEmail(user.email);
      setPersonalAvatar(user.avatar);
      setPersonalBio(user.bio || "");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  const { t } = useTranslation();

  const handleBack = () => {
    router.push(rooms[0] ? `/chat/${rooms[0].id}` : "/");
  };

  const currentTheme = user.theme || "light";
  const currentLanguage = user.language || uiLanguage;
  const currentNotifyDesktop = user.notifyDesktop ?? true;
  const currentNotifySound = user.notifySound ?? true;

  const updatePreference = async (updates: Partial<PreferencesInput>) => {
    try {
      await handleUpdatePreferences({
        theme: updates.theme ?? currentTheme,
        language: updates.language ?? currentLanguage,
        notifyDesktop: updates.notifyDesktop ?? currentNotifyDesktop,
        notifySound: updates.notifySound ?? currentNotifySound,
      });
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
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
    setProfileFeedback(null);

    if (personalNewPassword && personalNewPassword.length < 8) {
      setProfileFeedback({ type: "error", text: t("profile.passwordTooShort") });
      return;
    }

    if (personalNewPassword !== personalConfirmPassword) {
      setProfileFeedback({ type: "error", text: t("profile.passwordMismatch") });
      return;
    }

    try {
      await handleUpdateProfile({
        username: personalUsername,
        email: personalEmail,
        avatar: personalAvatar,
        password: personalNewPassword || undefined,
        bio: personalBio,
      });
      setPersonalNewPassword("");
      setPersonalConfirmPassword("");
      setProfileFeedback({ type: "success", text: t("profile.profileSaved") });
    } catch (error) {
      console.error(error);
      setProfileFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    }
  };

  return (
    <>
      <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6 max-w-4xl">
        <FeedbackMessage feedback={profileFeedback} />
        <SectionTitle title={t("profile.profile")} />
        <div className="flex items-center gap-6 py-2">
          <Avatar name={personalUsername} src={personalAvatar} size="lg" />
          <Button type="button" variant="secondary" onClick={handlePersonalAvatarChange}>
            {t("profile.changeAvatar")}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <Input label={t("profile.userId")} value={user.userId} readOnly disabled />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t("profile.username")} value={personalUsername} onChange={(event) => setPersonalUsername(event.target.value)} required />
            <Input label={t("profile.email")} type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} required />
          </div>
          <Input label={t("profile.bio")} value={personalBio} onChange={(event) => setPersonalBio(event.target.value)} />
        </div>

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

      <div className="flex flex-col gap-6 max-w-4xl mt-12">
        <SectionTitle title={t("profile.notifications")} />
        <div className="flex flex-col gap-3">
          <Checkbox 
            label={t("profile.desktopNotifications")} 
            checked={currentNotifyDesktop} 
            onChange={(event) => void updatePreference({ notifyDesktop: event.target.checked })} 
          />
          <Checkbox 
            label={t("profile.messageSounds")} 
            checked={currentNotifySound} 
            onChange={(event) => void updatePreference({ notifySound: event.target.checked })} 
          />
        </div>

        <SectionTitle title={t("profile.appearance")} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input 
              type="radio" 
              name="theme" 
              checked={currentTheme === "light"} 
              onChange={() => void updatePreference({ theme: "light" })} 
              className="accent-primary" 
            />
            {t("profile.light")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input 
              type="radio" 
              name="theme" 
              checked={currentTheme === "dark"} 
              onChange={() => void updatePreference({ theme: "dark" })} 
              className="accent-primary" 
            />
            {t("profile.dark")}
          </label>
        </div>

        <SectionTitle title={t("profile.language")} />
        <select
          value={currentLanguage}
          onChange={(event) => void updatePreference({ language: event.target.value as UiLanguage })}
          className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors max-w-xs cursor-pointer"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="mt-12 max-w-4xl border border-red-500/20 rounded-lg p-6 bg-red-500/5">
        <h3 className="text-lg font-semibold text-red-500 mb-2">{t("profile.deleteAccount")}</h3>
        <p className="text-sm text-foreground/70 mb-4">
          {t("profile.deleteAccountWarning")}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20 transition-colors"
          onClick={async () => {
            if (window.confirm(t("profile.deleteAccountConfirm"))) {
              try {
                await handleDeleteAccount();
              } catch (err) {
                setProfileFeedback({ type: "error", text: t("profile.deleteAccountFailed") });
              }
            }
          }}
        >
          {t("profile.deleteAccountButton")}
        </Button>
      </div>
    </>
  );
}
