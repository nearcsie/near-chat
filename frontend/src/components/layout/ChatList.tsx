"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChatRoom, getAvatarForUser, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
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
    toggleFolder,
    handleDeleteFolder,
    handleCategorizeRoom,
  } = useChat();

  const activeRoomId = params?.chatId as string | undefined;
  const isChatPage = pathname === "/" || pathname.startsWith("/chat");
  const { t } = useTranslation();

  const [draggedRoomId, setDraggedRoomId] = React.useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null);
  const [dragOverUncategorized, setDragOverUncategorized] = React.useState(false);
  const [isRootDropActive, setIsRootDropActive] = React.useState(false);
  const [isUncategorizedCollapsed, setIsUncategorizedCollapsed] = React.useState(false);

  const resetDragState = () => {
    setDraggedRoomId(null);
    setDragOverFolderId(null);
    setDragOverUncategorized(false);
    setIsRootDropActive(false);
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
      (room) =>
        room.folderId === folder.id &&
        room.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return folderMatches || hasMatchingRooms;
  });

  const getFolderRooms = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    const folderMatches = folder?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    if (folderMatches) {
      return rooms.filter((room) => room.folderId === folderId);
    }

    return rooms.filter(
      (room) =>
        room.folderId === folderId &&
        room.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  const rootRooms = rooms.filter(
    (room) =>
      !room.folderId &&
      room.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteFolderClick = async (event: React.MouseEvent, folderId: string) => {
    event.stopPropagation();
    if (!window.confirm("Delete this folder? Chats inside it will move back to Uncategorized.")) {
      return;
    }

    try {
      await handleDeleteFolder(folderId);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "Failed to delete folder");
    }
  };

  return (
    <>
      <SectionLabel label={t("sidebar.chats")} />

      {rootRooms.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsUncategorizedCollapsed((current) => !current)}
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
              resetDragState();
            }}
            className={`w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors ${
              dragOverUncategorized ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={isUncategorizedCollapsed ? "" : "rotate-90"}>{">"}</span>
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
                  folders={folders}
                  isActive={room.id === activeRoomId && isChatPage}
                  onClick={() => router.push(`/chat/${room.id}`)}
                  onCategorizeRoom={handleCategorizeRoom}
                  onDragStart={(event) => handleRoomDragStart(event, room.id)}
                  onDragEnd={resetDragState}
                  avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                  noMessagesText={t("sidebar.noMessages")}
                  categorizeLabel={t("chatroom.categorize")}
                  rootChatsLabel={t("sidebar.rootChats")}
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
                <div
                  onDragOver={(event) => {
                    if (!draggedRoomId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(event) => handleDropToFolder(event, folder.id)}
                  className={`group w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors ${
                    dragOverFolderId === folder.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className={folder.collapsed ? "" : "rotate-90"}>{">"}</span>
                    <span className="truncate">{folder.name}</span>
                  </button>

                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`${t("friends.remove")} ${folder.name}`}
                      title={t("friends.remove")}
                      onClick={(event) => void handleDeleteFolderClick(event, folder.id)}
                      className="rounded-sm border border-transparent px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-all hover:border-border-primary hover:text-red-600 group-hover:opacity-100"
                    >
                      Del
                    </button>
                    <Badge variant="default" className="scale-90">
                      {folderRooms.length}
                    </Badge>
                  </span>
                </div>

                {!folder.collapsed && (
                  <div className="pl-4 border-l border-border-secondary/40 ml-5">
                    {folderRooms.map((room) => (
                      <RoomItem
                        key={room.id}
                        room={room}
                        folders={folders}
                        isActive={room.id === activeRoomId && isChatPage}
                        onClick={() => router.push(`/chat/${room.id}`)}
                        onCategorizeRoom={handleCategorizeRoom}
                        onDragStart={(event) => handleRoomDragStart(event, room.id)}
                        onDragEnd={resetDragState}
                        avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                        noMessagesText={t("sidebar.noMessages")}
                        categorizeLabel={t("chatroom.categorize")}
                        rootChatsLabel={t("sidebar.rootChats")}
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
  folders,
  isActive,
  onClick,
  onCategorizeRoom,
  onDragStart,
  onDragEnd,
  avatarSrc,
  noMessagesText,
  categorizeLabel,
  rootChatsLabel,
}: {
  room: ChatRoom;
  folders: Array<{ id: string; name: string }>;
  isActive: boolean;
  onClick: () => void;
  onCategorizeRoom: (roomId: string, folderId: string | null) => Promise<void>;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  avatarSrc?: string;
  noMessagesText: string;
  categorizeLabel: string;
  rootChatsLabel: string;
}) {
  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 px-4 py-2.5 transition-colors ${
        isActive ? "bg-surface-muted" : "hover:bg-surface-muted/70"
      }`}
    >
      {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
      <button
        type="button"
        onClick={onClick}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left select-none cursor-grab active:cursor-grabbing"
      >
        <Avatar name={room.name} src={avatarSrc} size="sm" isOnline={room.isOnline} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{room.name}</span>
            <span className="text-[9px] text-text-muted font-mono shrink-0">{room.lastMessageAt}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] text-text-muted truncate flex-1">
              {room.lastMessagePreview || noMessagesText}
            </span>
            {room.unreadCount ? <Badge variant="danger">{room.unreadCount}</Badge> : null}
          </span>
        </span>
      </button>
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            aria-label={categorizeLabel}
            title={categorizeLabel}
            className="rounded-sm border border-transparent p-1 text-text-muted opacity-0 transition-all hover:border-border-primary hover:text-foreground group-hover:opacity-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        }
        items={[
          {
            label: categorizeLabel,
            subMenuItems: [
              { label: rootChatsLabel, onClick: () => void onCategorizeRoom(room.id, null) },
              ...folders.map((folder) => ({
                label: folder.name,
                onClick: () => void onCategorizeRoom(room.id, folder.id),
              })),
            ],
          },
        ]}
      />
      <Badge variant="default" className="scale-75 font-mono">
        {room.type === "group" ? "G" : "DM"}
      </Badge>
    </div>
  );
}
