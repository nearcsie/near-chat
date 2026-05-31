"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Avatar } from "@/components/ui/Avatar";

export default function PersonalSettings() {
  const router = useRouter();
  const { user, handleSavePersonalSettings, rooms } = useChat();

  const [personalUsername, setPersonalUsername] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalAvatar, setPersonalAvatar] = useState("");
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [personalTheme, setPersonalTheme] = useState("light");
  const [personalLanguage, setPersonalLanguage] = useState("zh-TW");
  const [personalNewPassword, setPersonalNewPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [personalSuccessMsg, setPersonalSuccessMsg] = useState("");
  const [personalErrorMsg, setPersonalErrorMsg] = useState("");

  useEffect(() => {
    // Populate form values from localStorage or user state
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setPersonalUsername(u.username || "我");
        setPersonalEmail(u.email || "your@email.com");
        setPersonalAvatar(u.avatar || "");
      } catch (e) {
        console.error(e);
      }
    } else {
      setPersonalUsername(user.username);
      setPersonalEmail(user.email);
      setPersonalAvatar(user.avatar);
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    setPersonalTheme(savedTheme);

    const savedNotify = localStorage.getItem("notify-desktop");
    setDesktopNotifications(savedNotify !== "false");

    const savedSound = localStorage.getItem("notify-sound");
    setMessageSounds(savedSound !== "false");
  }, [user]);

  const handlePersonalThemeChange = (newTheme: string) => {
    setPersonalTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
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
    const nextIndex = (currentIndex + 1) % avatars.length;
    setPersonalAvatar(avatars[nextIndex]);
  };

  const handleBack = () => {
    if (rooms.length > 0) {
      router.push(`/chat/${rooms[0].id}`);
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalErrorMsg("");
    setPersonalSuccessMsg("");

    if (personalNewPassword && personalNewPassword.length < 8) {
      setPersonalErrorMsg("新密碼長度至少需要 8 個字元");
      return;
    }

    if (personalNewPassword !== personalConfirmPassword) {
      setPersonalErrorMsg("密碼與確認密碼不相符");
      return;
    }

    try {
      await handleSavePersonalSettings({
        username: personalUsername,
        email: personalEmail,
        avatar: personalAvatar,
        theme: personalTheme,
        notifyDesktop: desktopNotifications,
        notifySound: messageSounds,
      });

      setPersonalSuccessMsg("設定已成功儲存！");
      setTimeout(() => {
        handleBack();
      }, 800);
    } catch (error) {
      console.error(error);
      setPersonalErrorMsg(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <h1 className="text-sm font-bold text-foreground tracking-wider">個人設定</h1>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleBack} className="text-xs py-1 px-3">
            返回聊天
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Profile Section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                個人資料
              </h2>
              <div className="flex items-center gap-6 py-2">
                <Avatar name={personalUsername} src={personalAvatar} size="lg" />
                <Button type="button" variant="secondary" onClick={handlePersonalAvatarChange}>
                  變更頭像
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="使用者名稱"
                  type="text"
                  value={personalUsername}
                  onChange={(e) => setPersonalUsername(e.target.value)}
                  required
                />
                <Input
                  label="電子郵件"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Notifications Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                通知設定
              </h2>
              <div className="flex flex-col gap-3.5 mt-1">
                <Checkbox
                  label="啟用桌面通知"
                  checked={desktopNotifications}
                  onChange={(e) => setDesktopNotifications(e.target.checked)}
                />
                <Checkbox
                  label="啟用訊息音效"
                  checked={messageSounds}
                  onChange={(e) => setMessageSounds(e.target.checked)}
                />
              </div>
            </div>

            {/* Appearance Section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                外觀
              </h2>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5 select-none">
                  主題
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={personalTheme === "light"}
                      onChange={() => handlePersonalThemeChange("light")}
                      className="accent-primary h-4.5 w-4.5"
                    />
                    <span>淺色</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={personalTheme === "dark"}
                      onChange={() => handlePersonalThemeChange("dark")}
                      className="accent-primary h-4.5 w-4.5"
                    />
                    <span>深色</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Language Section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                語言
              </h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
                  顯示語言
                </label>
                <select
                  value={personalLanguage}
                  onChange={(e) => setPersonalLanguage(e.target.value)}
                  className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors max-w-xs cursor-pointer"
                >
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {/* Security Section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                安全性 (變更密碼)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="新密碼"
                  type="password"
                  placeholder="留空則不修改"
                  value={personalNewPassword}
                  onChange={(e) => setPersonalNewPassword(e.target.value)}
                />
                <Input
                  label="確認新密碼"
                  type="password"
                  placeholder="再次輸入新密碼"
                  value={personalConfirmPassword}
                  onChange={(e) => setPersonalConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Feedback messages */}
            {personalErrorMsg && (
              <p className="text-xs text-red-600 font-sans text-center mt-2">{personalErrorMsg}</p>
            )}
            {personalSuccessMsg && (
              <p className="text-xs text-green-600 font-sans font-bold text-center mt-2">
                {personalSuccessMsg}
              </p>
            )}

            {/* Submit Actions */}
            <div className="border-t border-border-primary pt-6 mt-2 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={handleBack}>
                取消
              </Button>
              <Button type="submit" variant="primary">
                儲存變更
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
