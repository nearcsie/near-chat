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
  const { rooms, showRightPanel, setShowRightPanel, user } = useChat();
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

  const rightPanel =
    activeRoom.type === "group" && activeRoom.members ? (
      <RoomMembersPanel room={activeRoom} members={activeRoom.members} />
    ) : activeRoom.type === "msg" ? (
      <div className="w-[280px] max-w-[85vw] lg:w-[240px] shrink-0 border-l border-border-primary bg-surface-card h-full">
        <FriendInfoPanel userId={otherMember?.userId} friendName={activeRoom.name} />
      </div>
    ) : null;

  return (
    <div className="relative flex-1 flex h-full overflow-hidden">
      {showSettings ? (
        <GroupSettings roomId={activeRoom.id} onClose={() => setShowSettings(false)} />
      ) : (
        <Chatroom
          roomId={activeRoom.id}
          onOpenGroupSettings={activeRoom.type === "group" ? () => setShowSettings(true) : undefined}
        />
      )}

      {showRightPanel && rightPanel && (
        <>
          {/* Below lg the panel floats over the conversation as a drawer. */}
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden animate-fade-in"
            onClick={() => setShowRightPanel(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 z-40 flex h-full lg:static lg:z-auto animate-slide-in-right lg:animate-none">
            {rightPanel}
          </div>
        </>
      )}
    </div>
  );
}
