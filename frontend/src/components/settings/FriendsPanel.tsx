"use client";

import React, { useMemo, useState } from "react";
import { useChat } from "@/context/ChatContext";
import type { Friend } from "@/context/ChatContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/hooks/useTranslation";
import { searchUsers, sendFriendRequest as sendFriendRequestApi } from "@/lib/api";
import { getActiveAccessToken } from "@/lib/api";
import type { SearchUserResult } from "@shared/types";

type Tab = "friends" | "incoming" | "outgoing" | "blocked" | "add";
type SearchMode = "name" | "userId" | "email";

export default function FriendsPanel() {
  const {
    friends,
    friendRequests,
    blockedUsers,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    blockFriend,
    unblockUser,
    setSelectedFriendForSidebar,
  } = useChat();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>("friends");

  // Friends tab state
  const [searchText, setSearchText] = useState("");

  // Add friend tab state
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [addQuery, setAddQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(query) ||
        friend.email.toLowerCase().includes(query)
    );
  }, [friends, searchText]);

  const incomingRequests = friendRequests.filter((r) => r.direction === "incoming");
  const outgoingRequests = friendRequests.filter((r) => r.direction === "outgoing");

  /** Convert any user with id/name/email into a Friend shape for the sidebar. */
  const toFriendShape = (user: { id: string; name: string; email: string }): Friend => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: "offline",
  });

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = addQuery.trim();
    if (!query) return;

    const token = getActiveAccessToken();
    if (!token) {
      setSearchError("Not authenticated");
      return;
    }

    setIsSearching(true);
    setSearchPerformed(false);
    setSearchError(null);
    try {
      const results = await searchUsers(token, { query, mode: searchMode });
      setSearchResults(results);
      setSearchPerformed(true);
    } catch (err) {
      console.error(err);
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setSearchResults([]);
      setSearchPerformed(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    const token = getActiveAccessToken();
    if (!token) return;
    setSendingIds((prev) => new Set(prev).add(targetUserId));
    try {
      await sendFriendRequestApi(token, targetUserId);
      setSentIds((prev) => new Set(prev).add(targetUserId));
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed";
      alert(t("friends.requestFailed") + (msg !== "Failed" ? `: ${msg}` : ""));
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "friends", label: t("friends.tabFriends"), badge: friends.length },
    { key: "incoming", label: t("friends.tabIncoming"), badge: incomingRequests.length || undefined },
    { key: "outgoing", label: t("friends.tabOutgoing"), badge: outgoingRequests.length || undefined },
    { key: "blocked", label: t("friends.tabBlocked"), badge: blockedUsers.length || undefined },
    { key: "add", label: t("friends.tabAdd") },
  ];

  return (
    <div className="flex flex-col gap-0 border border-border-primary rounded-sm bg-surface-card overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-border-primary bg-surface-muted overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-primary text-primary bg-surface-card"
                : "border-transparent text-text-muted hover:text-foreground hover:bg-surface-card/50",
            ].join(" ")}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={[
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "bg-border-secondary text-text-muted",
                ].join(" ")}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {/* ── Friends Tab ── */}
        {activeTab === "friends" && (
          <div>
            <div className="p-4 border-b border-border-secondary">
              <Input
                label={t("friends.search")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
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
                        {friend.isEmergencyContact && (
                          <Badge variant="secondary">{t("friends.emergency")}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted font-mono truncate">{friend.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs py-1 px-2"
                      onClick={() => void removeFriend(friend.id).catch(console.error)}
                    >
                      {t("friends.remove")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs py-1 px-2 text-red-600"
                      onClick={() => void blockFriend(friend.id).catch(console.error)}
                    >
                      {t("friends.block")}
                    </Button>
                  </div>
                </div>
              ))}
              {filteredFriends.length === 0 && (
                <div className="p-8 text-center text-xs text-text-muted">{t("friends.noMatch")}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Incoming Tab ── */}
        {activeTab === "incoming" && (
          <div>
            <SectionLabel>{t("friends.incomingTitle")}</SectionLabel>
            <div className="divide-y divide-border-secondary">
              {incomingRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                  <div
                    onClick={() => setSelectedFriendForSidebar(toFriendShape(req))}
                    className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition-all"
                  >
                    <Avatar name={req.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{req.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">{req.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="primary"
                      className="text-xs py-1 px-2"
                      onClick={() => void acceptFriendRequest(req.id).catch(console.error)}
                    >
                      {t("friends.accept")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs py-1 px-2"
                      onClick={() => void rejectFriendRequest(req.id).catch(console.error)}
                    >
                      {t("friends.reject")}
                    </Button>
                  </div>
                </div>
              ))}
              {incomingRequests.length === 0 && (
                <div className="p-8 text-center text-xs text-text-muted">{t("friends.noIncoming")}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Outgoing Tab ── */}
        {activeTab === "outgoing" && (
          <div>
            <SectionLabel>{t("friends.outgoingTitle")}</SectionLabel>
            <div className="divide-y divide-border-secondary">
              {outgoingRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                  <div
                    onClick={() => setSelectedFriendForSidebar(toFriendShape(req))}
                    className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition-all"
                  >
                    <Avatar name={req.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{req.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">{req.email}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs py-1 px-2"
                    onClick={() => void rejectFriendRequest(req.id).catch(console.error)}
                  >
                    {t("friends.cancel")}
                  </Button>
                </div>
              ))}
              {outgoingRequests.length === 0 && (
                <div className="p-8 text-center text-xs text-text-muted">{t("friends.noOutgoing")}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Blocked Tab ── */}
        {activeTab === "blocked" && (
          <div>
            <SectionLabel>{t("friends.blockedUsers")}</SectionLabel>
            <div className="divide-y divide-border-secondary">
              {blockedUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                  <div
                    onClick={() => setSelectedFriendForSidebar(toFriendShape(user))}
                    className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition-all"
                  >
                    <Avatar name={user.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs py-1 px-2"
                    onClick={() => void unblockUser(user.id).catch(console.error)}
                  >
                    {t("friends.unblock")}
                  </Button>
                </div>
              ))}
              {blockedUsers.length === 0 && (
                <div className="p-8 text-center text-xs text-text-muted">{t("friends.noBlocked")}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Add Friend Tab ── */}
        {activeTab === "add" && (
          <div className="p-4 flex flex-col gap-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <Input
                label={t("friends.addFriend")}
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder={
                  searchMode === "userId"
                    ? "User ID (exact)"
                    : searchMode === "email"
                    ? "user@example.com"
                    : t("friends.searchPlaceholder")
                }
              />

              {/* Radio buttons for search mode */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  {t("friends.searchMode")}
                </p>
                <div className="flex items-center gap-4">
                  {(
                    [
                      { value: "name" as SearchMode, label: t("friends.byName") },
                      { value: "userId" as SearchMode, label: t("friends.byUserId") },
                      { value: "email" as SearchMode, label: t("friends.byEmail") },
                    ] as { value: SearchMode; label: string }[]
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground"
                    >
                      <input
                        type="radio"
                        name="searchMode"
                        value={value}
                        checked={searchMode === value}
                        onChange={() => {
                          setSearchMode(value);
                          setSearchResults([]);
                          setSearchPerformed(false);
                          setSearchError(null);
                        }}
                        className="accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {searchError && (
                <p className="text-xs text-red-500">{searchError}</p>
              )}

              <button
                type="submit"
                disabled={isSearching || addQuery.trim().length === 0}
                className="inline-flex items-center justify-center font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer text-sm select-none bg-primary text-white hover:bg-[#0066d6] active:translate-x-[1px] active:translate-y-[1px] rounded-sm py-2 px-4 border-none"
              >
                {isSearching ? t("friends.searching") : t("friends.searchBtn")}
              </button>
            </form>

            {/* Results */}
            {searchPerformed && (
              <div className="border border-border-primary rounded-sm overflow-hidden">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-muted border-b border-border-secondary">
                  {searchResults.length > 0
                    ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
                    : t("friends.noResults")}
                </div>
                <div className="divide-y divide-border-secondary">
                  {searchResults.map((user) => {
                    const alreadyFriend = friends.some((f) => f.id === user.userId);
                    const alreadySent = sentIds.has(user.userId);
                    const isSending = sendingIds.has(user.userId);

                    return (
                      <div key={user.userId} className="p-4 flex items-center justify-between gap-4">
                        <div
                          onClick={() =>
                            setSelectedFriendForSidebar({
                              id: user.userId,
                              name: user.name,
                              email: user.email,
                              status: "offline",
                            })
                          }
                          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition-all"
                        >
                          <Avatar name={user.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                            <p className="text-[10px] text-text-muted font-mono truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {alreadyFriend ? (
                            <span className="text-xs text-text-muted">{t("friends.accepted")}</span>
                          ) : alreadySent ? (
                            <span className="text-xs text-text-muted">{t("friends.requested")}</span>
                          ) : (
                            <Button
                              type="button"
                              variant="primary"
                              className="text-xs py-1 px-2"
                              disabled={isSending}
                              onClick={() => void handleSendRequest(user.userId)}
                            >
                              {isSending ? "..." : t("friends.sendRequest")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {searchResults.length === 0 && (
                    <div className="p-8 text-center text-xs text-text-muted">
                      {t("friends.noResults")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border-secondary bg-surface-muted text-[10px] font-bold uppercase tracking-wider text-text-muted">
      {children}
    </div>
  );
}
