"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Attachment as ApiAttachment,
  Folder as ApiFolder,
  MessageWithSender,
  MyProfile,
  Room,
  RoomSummary,
  UserSettings,
} from "@shared/types";
import {
  attachmentDownloadUrl,
  createFolder,
  createGroup,
  createPrivateRoom,
  getMe,
  getMySettings,
  leaveRoom as leaveRoomApi,
  listFolders,
  listMessages,
  listRooms,
  logout,
  searchUsers,
  updateFolderRooms,
  updateMe,
  updateMySettings,
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
  language?: string;
  warningEnabled?: boolean;
  warningDays?: number;
}

type StoredUser = User;

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

interface ChatContextType {
  rooms: ChatRoom[];
  folders: Folder[];
  messages: Message[];
  groupReadStates: Record<string, Record<string, string>>;
  user: User;
  activeRoomNicknames: Record<string, string>;
  isAuthenticated: boolean;
  isMounted: boolean;

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
  handleSavePersonalSettings: (settings: {
    username: string;
    email: string;
    avatar: string;
    theme: string;
    notifyDesktop: boolean;
    notifySound: boolean;
    language: string;
    warningEnabled: boolean;
    warningDays: number;
  }) => Promise<void>;
  saveGroupSettings: (roomId: string, settings: {
    name: string;
    description: string;
    isPublic: boolean;
    allowInvite: boolean;
    allowUpload: boolean;
    members: Member[];
  }) => Promise<void>;
  handleDeleteGroupRoom: (roomId: string) => Promise<string | null>;
  getReadAvatarsForMessage: (room: ChatRoom, msg: Message) => string[];
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
  language: settings?.language ?? "en",
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
    description: room.inviteCode ? `Invite code: ${room.inviteCode}` : undefined,
    isPublic: !room.requireApproval,
    allowInvite: Boolean(room.inviteCode),
    allowUpload: true,
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

  const handleSavePersonalSettings = async (settings: {
    username: string;
    email: string;
    avatar: string;
    theme: string;
    notifyDesktop: boolean;
    notifySound: boolean;
    language: string;
    warningEnabled: boolean;
    warningDays: number;
  }) => {
    let nextUser: StoredUser = {
      userId: currentUserId,
      username: settings.username,
      email: settings.email,
      avatar: settings.avatar,
      bio: user.bio ?? "",
      language: settings.language,
      warningEnabled: settings.warningEnabled,
      warningDays: settings.warningDays,
    };

    if (token) {
      const [updatedProfile, updatedSettings] = await Promise.all([
        updateMe(token, {
          name: settings.username,
          avatarUrl: settings.avatar,
        }),
        updateMySettings(token, {
          language: settings.language,
          warningEnabled: settings.warningEnabled,
          warningDays: settings.warningDays,
        }),
      ]);
      nextUser = toStoredUser(updatedProfile, updatedSettings);
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("notify-desktop", String(settings.notifyDesktop));
    localStorage.setItem("notify-sound", String(settings.notifySound));
    setUser(nextUser);
  };

  const saveGroupSettings = async (roomId: string, settings: {
    name: string;
    description: string;
    isPublic: boolean;
    allowInvite: boolean;
    allowUpload: boolean;
    members: Member[];
  }) => {
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
        isAuthenticated,
        isMounted,
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
