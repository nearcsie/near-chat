"use client";

import React from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { ChatRoom, getAvatarForUser, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useTranslation } from "@/hooks/useTranslation";

interface ChatListProps {
  searchQuery: string;
}

export default function ChatList({ searchQuery }: ChatListProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const {
    rooms,
    folders,
    user,
    activeRoomNicknames,
    toggleFolder,
    handleCategorizeRoom,
  } = useChat();

  const activeRoomId = params?.chatId as string | undefined;
  const isChatPage = pathname === "/" || pathname.startsWith("/chat");
  const { t } = useTranslation();

  const [draggedRoomId, setDraggedRoomId] = React.useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null);
  const [isRootDropActive, setIsRootDropActive] = React.useState(false);
  const [isUncategorizedCollapsed, setIsUncategorizedCollapsed] = React.useState(false);
  const [dragOverUncategorized, setDragOverUncategorized] = React.useState(false);

  const resetDragState = () => {
    setDraggedRoomId(null);
    setDragOverFolderId(null);
    setIsRootDropActive(false);
    setDragOverUncategorized(false);
  };

  const getDroppedRoomId = (event: React.DragEvent) =>
    event.dataTransfer.getData("text/plain") || draggedRoomId;

  const handleRoomDragStart = (event: React.DragEvent, roomId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", roomId);
    setDraggedRoomId(roomId);
  };

  const handleDropToRoot = (event: React.DragEvent) => {
    event.preventDefault();
    const roomId = getDroppedRoomId(event);
    if (roomId) {
      handleCategorizeRoom(roomId, null);
    }
    resetDragState();
  };

  const handleDropToFolder = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    const roomId = getDroppedRoomId(event);
    if (roomId) {
      handleCategorizeRoom(roomId, folderId);
      const targetFolder = folders.find((folder) => folder.id === folderId);
      if (targetFolder?.collapsed) {
        toggleFolder(folderId);
      }
    }
    resetDragState();
  };

  const visibleFolders = folders.filter((folder) => {
    const folderMatches = folder.name.toLowerCase().includes(searchQuery.toLowerCase());
    const hasMatchingRooms = rooms.some(
      (room) => room.folderId === folder.id && room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return folderMatches || hasMatchingRooms;
  });

  const getFolderRooms = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    const folderMatches = folder?.name.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    if (folderMatches) {
      return rooms.filter((room) => room.folderId === folderId);
    }
    return rooms.filter(
      (room) =>
        room.folderId === folderId &&
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const rootRooms = rooms.filter(
    (room) =>
      !room.folderId &&
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <SectionLabel label={t("sidebar.chats")} />

      {rootRooms.length > 0 && (
        <div key="uncategorized-folder">
          <button
            onClick={() => setIsUncategorizedCollapsed(!isUncategorizedCollapsed)}
            onDragOver={(event) => {
              if (!draggedRoomId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverUncategorized(true);
            }}
            onDragLeave={() => setDragOverUncategorized(false)}
            onDrop={(event) => {
              event.preventDefault();
              const roomId = getDroppedRoomId(event);
              if (roomId) {
                handleCategorizeRoom(roomId, null);
                if (isUncategorizedCollapsed) {
                  setIsUncategorizedCollapsed(false);
                }
              }
              setDragOverUncategorized(false);
              resetDragState();
            }}
            className={`w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors ${
              dragOverUncategorized ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={isUncategorizedCollapsed ? "" : "rotate-90"}>›</span>
              {t("chatroom.noCategory")}
            </span>
            <Badge variant="default" className="scale-90">
              {rootRooms.length}
            </Badge>
          </button>
          {!isUncategorizedCollapsed && (
            <div
              onDragOver={(event) => {
                if (!draggedRoomId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setIsRootDropActive(true);
              }}
              onDragLeave={() => setIsRootDropActive(false)}
              onDrop={handleDropToRoot}
              className={`pl-4 border-l border-border-secondary/40 ml-5 transition-colors ${
                isRootDropActive ? "bg-primary/5 outline outline-1 outline-primary/40 outline-offset-[-1px]" : ""
              }`}
            >
              {rootRooms.map((room) => (
                <RoomItem
                  key={room.id}
                  room={room}
                  isActive={room.id === activeRoomId && isChatPage}
                  onClick={() => router.push(`/chat/${room.id}`)}
                  onDragStart={(event) => handleRoomDragStart(event, room.id)}
                  onDragEnd={resetDragState}
                  avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                  noMessagesText={t("sidebar.noMessages")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {visibleFolders.length > 0 && (
        <div className="flex flex-col gap-0.5 pb-2">
          {visibleFolders.map((folder) => {
            const folderRooms = getFolderRooms(folder.id);
            return (
              <div key={folder.id}>
                <button
                  onClick={() => toggleFolder(folder.id)}
                  onDragOver={(event) => {
                    if (!draggedRoomId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(event) => handleDropToFolder(event, folder.id)}
                  className={`w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors ${
                    dragOverFolderId === folder.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={folder.collapsed ? "" : "rotate-90"}>›</span>
                    {folder.name}
                  </span>
                  <Badge variant="default" className="scale-90">
                    {folderRooms.length}
                  </Badge>
                </button>
                {!folder.collapsed && (
                  <div className="pl-4 border-l border-border-secondary/40 ml-5">
                    {folderRooms.map((room) => (
                      <RoomItem
                        key={room.id}
                        room={room}
                        isActive={room.id === activeRoomId && isChatPage}
                        onClick={() => router.push(`/chat/${room.id}`)}
                        onDragStart={(event) => handleRoomDragStart(event, room.id)}
                        onDragEnd={resetDragState}
                        avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                        noMessagesText={t("sidebar.noMessages")}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <span className="px-4 pt-4 pb-1 text-[10px] font-bold text-text-muted uppercase tracking-widest block">
      {label}
    </span>
  );
}

function RoomItem({
  room,
  isActive,
  onClick,
  onDragStart,
  onDragEnd,
  avatarSrc,
  noMessagesText,
}: {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  avatarSrc?: string;
  noMessagesText: string;
}) {
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-surface-muted/70 transition-colors select-none cursor-grab active:cursor-grabbing ${
        isActive ? "bg-surface-muted" : ""
      }`}
    >
      {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
      <Avatar name={room.name} src={avatarSrc} size="sm" isOnline={room.isOnline} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{room.name}</span>
          <span className="text-[9px] text-text-muted font-mono shrink-0">{room.lastMessageAt}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-text-muted truncate flex-1">{room.lastMessagePreview || noMessagesText}</span>
          {room.unreadCount ? <Badge variant="danger">{room.unreadCount}</Badge> : null}
        </span>
      </span>
      <Badge variant="default" className="scale-75 font-mono">
        {room.type === "group" ? "G" : "DM"}
      </Badge>
    </button>
  );
}
