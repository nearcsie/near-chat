"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  Attachment as ApiAttachment,
  EmergencyContactResponse,
  Folder as ApiFolder,
  FriendRequestResponse,
  FriendResponse,
  MessageWithSender,
  MyProfile,
  PublicUser,
  Room,
  RoomMember as ApiRoomMember,
  RoomMemberRole,
  RoomSummary,
  UserProfile,
  UserSettings,
} from "@shared/types";
import {
  approveRoomMember,
  attachmentDownloadUrl,
  blockUser as blockUserApi,
  createFolder,
  createGroup,
  createPrivateRoom,
  deleteEmergencyContact,
  deleteFriend,
  deleteFolder as deleteFolderApi,
  deleteMe as deleteMeApi,
  getBlockedUsers,
  getMe,
  joinRoomByCode,
  getMySettings,
  getUserProfile,
  kickRoomMember,
  leaveRoom as leaveRoomApi,
  listEmergencyContacts,
  listFolders,
  listFriendRequests,
  listFriends,
  listMessages,
  listRoomMembers,
  listRooms,
  logout,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest as sendFriendRequestApi,
  triggerEmergencyAlert as triggerEmergencyAlertApi,
  unblockUser as unblockUserApi,
  updateFolderRooms,
  updateMe,
  updateMySettings,
  updateRoom,
  updateRoomMember,
  transferRoomOwner,
  upsertEmergencyContact,
  uploadAttachment,
} from "@/lib/api";
import {
  createChatSocket,
  joinRoom,
  onEmergencyAlert,
  onFriendRequest,
  onMessageRecalled,
  onNewMessage,
  onReadUpdate,
  onSocketError,
  onUserTyping,
  recallMessage,
  sendMessage,
  sendReadReceipt,
  sendTyping,
  type ChatSocket,
} from "@/lib/socket";

export interface Member {
  userId: string;
  name: string;
  role: RoomMemberRole;
  nickname?: string;
  isMuted?: boolean;
  lastReadId?: string | null;
}

export interface ChatRoom {
  id: string;
  type: "msg" | "group";
  name: string;
  isOnline?: boolean;
  folderId?: string | null;
  inviteCode?: string;
  requireApproval?: boolean;
  viewHistory?: boolean;
  members?: Member[];
  isArchived?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  content: string;
  sentAt: string;
  timestamp: string;
  replyToId?: string;
  isOutgoing?: boolean;
  isRecalled?: boolean;
  replyTo?: {
    senderName: string;
    content: string;
  } | null;
  attachments?: { filename: string; filetype: string; url?: string }[];
  mentions?: string[];
  isRead?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface User {
  userId?: string;
  username: string;
  email: string;
  avatar: string;
  bio?: string;
  language?: UiLanguage;
  theme?: "light" | "dark";
  notifyDesktop?: boolean;
  notifySound?: boolean;
  warningEnabled?: boolean;
  warningDays?: number;
}

type StoredUser = User;

export interface Friend {
  id: string;
  name: string;
  email: string;
  status: "online" | "offline";
  isEmergencyContact?: boolean;
}

export interface FriendRequest {
  id: string;
  name: string;
  email: string;
  direction: "incoming" | "outgoing";
}

export interface BlockedUser {
  id: string;
  name: string;
  email: string;
}

export interface EmergencyContact {
  id: string;
  contactId: string;
  name: string;
  email: string;
  message: string;
}

export interface EmergencySettings {
  warningEnabled: boolean;
  warningDays: number;
  contacts: EmergencyContact[];
}

interface TriggerEmergencyAlertResult {
  alerted: boolean;
  recipients: string[];
  reason?: string;
}

export type UiLanguage = "zh-TW" | "en";

export const getAvatarForUser = (
  username: string,
  currentUserAvatar?: string,
  currentUsername?: string,
) => {
  if (currentUsername && username === currentUsername) {
    return currentUserAvatar || "";
  }
  return "";
};

export interface ProfileInput {
  username: string;
  email: string;
  avatar: string;
  password?: string;
  bio?: string;
}

export interface PreferencesInput {
  theme: string;
  language: UiLanguage;
  notifyDesktop: boolean;
  notifySound: boolean;
  warningEnabled?: boolean;
  warningDays?: number;
}

interface GroupSettingsInput {
  name: string;
  requireApproval: boolean;
  viewHistory: boolean;
}

interface ChatContextType {
  rooms: ChatRoom[];
  folders: Folder[];
  messages: Message[];
  groupReadStates: Record<string, Record<string, string>>;
  user: User;
  activeRoomNicknames: Record<string, string>;
  friends: Friend[];
  friendRequests: FriendRequest[];
  blockedUsers: BlockedUser[];
  emergencySettings: EmergencySettings;
  uiLanguage: UiLanguage;
  isAuthenticated: boolean;
  isMounted: boolean;
  selectedFriendForSidebar: Friend | null;
  setSelectedFriendForSidebar: React.Dispatch<React.SetStateAction<Friend | null>>;
  showRightPanel: boolean;
  setShowRightPanel: React.Dispatch<React.SetStateAction<boolean>>;

  setRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  setActiveRoomNicknames: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  toggleFolder: (folderId: string) => void;
  handleLogout: () => void;
  handleSendMessage: (roomId: string, content: string, replyTarget: Message | null) => void;
  handleTyping: (roomId: string, isTyping: boolean) => void;
  handleUploadAttachment: (roomId: string, file: File) => Promise<void>;
  handleRecallMessage: (msgId: string) => void;
  handleUpdateProfile: (profile: ProfileInput) => Promise<void>;
  handleUpdatePreferences: (preferences: PreferencesInput) => Promise<void>;
  handleCreateRoom: (name: string, type: "msg" | "group", folderId: string) => Promise<string>;
  handleOpenPrivateRoom: (targetUserId: string) => Promise<string>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleCategorizeRoom: (roomId: string, folderId: string | null) => Promise<void>;
  handleModifyNickname: (roomId: string, nickname: string) => void;
  handleLeaveOrBlock: (roomId: string) => Promise<{ isDeleted: boolean; newActiveId?: string }>;
  handleDeleteAccount: () => Promise<void>;
  loadGroupMembers: (roomId: string) => Promise<Member[]>;
  saveGroupSettings: (roomId: string, settings: GroupSettingsInput) => Promise<void>;
  approveGroupMember: (roomId: string, userId: string) => Promise<void>;
  updateGroupMember: (
    roomId: string,
    userId: string,
    data: { role?: "admin" | "member"; nickname?: string; isMuted?: boolean },
  ) => Promise<void>;
  kickGroupMember: (roomId: string, userId: string) => Promise<void>;
  transferGroupOwner: (roomId: string, userId: string) => Promise<void>;
  handleDeleteGroupRoom: (roomId: string) => Promise<string | null>;
  getReadAvatarsForMessage: (room: ChatRoom, msg: Message) => string[];

