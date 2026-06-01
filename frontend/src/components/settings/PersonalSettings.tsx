"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useChat } from "@/context/ChatContext";

export default function PersonalSettings() {
  const router = useRouter();
  const { user, handleSavePersonalSettings, rooms } = useChat();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [theme, setTheme] = useState("light");
  const [notifyDesktop, setNotifyDesktop] = useState(true);
  const [notifySound, setNotifySound] = useState(true);
  const [language, setLanguage] = useState("en");
  const [warningEnabled, setWarningEnabled] = useState(false);
  const [warningDays, setWarningDays] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setAvatar(user.avatar);
    setLanguage(user.language ?? "en");
    setWarningEnabled(user.warningEnabled ?? false);
    setWarningDays(user.warningDays ?? 0);

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);

    const savedNotifyDesktop = localStorage.getItem("notify-desktop");
    setNotifyDesktop(savedNotifyDesktop !== "false");

    const savedNotifySound = localStorage.getItem("notify-sound");
    setNotifySound(savedNotifySound !== "false");
  }, [user]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      return;
    }
    document.documentElement.classList.remove("dark");
  }, [theme]);

  const handleBack = () => {
    if (rooms.length > 0) {
      router.push(`/chat/${rooms[0].id}`);
      return;
    }
    router.push("/");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!username.trim()) {
      setErrorMessage("Display name cannot be empty.");
      return;
    }

    if (warningEnabled && warningDays < 1) {
      setErrorMessage("Warning days must be at least 1 when inactivity alerts are enabled.");
      return;
    }

    setIsSaving(true);
    try {
      await handleSavePersonalSettings({
        username: username.trim(),
        email,
        avatar: avatar.trim(),
        theme,
        notifyDesktop,
        notifySound,
        language,
        warningEnabled,
        warningDays,
      });
      setSuccessMessage("Settings saved.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-border-primary bg-surface-card px-6 select-none">
        <h1 className="text-sm font-bold tracking-wider text-foreground">Personal settings</h1>
        <Button type="button" variant="secondary" onClick={handleBack} className="px-3 py-1 text-xs">
          Back
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface-card p-6">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-6">
          <section className="flex flex-col gap-4">
            <div className="border-b border-border-secondary pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Profile</h2>
            </div>

            <div className="flex items-center gap-4">
              <Avatar name={username || user.username || "User"} src={avatar} size="lg" />
              <p className="text-sm text-text-muted">
                Name and avatar are saved to the backend profile. Email is shown here for reference.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Display name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
              <Input label="Email" value={email} readOnly disabled />
            </div>

            <Input
              label="Avatar URL"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
            />
          </section>

          <section className="flex flex-col gap-4">
            <div className="border-b border-border-secondary pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">App preferences</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="max-w-xs rounded-sm border border-border-secondary bg-surface-card px-3 py-2.5 text-sm text-foreground transition-colors hover:border-border-primary focus:border-primary focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="zh-TW">Traditional Chinese</option>
                </select>
              </div>

              <Input
                label="Warning days"
                type="number"
                min={0}
                value={String(warningDays)}
                disabled={!warningEnabled}
                onChange={(event) => setWarningDays(Number(event.target.value) || 0)}
              />
            </div>

            <Checkbox
              label="Enable inactivity alerts"
              description="When enabled, the backend checks whether you have been inactive longer than the configured number of days."
              checked={warningEnabled}
              onChange={(event) => {
                const checked = event.target.checked;
                setWarningEnabled(checked);
                if (!checked) {
                  setWarningDays(0);
                } else if (warningDays < 1) {
                  setWarningDays(1);
                }
              }}
            />
          </section>

          <section className="flex flex-col gap-4">
            <div className="border-b border-border-secondary pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Local only</h2>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Theme</label>
                <div className="flex gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={theme === "light"}
                      onChange={() => setTheme("light")}
                      className="h-4.5 w-4.5 accent-primary"
                    />
                    <span>Light</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={theme === "dark"}
                      onChange={() => setTheme("dark")}
                      className="h-4.5 w-4.5 accent-primary"
                    />
                    <span>Dark</span>
                  </label>
                </div>
              </div>

              <Checkbox
                label="Desktop notifications"
                description="Stored locally in this browser."
                checked={notifyDesktop}
                onChange={(event) => setNotifyDesktop(event.target.checked)}
              />
              <Checkbox
                label="Message sounds"
                description="Stored locally in this browser."
                checked={notifySound}
                onChange={(event) => setNotifySound(event.target.checked)}
              />
            </div>
          </section>

          {(errorMessage || successMessage) && (
            <div className="rounded-sm border border-border-secondary bg-surface-muted px-4 py-3 text-sm">
              {errorMessage && <p className="text-red-600">{errorMessage}</p>}
              {successMessage && <p className="text-green-600">{successMessage}</p>}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-3 border-t border-border-primary pt-6">
            <Button type="button" variant="secondary" onClick={handleBack}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
