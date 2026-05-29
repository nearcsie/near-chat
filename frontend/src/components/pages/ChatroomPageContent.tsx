"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import Chatroom from "@/components/chat/Chatroom";
import GroupSettings from "@/components/settings/GroupSettings";
import RoomMembersPanel from "@/components/chat/RoomMembersPanel";

export default function ChatroomPageContent() {
  const params = useParams();
  const { rooms } = useChat();
  const [showSettings, setShowSettings] = useState(false);

  const chatId = params?.chatId as string;
  const activeRoom = rooms.find((room) => room.id === chatId);

  useEffect(() => {
    setShowSettings(false);
  }, [chatId]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground font-sans">
        找不到此聊天室
      </div>
    );
  }

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

      {activeRoom.type === "group" && activeRoom.members && (
        <RoomMembersPanel room={activeRoom} members={activeRoom.members} />
      )}
    </div>
  );
}
