"use client";

import React, { useMemo, useState } from "react";
import { useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const friendsCopy = {
  "zh-TW": {
    friendList: "好友列表",
    accepted: "已接受",
    search: "搜尋",
    searchPlaceholder: "名稱或 email",
    emergency: "緊急聯絡人",
    remove: "移除",
    block: "封鎖",
    noMatch: "沒有符合搜尋的好友。",
    addFriend: "新增好友",
    mockRequest: "模擬邀請",
    name: "名稱",
    namePlaceholder: "課程夥伴",
    email: "Email",
    emailPlaceholder: "friend@example.com",
    sendRequest: "送出邀請",
    friendRequests: "好友邀請",
    incoming: "收到",
    outgoing: "送出",
    incomingTitle: "收到的邀請",
    outgoingTitle: "送出的邀請",
    noIncoming: "沒有收到的邀請。",
    noOutgoing: "沒有送出的邀請。",
    accept: "接受",
    reject: "拒絕",
    cancel: "取消",
    blockedUsers: "封鎖名單",
    blocked: "已封鎖",
    unblock: "解除封鎖",
    noBlocked: "沒有封鎖使用者。",
  },
  en: {
    friendList: "Friend list",
    accepted: "accepted",
    search: "Search",
    searchPlaceholder: "Name or email",
    emergency: "Emergency",
    remove: "Remove",
    block: "Block",
    noMatch: "No friends match this search.",
    addFriend: "Add friend",
    mockRequest: "Mock request",
    name: "Name",
    namePlaceholder: "Course teammate",
    email: "Email",
    emailPlaceholder: "friend@example.com",
    sendRequest: "Send request",
    friendRequests: "Friend requests",
    incoming: "incoming",
    outgoing: "outgoing",
    incomingTitle: "Incoming",
    outgoingTitle: "Outgoing",
    noIncoming: "No incoming requests.",
    noOutgoing: "No outgoing requests.",
    accept: "Accept",
    reject: "Reject",
    cancel: "Cancel",
    blockedUsers: "Blocked users",
    blocked: "blocked",
    unblock: "Unblock",
    noBlocked: "No blocked users.",
  },
} as const;

export default function FriendsPanel() {
  const {
    friends,
    friendRequests,
    blockedUsers,
    uiLanguage,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    blockFriend,
    unblockUser,
  } = useChat();
  const [searchText, setSearchText] = useState("");
  const [newFriendName, setNewFriendName] = useState("");
  const [newFriendEmail, setNewFriendEmail] = useState("");

  const filteredFriends = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(query) ||
        friend.email.toLowerCase().includes(query)
    );
  }, [friends, searchText]);

  const incomingRequests = friendRequests.filter((request) => request.direction === "incoming");
  const outgoingRequests = friendRequests.filter((request) => request.direction === "outgoing");
  const t = friendsCopy[uiLanguage];

  const handleSendRequest = (event: React.FormEvent) => {
    event.preventDefault();
    sendFriendRequest(newFriendName, newFriendEmail);
    setNewFriendName("");
    setNewFriendEmail("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="border border-border-primary rounded-sm bg-surface-card">
          <PanelHeader title={t.friendList} meta={`${friends.length} ${t.accepted}`} />
          <div className="p-4 border-b border-border-secondary">
            <Input
              label={t.search}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </div>
          <div className="divide-y divide-border-secondary">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={friend.name} size="sm" isOnline={friend.status === "online"} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{friend.name}</p>
                      {friend.isEmergencyContact && <Badge variant="secondary">{t.emergency}</Badge>}
                    </div>
                    <p className="text-[10px] text-text-muted font-mono truncate">{friend.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs py-1 px-2"
                    onClick={() => removeFriend(friend.id)}
                  >
                    {t.remove}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs py-1 px-2 text-red-600"
                    onClick={() => blockFriend(friend.id)}
                  >
                    {t.block}
                  </Button>
                </div>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted">{t.noMatch}</div>
            )}
          </div>
        </section>

        <section className="border border-border-primary rounded-sm bg-surface-card">
          <PanelHeader title={t.addFriend} meta={t.mockRequest} />
          <form onSubmit={handleSendRequest} className="p-4 flex flex-col gap-4">
            <Input
              label={t.name}
              value={newFriendName}
              onChange={(event) => setNewFriendName(event.target.value)}
              placeholder={t.namePlaceholder}
              required
            />
            <Input
              label={t.email}
              type="email"
              value={newFriendEmail}
              onChange={(event) => setNewFriendEmail(event.target.value)}
              placeholder={t.emailPlaceholder}
              required
            />
            <Button type="submit" variant="primary">
              {t.sendRequest}
            </Button>
          </form>
        </section>
      </div>

      <section className="border border-border-primary rounded-sm bg-surface-card">
        <PanelHeader title={t.friendRequests} meta={`${incomingRequests.length} ${t.incoming} / ${outgoingRequests.length} ${t.outgoing}`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-secondary">
          <RequestColumn
            title={t.incomingTitle}
            empty={t.noIncoming}
            requests={incomingRequests}
            renderActions={(requestId) => (
              <>
                <Button type="button" variant="primary" className="text-xs py-1 px-2" onClick={() => acceptFriendRequest(requestId)}>
                  {t.accept}
                </Button>
                <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => rejectFriendRequest(requestId)}>
                  {t.reject}
                </Button>
              </>
            )}
          />
          <RequestColumn
            title={t.outgoingTitle}
            empty={t.noOutgoing}
            requests={outgoingRequests}
            renderActions={(requestId) => (
              <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => rejectFriendRequest(requestId)}>
                {t.cancel}
              </Button>
            )}
          />
        </div>
      </section>

      <section className="border border-border-primary rounded-sm bg-surface-card">
        <PanelHeader title={t.blockedUsers} meta={`${blockedUsers.length} ${t.blocked}`} />
        <div className="divide-y divide-border-secondary">
          {blockedUsers.map((user) => (
            <div key={user.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-text-muted font-mono truncate">{user.email}</p>
              </div>
              <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => unblockUser(user.id)}>
                {t.unblock}
              </Button>
            </div>
          ))}
          {blockedUsers.length === 0 && (
            <div className="p-6 text-center text-xs text-text-muted">{t.noBlocked}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function PanelHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="px-4 py-3 border-b border-border-primary bg-surface-muted flex items-center justify-between">
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h3>
      <span className="text-[10px] text-text-muted font-mono">{meta}</span>
    </div>
  );
}

function RequestColumn({
  title,
  empty,
  requests,
  renderActions,
}: {
  title: string;
  empty: string;
  requests: { id: string; name: string; email: string }[];
  renderActions: (requestId: string) => React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-secondary">
        {title}
      </div>
      <div className="divide-y divide-border-secondary">
        {requests.map((request) => (
          <div key={request.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{request.name}</p>
              <p className="text-[10px] text-text-muted font-mono truncate">{request.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">{renderActions(request.id)}</div>
          </div>
        ))}
        {requests.length === 0 && <div className="p-6 text-center text-xs text-text-muted">{empty}</div>}
      </div>
    </div>
  );
}
