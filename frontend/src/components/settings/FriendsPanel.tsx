"use client";

import React, { useMemo, useState } from "react";
import { useChat } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/hooks/useTranslation";

export default function FriendsPanel() {
  const {
    friends,
    friendRequests,
    blockedUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    blockFriend,
    unblockUser,
    setSelectedFriendForSidebar,
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
  const { t } = useTranslation();

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
          <PanelHeader title={t("friends.friendList")} meta={`${friends.length} ${t("friends.accepted")}`} />
          <div className="p-4 border-b border-border-secondary">
            <Input
              label={t("friends.search")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("friends.searchPlaceholder")}
            />
          </div>
          <div className="divide-y divide-border-secondary">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="p-4 flex items-center justify-between gap-4">
                <div
                  onClick={() => setSelectedFriendForSidebar(friend)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 active:scale-98 transition-all"
                >
                  <Avatar name={friend.name} size="sm" isOnline={friend.status === "online"} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{friend.name}</p>
                      {friend.isEmergencyContact && <Badge variant="secondary">{t("friends.emergency")}</Badge>}
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
                    {t("friends.remove")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs py-1 px-2 text-red-600"
                    onClick={() => blockFriend(friend.id)}
                  >
                    {t("friends.block")}
                  </Button>
                </div>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted">{t("friends.noMatch")}</div>
            )}
          </div>
        </section>

        <section className="border border-border-primary rounded-sm bg-surface-card">
          <PanelHeader title={t("friends.addFriend")} meta={t("friends.mockRequest")} />
          <form onSubmit={handleSendRequest} className="p-4 flex flex-col gap-4">
            <Input
              label={t("friends.name")}
              value={newFriendName}
              onChange={(event) => setNewFriendName(event.target.value)}
              placeholder={t("friends.namePlaceholder")}
              required
            />
            <Input
              label={t("friends.email")}
              type="email"
              value={newFriendEmail}
              onChange={(event) => setNewFriendEmail(event.target.value)}
              placeholder={t("friends.emailPlaceholder")}
              required
            />
            <Button type="submit" variant="primary">
              {t("friends.sendRequest")}
            </Button>
          </form>
        </section>
      </div>

      <section className="border border-border-primary rounded-sm bg-surface-card">
        <PanelHeader title={t("friends.friendRequests")} meta={`${incomingRequests.length} ${t("friends.incoming")} / ${outgoingRequests.length} ${t("friends.outgoing")}`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-secondary">
          <RequestColumn
            title={t("friends.incomingTitle")}
            empty={t("friends.noIncoming")}
            requests={incomingRequests}
            renderActions={(requestId) => (
              <>
                <Button type="button" variant="primary" className="text-xs py-1 px-2" onClick={() => acceptFriendRequest(requestId)}>
                  {t("friends.accept")}
                </Button>
                <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => rejectFriendRequest(requestId)}>
                  {t("friends.reject")}
                </Button>
              </>
            )}
          />
          <RequestColumn
            title={t("friends.outgoingTitle")}
            empty={t("friends.noOutgoing")}
            requests={outgoingRequests}
            renderActions={(requestId) => (
              <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => rejectFriendRequest(requestId)}>
                {t("friends.cancel")}
              </Button>
            )}
          />
        </div>
      </section>

      <section className="border border-border-primary rounded-sm bg-surface-card">
        <PanelHeader title={t("friends.blockedUsers")} meta={`${blockedUsers.length} ${t("friends.blocked")}`} />
        <div className="divide-y divide-border-secondary">
          {blockedUsers.map((user) => (
            <div key={user.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-text-muted font-mono truncate">{user.email}</p>
              </div>
              <Button type="button" variant="secondary" className="text-xs py-1 px-2" onClick={() => unblockUser(user.id)}>
                {t("friends.unblock")}
              </Button>
            </div>
          ))}
          {blockedUsers.length === 0 && (
            <div className="p-6 text-center text-xs text-text-muted">{t("friends.noBlocked")}</div>
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
