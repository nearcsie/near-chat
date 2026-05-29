"use client";

import { ChatRoom, Member, getAvatarForUser, useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";

export default function RoomMembersPanel({ room, members }: { room: ChatRoom; members: Member[] }) {
  const { user, activeRoomNicknames } = useChat();
  const activeUserDisplayName = activeRoomNicknames[room.id] || user.username;

  return (
    <div className="w-[240px] shrink-0 border-l border-border-primary bg-surface-card flex flex-col h-full select-none">
      <div className="h-14 border-b border-border-primary px-4 flex items-center select-none shrink-0 bg-surface-muted">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
          成員列表 ({members.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border-secondary/30">
        {members.map((member, index) => {
          const displayNick = member.name === user.username ? activeUserDisplayName : member.name;
          return (
            <div key={`${member.name}-${index}`} className="p-3.5 flex items-center justify-between hover:bg-surface-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={member.name} src={getAvatarForUser(member.name, user.avatar, user.username)} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{displayNick}</p>
                  <p className="text-[9px] text-text-muted capitalize mt-0.5 font-mono">{member.role}</p>
                </div>
              </div>
              {member.isMuted && <MutedIcon />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MutedIcon() {
  return (
    <span title="已靜音" className="text-red-500 scale-90">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    </span>
  );
}
