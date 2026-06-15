"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import Chatroom from "@/components/chat/Chatroom";
import GroupSettings from "@/components/settings/GroupSettings";
import RoomMembersPanel from "@/components/chat/RoomMembersPanel";
import FriendInfoPanel from "@/components/chat/FriendInfoPanel";

export default function ChatroomPageContent() {
  const params = useParams();
  const { rooms, showRightPanel, user } = useChat();
  const [showSettings, setShowSettings] = useState(false);

  const chatId = params?.chatId as string;
  const activeRoom = rooms.find((room) => room.id === chatId);

  useEffect(() => {
    if (activeRoom) {
      document.title = `Near | ${activeRoom.name}`;
    }
  }, [activeRoom]);

  // Reset the settings view when switching rooms (adjust state during render).
  const [prevChatId, setPrevChatId] = useState(chatId);
  if (prevChatId !== chatId) {
    setPrevChatId(chatId);
    setShowSettings(false);
  }

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        找不到此聊天室
      </div>
    );
  }

  // Find the other member in a private (msg) chatroom
  const otherMember = activeRoom.type === "msg"
    ? activeRoom.members?.find((m) => m.userId !== user.userId)
    : undefined;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {showSettings ? (
        <GroupSettings roomId={activeRoom.id} onClose={() => setShowSettings(false)} />
      ) : (
        <Chatroom
          roomId={activeRoom.id}
          onOpenGroupSettings={activeRoom.type === "group" ? () => setShowSettings(true) : undefined}
        />
      )}

      {showRightPanel && (
        activeRoom.type === "group" && activeRoom.members ? (
          <RoomMembersPanel room={activeRoom} members={activeRoom.members} />
        ) : activeRoom.type === "msg" ? (
          <div className="w-[240px] shrink-0 border-l border-border-primary bg-surface-card h-full">
            <FriendInfoPanel userId={otherMember?.userId} friendName={activeRoom.name} />
          </div>
        ) : null
      )}
    </div>
  );
}
