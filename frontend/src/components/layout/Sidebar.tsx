"use client";

import React, { useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useChat, getAvatarForUser, ChatRoom } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

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
    handleLogout,
  } = useChat();

  const activeRoomId = params?.chatId as string | undefined;
  const isSettingsPage = pathname === "/settings";

  // Modal states
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  // Forms
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"msg" | "group">("msg");
  const [newRoomFolder, setNewRoomFolder] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newId = handleCreateRoom(newRoomName, newRoomType, newRoomFolder);
    setNewRoomName("");
    setNewRoomFolder("");
    setIsCreateRoomOpen(false);
    
    // Redirect to the newly created room
    router.push(`/chat/${newId}`);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    handleCreateFolder(newFolderName);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const selectRoom = (roomId: string) => {
    router.push(`/chat/${roomId}`);
  };

  const handleSettingsClick = () => {
    if (isSettingsPage) {
      // Go back to the first room or default page
      if (rooms.length > 0) {
        router.push(`/chat/${rooms[0].id}`);
      } else {
        router.push("/");
      }
    } else {
      router.push("/settings");
    }
  };

  // Helper to change room and close settings
  const rootRooms = rooms.filter((r) => !r.folderId);
  const getFolderRooms = (folderId: string) => rooms.filter((r) => r.folderId === folderId);
  const activeUserDisplayName = (activeRoomId && activeRoomNicknames[activeRoomId]) || user.username;

  return (
    <div className="w-[280px] shrink-0 border-r border-border-primary bg-surface-card flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="14" rx="2" strokeLinejoin="round" />
            <path d="M7 21h10M12 17v4" />
          </svg>
          <span className="font-mono text-sm font-bold uppercase tracking-wider">DB-9CHAT</span>
        </div>
        <div className="flex gap-1">
          {/* Create Folder Button */}
          <button
            onClick={() => setIsCreateFolderOpen(true)}
            title="新增資料夾"
            className="p-1 text-text-muted hover:text-foreground border border-transparent hover:border-border-primary rounded-sm transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          {/* Create Chat Room Button */}
          <button
            onClick={() => setIsCreateRoomOpen(true)}
            title="新增聊天室"
            className="p-1 text-text-muted hover:text-foreground border border-transparent hover:border-border-primary rounded-sm transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Rooms & Folders Lists */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-secondary/40 select-none">
        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="py-2 flex flex-col gap-0.5">
            <span className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">
              分類資料夾
            </span>
            {folders.map((folder) => {
              const folderRooms = getFolderRooms(folder.id);
              return (
                <div key={folder.id} className="flex flex-col">
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(folder.id)}
                    className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`h-3.5 w-3.5 text-text-muted transition-transform ${
                          folder.collapsed ? "" : "rotate-90"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{folder.name}</span>
                    </div>
                    <Badge variant="default" className="scale-90">{folderRooms.length}</Badge>
                  </div>

                  {/* Folder Chat Items (collapsible) */}
                  {!folder.collapsed && (
                    <div className="pl-4 flex flex-col border-l border-border-secondary/30 ml-6 my-0.5 gap-0.5">
                      {folderRooms.length === 0 ? (
                        <span className="text-[10px] text-text-muted py-1 italic pl-2">
                          資料夾是空的
                        </span>
                      ) : (
                        folderRooms.map((room) => (
                          <RoomItem
                            key={room.id}
                            room={room}
                            isActive={room.id === activeRoomId && !isSettingsPage}
                            onClick={() => selectRoom(room.id)}
                            avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Root Chats Section */}
        <div className="py-2 flex flex-col gap-0.5">
          <span className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">
            未分類
          </span>
          {rootRooms.map((room) => (
            <RoomItem
              key={room.id}
              room={room}
              isActive={room.id === activeRoomId && !isSettingsPage}
              onClick={() => selectRoom(room.id)}
              avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
            />
          ))}
        </div>
      </div>

      {/* Sidebar Footer User Details */}
      <div className="border-t border-border-primary p-4 bg-surface-muted select-none shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.username} src={user.avatar} size="sm" isOnline={true} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate leading-tight">
              {activeUserDisplayName}
            </p>
            <p className="text-[10px] text-text-muted truncate font-mono mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border-secondary/40 pt-3">
          <Button
            variant="ghost"
            onClick={handleSettingsClick}
            className="text-xs flex items-center gap-1.5 hover:underline"
          >
            {isSettingsPage ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {isSettingsPage ? "返回" : "設定"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1.5"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            登出
          </Button>
        </div>
      </div>

      {/* ========================================================
          MODALS
         ======================================================== */}
      {/* Create Chat Room Modal */}
      <Modal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} title="新增聊天室">
        <form onSubmit={handleCreateRoomSubmit} className="flex flex-col gap-5">
          <Input
            label="聊天室名稱"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            required
            placeholder="請輸入名稱"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
              聊天室類型
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="roomType"
                  checked={newRoomType === "msg"}
                  onChange={() => setNewRoomType("msg")}
                  className="accent-primary h-4.5 w-4.5"
                />
                <span>個人私訊 (DM)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="roomType"
                  checked={newRoomType === "group"}
                  onChange={() => setNewRoomType("group")}
                  className="accent-primary h-4.5 w-4.5"
                />
                <span>群組聊天室 (Group)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
              收納至資料夾 (選填)
            </label>
            <select
              value={newRoomFolder}
              onChange={(e) => setNewRoomFolder(e.target.value)}
              className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors cursor-pointer"
            >
              <option value="">無分類</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateRoomOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              確認建立
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Folder Modal */}
      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title="新增分類資料夾">
        <form onSubmit={handleCreateFolderSubmit} className="flex flex-col gap-5">
          <Input
            label="資料夾名稱"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            required
            placeholder="請輸入資料夾分類名稱"
          />

          <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              確認建立
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

interface RoomItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  avatarSrc?: string;
}

function RoomItem({ room, isActive, onClick, avatarSrc }: RoomItemProps) {
  return (
    <div
      onClick={onClick}
      className={`relative px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-muted/60 transition-colors select-none group/item ${
        isActive ? "bg-surface-muted font-semibold" : ""
      }`}
    >
      {/* Active Room Left Indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={room.name} src={avatarSrc} size="sm" isOnline={room.isOnline} />
        <span className="text-xs text-foreground truncate max-w-[140px]">{room.name}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {room.type === "group" ? (
          <Badge variant="secondary" className="scale-75 font-mono">G</Badge>
        ) : (
          <Badge variant="default" className="scale-75 font-mono">DM</Badge>
        )}
      </div>
    </div>
  );
}
