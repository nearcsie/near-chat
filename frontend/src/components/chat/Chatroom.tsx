"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat, getAvatarForUser, Message, ChatRoom } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { useTranslation } from "@/hooks/useTranslation";
import ProfilePopover from "./ProfilePopover";

interface ChatroomProps {
  roomId: string;
  onOpenGroupSettings?: () => void;
}

interface MentionDraft {
  start: number;
  end: number;
  query: string;
}

const getMentionDraft = (value: string, cursorPosition: number): MentionDraft | null => {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

  if (!match) return null;

  const start = beforeCursor.lastIndexOf("@");
  if (start < 0) return null;

  return {
    start,
    end: cursorPosition,
    query: match[1] ?? "",
  };
};

export default function Chatroom({ roomId, onOpenGroupSettings }: ChatroomProps) {
  const router = useRouter();
  const {
    rooms,
    folders,
    messages,
    user,
    activeRoomNicknames,
    handleSendMessage,
    handleTyping,
    handleUploadAttachment,
    handleRecallMessage,
    handleCategorizeRoom,
    handleModifyNickname,
    handleLeaveOrBlock,
    getReadAvatarsForMessage,
    showRightPanel,
    setShowRightPanel,
    typingUsers,
  } = useChat();

  const [inputText, setInputText] = useState("");
  const [mentionDraft, setMentionDraft] = useState<MentionDraft | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [showHeaderPopover, setShowHeaderPopover] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const activeRoom = rooms.find((r) => r.id === roomId);
  const currentMember = activeRoom?.members?.find((m) => m.userId === user.userId || m.name === user.username);
  const canManageMembers = currentMember?.role === "owner" || currentMember?.role === "admin";

  const mentionCandidates =
    mentionDraft
      ? (activeRoom?.members ?? [])
          .filter((member) => member.userId !== user.userId)
          .filter((member) =>
            mentionDraft.query
              ? member.name.toLowerCase().startsWith(mentionDraft.query.toLowerCase())
              : true,
          )
      : [];

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionDraft?.query, roomId]);

  // Scroll to bottom when room or messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomId, messages]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        {t("chatroom.notFound")}
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    handleSendMessage(activeRoom.id, inputText, replyTarget);
    handleTyping(activeRoom.id, false);
    setInputText("");
    setReplyTarget(null);
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await handleUploadAttachment(activeRoom.id, file);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to upload attachment");
    }
  };

  const handleModifyNick = () => {
    const currentNick = activeRoomNicknames[activeRoom.id] || "我";
    const nick = prompt(t("chatroom.modifyNicknamePrompt"), currentNick);
    if (nick !== null) {
      handleModifyNickname(activeRoom.id, nick || "我");
    }
  };

  const handleLeaveOrBlockAction = async () => {
    const action = activeRoom.type === "group" ? t("chatroom.leave") : activeRoom.isArchived ? t("chatroom.unblock") : t("chatroom.block");
    if (confirm(t("chatroom.confirmLeaveOrBlock", { action, name: activeRoom.name }))) {
      const { isDeleted, newActiveId } = await handleLeaveOrBlock(activeRoom.id);
      if (isDeleted) {
        if (newActiveId) {
          router.push(`/chat/${newActiveId}`);
        } else {
          router.push("/");
        }
      }
    }
  };

  const handleMentionSelect = (memberName: string) => {
    if (!mentionDraft) return;

    const nextText =
      `${inputText.slice(0, mentionDraft.start)}@${memberName} ${inputText.slice(mentionDraft.end)}`;
    const nextCursorPosition = mentionDraft.start + memberName.length + 2;

    setInputText(nextText);
    setMentionDraft(null);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleMentionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionDraft || mentionCandidates.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedMentionIndex((current) => (current + 1) % mentionCandidates.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedMentionIndex((current) =>
        current === 0 ? mentionCandidates.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      handleMentionSelect(mentionCandidates[selectedMentionIndex]?.name ?? mentionCandidates[0].name);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMentionDraft(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Chat Panel Header */}
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <div
          className={`flex items-center gap-3 relative avatar-click-target ${
            activeRoom.type === "msg" ? "cursor-pointer hover:opacity-85 transition-opacity" : ""
          }`}
          onClick={() => {
            if (activeRoom.type === "msg") {
              setShowHeaderPopover(!showHeaderPopover);
            }
          }}
        >
          <Avatar
            name={activeRoom.name}
            src={getAvatarForUser(activeRoom.name, user.avatar, user.username)}
            size="sm"
            isOnline={activeRoom.isOnline}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground truncate max-w-[200px]">
                {activeRoom.name}
              </h1>
              {activeRoom.isArchived && <Badge variant="danger">{t("chatroom.readOnly")}</Badge>}
            </div>
            {activeRoom.type === "group" && (
              <span className="text-[10px] text-text-muted font-mono leading-none">
                {t("chatroom.groupChatInfo", { count: activeRoom.members?.length || 0 })}
              </span>
            )}
          </div>

          {showHeaderPopover && activeRoom.type === "msg" && (
            <ProfilePopover
              username={activeRoom.name}
              onClose={(e) => {
                e.stopPropagation();
                setShowHeaderPopover(false);
              }}
              position="bottom"
            />
          )}
        </div>

        {/* Header Action Elements */}
        <div className="flex items-center gap-3">
          {/* Panel Toggle Button */}
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`p-1.5 border rounded-sm transition-colors cursor-pointer ${
              showRightPanel
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border-secondary hover:border-border-primary text-text-muted hover:text-foreground"
            }`}
            title={showRightPanel ? t("chatroom.hideInfoPanel") : t("chatroom.showInfoPanel")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 4v16" />
            </svg>
          </button>

          {/* Group Settings Button */}
          {activeRoom.type === "group" && onOpenGroupSettings && (
            <Button
              variant="secondary"
              onClick={onOpenGroupSettings}
              className="py-1 px-3 text-xs flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              {t("chatroom.groupSettings")}
            </Button>
          )}

          {/* Chat Options Dropdown */}
          <Dropdown
            trigger={
              <button
                className="p-1.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer"
                title={t("chatroom.chatOptions")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            }
            items={[
              { label: t("chatroom.modifyNickname"), onClick: handleModifyNick },
              {
                label: t("chatroom.categorize"),
                subMenuItems: [
                  { label: t("chatroom.noCategory"), onClick: () => handleCategorizeRoom(activeRoom.id, null) },
                  ...folders.map((f) => ({
                    label: f.name,
                    onClick: () => handleCategorizeRoom(activeRoom.id, f.id),
                  })),
                ],
              },
              {
                label: activeRoom.type === "group" ? t("chatroom.leaveGroup") : activeRoom.isArchived ? t("chatroom.unblock") : t("chatroom.blockContact"),
                onClick: handleLeaveOrBlockAction,
                variant: activeRoom.isArchived ? "default" : "danger",
              },
            ]}
          />
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages
          .filter((m) => m.roomId === activeRoom.id)
          .map((msg) => {
            const senderMember = activeRoom.members?.find((m) => m.userId === msg.senderId);
            const displayName = senderMember?.nickname || msg.senderName;

            return (
              <div
                key={msg.id}
                className={`group/msg flex flex-col ${msg.isOutgoing ? "items-end" : "items-start"}`}
              >
                <ChatBubble
                  content={msg.content}
                  senderName={displayName}
                  timestamp={msg.timestamp}
                  isOutgoing={msg.isOutgoing}
                  isHighEmphasis={msg.isOutgoing}
                  isRecalled={msg.isRecalled}
                  replyTo={msg.replyTo || undefined}
                  attachments={msg.attachments}
                  senderAvatar={msg.isOutgoing ? user.avatar : getAvatarForUser(msg.senderName, user.avatar, user.username)}
                  isRead={msg.isRead}
                  readByAvatars={getReadAvatarsForMessage(activeRoom, msg)}
                  roomType={activeRoom.type}
                  onReply={() => setReplyTarget(msg)}
                  onRecall={() => handleRecallMessage(msg.id)}
                  canRecall={Boolean(msg.isOutgoing) || canManageMembers}
                />

                {!msg.isRecalled && (
                  <div className="opacity-0 group-hover/msg:opacity-100 flex gap-2.5 mt-1 select-none text-[10px] text-text-muted transition-opacity">
                    <button
                      onClick={() => setReplyTarget(msg)}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      {t("chatroom.reply")}
                    </button>
                    {(Boolean(msg.isOutgoing) || canManageMembers) && (
                      <button
                        onClick={() => handleRecallMessage(msg.id)}
                        className="hover:text-danger transition-colors cursor-pointer"
                      >
                        {t("chatroom.recall")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        <div ref={messageEndRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyTarget && (
        <div className="bg-surface-muted border-t border-border-primary px-6 py-2 flex items-center justify-between text-xs select-none">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <span className="font-bold text-foreground block">{t("chatroom.replyTo", { name: activeRoom.members?.find((m) => m.userId === replyTarget.senderId)?.nickname || replyTarget.senderName })}</span>
            <p className="text-text-muted truncate mt-0.5">{replyTarget.content}</p>
          </div>
          <button
            onClick={() => setReplyTarget(null)}
            className="text-text-muted hover:text-foreground cursor-pointer p-0.5 border border-transparent hover:border-border-primary rounded-sm ml-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {(() => {
        const names = typingUsers[activeRoom.id] ?? [];
        if (names.length === 0) return null;
        const label = names.length === 1
          ? `${names[0]} is typing...`
          : `${names.slice(0, 2).join(', ')} are typing...`;
        return (
          <div className="px-6 py-1 text-xs text-text-muted italic select-none">
            {label}
          </div>
        );
      })()}

      {/* Input Box Area */}
      <div className="border-t border-border-primary bg-surface-card px-6 py-4 shrink-0">
        {activeRoom.isArchived ? (
          <div className="w-full text-center py-2.5 bg-surface-muted text-xs text-text-muted uppercase tracking-wider select-none border border-dashed border-border-secondary rounded-sm">
            {t("chatroom.readOnlyOrBlocked")}
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-4 items-end">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              type="button"
              onClick={handleAttach}
              title={t("chatroom.uploadAttachment")}
              className="p-2.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer shrink-0 mb-0.5"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <div className="relative flex-1">
              {mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-sm border border-border-primary bg-surface-card shadow-lg">
                  {mentionCandidates.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleMentionSelect(member.name)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-border-secondary/40 px-3 py-2 text-left text-xs text-foreground transition-colors last:border-b-0 ${
                        mentionCandidates[selectedMentionIndex]?.userId === member.userId
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-surface-muted"
                      }`}
                    >
                      <span className="truncate font-semibold">{member.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted">
                        @{member.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                placeholder={t("chatroom.inputPlaceholder")}
                value={inputText}
                onChange={(e) => {
                  const nextText = e.target.value;
                  const nextCursorPosition = e.target.selectionStart ?? nextText.length;

                  setInputText(nextText);
                  setMentionDraft(getMentionDraft(nextText, nextCursorPosition));
                  handleTyping(activeRoom.id, nextText.length > 0);
                }}
                onClick={(e) => {
                  const nextCursorPosition = e.currentTarget.selectionStart ?? inputText.length;
                  setMentionDraft(getMentionDraft(inputText, nextCursorPosition));
                }}
                onKeyUp={(e) => {
                  const nextCursorPosition = e.currentTarget.selectionStart ?? inputText.length;
                  setMentionDraft(getMentionDraft(inputText, nextCursorPosition));
                }}
                onBlur={() => {
                  handleTyping(activeRoom.id, false);
                  setMentionDraft(null);
                }}
                onKeyDown={handleMentionKeyDown}
                className="w-full bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3.5 py-2.5 text-sm text-foreground transition-colors"
              />
            </div>

            <Button type="submit" variant="primary" className="py-2.5 px-5 shrink-0 select-none">
              {t("chatroom.send")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
