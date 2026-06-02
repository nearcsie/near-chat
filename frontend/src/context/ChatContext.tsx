"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  getBlockedUsers,
  getMe,
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
  senderName: string;
  content: string;
  timestamp: string;
  isOutgoing?: boolean;
  isRecalled?: boolean;
  replyTo?: {
    senderName: string;
    content: string;
  } | null;
  attachments?: { filename: string; filetype: string; url?: string }[];
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

interface PersonalSettingsInput {
  username: string;
  email: string;
  avatar: string;
  theme: string;
  language: UiLanguage;
  notifyDesktop: boolean;
  notifySound: boolean;
  password?: string;
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
  handleCreateRoom: (name: string, type: "msg" | "group", folderId: string) => Promise<string>;
  handleOpenPrivateRoom: (targetUserId: string) => Promise<string>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleCategorizeRoom: (roomId: string, folderId: string | null) => Promise<void>;
  handleModifyNickname: (roomId: string, nickname: string) => void;
  handleLeaveOrBlock: (roomId: string) => Promise<{ isDeleted: boolean; newActiveId?: string }>;
  handleSavePersonalSettings: (settings: PersonalSettingsInput) => Promise<void>;
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

  sendFriendRequest: (query: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockFriend: (friendId: string) => Promise<void>;
  unblockUser: (blockedId: string) => Promise<void>;
  saveEmergencySettings: (settings: EmergencySettings) => Promise<void>;
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

const mapMessage = (message: MessageWithSender, currentUserId?: string): Message => ({
  id: message.messageId,
  roomId: message.roomId,
  senderName: message.sender?.name ?? "Deleted User",
  content: message.content,
  timestamp: formatMessageTime(message.sentAt),
  isOutgoing: Boolean(currentUserId && message.senderId === currentUserId),
  isRecalled: message.isRecalled,
  replyTo: null,
  attachments: message.attachments?.map(mapAttachment) ?? [],
});

const mapRooms = (
  apiRooms: RoomSummary[],
  apiFolders: ApiFolder[],
  currentRooms: ChatRoom[],
): ChatRoom[] => {
  const collapsedById = new Map(currentRooms.map((room) => [room.id, room.folderId]));
  const folderByRoom = new Map<string, string>();
  for (const folder of apiFolders) {
    for (const roomId of folder.roomIds) {
      folderByRoom.set(roomId, folder.folderId);
    }
  }

  return apiRooms.map((room) => ({
    id: room.roomId,
    type: room.type === "group" ? "group" : "msg",
    name: room.name || `Private ${room.roomId.slice(0, 8)}`,
    folderId: folderByRoom.get(room.roomId) ?? collapsedById.get(room.roomId) ?? null,
    inviteCode: room.inviteCode,
    requireApproval: room.requireApproval,
    viewHistory: room.viewHistory,
    isArchived: room.isArchived,
    members: room.type === "group" ? [] : undefined,
  }));
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

const mapFriend = (item: FriendResponse, emergencyContactIds: Set<string>): Friend => ({
  id: item.friend.userId,
  name: item.friend.name,
  email: "",
  status: "offline",
  isEmergencyContact: emergencyContactIds.has(item.friend.userId),
});

const mapFriendRequest = (item: FriendRequestResponse): FriendRequest => {
  const requester = item.requester;
  return {
    id: item.requesterId,
    name: requester?.name ?? item.requesterId,
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
  name: member.nickname || profile?.name || member.userId,
  role: member.role,
  nickname: member.nickname,
  isMuted: member.isMuted,
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
  [...items].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    setMessages(roomMessages.flat());
  };

  const refreshGroupMembersForRooms = async (authToken: string, nextRooms: ChatRoom[]) => {
    const entries = await Promise.all(
      nextRooms.map(async (room) => [room.id, await fetchRoomMembers(authToken, room.id)] as const),
    );
    const membersByRoomId = new Map(entries);

    setRooms((current) =>
      current.map((room) =>
        membersByRoomId.has(room.id)
          ? { ...room, members: membersByRoomId.get(room.id) }
          : room,
      ),
    );
  };

  const refreshRoomsAndFolders = async (authToken: string, userId = currentUserId) => {
    const [apiRooms, apiFolders] = await Promise.all([listRooms(authToken), listFolders(authToken)]);
    const nextRooms = mapRooms(apiRooms, apiFolders, roomsRef.current);

    setFolders((current) => mapFolders(apiFolders, current));
    setRooms(nextRooms);
    void loadMessagesForRooms(authToken, nextRooms, userId);
    void refreshGroupMembersForRooms(authToken, nextRooms);
  };

  const refreshSocialData = async (authToken: string, settings?: UserSettings) => {
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
      const p = new Promise<void>((resolve) => { resolveFn = resolve; });
      socialDataRefreshResolversRef.current.push(resolveFn!);
      // We still return the single promise that represents the batch,
      // but wait, if we push a new resolver, we should make sure we return a promise 
      // that resolves when THIS specific call resolves. 
      // It's easier to just return the shared promise:
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
        setFriendRequests(apiRequests.map(mapFriendRequest));
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
          refreshSocialData(savedToken, settings),
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
        return sortMessages([...withoutDuplicate, incoming]);
      });
    });
    const cleanupRecall = onMessageRecalled(socket, ({ messageId }) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, isRecalled: true, content: "" } : message,
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
    });
    const cleanupTyping = onUserTyping(socket, ({ roomId, userId, isTyping }) => {
      console.debug("typing", { roomId, userId, isTyping });
    });
    const cleanupError = onSocketError(socket, (error) => {
      console.error("Socket error", error);
    });

    socket.on("connect", joinKnownRooms);
    socket.connect();

    return () => {
      cleanupNewMessage();
      cleanupRecall();
      cleanupRead();
      cleanupTyping();
      cleanupError();
      socket.off("connect", joinKnownRooms);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, currentUserId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

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
      content: `Uploaded ${file.name}`,
      attachmentIds: [uploaded.attachmentId],
    });
  };

  const handleRecallMessage = (msgId: string) => {
    if (!socketRef.current) return;
    recallMessage(socketRef.current, msgId);
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

  const handleSavePersonalSettings = async (settings: PersonalSettingsInput) => {
    const nextWarningEnabled = settings.warningEnabled ?? user.warningEnabled ?? false;
    const nextWarningDays = settings.warningDays ?? user.warningDays ?? 0;
    let nextUser: StoredUser = {
      userId: currentUserId,
      username: settings.username,
      email: settings.email,
      avatar: settings.avatar,
      bio: user.bio ?? "",
      language: settings.language,
      theme: settings.theme === "dark" ? "dark" : "light",
      notifyDesktop: settings.notifyDesktop,
      notifySound: settings.notifySound,
      warningEnabled: nextWarningEnabled,
      warningDays: nextWarningDays,
    };

    if (token) {
      const [updatedProfile, updatedSettings] = await Promise.all([
        updateMe(token, {
          name: settings.username,
          email: settings.email,
          avatarUrl: settings.avatar,
          ...(settings.password ? { password: settings.password } : {}),
        }),
        updateMySettings(token, {
          language: settings.language,
          theme: settings.theme === "dark" ? "dark" : "light",
          notifyDesktop: settings.notifyDesktop,
          notifySound: settings.notifySound,
          ...(settings.warningEnabled !== undefined ? { warningEnabled: nextWarningEnabled } : {}),
          ...(settings.warningDays !== undefined ? { warningDays: nextWarningDays } : {}),
        }),
      ]);
      nextUser = toStoredUser(updatedProfile, updatedSettings);
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("language", settings.language);
    localStorage.setItem("notify-desktop", String(settings.notifyDesktop));
    localStorage.setItem("notify-sound", String(settings.notifySound));
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    setUser(nextUser);
    setUiLanguageState(settings.language);
    setEmergencySettings((current) => ({
      ...current,
      warningEnabled: nextUser.warningEnabled ?? false,
      warningDays: nextUser.warningDays ?? 0,
    }));
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
    await respondFriendRequest(token, requestId, "accepted");
    await refreshSocialData(token);
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

  const setUiLanguage = (language: UiLanguage) => {
    localStorage.setItem("language", language);
    setUiLanguageState(language);
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage && socketRef.current && !lastMessage.isOutgoing) {
      sendReadReceipt(socketRef.current, {
        roomId: lastMessage.roomId,
        messageId: lastMessage.id,
      });
    }
  }, [messages]);

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
        handleCreateRoom,
        handleOpenPrivateRoom,
        handleCreateFolder,
        handleCategorizeRoom,
        handleModifyNickname,
        handleLeaveOrBlock,
        handleSavePersonalSettings,
        loadGroupMembers,
        saveGroupSettings,
        approveGroupMember,
        updateGroupMember,
        kickGroupMember,
        transferGroupOwner,
        handleDeleteGroupRoom,
        getReadAvatarsForMessage,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        blockFriend,
        unblockUser,
        saveEmergencySettings,
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
