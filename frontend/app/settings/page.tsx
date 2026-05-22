"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Avatar } from "@/components/ui/Avatar";

export default function SettingsPage() {
  const router = useRouter();

  // Profile settings
  const [username, setUsername] = useState("我");
  const [email, setEmail] = useState("your@email.com");
  const [avatar, setAvatar] = useState("");

  // Notification settings
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);

  // Appearance / Theme
  const [theme, setTheme] = useState("light");

  // Language
  const [language, setLanguage] = useState("zh-TW");

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load configuration from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUsername(u.username || "我");
        setEmail(u.email || "your@email.com");
        setAvatar(u.avatar || "");
      } catch (e) {
        console.error(e);
      }
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);

    const savedNotify = localStorage.getItem("notify-desktop");
    if (savedNotify !== null) setDesktopNotifications(savedNotify === "true");

    const savedSound = localStorage.getItem("notify-sound");
    if (savedSound !== null) setMessageSounds(savedSound === "true");
  }, []);

  // Update theme dynamically on document element
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword && newPassword.length < 8) {
      setErrorMsg("新密碼長度至少需要 8 個字元");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("密碼與確認密碼不相符");
      return;
    }

    // Save user settings
    localStorage.setItem(
      "user",
      JSON.stringify({
        username,
        email,
        avatar,
        bio: "隨意聊天的地方",
      })
    );
    localStorage.setItem("theme", theme);
    localStorage.setItem("notify-desktop", String(desktopNotifications));
    localStorage.setItem("notify-sound", String(messageSounds));

    setSuccessMsg("設定已成功儲存！");
    setTimeout(() => {
      router.push("/");
    }, 1000);
  };

  const handleCancel = () => {
    router.push("/");
  };

  const handleAvatarChange = () => {
    // Cycles between a few simple mock avatar sources or empty string
    const avatars = [
      "",
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
    ];
    const currentIndex = avatars.indexOf(avatar);
    const nextIndex = (currentIndex + 1) % avatars.length;
    setAvatar(avatars[nextIndex]);
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 bg-background transition-colors min-h-screen">
      <div className="w-full max-w-xl border border-border-primary rounded-sm bg-surface-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-border-primary px-6 py-4 flex items-center justify-between bg-surface-muted select-none">
          <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">個人設定</h1>
          <Button variant="ghost" onClick={handleCancel}>
            返回聊天
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">
          {/* Profile Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
              個人資料
            </h2>
            <div className="flex items-center gap-6 py-2">
              <Avatar name={username} src={avatar} size="lg" />
              <Button type="button" variant="secondary" onClick={handleAvatarChange}>
                變更頭像
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="使用者名稱"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                label="電子郵件"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                    checked={theme === "light"}
                    onChange={() => handleThemeChange("light")}
                    className="accent-primary h-4.5 w-4.5"
                  />
                  <span>淺色</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === "dark"}
                    onChange={() => handleThemeChange("dark")}
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
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                label="確認新密碼"
                type="password"
                placeholder="再次輸入新密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <p className="text-xs text-red-600 font-sans text-center mt-2">{errorMsg}</p>
          )}
          {successMsg && (
            <p className="text-xs text-green-600 font-sans font-bold text-center mt-2">
              {successMsg}
            </p>
          )}

          {/* Footer Actions */}
          <div className="border-t border-border-primary pt-6 mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancel}>
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
