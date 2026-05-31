"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat, getAvatarForUser, Message, ChatRoom } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/ui/ChatBubble";

interface ChatroomProps {
  roomId: string;
  onOpenGroupSettings?: () => void;
}

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
  } = useChat();

  const [inputText, setInputText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRoom = rooms.find((r) => r.id === roomId);

  // Scroll to bottom when room or messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomId, messages]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        找不到此聊天室
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
    const nick = prompt("修改您的聊天室暱稱：", currentNick);
    if (nick !== null) {
      handleModifyNickname(activeRoom.id, nick || "我");
    }
  };

  const handleLeaveOrBlockAction = async () => {
    const action = activeRoom.type === "group" ? "退出" : activeRoom.isArchived ? "解除封鎖" : "封鎖";
    if (confirm(`確定要${action}「${activeRoom.name}」嗎？`)) {
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

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Chat Panel Header */}
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <div className="flex items-center gap-3">
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
              {activeRoom.isArchived && <Badge variant="danger">唯讀</Badge>}
            </div>
            {activeRoom.type === "group" && (
              <span className="text-[10px] text-text-muted font-mono leading-none">
                群組聊天室 • {activeRoom.members?.length || 0} 位成員
              </span>
            )}
          </div>
        </div>

        {/* Header Action Elements */}
        <div className="flex items-center gap-3">
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
              群組設定
            </Button>
          )}

          {/* Chat Options Dropdown */}
          <Dropdown
            trigger={
              <button
                className="p-1.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer"
                title="聊天室選項"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            }
            items={[
              { label: "修改暱稱", onClick: handleModifyNick },
              {
                label: "分類…",
                subMenuItems: [
                  { label: "無分類", onClick: () => handleCategorizeRoom(activeRoom.id, null) },
                  ...folders.map((f) => ({
                    label: f.name,
                    onClick: () => handleCategorizeRoom(activeRoom.id, f.id),
                  })),
                ],
              },
              {
                label: activeRoom.type === "group" ? "退出聊天室" : activeRoom.isArchived ? "解除封鎖" : "封鎖聯絡人",
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
          .map((msg) => (
            <div
              key={msg.id}
              className={`group/msg flex flex-col ${msg.isOutgoing ? "items-end" : "items-start"}`}
            >
              <ChatBubble
                content={msg.content}
                senderName={msg.senderName}
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
              />

              {!msg.isRecalled && (
                <div className="opacity-0 group-hover/msg:opacity-100 flex gap-2.5 mt-1 select-none text-[10px] text-text-muted transition-opacity">
                  <button
                    onClick={() => setReplyTarget(msg)}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    回覆
                  </button>
                  {msg.isOutgoing && (
                    <button
                      onClick={() => handleRecallMessage(msg.id)}
                      className="hover:text-red-600 transition-colors cursor-pointer"
                    >
                      收回
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        <div ref={messageEndRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyTarget && (
        <div className="bg-surface-muted border-t border-border-primary px-6 py-2 flex items-center justify-between text-xs select-none">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <span className="font-bold text-foreground block">回覆給 {replyTarget.senderName}</span>
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

      {/* Input Box Area */}
      <div className="border-t border-border-primary bg-surface-card px-6 py-4 shrink-0">
        {activeRoom.isArchived ? (
          <div className="w-full text-center py-2.5 bg-surface-muted text-xs text-text-muted uppercase tracking-wider select-none border border-dashed border-border-secondary rounded-sm">
            此聊天室已被封鎖或唯讀，無法發送訊息。
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
              title="上傳附件檔案"
              className="p-2.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer shrink-0 mb-0.5"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <input
              type="text"
              placeholder="輸入訊息..."
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTyping(activeRoom.id, e.target.value.length > 0);
              }}
              onBlur={() => handleTyping(activeRoom.id, false)}
              className="flex-1 bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3.5 py-2.5 text-sm text-foreground transition-colors"
            />

            <Button type="submit" variant="primary" className="py-2.5 px-5 shrink-0 select-none">
              發送
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
