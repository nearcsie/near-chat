"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@shared/types";
import { useChat, getAvatarForUser, Member } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

interface GroupSettingsProps {
  roomId: string;
  onClose: () => void;
}

export default function GroupSettings({ roomId, onClose }: GroupSettingsProps) {
  const router = useRouter();
  const {
    rooms,
    user,
    loadGroupMembers,
    saveGroupSettings,
    approveGroupMember,
    updateGroupMember,
    kickGroupMember,
    transferGroupOwner,
    handleDeleteGroupRoom,
    searchUsersForInvite,
    handleOpenPrivateRoom,
    handleSendMessage,
  } = useChat();

  const activeRoom = rooms.find((room) => room.id === roomId);
  const [name, setName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [viewHistory, setViewHistory] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMember = useMemo(
    () => members.find((member) => member.userId === user.userId || member.name === user.username),
    [members, user.userId, user.username],
  );
  const canManageMembers = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canTransferOwner = currentMember?.role === "owner";

  useEffect(() => {
    if (!activeRoom) return;
    setName(activeRoom.name);
    setRequireApproval(Boolean(activeRoom.requireApproval));
    setViewHistory(activeRoom.viewHistory ?? true);
  }, [activeRoom?.id, activeRoom?.name, activeRoom?.requireApproval, activeRoom?.viewHistory]);

  useEffect(() => {
    if (activeRoom?.members) {
      setMembers(activeRoom.members);
    }
  }, [activeRoom?.members]);

  useEffect(() => {
    let cancelled = false;
    setFeedback("");

    if (activeRoom?.members?.length) {
      setMembers(activeRoom.members);
      return () => {
        cancelled = true;
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }

    void loadGroupMembers(roomId)
      .then((loaded) => {
        if (!cancelled) {
          setMembers(loaded);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "Failed to load members");
        }
      });

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [activeRoom?.members, roomId]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        找不到聊天室
      </div>
    );
  }

  const refreshMembers = async () => {
    const nextMembers = await loadGroupMembers(roomId);
    if (nextMembers) {
      setMembers(nextMembers);
    }
  };

  const runMemberAction = async (
    member: Member,
    action: () => Promise<Member[] | undefined>,
    successMessage: string,
    fallbackMessage: string,
  ) => {
    setMemberActionUserId(member.userId);
    setFeedback("");
    try {
      const nextMembers = await action();
      if (nextMembers) {
        setMembers(nextMembers);
      }
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setMemberActionUserId(null);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback("");
    try {
      await saveGroupSettings(roomId, { name, requireApproval, viewHistory });
      setFeedback("Group settings saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to save group settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (member: Member) =>
    runMemberAction(
      member,
      () => approveGroupMember(roomId, member.userId),
      `${member.name} 已通過審核`,
      "Failed to approve member",
    );

  const handleRoleChange = async (member: Member, role: "admin" | "member") =>
    runMemberAction(
      member,
      () => updateGroupMember(roomId, member.userId, { role }),
      `${member.name} 的角色已更新`,
      "Failed to update member role",
    );

  const handleNickname = async (member: Member) => {
    const nickname = window.prompt("輸入群組暱稱，留空則清除暱稱：", member.nickname ?? "");
    if (nickname === null) return;

    await runMemberAction(
      member,
      () => updateGroupMember(roomId, member.userId, { nickname: nickname.trim() }),
      `${member.name} 的暱稱已更新`,
      "Failed to update nickname",
    );
  };

  const handleToggleMute = async (member: Member) =>
    runMemberAction(
      member,
      () => updateGroupMember(roomId, member.userId, { isMuted: !member.isMuted }),
      `${member.name} 的禁言狀態已更新`,
      "Failed to update mute status",
    );

  const handleKick = async (member: Member) => {
    if (!window.confirm(`確定要移除 ${member.name} 嗎？`)) return;

    await runMemberAction(
      member,
      () => kickGroupMember(roomId, member.userId),
      `${member.name} 已被移除`,
      "Failed to remove member",
    );
  };

  const handleTransferOwner = async (member: Member) => {
    if (!window.confirm(`確定要將群主轉讓給 ${member.name} 嗎？`)) return;

    await runMemberAction(
      member,
      () => transferGroupOwner(roomId, member.userId),
      `群主已轉讓給 ${member.name}`,
      "Failed to transfer owner",
    );
  };

  const handleArchive = async () => {
    if (!window.confirm("確定要封存這個群組嗎？封存後聊天室會變成唯讀。")) return;

    const nextActiveId = await handleDeleteGroupRoom(roomId);
    if (nextActiveId) {
      router.push(`/chat/${nextActiveId}`);
      return;
    }
    router.push("/");
  };

  const handleCopyInviteCode = async () => {
    const code = activeRoom.inviteCode;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setFeedback("邀請碼已複製到剪貼簿！");
    } catch {
      window.prompt("請手動複製以下邀請碼：", code);
    }
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      searchUsersForInvite(value)
        .then((results) => {
          const memberIds = new Set(members.map((member) => member.userId));
          setSearchResults(results.filter((candidate) => !memberIds.has(candidate.userId)));
        })
        .catch((error) => {
          setFeedback(error instanceof Error ? error.message : "搜尋失敗");
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 400);
  };

  const handleSendInviteMessage = async (targetUser: PublicUser) => {
    const code = activeRoom.inviteCode;
    if (!code) {
      setFeedback("此群組尚未產生邀請碼，無法傳送邀請");
      return;
    }

    try {
      const privateRoomId = await handleOpenPrivateRoom(targetUser.userId);
      const message = `【群組邀請】\n我邀請你加入群組「${activeRoom.name}」！\n邀請碼：${code}`;
      handleSendMessage(privateRoomId, message, null);
      setFeedback(`已傳送邀請訊息給 ${targetUser.name}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "傳送邀請失敗");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <div>
          <h1 className="text-sm font-bold text-foreground tracking-wider">群組設定 - {activeRoom.name}</h1>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">Room API settings and members</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs py-1 px-3">
            關閉
          </Button>
          <Button type="button" variant="primary" onClick={() => void refreshMembers()} className="text-xs py-1 px-3">
            重新載入成員
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-surface-card">
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {feedback && (
            <div className="border border-border-secondary bg-surface-muted px-3 py-2 text-xs text-foreground">
              {feedback}
            </div>
          )}

          {canManageMembers && (
            <section className="flex flex-col gap-4">
              <SectionTitle title="基本設定" />
              <Input
                label="群組名稱"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Checkbox
                  label="加入前需要審核"
                  description="開啟後，新成員會以 pending 身分加入，需由 owner/admin 審核。"
                  checked={requireApproval}
                  onChange={(event) => setRequireApproval(event.target.checked)}
                />
                <Checkbox
                  label="允許新成員查看歷史訊息"
                  description="關閉時，新成員只能看到加入後的訊息。"
                  checked={viewHistory}
                  onChange={(event) => setViewHistory(event.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between border border-border-secondary bg-surface-muted px-3 py-2 gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">邀請碼</p>
                  <p className="text-[10px] text-text-muted mt-1">
                    將邀請碼分享給想加入的人，對方在加入群組時輸入此碼即可。
                  </p>
                  <code className="text-xs font-mono text-primary mt-1 block">{activeRoom.inviteCode ?? "尚未產生"}</code>
                </div>
                {activeRoom.inviteCode && (
                  <Button type="button" variant="secondary" className="text-xs py-1 px-3 shrink-0" onClick={() => void handleCopyInviteCode()}>
                    複製邀請碼
                  </Button>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? "儲存中..." : "儲存設定"}
                </Button>
              </div>
            </section>
          )}

          {canManageMembers && (
            <div className="flex flex-col gap-2 border border-border-secondary bg-surface-muted px-3 py-3">
              <p className="text-xs font-semibold text-foreground">搜尋並邀請成員</p>
              <p className="text-[10px] text-text-muted">輸入名稱搜尋用戶，將邀請碼複製後分享給對方。</p>
              <div className="flex gap-2">
                <Input
                  label=""
                  value={searchQuery}
                  onChange={(event) => handleSearchQueryChange(event.target.value)}
                  placeholder="輸入名稱搜尋用戶…"
                />
              </div>
              {isSearching && <p className="text-[10px] text-text-muted">搜尋中…</p>}
              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-[10px] text-text-muted">找不到符合的用戶（已在群組中的成員不會顯示）</p>
              )}
              {searchResults.length > 0 && (
                <div className="flex flex-col divide-y divide-border-secondary border border-border-secondary rounded-sm overflow-hidden">
                  {searchResults.map((candidate) => (
                    <div key={candidate.userId} className="flex items-center justify-between px-3 py-2 text-xs bg-surface-card">
                      <span className="font-medium text-foreground">{candidate.name}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-[10px] py-1 px-2"
                        onClick={() => void handleSendInviteMessage(candidate)}
                      >
                        傳送邀請訊息
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle title={`成員管理 (${members.length})`} />
            <div className="flex flex-col border border-border-primary divide-y divide-border-secondary rounded-sm overflow-hidden bg-surface-card">
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  currentUser={user}
                  canManageMembers={canManageMembers}
                  canTransferOwner={canTransferOwner}
                  onApprove={handleApprove}
                  onRoleChange={handleRoleChange}
                  onNickname={handleNickname}
                  onToggleMute={handleToggleMute}
                  onKick={handleKick}
                  onTransferOwner={handleTransferOwner}
                  isBusy={memberActionUserId === member.userId}
                />
              ))}
              {members.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">目前沒有可顯示的成員</div>
              )}
            </div>
          </section>

          {canTransferOwner && (
            <section className="flex flex-col gap-3 border border-red-500/20 p-4 bg-red-500/5 rounded-sm">
              <SectionTitle title="危險區" danger />
              <div className="flex flex-col items-start gap-2">
                <Button type="button" variant="secondary" onClick={handleArchive} className="text-red-600 border-red-600 hover:bg-red-500/10">
                  封存群組
                </Button>
                <span className="text-[10px] text-red-600/70 leading-normal">
                  封存後群組會保留歷史資料，但不可再發送新訊息。
                </span>
              </div>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ title, danger = false }: { title: string; danger?: boolean }) {
  return (
    <h3 className={`text-xs font-bold uppercase tracking-wider border-b pb-1 ${danger ? "text-red-600 border-red-500/30" : "text-primary border-border-secondary"}`}>
      {title}
    </h3>
  );
}

function MemberRow({
  member,
  currentUser,
  canManageMembers,
  canTransferOwner,
  onApprove,
  onRoleChange,
  onNickname,
  onToggleMute,
  onKick,
  onTransferOwner,
  isBusy,
}: {
  member: Member;
  currentUser: { userId?: string; username: string; avatar: string };
  canManageMembers: boolean;
  canTransferOwner: boolean;
  onApprove: (member: Member) => Promise<void>;
  onRoleChange: (member: Member, role: "admin" | "member") => Promise<void>;
  onNickname: (member: Member) => Promise<void>;
  onToggleMute: (member: Member) => Promise<void>;
  onKick: (member: Member) => Promise<void>;
  onTransferOwner: (member: Member) => Promise<void>;
  isBusy: boolean;
}) {
  const isSelf = member.userId === currentUser.userId || member.name === currentUser.username;
  const isOwner = member.role === "owner";
  const isPending = member.role === "pending";
  const canEditMember = canManageMembers && !isOwner;

  return (
    <div className="flex flex-col gap-3 p-3 text-xs md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          name={member.name}
          src={getAvatarForUser(member.name, currentUser.avatar, currentUser.username)}
          size="sm"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">
              {member.nickname ? `${member.nickname} (${member.name})` : member.name}
            </p>
            {isSelf && <span className="text-[9px] text-primary font-mono">YOU</span>}
            {member.isMuted && <span className="text-[9px] text-red-600 font-mono">MUTED</span>}
          </div>
          <p className="text-[10px] text-text-muted font-mono">{member.userId}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {isPending ? (
          <span className="text-[10px] text-amber-600 font-mono">PENDING</span>
        ) : (
          <select
            value={member.role}
            disabled={isBusy || !canTransferOwner || isOwner}
            onChange={(event) => void onRoleChange(member, event.target.value as "admin" | "member")}
            className="bg-surface-card border border-border-secondary rounded-sm px-2 py-1 text-[11px] text-foreground disabled:opacity-60"
          >
            {isOwner && <option value="owner">owner</option>}
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>
        )}

        {isPending && canManageMembers && (
          <Button type="button" variant="secondary" className="text-[10px] py-1 px-2" disabled={isBusy} onClick={() => void onApprove(member)}>
            審核通過
          </Button>
        )}
        {!isPending && (isSelf || canManageMembers) && (
          <Button type="button" variant="ghost" className="text-[10px]" disabled={isBusy} onClick={() => void onNickname(member)}>
            暱稱
          </Button>
        )}
        {canManageMembers && (
          <Button
            type="button"
            variant="ghost"
            className="text-[10px]"
            disabled={isBusy || !canEditMember || isSelf}
            onClick={() => void onToggleMute(member)}
          >
            {member.isMuted ? "解除禁言" : "禁言"}
          </Button>
        )}
        {canTransferOwner && !isOwner && !isPending && (
          <Button type="button" variant="ghost" className="text-[10px]" disabled={isBusy} onClick={() => void onTransferOwner(member)}>
            轉讓群主
          </Button>
        )}
        {canManageMembers && (
          <Button
            type="button"
            variant="ghost"
            className="text-[10px] text-red-600"
            disabled={isBusy || !canEditMember || isSelf}
            onClick={() => void onKick(member)}
          >
            移除
          </Button>
        )}
      </div>
    </div>
  );
}
