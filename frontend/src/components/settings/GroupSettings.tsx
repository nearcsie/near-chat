"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat, getAvatarForUser, Member, ChatRoom } from "@/context/ChatContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Avatar } from "@/components/ui/Avatar";

interface GroupSettingsProps {
  roomId: string;
  onClose: () => void;
}

export default function GroupSettings({ roomId, onClose }: GroupSettingsProps) {
  const router = useRouter();
  const { rooms, user, saveGroupSettings, handleDeleteGroupRoom } = useChat();

  const activeRoom = rooms.find((r) => r.id === roomId);

  const [groupSettingsName, setGroupSettingsName] = useState("");
  const [groupSettingsDesc, setGroupSettingsDesc] = useState("");
  const [groupSettingsPublic, setGroupSettingsPublic] = useState(false);
  const [groupSettingsInvite, setGroupSettingsInvite] = useState(false);
  const [groupSettingsUpload, setGroupSettingsUpload] = useState(false);
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (activeRoom) {
      setGroupSettingsName(activeRoom.name);
      setGroupSettingsDesc(activeRoom.description || "");
      setGroupSettingsPublic(!!activeRoom.isPublic);
      setGroupSettingsInvite(!!activeRoom.allowInvite);
      setGroupSettingsUpload(!!activeRoom.allowUpload);
      setGroupSettingsMembers(activeRoom.members || []);
    }
  }, [activeRoom]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        找不到此群組
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveGroupSettings(roomId, {
      name: groupSettingsName,
      description: groupSettingsDesc,
      isPublic: groupSettingsPublic,
      allowInvite: groupSettingsInvite,
      allowUpload: groupSettingsUpload,
      members: groupSettingsMembers,
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm("警告！刪除群組聊天室將無法復原，所有訊息及成員資料都將被永久刪除。確認刪除嗎？")) {
      const nextActiveId = handleDeleteGroupRoom(roomId);
      if (nextActiveId) {
        router.push(`/chat/${nextActiveId}`);
      } else {
        router.push("/");
      }
    }
  };

  const handleInvite = () => {
    const name = prompt("請輸入欲邀請的成員名稱：");
    if (!name) return;
    setGroupSettingsMembers([...groupSettingsMembers, { name, role: "member" }]);
  };

  const handleKick = (memberName: string) => {
    if (memberName === "我") {
      alert("您無法踢出自己！");
      return;
    }
    setGroupSettingsMembers(groupSettingsMembers.filter((m) => m.name !== memberName));
  };

  const handleToggleMute = (memberName: string) => {
    setGroupSettingsMembers(
      groupSettingsMembers.map((m) =>
        m.name === memberName ? { ...m, isMuted: !m.isMuted } : m
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
        <h1 className="text-sm font-bold text-foreground tracking-wider">群組設定 - {groupSettingsName}</h1>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs py-1 px-3">
            取消
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} className="text-xs py-1 px-3">
            儲存變更
          </Button>
        </div>
      </div>

      {/* Centered Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
        <div className="w-full max-w-xl border border-border-primary rounded-sm bg-surface-card p-6 shadow-sm">
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Section: Basic Info */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                基本資訊
              </h3>
              <Input
                label="聊天室名稱"
                value={groupSettingsName}
                onChange={(e) => setGroupSettingsName(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
                  描述
                </label>
                <textarea
                  value={groupSettingsDesc}
                  onChange={(e) => setGroupSettingsDesc(e.target.value)}
                  className="w-full bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2 text-sm text-foreground transition-colors min-h-[60px]"
                />
              </div>
              <Checkbox
                label="公開聊天室"
                description="允許任何人加入此聊天室"
                checked={groupSettingsPublic}
                onChange={(e) => setGroupSettingsPublic(e.target.checked)}
              />
            </div>

            {/* Section: Member Management */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border-secondary pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  成員管理
                </h3>
                <Button type="button" variant="ghost" onClick={handleInvite} className="text-xs select-none">
                  邀請成員
                </Button>
              </div>
              <span className="text-[10px] text-text-muted font-bold font-mono">
                共 {groupSettingsMembers.length} 位成員
              </span>
              <div className="flex flex-col border border-border-primary divide-y divide-border-secondary rounded-sm overflow-hidden bg-surface-card max-h-[160px] overflow-y-auto">
                {groupSettingsMembers.map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar name={member.name} src={getAvatarForUser(member.name, user.avatar, user.username)} size="sm" />
                      <span className="font-semibold">{member.name}</span>
                      <span className="text-[9px] text-text-muted capitalize font-mono">
                        ({member.role})
                      </span>
                    </div>
                    {member.name !== "我" && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleToggleMute(member.name)}
                          className={`text-[10px] font-sans ${member.isMuted ? "text-green-600" : "text-text-muted"}`}
                        >
                          {member.isMuted ? "解禁" : "禁言"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleKick(member.name)}
                          className="text-[10px] text-red-600 font-sans"
                        >
                          踢出
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Permissions */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                權限設定
              </h3>
              <div className="flex flex-col gap-3.5">
                <Checkbox
                  label="允許成員邀請他人"
                  description="成員可以邀請新成員加入聊天室"
                  checked={groupSettingsInvite}
                  onChange={(e) => setGroupSettingsInvite(e.target.checked)}
                />
                <Checkbox
                  label="允許成員上傳檔案"
                  description="成員可以在聊天室中上傳檔案"
                  checked={groupSettingsUpload}
                  onChange={(e) => setGroupSettingsUpload(e.target.checked)}
                />
              </div>
            </div>

            {/* Section: Danger Zone */}
            <div className="flex flex-col gap-3 border border-red-500/20 p-4 bg-red-500/5 rounded-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">
                危險區域
              </h3>
              <div className="flex flex-col items-start gap-2">
                <Button type="button" variant="secondary" onClick={handleDelete} className="text-red-600 border-red-600 hover:bg-red-500/10">
                  刪除聊天室
                </Button>
                <span className="text-[10px] text-red-600/70 leading-normal">
                  刪除後將無法復原，所有訊息和成員資料都會被永久刪除。
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" variant="primary">
                儲存變更
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
