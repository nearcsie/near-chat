"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Folder as ApiFolder,
  MessageWithSender,
  PublicUser,
  Room,
  RoomSummary,
} from "@shared/types";
import {
  attachmentDownloadUrl,
  createFolder,
  createGroup,
  createPrivateRoom,
  getMe,
  leaveRoom as leaveRoomApi,
  listFolders,
  listMessages,
  listRooms,
  logout,
  searchUsers,
  updateFolderRooms,
  updateMe,
  updateRoom,
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
  name: string;
  role: "owner" | "admin" | "member";
  isMuted?: boolean;
}

export interface ChatRoom {
  id: string;
  type: "msg" | "group";
  name: string;
  isOnline?: boolean;
  folderId?: string | null;
  description?: string;
  isPublic?: boolean;
  allowInvite?: boolean;
  allowUpload?: boolean;
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
  username: string;
  email: string;
  avatar: string;
  bio?: string;
}

type StoredUser = User & { userId?: string };

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
}

interface GroupSettingsInput {
  name: string;
  description: string;
  isPublic: boolean;
  allowInvite: boolean;
  allowUpload: boolean;
  members: Member[];
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
  handleCreateFolder: (name: string) => Promise<void>;
  handleCategorizeRoom: (roomId: string, folderId: string | null) => Promise<void>;
  handleModifyNickname: (roomId: string, nickname: string) => void;
  handleLeaveOrBlock: (roomId: string) => Promise<{ isDeleted: boolean; newActiveId?: string }>;
  handleSavePersonalSettings: (settings: PersonalSettingsInput) => Promise<void>;
  saveGroupSettings: (roomId: string, settings: GroupSettingsInput) => Promise<void>;
  handleDeleteGroupRoom: (roomId: string) => Promise<string | null>;
  getReadAvatarsForMessage: (room: ChatRoom, msg: Message) => string[];

  sendFriendRequest: (name: string, email: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  removeFriend: (friendId: string) => void;
  blockFriend: (friendId: string) => void;
  unblockUser: (blockedId: string) => void;
  saveEmergencySettings: (settings: EmergencySettings) => void;
  setUiLanguage: (language: UiLanguage) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const toStoredUser = (user: PublicUser, email = ""): StoredUser => ({
  userId: user.userId,
  username: user.name,
  email,
  avatar: user.avatarUrl ?? "",
});

const formatMessageTime = (value: Date | string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const mapAttachment = (fileUrl: string) => {
  const url = attachmentDownloadUrl(fileUrl);
  const filename = decodeURIComponent(fileUrl.split("/").filter(Boolean).at(-1) ?? "attachment");
  return {
    filename,
    filetype: filename.includes(".") ? filename.split(".").pop() ?? "file" : "file",
    url,
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
    description: room.inviteCode ? `Invite code: ${room.inviteCode}` : undefined,
    isPublic: !room.requireApproval,
    allowInvite: Boolean(room.inviteCode),
    allowUpload: true,
    isArchived: room.isArchived || room.isReadonly,
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

const sortMessages = (items: Message[]) =>
  [...items].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const socketRef = useRef<ChatSocket | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);

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
    warningDays: 7,
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

  const refreshRoomsAndFolders = async (authToken: string, userId = currentUserId) => {
    const [apiRooms, apiFolders] = await Promise.all([listRooms(authToken), listFolders(authToken)]);
    setFolders((current) => mapFolders(apiFolders, current));
    setRooms((current) => {
      const nextRooms = mapRooms(apiRooms, apiFolders, current);
      void loadMessagesForRooms(authToken, nextRooms, userId);
      return nextRooms;
    });
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

    const savedEmergency = localStorage.getItem("emergency-settings");
    if (savedEmergency) {
      try {
        setEmergencySettings(JSON.parse(savedEmergency));
      } catch (error) {
        console.error(error);
      }
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
        const profile = await getMe(savedToken);
        if (cancelled) return;
        const stored = toStoredUser(profile, savedUser ? (JSON.parse(savedUser) as StoredUser).email : "");
        localStorage.setItem("user", JSON.stringify(stored));
        setUser(stored);
        setCurrentUserId(profile.userId);
        setToken(savedToken);
        setIsAuthenticated(true);
        await refreshRoomsAndFolders(savedToken, profile.userId);
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
      attachments: [uploaded.attachmentId],
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

    setRooms((current) =>
      current.map((item) =>
        item.id === roomId ? { ...item, isArchived: !item.isArchived } : item,
      ),
    );
    return { isDeleted: false };
  };

  const handleSavePersonalSettings = async (settings: PersonalSettingsInput) => {
    let nextUser: StoredUser = {
      username: settings.username,
      email: settings.email,
      avatar: settings.avatar,
      userId: currentUserId,
    };

    if (token) {
      const updated = await updateMe(token, {
        name: settings.username,
        avatarUrl: settings.avatar,
      });
      nextUser = toStoredUser(updated, settings.email);
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("language", settings.language);
    localStorage.setItem("notify-desktop", String(settings.notifyDesktop));
    localStorage.setItem("notify-sound", String(settings.notifySound));
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    setUser(nextUser);
    setUiLanguageState(settings.language);
  };

  const saveGroupSettings = async (roomId: string, settings: GroupSettingsInput) => {
    if (token) {
      await updateRoom(token, roomId, {
        name: settings.name,
        requireApproval: !settings.isPublic,
      });
    }

    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              name: settings.name,
              description: settings.description,
              isPublic: settings.isPublic,
              allowInvite: settings.allowInvite,
              allowUpload: settings.allowUpload,
              members: settings.members,
            }
          : room,
      ),
    );
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

  const sendFriendRequest = (name: string, email: string) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;

    setFriendRequests((prev) => [
      ...prev,
      {
        id: `req-${Date.now()}`,
        name: trimmedName,
        email: trimmedEmail,
        direction: "outgoing",
      },
    ]);
  };

  const acceptFriendRequest = (requestId: string) => {
    const request = friendRequests.find((item) => item.id === requestId);
    if (!request) return;

    setFriends((prev) => [
      ...prev,
      {
        id: `friend-${Date.now()}`,
        name: request.name,
        email: request.email,
        status: "online",
      },
    ]);
    setFriendRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  const rejectFriendRequest = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  const removeFriend = (friendId: string) => {
    setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
    setEmergencySettings((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((contact) => contact.contactId !== friendId),
    }));
  };

  const blockFriend = (friendId: string) => {
    const friend = friends.find((item) => item.id === friendId);
    if (!friend) return;

    setBlockedUsers((prev) => [...prev, { id: `blocked-${Date.now()}`, name: friend.name, email: friend.email }]);
    removeFriend(friendId);
  };

  const unblockUser = (blockedId: string) => {
    setBlockedUsers((prev) => prev.filter((item) => item.id !== blockedId));
  };

  const saveEmergencySettings = (settings: EmergencySettings) => {
    localStorage.setItem("emergency-settings", JSON.stringify(settings));
    setEmergencySettings(settings);
    setFriends((prev) =>
      prev.map((friend) => ({
        ...friend,
        isEmergencyContact: settings.contacts.some((contact) => contact.contactId === friend.id),
      }))
    );
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

  return (
    <ChatContext.Provider
      value={{
        rooms,
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
        handleCreateFolder,
        handleCategorizeRoom,
        handleModifyNickname,
        handleLeaveOrBlock,
        handleSavePersonalSettings,
        saveGroupSettings,
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
