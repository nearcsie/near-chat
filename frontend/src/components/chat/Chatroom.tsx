"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat, getAvatarForUser, Message } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { useTranslation } from "@/hooks/useTranslation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import ProfilePopover from "./ProfilePopover";
import { Icon } from "@iconify/react";

interface ChatroomProps {
  roomId: string;
  onOpenGroupSettings?: () => void;
}

interface MentionDraft {
  start: number;
  end: number;
  query: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
    messages,
    user,
    activeRoomNicknames,
    handleSendMessage,
    handleTyping,
    handleUploadAttachment,
    handleRecallMessage,
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
  const [isModifyNickOpen, setIsModifyNickOpen] = useState(false);
  const [nickInputValue, setNickInputValue] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
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

  const mentionResetKey = `${roomId}|${mentionDraft ? `q:${mentionDraft.query}` : "none"}`;
  const [prevMentionResetKey, setPrevMentionResetKey] = useState(mentionResetKey);
  if (prevMentionResetKey !== mentionResetKey) {
    setPrevMentionResetKey(mentionResetKey);
    setSelectedMentionIndex(0);
  }

  // Scroll to bottom when room or messages change
  const lastScrolledRoomIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (lastScrolledRoomIdRef.current !== roomId) {
      messageEndRef.current?.scrollIntoView({ behavior: "auto" });
      if (messages.length > 0) {
        lastScrolledRoomIdRef.current = roomId;
      }
    } else {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [roomId, messages]);

  useEffect(() => {
    // Reset the staged attachment when switching rooms so a file selected in one
    // chat is never sent from a different chat by accident.
    const resetId = window.setTimeout(() => {
      setPendingAttachment(null);
      setIsUploadingAttachment(false);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [roomId]);

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

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingAttachment(file);
  };

  const handleConfirmAttachmentUpload = async () => {
    if (!pendingAttachment) return;

    setIsUploadingAttachment(true);
    try {
      await handleUploadAttachment(activeRoom.id, pendingAttachment);
      setPendingAttachment(null);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to upload attachment");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemovePendingAttachment = () => {
    if (isUploadingAttachment) return;
    setPendingAttachment(null);
  };

  const handleModifyNick = () => {
    if (!activeRoom) return;
    const currentNick = activeRoomNicknames[activeRoom.id] || user.username;
    setNickInputValue(currentNick);
    setIsModifyNickOpen(true);
  };

  const handleModifyNickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    const trimmed = nickInputValue.trim();
    try {
      await handleModifyNickname(activeRoom.id, trimmed || user.username);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to update nickname");
    }
    setIsModifyNickOpen(false);
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

        <div className="flex items-center gap-3">
          {activeRoom.type === "group" && onOpenGroupSettings && (
            <Button
              variant="secondary"
              onClick={onOpenGroupSettings}
              className="py-1 px-3 text-xs flex items-center gap-1.5"
            >
              <Icon icon="boxicons:slider-vertical" className="h-3.5 w-3.5" />
              {t("chatroom.groupSettings")}
            </Button>
          )}

          <Dropdown
            trigger={
              <button
                className="p-1.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer"
                title={t("chatroom.chatOptions")}
              >
                <Icon icon="bx:dots-horizontal-rounded" className="h-4 w-4" />
              </button>
            }
            items={[
              { label: t("chatroom.modifyNickname"), onClick: handleModifyNick },
              {
                label: activeRoom.type === "group" ? t("chatroom.leaveGroup") : activeRoom.isArchived ? t("chatroom.unblock") : t("chatroom.blockContact"),
                onClick: handleLeaveOrBlockAction,
                variant: activeRoom.isArchived ? "default" : "danger",
              },
            ]}
          />

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`p-1.5 border rounded-sm transition-colors cursor-pointer ${
              showRightPanel
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border-secondary hover:border-border-primary text-text-muted hover:text-foreground"
            }`}
            title={showRightPanel ? t("chatroom.hideInfoPanel") : t("chatroom.showInfoPanel")}
          >
            <Icon icon="boxicons:sidebar-right" className="h-4 w-4" />
          </button>
        </div>
      </div>

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
            <Icon icon="boxicons:x" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {(() => {
        const names = typingUsers[activeRoom.id] ?? [];
        if (names.length === 0) return null;
        const label = names.length === 1
          ? `${names[0]} is typing...`
          : `${names.slice(0, 2).join(", ")} are typing...`;
        return (
          <div className="px-6 py-1 text-xs text-text-muted italic select-none">
            {label}
          </div>
        );
      })()}

      <div className="border-t border-border-primary bg-surface-card px-6 py-4 shrink-0">
        {activeRoom.isArchived ? (
          <div className="w-full text-center py-2.5 bg-surface-muted text-xs text-text-muted uppercase tracking-wider select-none border border-dashed border-border-secondary rounded-sm">
            {t("chatroom.readOnlyOrBlocked")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
              <Icon icon="boxicons:paperclip" className="h-4 w-4" />
            </button>

            {pendingAttachment && (
              <div className="bg-surface-muted border border-border-primary px-6 py-2 flex items-center justify-between text-xs select-none rounded-sm">
                <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                  <span className="font-bold text-foreground block">{t("chatroom.attachmentPreview")}</span>
                  <p className="text-foreground truncate mt-0.5">{pendingAttachment.name}</p>
                  <p className="text-text-muted truncate mt-0.5 font-mono">
                    {pendingAttachment.type || "application/octet-stream"} · {formatFileSize(pendingAttachment.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button
                    type="button"
                    onClick={() => void handleConfirmAttachmentUpload()}
                    disabled={isUploadingAttachment}
                    className="py-1.5 px-3"
                  >
                    {isUploadingAttachment ? "Uploading..." : t("chatroom.send")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleRemovePendingAttachment}
                    disabled={isUploadingAttachment}
                    className="text-text-muted hover:text-foreground cursor-pointer p-0.5 border border-transparent hover:border-border-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("chatroom.cancel")}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-4 items-end">
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
          </div>
        )}
      </div>

      <Modal
        isOpen={isModifyNickOpen}
        onClose={() => setIsModifyNickOpen(false)}
        title={t("chatroom.modifyNickname")}
      >
        <form onSubmit={handleModifyNickSubmit} className="flex flex-col gap-5">
          <Input
            label={t("chatroom.nickname")}
            value={nickInputValue}
            onChange={(e) => setNickInputValue(e.target.value)}
            required
            placeholder={t("chatroom.nicknamePlaceholder")}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModifyNickOpen(false)}
            >
              {t("chatroom.cancel")}
            </Button>
            <Button type="submit">
              {t("chatroom.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
