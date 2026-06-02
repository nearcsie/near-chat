"use client";

import React, { useRef, useEffect } from "react";
import { useChat, getAvatarForUser } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

interface ProfilePopoverProps {
  username: string;
  onClose: (e: React.MouseEvent) => void;
  position?: "left" | "right" | "bottom" | "custom";
  style?: React.CSSProperties;
  className?: string;
}

export default function ProfilePopover({ username, onClose, position = "right", style, className }: ProfilePopoverProps) {
  const { user, friends, rooms, handleCreateRoom, emergencySettings, saveEmergencySettings } = useChat();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Close popover if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest(".avatar-click-target")) {
          return;
        }
        onClose(event as unknown as React.MouseEvent);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const isSelf = username === user.username;
  const friend = friends.find((f) => f.name === username);

  const email = isSelf
    ? user.email
    : friend
    ? friend.email
    : `${username.toLowerCase().replace(/\s+/g, "")}@example.com`;

  const avatar = isSelf
    ? user.avatar
    : getAvatarForUser(username, user.avatar, user.username);

  const status = isSelf ? "online" : friend ? friend.status : "offline";
  const bio = isSelf ? user.bio || t("profileCard.defaultBio") : t("profileCard.defaultBio");

  const isEmergency = friend ? emergencySettings.contacts.some((c) => c.contactId === friend.id) : false;

  const handleToggleEmergency = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!friend) return;

    if (isEmergency) {
      saveEmergencySettings({
        ...emergencySettings,
        contacts: emergencySettings.contacts.filter((c) => c.contactId !== friend.id),
      });
    } else {
      saveEmergencySettings({
        ...emergencySettings,
        contacts: [
          ...emergencySettings.contacts,
          {
            id: `ec-${Date.now()}`,
            contactId: friend.id,
            name: friend.name,
            email: friend.email,
            message: t("profileCard.emergencyMessage"),
          },
        ],
      });
    }
  };

  const handleSendMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelf) return;

    const existingRoom = rooms.find((r) => r.type === "msg" && r.name === username);
    if (existingRoom) {
      router.push(`/chat/${existingRoom.id}`);
    } else {
      const newId = handleCreateRoom(username, "msg", "");
      router.push(`/chat/${newId}`);
    }
    onClose(e);
  };

  const positionClasses = {
    left: "absolute right-full top-1/2 -translate-y-1/2 mr-3",
    right: "absolute left-full top-0 ml-3",
    bottom: "absolute left-0 top-full mt-2",
    custom: "",
  };

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      style={style}
      className={`${positionClasses[position]} ${className || ""} z-[100] w-[240px] bg-surface-card/95 border border-border-primary rounded-sm shadow-xl p-4 text-left select-none text-foreground backdrop-blur-md transition-all duration-150`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
          {isSelf ? t("profileCard.myInfo") : friend ? t("profileCard.friendInfo") : t("profileCard.memberInfo")}
        </span>
        <button
          onClick={onClose}
          type="button"
          className="text-text-muted hover:text-foreground cursor-pointer p-0.5 hover:bg-surface-muted rounded-sm transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center text-center gap-2 py-2">
        <Avatar name={username} src={avatar} size="md" isOnline={status === "online"} />
        <div className="min-w-0 w-full">
          <h4 className="text-xs font-bold text-foreground truncate">{username}</h4>
          <p className="text-[9px] text-text-muted font-mono truncate mt-0.5">{email}</p>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-border-secondary/40 text-xs">
        <div>
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block mb-0.5">
            {t("profileCard.status")}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-2.5 w-2.5 border border-border-primary ${status === "online" ? "bg-green-500" : "bg-zinc-500"}`} />
            <span className="text-[11px] text-foreground leading-none">{t(`common.${status}`)}</span>
          </div>
        </div>

        <div>
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block mb-0.5">
            {t("profileCard.bio")}
          </span>
          <p className="text-[11px] text-text-muted leading-relaxed truncate-3-lines">{bio}</p>
        </div>

        {friend && (
          <div className="flex items-center justify-between border-t border-border-secondary/40 pt-2.5 mt-1">
            <span className="text-[11px] font-semibold text-foreground">{t("profileCard.setEmergency")}</span>
            <button
              onClick={handleToggleEmergency}
              type="button"
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEmergency ? "bg-primary" : "bg-zinc-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isEmergency ? "translate-x-3.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {!isSelf && (
        <Button onClick={handleSendMessage} variant="primary" className="w-full mt-3 text-[11px] py-1.5 font-bold">
          {t("profileCard.sendMessage")}
        </Button>
      )}
    </div>
  );
}