  searchUsersForInvite: (query: string) => Promise<PublicUser[]>;
  handleJoinByInviteCode: (inviteCode: string) => Promise<string>;
  sendFriendRequest: (query: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockFriend: (friendId: string) => Promise<void>;
  unblockUser: (blockedId: string) => Promise<void>;
  saveEmergencySettings: (settings: EmergencySettings) => Promise<void>;
  triggerEmergencyAlertNow: (message?: string) => Promise<TriggerEmergencyAlertResult>;
  setUiLanguage: (language: UiLanguage) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const toStoredUser = (
  profile: MyProfile,
  settings?: Partial<UserSettings>,
): StoredUser => ({
  userId: profile.userId,
  username: profile.name,
  email: profile.email,
  avatar: profile.avatarUrl ?? "",
  bio: profile.bio ?? "",
  language: normalizeLanguage(settings?.language),
  theme: settings?.theme ?? "light",
  notifyDesktop: settings?.notifyDesktop ?? true,
  notifySound: settings?.notifySound ?? true,
  warningEnabled: settings?.warningEnabled ?? false,
  warningDays: settings?.warningDays ?? 0,
});

const formatMessageTime = (value: Date | string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const mapAttachment = (attachment: ApiAttachment) => {
  const filename = attachment.originalName || "attachment";
  return {
    filename,
    filetype: attachment.fileType,
    url: attachmentDownloadUrl(attachment.fileUrl),
  };
};

const summarizeMessagePreview = (message: {
  content: string;
  attachments?: { filename: string }[];
  isRecalled?: boolean;
}) => {
  if (message.isRecalled) return "";
  if (message.content.trim()) return message.content.trim();
  if (message.attachments?.length) return message.attachments[0].filename;
  return "";
};

const isPrivateRoomFallbackName = (roomName: string | undefined, roomId: string) =>
  roomName === `Private ${roomId.slice(0, 8)}`;

const mapMessage = (message: MessageWithSender, currentUserId?: string): Message => ({
  id: message.messageId,
  roomId: message.roomId,
  senderId: message.senderId,
  senderName: message.sender?.name ?? "Deleted User",
  content: message.content,
  sentAt: new Date(message.sentAt).toISOString(),
  timestamp: formatMessageTime(message.sentAt),
  replyToId: message.replyToId,
  isOutgoing: Boolean(currentUserId && message.senderId === currentUserId),
  isRecalled: message.isRecalled,
  replyTo: null,
  attachments: message.attachments?.map(mapAttachment) ?? [],
  mentions: message.mentions ?? [],
});

const hydrateReplyTargets = (items: Message[]): Message[] => {
  const messageByRoom = new Map<string, Map<string, Message>>();

  for (const item of items) {
    let roomMessages = messageByRoom.get(item.roomId);
    if (!roomMessages) {
      roomMessages = new Map<string, Message>();
      messageByRoom.set(item.roomId, roomMessages);
    }
    roomMessages.set(item.id, item);
  }

  return items.map((item) => {
    if (!item.replyToId) {
      return item.replyTo ? { ...item, replyTo: null } : item;
    }

    const replyTarget = messageByRoom.get(item.roomId)?.get(item.replyToId);
    if (!replyTarget) {
      return item;
    }

    const nextReplyTo = {
      senderName: replyTarget.senderName,
      content: replyTarget.isRecalled ? "" : replyTarget.content,
    };

    if (
      item.replyTo?.senderName === nextReplyTo.senderName &&
      item.replyTo?.content === nextReplyTo.content
    ) {
      return item;
    }

    return {
      ...item,
      replyTo: nextReplyTo,
    };
  });
};

const mapRooms = (
  apiRooms: RoomSummary[],
  apiFolders: ApiFolder[],
  currentRooms: ChatRoom[],
): ChatRoom[] => {
  const currentRoomById = new Map(currentRooms.map((room) => [room.id, room]));
  const folderByRoom = new Map<string, string>();
  for (const folder of apiFolders) {
    for (const roomId of folder.roomIds) {
      folderByRoom.set(roomId, folder.folderId);
    }
  }

  return apiRooms.map((room) => {
    const currentRoom = currentRoomById.get(room.roomId);
    const latestMessage =
      room.latestMessage
        ? {
            content: room.latestMessage.content,
            attachments: [],
            isRecalled: false,
          }
        : null;

    return {
      id: room.roomId,
      type: room.type === "group" ? "group" : "msg",
      name:
        room.name ||
        (currentRoom?.name && !isPrivateRoomFallbackName(currentRoom.name, room.roomId)
          ? currentRoom.name
          : room.type === "group"
            ? `Group ${room.roomId.slice(0, 8)}`
            : ""),
      folderId: folderByRoom.get(room.roomId) ?? currentRoom?.folderId ?? null,
      inviteCode: room.inviteCode,
      requireApproval: room.requireApproval,
      viewHistory: room.viewHistory,
      isArchived: room.isArchived,
      members: currentRoom?.members ?? (room.type === "group" ? [] : undefined),
      unreadCount: room.unreadCount ?? currentRoom?.unreadCount ?? 0,
      lastMessagePreview: latestMessage
        ? summarizeMessagePreview(latestMessage)
        : currentRoom?.lastMessagePreview,
      lastMessageAt: room.latestMessage
        ? formatMessageTime(room.latestMessage.sentAt)
        : currentRoom?.lastMessageAt,
    };
  });
};

const mapFolders = (apiFolders: ApiFolder[], currentFolders: Folder[]): Folder[] => {
  const collapsedById = new Map(currentFolders.map((folder) => [folder.id, folder.collapsed]));
  return apiFolders.map((folder) => ({
    id: folder.folderId,
    name: folder.name,
    collapsed: collapsedById.get(folder.folderId) ?? false,
  }));
};

const normalizeLanguage = (language?: string): UiLanguage =>
  language === "zh-TW" || language === "en" ? language : "en";

const formatUploadedAttachmentMessage = (language: UiLanguage, fileName: string) =>
  language === "zh-TW" ? `已上傳附件：${fileName}` : `Shared attachment: ${fileName}`;

const mapFriend = (item: FriendResponse, emergencyContactIds: Set<string>): Friend => ({
  id: item.friend.userId,
  name: item.friend.name,
  email: "",
  status: "offline",
  isEmergencyContact: emergencyContactIds.has(item.friend.userId),
});

const mapFriendRequest = (item: FriendRequestResponse, currentUserId: string): FriendRequest => {
  if (item.requesterId === currentUserId) {
    return {
      id: item.addresseeId,
      name: item.addressee?.name ?? item.addresseeId,
      email: "",
      direction: "outgoing",
    };
  }
  return {
    id: item.requesterId,
    name: item.requester?.name ?? item.requesterId,
    email: "",
    direction: "incoming",
  };
};

const mapEmergencyContact = (item: EmergencyContactResponse): EmergencyContact => ({
  id: item.contactId,
  contactId: item.contactId,
  name: item.contact?.name ?? item.contactId,
  email: item.contact?.email ?? "",
  message: item.message,
});

const mapRoomMember = (member: ApiRoomMember, profile?: UserProfile): Member => ({
  userId: member.userId,
  name: profile?.name || member.userId,
  role: member.role,
  nickname: member.nickname,
  isMuted: member.isMuted,
  lastReadId: member.lastReadId ?? null,
});

const fetchRoomMembers = async (authToken: string, roomId: string): Promise<Member[]> => {
  const apiMembers = await listRoomMembers(authToken, roomId);
  const profiles = await Promise.all(
    apiMembers.map((member) =>
      getUserProfile(authToken, member.userId).catch(() => undefined),
    ),
  );

  return apiMembers.map((member, index) => mapRoomMember(member, profiles[index]));
};

const findRequestedUser = (
  candidates: PublicUser[],
  query: string,
): PublicUser | undefined => {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    candidates.find((candidate) => candidate.userId.toLowerCase() === normalizedQuery) ??
    candidates.find((candidate) => candidate.name.toLowerCase() === normalizedQuery) ??
    candidates.find((candidate) => candidate.name.toLowerCase().includes(normalizedQuery)) ??
    candidates[0]
  );
};

const sortMessages = (items: Message[]) =>
  [...items].sort((a, b) => {
    const sentAtCompare = new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
    if (sentAtCompare !== 0) return sentAtCompare;
    return a.id.localeCompare(b.id);
  });

const computeUnreadCount = (
  roomMessages: Message[],
  currentUserId?: string,
  lastReadId?: string | null,
) => {
  if (!roomMessages.length) return 0;

  const firstUnreadIndex = lastReadId
    ? roomMessages.findIndex((message) => message.id === lastReadId) + 1
    : 0;

  return roomMessages
    .slice(Math.max(firstUnreadIndex, 0))
    .filter((message) => message.senderId !== currentUserId)
    .length;
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const socketRef = useRef<ChatSocket | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);
  const socialDataRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const socialDataRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const socialDataRefreshResolversRef = useRef<Array<() => void>>([]);

  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<User>({ username: "", email: "", avatar: "" });
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupReadStates, setGroupReadStates] = useState<Record<string, Record<string, string>>>({});
  const [activeRoomNicknames, setActiveRoomNicknames] = useState<Record<string, string>>({});
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>("zh-TW");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [emergencySettings, setEmergencySettings] = useState<EmergencySettings>({
    warningEnabled: false,
    warningDays: 0,
    contacts: [],
  });
  const [selectedFriendForSidebar, setSelectedFriendForSidebar] = useState<Friend | null>(null);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);

