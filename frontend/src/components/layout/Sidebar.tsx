"use client";

import React, { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useChat, Friend, getAvatarForUser } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import ChatList from "./ChatList";
import FriendInfoPanel from "@/components/chat/FriendInfoPanel";

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
    friendRequests,
    uiLanguage,
    selectedFriendForSidebar,
    setSelectedFriendForSidebar,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState("");
  const activeRoomId = params?.chatId as string | undefined;
  const isSettingsPage = pathname === "/settings";
  const isChatPage = pathname === "/" || pathname.startsWith("/chat");
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"msg" | "group">("msg");
  const [newRoomFolder, setNewRoomFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

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



  const pendingIncoming = friendRequests?.filter((request) => request.direction === "incoming").length || 0;
  const firstChatPath = rooms[0] ? `/chat/${rooms[0].id}` : "/";

  const menuItems = [
    {
      label: t("rail.chats"),
      active: pathname === "/" || pathname.startsWith("/chat"),
      onClick: () => router.push(firstChatPath),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l3.5-3H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v6a3 3 0 003 3h.5L5 19z" />
        </svg>
      ),
    },
    {
      label: t("rail.friends"),
      active: pathname === "/friends",
      onClick: () => {
        setSelectedFriendForSidebar(null);
        router.push("/friends");
      },
      badge: pendingIncoming,
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
        </svg>
      ),
    },
    {
      label: t("rail.emergency"),
      active: pathname === "/emergency",
      onClick: () => router.push("/emergency"),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 15H4L12 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01" />
        </svg>
      ),
    },
    {
      label: t("sidebar.settings"),
      active: isSettingsPage,
      onClick: () => router.push("/settings"),
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: t("sidebar.logout"),
      active: false,
      onClick: handleLogout,
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-[300px] shrink-0 border-r border-border-primary bg-surface-card flex flex-col h-full">
      {isChatPage ? (
        <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0 gap-2">
          {/* Search bar */}
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-muted">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={uiLanguage === "zh-TW" ? "搜尋聊天室..." : "Search chats..."}
              className="w-full bg-surface-muted border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm pl-7 pr-2 py-1.5 text-xs text-foreground transition-colors placeholder:text-text-muted/65"
            />
          </div>
          {/* Action buttons */}
          <div className="flex gap-1 shrink-0">
            <IconButton label={t("sidebar.newFolder")} onClick={() => setIsCreateFolderOpen(true)}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6l2 2h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </IconButton>
            <IconButton label={t("sidebar.newChat")} onClick={() => setIsCreateRoomOpen(true)}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </IconButton>
          </div>
        </div>
      ) : pathname === "/friends" && selectedFriendForSidebar ? (
        <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0 bg-surface-muted">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
            {t("profileCard.friendInfo")}
          </span>
        </div>
      ) : (
        <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0" />
      )}

      <div className="flex-1 overflow-y-auto select-none flex flex-col">
        {isChatPage ? (
          <ChatList searchQuery={searchQuery} />
        ) : pathname === "/friends" ? (
          selectedFriendForSidebar ? (
            <FriendInfoPanel
              friendName={selectedFriendForSidebar.name}
              showChatButton={true}
              hideHeader={true}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs text-center p-4">
              <svg className="h-10 w-10 text-text-muted/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
              </svg>
              <p>{t("profileCard.selectPrompt")}</p>
            </div>
          )
        ) : null}
      </div>

      <div className="border-t border-border-primary bg-surface-muted select-none shrink-0 flex flex-col">
        <div className="p-4 flex items-center gap-3">
          <Avatar name={user.username} src={user.avatar} size="sm" isOnline />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate leading-tight">{activeUserDisplayName}</p>
            <p className="text-[10px] text-text-muted truncate font-mono mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="flex items-stretch border-t border-border-secondary/40 h-12 bg-surface-muted">
          {menuItems.map((item, idx) => (
            <div key={idx} className="relative group flex flex-col items-stretch flex-1">
              <button
                type="button"
                onClick={item.onClick}
                aria-label={item.label}
                className={`w-full h-full flex items-center justify-center transition-all duration-200 relative cursor-pointer ${
                  item.active
                    ? "text-primary bg-surface-card"
                    : "text-text-muted hover:text-foreground hover:bg-surface-card/60"
                }`}
              >
                {item.icon}
                {!!item.badge && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
                {/* Bottom active indicator line */}
                {item.active && <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-primary" />}
              </button>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 bg-slate-950 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                {item.label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
              </div>
            </div>
          ))}
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

