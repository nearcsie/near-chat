"use client";

import React, { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChatRoom, getAvatarForUser, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";

export default function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const {
    rooms,
    folders,
    user,
    activeRoomNicknames,
    toggleFolder,
    handleCreateRoom,
    handleCreateFolder,
    handleCategorizeRoom,
    handleLogout,
  } = useChat();

  const activeRoomId = params?.chatId as string | undefined;
  const isSettingsPage = pathname === "/settings";
  const isChatPage = pathname === "/" || pathname.startsWith("/chat");
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"msg" | "group">("msg");
  const [newRoomFolder, setNewRoomFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isRootDropActive, setIsRootDropActive] = useState(false);

  const rootRooms = rooms.filter((room) => !room.folderId);
  const getFolderRooms = (folderId: string) => rooms.filter((room) => room.folderId === folderId);
  const activeUserDisplayName = (activeRoomId && activeRoomNicknames[activeRoomId]) || user.username;
  const { t } = useTranslation();

  const handleCreateRoomSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRoomName.trim()) return;

    const newId = handleCreateRoom(newRoomName, newRoomType, newRoomFolder);
    setNewRoomName("");
    setNewRoomFolder("");
    setIsCreateRoomOpen(false);
    router.push(`/chat/${newId}`);
  };

  const handleCreateFolderSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newFolderName.trim()) return;

    handleCreateFolder(newFolderName);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const handleSettingsClick = () => {
    if (isSettingsPage) {
      router.push(rooms[0] ? `/chat/${rooms[0].id}` : "/");
      return;
    }
    router.push("/settings");
  };

  const resetDragState = () => {
    setDraggedRoomId(null);
    setDragOverFolderId(null);
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

  return (
    <div className="w-[300px] shrink-0 border-r border-border-primary bg-surface-card flex flex-col h-full">
      <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 border border-primary text-primary grid place-items-center text-[10px] font-mono font-bold">
            9
          </span>
          <span className="font-mono text-sm font-bold uppercase tracking-wider">DB-9CHAT</span>
        </div>
        <div className="flex gap-1">
          <IconButton label={t("sidebar.newFolder")} onClick={() => setIsCreateFolderOpen(true)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6l2 2h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </IconButton>
          <IconButton label={t("sidebar.newChat")} onClick={() => setIsCreateRoomOpen(true)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto select-none">
        <SectionLabel label={t("sidebar.chats")} />
        <div
          onDragOver={(event) => {
            if (!draggedRoomId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setIsRootDropActive(true);
          }}
          onDragLeave={() => setIsRootDropActive(false)}
          onDrop={handleDropToRoot}
          className={`flex flex-col gap-0.5 pb-2 transition-colors ${
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

        {folders.length > 0 && (
          <>
            <SectionLabel label={t("sidebar.folders")} />
            <div className="flex flex-col gap-0.5 pb-2">
              {folders.map((folder) => {
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
          </>
        )}
      </div>

      <div className="border-t border-border-primary p-4 bg-surface-muted select-none shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.username} src={user.avatar} size="sm" isOnline />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate leading-tight">{activeUserDisplayName}</p>
            <p className="text-[10px] text-text-muted truncate font-mono mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border-secondary/40 pt-3">
          <Button variant="ghost" onClick={handleSettingsClick} className="text-xs">
            {isSettingsPage ? t("sidebar.backToChat") : t("sidebar.settings")}
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="text-xs text-red-600 hover:text-red-700">
            {t("sidebar.logout")}
          </Button>
        </div>
      </div>

      <Modal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} title={t("sidebar.createChat")}>
        <form onSubmit={handleCreateRoomSubmit} className="flex flex-col gap-5">
          <Input
            label={t("sidebar.chatName")}
            value={newRoomName}
            onChange={(event) => setNewRoomName(event.target.value)}
            required
            placeholder={t("sidebar.chatNamePlaceholder")}
          />
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="roomType"
                checked={newRoomType === "msg"}
                onChange={() => setNewRoomType("msg")}
                className="accent-primary"
              />
              {t("sidebar.directMessage")}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="roomType"
                checked={newRoomType === "group"}
                onChange={() => setNewRoomType("group")}
                className="accent-primary"
              />
              {t("sidebar.group")}
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t("sidebar.folder")}</span>
            <select
              value={newRoomFolder}
              onChange={(event) => setNewRoomFolder(event.target.value)}
              className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors"
            >
              <option value="">{t("sidebar.rootChats")}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <div className="border-t border-border-primary pt-5 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateRoomOpen(false)}>
              {t("sidebar.cancel")}
            </Button>
            <Button type="submit" variant="primary">
              {t("sidebar.create")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title={t("sidebar.createFolder")}>
        <form onSubmit={handleCreateFolderSubmit} className="flex flex-col gap-5">
          <Input
            label={t("sidebar.folderName")}
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            required
            placeholder={t("sidebar.folderNamePlaceholder")}
          />
          <div className="border-t border-border-primary pt-5 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              {t("sidebar.cancel")}
            </Button>
            <Button type="submit" variant="primary">
              {t("sidebar.create")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1 text-text-muted hover:text-foreground border border-transparent hover:border-border-primary rounded-sm transition-colors cursor-pointer"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        {children}
      </svg>
    </button>
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
      <Badge variant={room.type === "group" ? "secondary" : "default"} className="scale-75 font-mono">
        {room.type === "group" ? "G" : "DM"}
      </Badge>
    </button>
  );
}