  const activeRoomId = useMemo(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/);
    return match?.[1] ?? null;
  }, [pathname]);

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setCurrentUserId(undefined);
    setIsAuthenticated(false);
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  const loadMessagesForRooms = async (authToken: string, nextRooms: ChatRoom[], userId?: string) => {
    const roomMessages = await Promise.all(
      nextRooms.map(async (room) => {
        const rows = await listMessages(authToken, room.id, { limit: 50 });
        return rows.reverse().map((message) => mapMessage(message, userId));
      }),
    );
    setMessages(hydrateReplyTargets(roomMessages.flat()));
  };

  const refreshGroupMembersForRooms = async (authToken: string, nextRooms: ChatRoom[]) => {
    const entries = await Promise.all(
      nextRooms.map(async (room) => [room.id, await fetchRoomMembers(authToken, room.id)] as const),
    );
    const membersByRoomId = new Map(entries);
    const nextReadStates = entries.reduce<Record<string, Record<string, string>>>((acc, [roomId, members]) => {
      const roomReads = members.reduce<Record<string, string>>((reads, member) => {
        if (member.lastReadId) {
          reads[member.userId] = member.lastReadId;
        }
        return reads;
      }, {});

      if (Object.keys(roomReads).length > 0) {
        acc[roomId] = roomReads;
      }
      return acc;
    }, {});

    setRooms((current) =>
      current.map((room) =>
        membersByRoomId.has(room.id)
          ? { ...room, members: membersByRoomId.get(room.id) }
          : room,
      ),
    );
    setGroupReadStates((current) => ({ ...current, ...nextReadStates }));
  };

  const refreshRoomsAndFolders = async (authToken: string, userId = currentUserId) => {
    const [apiRooms, apiFolders] = await Promise.all([listRooms(authToken), listFolders(authToken)]);
    const nextRooms = mapRooms(apiRooms, apiFolders, roomsRef.current);

    setFolders((current) => mapFolders(apiFolders, current));
    setRooms(nextRooms);
    void loadMessagesForRooms(authToken, nextRooms, userId);
    void refreshGroupMembersForRooms(authToken, nextRooms);
  };

  const refreshSocialData = async (authToken: string, settings?: UserSettings, userId = currentUserId) => {
    const effectiveUserId = userId ?? user.userId;
    if (!effectiveUserId) return;

    if (socialDataRefreshTimerRef.current) {
      clearTimeout(socialDataRefreshTimerRef.current);
    }

    if (!socialDataRefreshPromiseRef.current) {
      let resolveFn: () => void;
      socialDataRefreshPromiseRef.current = new Promise<void>((resolve) => {
        resolveFn = resolve;
      });
      socialDataRefreshResolversRef.current = [resolveFn!];
    } else {
      let resolveFn: () => void;
      new Promise<void>((resolve) => { resolveFn = resolve; });
      socialDataRefreshResolversRef.current.push(resolveFn!);
    }
    const currentPromise = socialDataRefreshPromiseRef.current;

    socialDataRefreshTimerRef.current = setTimeout(async () => {
      socialDataRefreshTimerRef.current = null;
      socialDataRefreshPromiseRef.current = null;
      const resolvers = socialDataRefreshResolversRef.current;
      socialDataRefreshResolversRef.current = [];

      try {
        const [apiFriends, apiRequests, apiEmergencyContacts, apiBlockedUsers] = await Promise.all([
          listFriends(authToken),
          listFriendRequests(authToken),
          listEmergencyContacts(authToken),
          getBlockedUsers(authToken),
        ]);
        const contacts = apiEmergencyContacts.map(mapEmergencyContact);
        const emergencyContactIds = new Set(contacts.map((contact) => contact.contactId));

        setFriends(apiFriends.map((friend) => mapFriend(friend, emergencyContactIds)));
        setFriendRequests(apiRequests.map((req) => mapFriendRequest(req, effectiveUserId)));
        setBlockedUsers(apiBlockedUsers.map(u => ({ id: u.userId, name: u.name, email: u.email })));
        setEmergencySettings(prev => ({
          warningEnabled: settings?.warningEnabled ?? user.warningEnabled ?? false,
          warningDays: settings?.warningDays ?? user.warningDays ?? 0,
          contacts,
        }));
      } catch (error) {
        console.error("Error refreshing social data:", error);
      } finally {
        resolvers.forEach((resolve) => resolve());
      }
    }, 250);

    return currentPromise;
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage === "zh-TW" || savedLanguage === "en") {
      setUiLanguageState(savedLanguage);
    }

    if (!savedToken) {
      window.location.replace("/login");
      return;
    }

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as StoredUser;
        setUser(parsed);
        setCurrentUserId(parsed.userId);
      } catch (error) {
        console.error(error);
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        const [profile, settings] = await Promise.all([
          getMe(savedToken),
          getMySettings(savedToken),
        ]);
        if (cancelled) return;
        const stored = toStoredUser(profile, settings);
        localStorage.setItem("user", JSON.stringify(stored));
        localStorage.setItem("theme", stored.theme ?? "light");
        localStorage.setItem("notify-desktop", String(stored.notifyDesktop ?? true));
        localStorage.setItem("notify-sound", String(stored.notifySound ?? true));
        document.documentElement.classList.toggle("dark", stored.theme === "dark");
        setUser(stored);
        setCurrentUserId(profile.userId);
        setUiLanguageState(stored.language ?? "en");
        setToken(savedToken);
        setIsAuthenticated(true);
        await Promise.all([
          refreshRoomsAndFolders(savedToken, profile.userId),
          refreshSocialData(savedToken, settings, profile.userId),
        ]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          clearSession();
          window.location.replace("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isMounted]);

  useEffect(() => {
    roomsRef.current = rooms;
    if (socketRef.current?.connected) {
      rooms.forEach((room) => joinRoom(socketRef.current!, room.id));
    }
  }, [rooms]);

  useEffect(() => {
    if (!token) return;

    const socket = createChatSocket(token);
    socketRef.current = socket;

    const joinKnownRooms = () => {
      roomsRef.current.forEach((room) => joinRoom(socket, room.id));
    };

    const cleanupNewMessage = onNewMessage(socket, (payload) => {
      const incoming = mapMessage(payload, currentUserId);
      setMessages((current) => {
        const withoutDuplicate = current.filter((message) => message.id !== incoming.id);
        return hydrateReplyTargets(sortMessages([...withoutDuplicate, incoming]));
      });
      setRooms((current) =>
        current.map((room) =>
          room.id === incoming.roomId
            ? {
                ...room,
                lastMessagePreview: summarizeMessagePreview(incoming),
                lastMessageAt: incoming.timestamp,
              }
            : room,
        ),
      );
    });
    const cleanupRecall = onMessageRecalled(socket, ({ messageId }) => {
      setMessages((current) =>
        hydrateReplyTargets(
          current.map((message) =>
            message.id === messageId ? { ...message, isRecalled: true, content: "" } : message,
          ),
        ),
      );
    });
    const cleanupRead = onReadUpdate(socket, ({ roomId, userId, messageId }) => {
      setGroupReadStates((current) => ({
        ...current,
        [roomId]: {
          ...(current[roomId] ?? {}),
          [userId]: messageId,
        },
      }));
      setRooms((current) =>
        current.map((room) => {
          if (room.id !== roomId || !room.members) return room;

          let memberChanged = false;
          const nextMembers = room.members.map((member) => {
            if (member.userId !== userId || member.lastReadId === messageId) {
              return member;
            }

            memberChanged = true;
            return { ...member, lastReadId: messageId };
          });

          return memberChanged ? { ...room, members: nextMembers } : room;
        }),
      );
    });
    const cleanupTyping = onUserTyping(socket, ({ roomId, userId, isTyping }) => {
      console.debug("typing", { roomId, userId, isTyping });
    });
    const cleanupError = onSocketError(socket, (error) => {
      console.error("Socket error", error);
    });
    const cleanupFriendRequest = onFriendRequest(socket, () => {
      void refreshSocialData(token, undefined, currentUserId);
    });
    const cleanupEmergencyAlert = onEmergencyAlert(socket, (payload) => {
      window.alert(`[EMERGENCY ALERT]\nFrom User: ${payload.userId}\nMessage: ${payload.message}`);
    });

    socket.on("connect", joinKnownRooms);
    socket.connect();

    return () => {
      cleanupNewMessage();
      cleanupRecall();
      cleanupRead();
      cleanupTyping();
      cleanupError();
      cleanupFriendRequest();
      cleanupEmergencyAlert();
      socket.off("connect", joinKnownRooms);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, currentUserId]);

  const toggleFolder = (folderId: string) => {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId ? { ...folder, collapsed: !folder.collapsed } : folder,
      ),
    );
  };

  const handleLogout = () => {
    const authToken = token;
    clearSession();
    if (authToken) {
      void logout(authToken).catch(console.error);
    }
    router.push("/login");
  };

  const handleSendMessage = (roomId: string, content: string, replyTarget: Message | null) => {
    if (!content.trim() || !socketRef.current) return;

    sendMessage(socketRef.current, {
      roomId,
      content,
      replyTo: replyTarget?.id,
    });
  };

  const handleTyping = (roomId: string, isTyping: boolean) => {
    if (!socketRef.current) return;
    sendTyping(socketRef.current, { roomId, isTyping });
  };

  const handleUploadAttachment = async (roomId: string, file: File) => {
    if (!token || !socketRef.current) return;
    const uploaded = await uploadAttachment(token, file);
    sendMessage(socketRef.current, {
      roomId,
      content: formatUploadedAttachmentMessage(uiLanguage, file.name),
      attachmentIds: [uploaded.attachmentId],
    });
  };

  const handleRecallMessage = (msgId: string) => {
    if (!socketRef.current) return;
    recallMessage(socketRef.current, msgId);
  };

  const handleUpdateProfile = async (profile: ProfileInput) => {
    let nextUser: StoredUser = {
      ...user,
      username: profile.username,
      email: profile.email,
      avatar: profile.avatar,
      bio: profile.bio ?? user.bio ?? "",
    };

    if (token) {
      const updatedProfile = await updateMe(token, {
        name: profile.username,
        email: profile.email,
        avatarUrl: profile.avatar,
        bio: profile.bio,
        ...(profile.password ? { password: profile.password } : {}),
      });
      nextUser = { ...nextUser, ...toStoredUser(updatedProfile, {
        language: user.language ?? uiLanguage,
        theme: user.theme ?? "light",
        notifyDesktop: user.notifyDesktop ?? true,
        notifySound: user.notifySound ?? true,
        warningEnabled: user.warningEnabled ?? false,
        warningDays: user.warningDays ?? 14,
      }) };
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const handleUpdatePreferences = async (preferences: PreferencesInput) => {
    const nextWarningEnabled = preferences.warningEnabled ?? user.warningEnabled ?? false;
    const nextWarningDays = preferences.warningDays ?? user.warningDays ?? 0;
    
    let nextUser: StoredUser = {
      ...user,
      language: preferences.language,
      theme: preferences.theme === "dark" ? "dark" : "light",
      notifyDesktop: preferences.notifyDesktop,
      notifySound: preferences.notifySound,
      warningEnabled: nextWarningEnabled,
      warningDays: nextWarningDays,
    };

    if (token) {
      const updatedSettings = await updateMySettings(token, {
        language: preferences.language,
        theme: preferences.theme === "dark" ? "dark" : "light",
        notifyDesktop: preferences.notifyDesktop,
        notifySound: preferences.notifySound,
        ...(preferences.warningEnabled !== undefined ? { warningEnabled: nextWarningEnabled } : {}),
        ...(preferences.warningDays !== undefined ? { warningDays: nextWarningDays } : {}),
      });
      nextUser = { 
        ...nextUser, 
        language: updatedSettings.language as UiLanguage, 
        theme: updatedSettings.theme as "light" | "dark", 
        notifyDesktop: updatedSettings.notifyDesktop, 
        notifySound: updatedSettings.notifySound, 
        warningEnabled: updatedSettings.warningEnabled, 
        warningDays: updatedSettings.warningDays 
      };
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("theme", preferences.theme);
    localStorage.setItem("language", preferences.language);
    localStorage.setItem("notify-desktop", String(preferences.notifyDesktop));
    localStorage.setItem("notify-sound", String(preferences.notifySound));
    document.documentElement.classList.toggle("dark", preferences.theme === "dark");
    setUser(nextUser);
    setUiLanguageState(preferences.language);
    setEmergencySettings((current) => ({
      ...current,
      warningEnabled: nextWarningEnabled,
      warningDays: nextWarningDays,
    }));
  };

  const handleCreateRoom = async (name: string, type: "msg" | "group", folderId: string) => {
    if (!token) return "";

    let created: Room;
    if (type === "group") {
      created = await createGroup(token, { name });
    } else {
      const matches = await searchUsers(token, { query: name });
      const target = matches[0];
      if (!target) {
        throw new Error("No matching user found for private room");
      }
      created = await createPrivateRoom(token, { targetUserId: target.userId });
    }

    await refreshRoomsAndFolders(token);
    if (folderId) {
      await handleCategorizeRoom(created.roomId, folderId);
    }
    return created.roomId;
  };

  const handleOpenPrivateRoom = async (targetUserId: string) => {
    if (!token) return "";
    const room = await createPrivateRoom(token, { targetUserId });
    await refreshRoomsAndFolders(token);
    return room.roomId;
  };

  const handleCreateFolder = async (name: string) => {
    if (!token) return;
    const folder = await createFolder(token, name);
    setFolders((current) => [...current, { id: folder.folderId, name: folder.name, collapsed: false }]);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!token) return;

    await deleteFolderApi(token, folderId);
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setRooms((current) =>
      current.map((room) =>
        room.folderId === folderId ? { ...room, folderId: null } : room,
      ),
    );
  };

  const handleCategorizeRoom = async (roomId: string, folderId: string | null) => {
    if (!token) return;

    const nextFolders = folders.map((folder) => {
      const currentRoomIds = rooms
        .filter((room) => room.folderId === folder.id && room.id !== roomId)
        .map((room) => room.id);
      const roomIds = folder.id === folderId ? [...currentRoomIds, roomId] : currentRoomIds;
      return { folder, roomIds };
    });

    await Promise.all(
      nextFolders.map(({ folder, roomIds }) => updateFolderRooms(token, folder.id, roomIds)),
    );

    setRooms((current) =>
      current.map((room) =>
        room.id === roomId ? { ...room, folderId } : room,
      ),
    );
  };

  const handleModifyNickname = (roomId: string, nickname: string) => {
    setActiveRoomNicknames((current) => ({
      ...current,
      [roomId]: nickname || user.username,
    }));
  };

  const handleLeaveOrBlock = async (roomId: string) => {
    if (!token) return { isDeleted: false };
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return { isDeleted: false };

    if (room.type === "group") {
      await leaveRoomApi(token, roomId);
      const remaining = rooms.filter((item) => item.id !== roomId);
      setRooms(remaining);
      return { isDeleted: true, newActiveId: remaining[0]?.id };
    }

    const newArchived = !room.isArchived;
    if (token) {
      await updateRoom(token, roomId, { isArchived: newArchived });
      const targetUserId = room.members?.find((m) => m.userId !== currentUserId)?.userId;
      if (targetUserId) {
        if (newArchived) {
          await blockUserApi(token, targetUserId).catch(console.error);
        } else {
          await unblockUserApi(token, targetUserId).catch(console.error);
        }
        await refreshSocialData(token).catch(console.error);
      }
    }

    setRooms((current) =>
      current.map((item) =>
        item.id === roomId ? { ...item, isArchived: newArchived } : item,
      ),
    );
    return { isDeleted: false };
  };

  const handleDeleteAccount = async () => {
    if (!token) throw new Error("Not authenticated");
    await deleteMeApi(token);
    handleLogout();
  };

  const loadGroupMembers = async (roomId: string): Promise<Member[]> => {
    if (!token) return [];
    const members = await fetchRoomMembers(token, roomId);
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId ? { ...room, members } : room,
      ),
    );
    return members;
  };

  const saveGroupSettings = async (roomId: string, settings: GroupSettingsInput) => {
    if (!token) return;

    const updated = await updateRoom(token, roomId, {
      name: settings.name,
      requireApproval: settings.requireApproval,
      viewHistory: settings.viewHistory,
    });

    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              name: updated.name ?? settings.name,
              inviteCode: updated.inviteCode,
              requireApproval: updated.requireApproval,
              viewHistory: updated.viewHistory,
              isArchived: updated.isArchived,
            }
          : room,
      ),
    );
  };

  const approveGroupMember = async (roomId: string, userId: string) => {
    if (!token) return;
    await approveRoomMember(token, roomId, userId);
    await loadGroupMembers(roomId);
  };

  const updateGroupMember = async (
    roomId: string,
    userId: string,
    data: { role?: "admin" | "member"; nickname?: string; isMuted?: boolean },
  ) => {
    if (!token) return;
    await updateRoomMember(token, roomId, userId, data);
    await loadGroupMembers(roomId);
  };

  const kickGroupMember = async (roomId: string, userId: string) => {
    if (!token) return;
    await kickRoomMember(token, roomId, userId);
    await loadGroupMembers(roomId);
  };

  const transferGroupOwner = async (roomId: string, userId: string) => {
    if (!token) return;
    await transferRoomOwner(token, roomId, userId);
    await loadGroupMembers(roomId);
  };

  const handleDeleteGroupRoom = async (roomId: string) => {
    if (token) {
      await updateRoom(token, roomId, { isArchived: true });
    }
    const remaining = rooms.filter((room) => room.id !== roomId);
    setRooms(remaining);
    return remaining[0]?.id ?? null;
  };

  const getReadAvatarsForMessage = (room: ChatRoom, msg: Message): string[] => {
    if (room.type !== "group") return [];

    const roomReads = groupReadStates[room.id];
    if (!roomReads) return [];

    return Object.entries(roomReads)
      .filter(([readerId, lastReadId]) => readerId !== currentUserId && lastReadId === msg.id)
      .map(() => "");
  };

  const searchUsersForInvite = async (query: string): Promise<PublicUser[]> => {
    if (!token) throw new Error("Not authenticated");
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchUsers(token, { query: trimmed });
  };

  const handleJoinByInviteCode = async (inviteCode: string): Promise<string> => {
    if (!token) throw new Error("Not authenticated");
    const room = await joinRoomByCode(token, inviteCode.trim());
    await refreshRoomsAndFolders(token);
    return room.roomId;
  };

  const sendFriendRequest = async (query: string) => {
    if (!token) throw new Error("Not authenticated");
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error("Search query is required");

    const matches = await searchUsers(token, { query: trimmedQuery });
    const target = findRequestedUser(matches, trimmedQuery);
    if (!target) {
      throw new Error("No matching user found");
    }

    await sendFriendRequestApi(token, target.userId);
    setFriendRequests((prev) => [
      ...prev,
      {
        id: target.userId,
        name: target.name,
        email: trimmedQuery.includes("@") ? trimmedQuery : "",
        direction: "outgoing",
      },
    ]);
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!token) return;
    const request = friendRequests.find(
      (item) => item.id === requestId && item.direction === "incoming",
    );

    await respondFriendRequest(token, requestId, "accepted");
    if (request) {
      setFriendRequests((prev) => prev.filter((item) => item.id !== requestId));
      setFriends((prev) => {
        if (prev.some((item) => item.id === request.id)) return prev;
        return [
          ...prev,
          {
            id: request.id,
            name: request.name,
            email: request.email,
            status: "offline",
          },
        ];
      });
    }
    await refreshSocialData(token, undefined, currentUserId);
  };

  const rejectFriendRequest = async (requestId: string) => {
    if (!token) return;
    const request = friendRequests.find((item) => item.id === requestId);
    if (request?.direction === "incoming") {
      await respondFriendRequest(token, requestId, "rejected");
    }
    setFriendRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  const removeFriend = async (friendId: string) => {
    if (!token) return;
    await deleteFriend(token, friendId);
    await refreshSocialData(token);
  };

  const blockFriend = async (friendId: string) => {
    if (!token) return;
    const friend = friends.find((item) => item.id === friendId);
    if (!friend) return;

    await blockUserApi(token, friendId);
    setBlockedUsers((prev) => {
      if (prev.some((item) => item.id === friendId)) return prev;
      return [...prev, { id: friend.id, name: friend.name, email: friend.email }];
    });
    await refreshSocialData(token);
  };

  const unblockUser = async (blockedId: string) => {
    if (token) {
      await unblockUserApi(token, blockedId);
    }
    setBlockedUsers((prev) => prev.filter((item) => item.id !== blockedId));
  };

  const saveEmergencySettings = async (settings: EmergencySettings) => {
    if (!token) return;
    const nextWarningDays = settings.warningEnabled ? Math.max(1, settings.warningDays) : 0;

    await updateMySettings(token, {
      warningEnabled: settings.warningEnabled,
      warningDays: nextWarningDays,
    });

    const nextContactIds = new Set(settings.contacts.map((contact) => contact.contactId));
    const removedContacts = emergencySettings.contacts.filter(
      (contact) => !nextContactIds.has(contact.contactId),
    );

    await Promise.all([
      ...settings.contacts.map((contact) =>
        upsertEmergencyContact(token, {
          contactId: contact.contactId,
          message: contact.message,
        }),
      ),
      ...removedContacts.map((contact) => deleteEmergencyContact(token, contact.contactId)),
    ]);

    const updatedSettings: UserSettings = {
      language: user.language ?? uiLanguage,
      theme: user.theme ?? "light",
      notifyDesktop: user.notifyDesktop ?? true,
      notifySound: user.notifySound ?? true,
      warningEnabled: settings.warningEnabled,
      warningDays: nextWarningDays,
    };
    await refreshSocialData(token, updatedSettings);
    setUser((current) => ({
      ...current,
      warningEnabled: updatedSettings.warningEnabled,
      warningDays: updatedSettings.warningDays,
    }));
  };

  const triggerEmergencyAlertNow = async (message?: string): Promise<TriggerEmergencyAlertResult> => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    return triggerEmergencyAlertApi(token, message?.trim() ? message.trim() : undefined);
  };

  const setUiLanguage = (language: UiLanguage) => {
    localStorage.setItem("language", language);
    setUiLanguageState(language);
  };

  useEffect(() => {
    if (!currentUserId) return;

    const messagesByRoom = messages.reduce<Record<string, Message[]>>((acc, message) => {
      (acc[message.roomId] ??= []).push(message);
      return acc;
    }, {});

    setRooms((current) => {
      let changed = false;

      const nextRooms = current.map((room) => {
        const roomMessages = sortMessages(messagesByRoom[room.id] ?? []);
        const latestMessage = roomMessages.at(-1);
        const roomLastReadId =
          groupReadStates[room.id]?.[currentUserId] ??
          room.members?.find((member) => member.userId === currentUserId)?.lastReadId ??
          null;
        const nextUnreadCount =
          activeRoomId === room.id ? 0 : computeUnreadCount(roomMessages, currentUserId, roomLastReadId);
        const nextPreview = latestMessage ? summarizeMessagePreview(latestMessage) : room.lastMessagePreview;
        const nextLastMessageAt = latestMessage ? latestMessage.timestamp : room.lastMessageAt;

        if (
          room.unreadCount === nextUnreadCount &&
          room.lastMessagePreview === nextPreview &&
          room.lastMessageAt === nextLastMessageAt
        ) {
          return room;
        }

        changed = true;
        return {
          ...room,
          unreadCount: nextUnreadCount,
          lastMessagePreview: nextPreview,
          lastMessageAt: nextLastMessageAt,
        };
      });

      return changed ? nextRooms : current;
    });
  }, [activeRoomId, currentUserId, groupReadStates, messages]);

  useEffect(() => {
    if (!socketRef.current || !activeRoomId || !currentUserId) return;

    const activeRoom = roomsRef.current.find((room) => room.id === activeRoomId);
    if (!activeRoom) return;

    const roomMessages = sortMessages(messages.filter((message) => message.roomId === activeRoomId));
    const latestIncoming = [...roomMessages].reverse().find((message) => message.senderId !== currentUserId);
    if (!latestIncoming) return;

    const currentLastReadId =
      groupReadStates[activeRoomId]?.[currentUserId] ??
      activeRoom.members?.find((member) => member.userId === currentUserId)?.lastReadId ??
      null;

    if (currentLastReadId === latestIncoming.id) return;

    sendReadReceipt(socketRef.current, {
      roomId: activeRoomId,
      messageId: latestIncoming.id,
    });

    setGroupReadStates((current) => ({
      ...current,
      [activeRoomId]: {
        ...(current[activeRoomId] ?? {}),
        [currentUserId]: latestIncoming.id,
      },
    }));
  }, [activeRoomId, currentUserId, groupReadStates, messages]);

  const derivedRooms = useMemo(() => {
    return rooms.map((room) => {
      if (room.type === "msg" && room.members && currentUserId) {
        const otherMember = room.members.find((m) => m.userId !== currentUserId);
        if (otherMember) {
          const friend = friends.find((f) => f.id === otherMember.userId);
          return {
            ...room,
            name: friend ? friend.name : (otherMember.name || room.name),
          };
        }
      }
      return room;
    });
  }, [rooms, friends, currentUserId]);

  return (
    <ChatContext.Provider
      value={{
        rooms: derivedRooms,
        folders,
        messages,
        groupReadStates,
        user,
        activeRoomNicknames,
        friends,
        friendRequests,
        blockedUsers,
        emergencySettings,
        uiLanguage,
        isAuthenticated,
        isMounted,
        selectedFriendForSidebar,
        setSelectedFriendForSidebar,
        showRightPanel,
        setShowRightPanel,
        setRooms,
        setFolders,
        setMessages,
        setUser,
        setActiveRoomNicknames,
        toggleFolder,
        handleLogout,
        handleSendMessage,
        handleTyping,
        handleUploadAttachment,
        handleRecallMessage,
        handleUpdateProfile,
        handleUpdatePreferences,
        handleCreateRoom,
        handleOpenPrivateRoom,
        handleCreateFolder,
        handleDeleteFolder,
        handleCategorizeRoom,
        handleModifyNickname,
        handleLeaveOrBlock,
        handleDeleteAccount,
        loadGroupMembers,
        saveGroupSettings,
        approveGroupMember,
        updateGroupMember,
        kickGroupMember,
        transferGroupOwner,
        handleDeleteGroupRoom,
        getReadAvatarsForMessage,
        searchUsersForInvite,
        handleJoinByInviteCode,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        blockFriend,
        unblockUser,
        saveEmergencySettings,
        triggerEmergencyAlertNow,
        setUiLanguage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
