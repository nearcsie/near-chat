"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChatRoom, getAvatarForUser, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveAssetUrl } from "@/lib/assets";

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
    friends,
    toggleFolder,
    handleDeleteFolder,
    handleRenameFolder,
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
  const [contextMenu, setContextMenu] = React.useState<{
    folderId: string;
    folderName: string;
    x: number;
    y: number;
  } | null>(null);

  // 刪除確認 Modal 狀態
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteTargetFolderId, setDeleteTargetFolderId] = React.useState<string | null>(null);

  // 更名 Modal 狀態
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameTargetFolderId, setRenameTargetFolderId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // 通用錯誤警告 Alert Modal 狀態
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertTitle, setAlertTitle] = React.useState("");
  const [alertMessage, setAlertMessage] = React.useState("");

  React.useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  const handleRenameFolderClick = (folderId: string, currentName: string) => {
    setRenameTargetFolderId(folderId);
    setRenameValue(currentName);
    setRenameOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTargetFolderId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setAlertTitle("錯誤");
      setAlertMessage("資料夾名稱不能為空");
      setAlertOpen(true);
      return;
    }
    if (trimmed.length > 50) {
      setAlertTitle("錯誤");
      setAlertMessage("資料夾名稱長度不能超過 50 個字元");
      setAlertOpen(true);
      return;
    }
    try {
      await handleRenameFolder(renameTargetFolderId, trimmed);
      setRenameOpen(false);
    } catch (error) {
      setAlertTitle("錯誤");
      setAlertMessage(error instanceof Error ? error.message : "修改資料夾名稱失敗");
      setAlertOpen(true);
    }
  };

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

  const handleDeleteFolderClick = (event: React.MouseEvent | React.BaseSyntheticEvent | MouseEvent | undefined, folderId: string) => {
    if (event) event.stopPropagation();
    setDeleteTargetFolderId(folderId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetFolderId) return;
    try {
      await handleDeleteFolder(deleteTargetFolderId);
      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error(error);
      setAlertTitle("錯誤");
      setAlertMessage(error instanceof Error ? error.message : "刪除資料夾失敗");
      setAlertOpen(true);
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
              {rootRooms.map((room) => {
                const roomMember = room.members?.find((m) => m.userId === user.userId || m.name === user.username);
                const isPending = roomMember?.role === "pending";
                return (
                  <RoomItem
                    key={room.id}
                    room={room}
                    isActive={room.id === activeRoomId && isChatPage}
                    onClick={() => router.push(`/chat/${room.id}`)}
                    onDragStart={(event) => handleRoomDragStart(event, room.id)}
                    onDragEnd={resetDragState}
                    avatarSrc={(() => {
                      if (room.avatarUrl) {
                        return resolveAssetUrl(room.avatarUrl);
                      }
                      if (room.type === "msg") {
                        const otherMember = room.members?.find((m) => m.userId !== user.userId);
                        if (otherMember?.avatarUrl) {
                          return resolveAssetUrl(otherMember.avatarUrl);
                        }
                        const friend = friends.find((f) => f.id === room.otherMemberId || f.name === room.name);
                        if (friend?.avatarUrl) {
                          return resolveAssetUrl(friend.avatarUrl);
                        }
                      }
                      return getAvatarForUser(room.name, user.avatar, user.username);
                    })()}
                    noMessagesText={t("sidebar.noMessages")}
                    isPending={isPending}
                  />
                );
              })}
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      folderId: folder.id,
                      folderName: folder.name,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  className={`group w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors select-none ${
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
                      aria-label="Folder actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        setContextMenu({
                          folderId: folder.id,
                          folderName: folder.name,
                          x: rect.right - 120,
                          y: rect.bottom + 4,
                        });
                      }}
                      className="rounded-sm border border-transparent px-1.5 py-0.5 text-xs text-text-muted opacity-0 transition-all hover:border-border-primary hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                    >
                      ...
                    </button>

                    <Badge variant="default" className="scale-90">
                      {folderRooms.length}
                    </Badge>
                  </span>
                </div>

                {!folder.collapsed && (
                  <div className="pl-4 border-l border-border-secondary/40 ml-5">
                    {folderRooms.map((room) => {
                      const roomMember = room.members?.find((m) => m.userId === user.userId || m.name === user.username);
                      const isPending = roomMember?.role === "pending";
                      return (
                        <RoomItem
                          key={room.id}
                          room={room}
                          isActive={room.id === activeRoomId && isChatPage}
                          onClick={() => router.push(`/chat/${room.id}`)}
                          onDragStart={(event) => handleRoomDragStart(event, room.id)}
                          onDragEnd={resetDragState}
                          avatarSrc={(() => {
                            if (room.avatarUrl) {
                              return resolveAssetUrl(room.avatarUrl);
                            }
                            if (room.type === "msg") {
                              const otherMember = room.members?.find((m) => m.userId !== user.userId);
                              if (otherMember?.avatarUrl) {
                                return resolveAssetUrl(otherMember.avatarUrl);
                              }
                              const friend = friends.find((f) => f.id === room.otherMemberId || f.name === room.name);
                              if (friend?.avatarUrl) {
                                return resolveAssetUrl(friend.avatarUrl);
                              }
                            }
                            return getAvatarForUser(room.name, user.avatar, user.username);
                          })()}
                          noMessagesText={t("sidebar.noMessages")}
                          isPending={isPending}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          className="bg-surface-card border border-border-primary rounded-sm shadow-md py-1 z-50 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              void handleRenameFolderClick(contextMenu.folderId, contextMenu.folderName);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-surface-muted text-foreground transition-colors font-normal text-xs block"
          >
            修改資料夾名稱
          </button>
          <button
            type="button"
            onClick={(event) => {
              setContextMenu(null);
              void handleDeleteFolderClick(event as unknown as React.MouseEvent, contextMenu.folderId);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-surface-muted text-red-600 transition-colors font-normal text-xs block"
          >
            刪除資料夾
          </button>
        </div>
      )}

      {deleteConfirmOpen && (
        <Modal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="確認刪除資料夾"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              確定要刪除此資料夾嗎？資料夾內的聊天室將會移回「未分類」。
            </p>
            <div className="flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 border-none"
                onClick={handleDeleteConfirm}
              >
                刪除
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {renameOpen && (
        <Modal
          isOpen={renameOpen}
          onClose={() => setRenameOpen(false)}
          title="修改資料夾名稱"
        >
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <Input
              label="資料夾名稱"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
              autoFocus
            />
            <div className="flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRenameOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                保存
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {alertOpen && (
        <Modal
          isOpen={alertOpen}
          onClose={() => setAlertOpen(false)}
          title={alertTitle}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{alertMessage}</p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => setAlertOpen(false)}
              >
                確定
              </Button>
            </div>
          </div>
        </Modal>
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
  isPending,
}: {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  avatarSrc?: string;
  noMessagesText: string;
  isPending?: boolean;
}) {
  const { t } = useTranslation();

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
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left select-none cursor-pointer"
      >
        <Avatar name={room.name} src={avatarSrc} size="sm" isOnline={room.isOnline} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-xs font-semibold text-foreground truncate">{room.name}</span>
              {isPending && (
                <span className="text-[9px] font-bold text-amber-500 px-1.5 py-0.5 border border-amber-500/20 bg-amber-500/5 rounded-sm shrink-0 uppercase tracking-wide">
                  {t("chatroom.pendingApproval")}
                </span>
              )}
            </span>
            <span className="text-[9px] text-text-muted font-mono shrink-0">{room.lastMessageAt}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] text-text-muted truncate flex-1">
              {isPending ? t("chatroom.pendingApproval") : (room.lastMessagePreview || noMessagesText)}
            </span>
            {room.unreadCount ? <Badge variant="danger">{room.unreadCount}</Badge> : null}
          </span>
        </span>
      </button>
      <Badge variant="default" className="scale-75 font-mono">
        {room.type === "group" ? "G" : "DM"}
      </Badge>
    </div>
  );
}
