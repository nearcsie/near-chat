"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  attachments?: { filename: string; filetype: string }[];
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
  currentUsername?: string
) => {
  if (currentUsername && username === currentUsername) {
    return currentUserAvatar || "";
  }

  const avatarMap: Record<string, string> = {
    "Alex Chen": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    "Mina Lin": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    "Ray Huang": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
    "Nina Wu": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    "Project Lab": "https://images.unsplash.com/photo-1551434678-e076c223a692?w=100&h=100&fit=crop",
  };

  return avatarMap[username] || "";
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
  handleMockAttachment: (roomId: string, filename: string) => void;
  handleRecallMessage: (msgId: string) => void;
  handleCreateRoom: (name: string, type: "msg" | "group", folderId: string) => string;
  handleCreateFolder: (name: string) => void;
  handleCategorizeRoom: (roomId: string, folderId: string | null) => void;
  handleModifyNickname: (roomId: string, nickname: string) => void;
  handleLeaveOrBlock: (roomId: string) => { isDeleted: boolean; newActiveId?: string };
  handleSavePersonalSettings: (settings: PersonalSettingsInput) => void;
  saveGroupSettings: (roomId: string, settings: GroupSettingsInput) => void;
  handleDeleteGroupRoom: (roomId: string) => string | null;
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

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User>({
    username: "Hank",
    email: "your@email.com",
    avatar: "",
    bio: "Database chat project member",
  });

  const [rooms, setRooms] = useState<ChatRoom[]>([
    {
      id: "1",
      type: "msg",
      name: "Alex Chen",
      isOnline: true,
      isArchived: false,
      unreadCount: 0,
      lastMessagePreview: "Can you review the schema notes?",
      lastMessageAt: "10:18 AM",
    },
    {
      id: "2",
      type: "group",
      name: "Database Project Group 9",
      description: "Course project planning and implementation chat.",
      isPublic: false,
      allowInvite: true,
      allowUpload: true,
      unreadCount: 2,
      lastMessagePreview: "Let's verify frontend and backend separately.",
      lastMessageAt: "Yesterday",
      members: [
        { name: "Hank", role: "owner" },
        { name: "Mina Lin", role: "admin" },
        { name: "Ray Huang", role: "member" },
      ],
    },
    {
      id: "3",
      type: "msg",
      name: "Nina Wu",
      isOnline: false,
      folderId: "study",
      isArchived: false,
      unreadCount: 1,
      lastMessagePreview: "I uploaded the report draft.",
      lastMessageAt: "Mon",
    },
    {
      id: "4",
      type: "group",
      name: "Testing Squad",
      description: "Backend tests, CI, and migration checks.",
      isPublic: false,
      allowInvite: false,
      allowUpload: true,
      folderId: "study",
      unreadCount: 0,
      lastMessagePreview: "Unit tests are green.",
      lastMessageAt: "Tue",
      members: [
        { name: "Hank", role: "owner" },
        { name: "Ray Huang", role: "member" },
      ],
    },
  ]);

  const [folders, setFolders] = useState<Folder[]>([
    { id: "study", name: "Course Work", collapsed: false },
    { id: "life", name: "Personal", collapsed: true },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    { id: "m1-1", roomId: "1", senderName: "Alex Chen", content: "Can you review the schema notes?", timestamp: "10:15 AM" },
    { id: "m1-2", roomId: "1", senderName: "Hank", content: "Yes, I will compare it with the ER diagram.", timestamp: "10:16 AM", isOutgoing: true, isRead: true },
    { id: "m1-3", roomId: "1", senderName: "Alex Chen", content: "Great. Please check the friendship relation too.", timestamp: "10:18 AM" },
    { id: "m2-1", roomId: "2", senderName: "Mina Lin", content: "Frontend and backend should be tested separately before merge.", timestamp: "Yesterday 3:40 PM" },
    { id: "m2-2", roomId: "2", senderName: "Ray Huang", content: "I will keep backend branches unmerged for now.", timestamp: "Yesterday 4:00 PM" },
    { id: "m2-3", roomId: "2", senderName: "Hank", content: "I will finish chat, friends, and emergency contact UI first.", timestamp: "Yesterday 4:10 PM", isOutgoing: true },
    { id: "m3-1", roomId: "3", senderName: "Nina Wu", content: "I uploaded the report draft.", timestamp: "Monday 1:15 PM" },
    { id: "m4-1", roomId: "4", senderName: "Hank", content: "Please keep integration tests isolated from the UI branch.", timestamp: "Tuesday 2:00 PM", isOutgoing: true },
    { id: "m4-2", roomId: "4", senderName: "Ray Huang", content: "Unit tests are green; integration DB still needs migrations.", timestamp: "Tuesday 2:05 PM" },
  ]);

  const [groupReadStates, setGroupReadStates] = useState<Record<string, Record<string, string>>>({
    "2": {
      "Mina Lin": "m2-3",
      "Ray Huang": "m2-3",
    },
    "4": {
      "Ray Huang": "m4-2",
    },
  });

  const [activeRoomNicknames, setActiveRoomNicknames] = useState<Record<string, string>>({});
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>("zh-TW");
  const [friends, setFriends] = useState<Friend[]>([
    { id: "f1", name: "Alex Chen", email: "alex@example.com", status: "online", isEmergencyContact: true },
    { id: "f2", name: "Mina Lin", email: "mina@example.com", status: "online" },
    { id: "f3", name: "Nina Wu", email: "nina@example.com", status: "offline" },
  ]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([
    { id: "r1", name: "Ray Huang", email: "ray@example.com", direction: "incoming" },
    { id: "r2", name: "Course TA", email: "ta@example.com", direction: "outgoing" },
  ]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([
    { id: "b1", name: "Spam Account", email: "spam@example.com" },
  ]);
  const [emergencySettings, setEmergencySettings] = useState<EmergencySettings>({
    warningEnabled: true,
    warningDays: 7,
    contacts: [
      {
        id: "ec1",
        contactId: "f1",
        name: "Alex Chen",
        email: "alex@example.com",
        message: "Hank has been offline for several days. Please check in.",
      },
    ],
  });

  const [selectedFriendForSidebar, setSelectedFriendForSidebar] = useState<Friend | null>(null);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (!token) {
      window.location.replace("/login");
      return;
    }

    setIsAuthenticated(true);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error(error);
      }
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

    const savedTheme = localStorage.getItem("theme");
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, [isMounted]);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const updateRoomPreview = (roomId: string, content: string, timestamp: string, incoming = false) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? {
              ...room,
              lastMessagePreview: content,
              lastMessageAt: timestamp,
              unreadCount: incoming ? (room.unreadCount || 0) + 1 : room.unreadCount || 0,
            }
          : room
      )
    );
  };

  const triggerReadAndReplySimulation = (newMsg: Message) => {
    const room = roomById.get(newMsg.roomId);
    if (!room) return;

    if (room.type === "msg") {
      window.setTimeout(() => {
        setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, isRead: true } : m)));
      }, 1200);
      return;
    }

    const members = room.members?.filter((member) => member.name !== user.username) || [];
    members.forEach((member, index) => {
      window.setTimeout(() => {
        setGroupReadStates((prev) => ({
          ...prev,
          [room.id]: {
            ...(prev[room.id] || {}),
            [member.name]: newMsg.id,
          },
        }));
      }, (index + 1) * 900);
    });
  };

  const toggleFolder = (folderId: string) => {
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f)));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleSendMessage = (roomId: string, content: string, replyTarget: Message | null) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const sender = activeRoomNicknames[roomId] || user.username;
    const timestamp = nowTime();
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId,
      senderName: sender,
      content: trimmed,
      timestamp,
      isOutgoing: true,
      replyTo: replyTarget ? { senderName: replyTarget.senderName, content: replyTarget.content } : null,
    };

    setMessages((prev) => [...prev, newMsg]);
    updateRoomPreview(roomId, trimmed, timestamp);
    triggerReadAndReplySimulation(newMsg);
  };

  const handleMockAttachment = (roomId: string, filename: string) => {
    const sender = activeRoomNicknames[roomId] || user.username;
    const timestamp = nowTime();
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId,
      senderName: sender,
      content: `Uploaded ${filename}`,
      timestamp,
      isOutgoing: true,
      attachments: [{ filename, filetype: filename.split(".").pop() || "unknown" }],
    };

    setMessages((prev) => [...prev, newMsg]);
    updateRoomPreview(roomId, `Uploaded ${filename}`, timestamp);
    triggerReadAndReplySimulation(newMsg);
  };

  const handleRecallMessage = (msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isRecalled: true, content: "" } : m)));
  };

  const handleCreateRoom = (name: string, type: "msg" | "group", folderId: string) => {
    const newId = `room-${Date.now()}`;
    const newRoom: ChatRoom = {
      id: newId,
      type,
      name,
      isOnline: type === "msg" ? true : undefined,
      folderId: folderId || null,
      isArchived: false,
      unreadCount: 0,
      lastMessagePreview: "No messages yet",
      lastMessageAt: "New",
      description: type === "group" ? "New group chat" : undefined,
      isPublic: type === "group" ? false : undefined,
      allowInvite: type === "group" ? true : undefined,
      allowUpload: type === "group" ? true : undefined,
      members: type === "group" ? [{ name: user.username, role: "owner" }] : undefined,
    };

    setRooms((prev) => [...prev, newRoom]);
    return newId;
  };

  const handleCreateFolder = (name: string) => {
    setFolders((prev) => [...prev, { id: `folder-${Date.now()}`, name, collapsed: false }]);
  };

  const handleCategorizeRoom = (roomId: string, folderId: string | null) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, folderId } : r)));
  };

  const handleModifyNickname = (roomId: string, nickname: string) => {
    setActiveRoomNicknames((prev) => ({ ...prev, [roomId]: nickname || user.username }));
  };

  const handleLeaveOrBlock = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { isDeleted: false };

    if (room.type === "group") {
      const remaining = rooms.filter((r) => r.id !== roomId);
      setRooms(remaining);
      return { isDeleted: true, newActiveId: remaining[0]?.id };
    }

    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, isArchived: !r.isArchived } : r)));
    return { isDeleted: false };
  };

  const handleSavePersonalSettings = (settings: PersonalSettingsInput) => {
    const updatedUser: User = {
      username: settings.username,
      email: settings.email,
      avatar: settings.avatar,
      bio: user.bio,
    };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("language", settings.language);
    localStorage.setItem("notify-desktop", String(settings.notifyDesktop));
    localStorage.setItem("notify-sound", String(settings.notifySound));
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    setUser(updatedUser);
    setUiLanguageState(settings.language);
  };

  const saveGroupSettings = (roomId: string, settings: GroupSettingsInput) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              name: settings.name,
              description: settings.description,
              isPublic: settings.isPublic,
              allowInvite: settings.allowInvite,
              allowUpload: settings.allowUpload,
              members: settings.members,
            }
          : r
      )
    );
  };

  const handleDeleteGroupRoom = (roomId: string) => {
    const remaining = rooms.filter((r) => r.id !== roomId);
    setRooms(remaining);
    return remaining[0]?.id || null;
  };

  const getReadAvatarsForMessage = (room: ChatRoom, msg: Message): string[] => {
    if (room.type !== "group") return [];

    const roomReads = groupReadStates[room.id];
    if (!roomReads) return [];

    return Object.entries(roomReads)
      .filter(([memberName, lastReadId]) => memberName !== user.username && memberName !== msg.senderName && lastReadId === msg.id)
      .map(([memberName]) => getAvatarForUser(memberName, user.avatar, user.username));
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
        setRooms,
        setFolders,
        setMessages,
        setUser,
        setActiveRoomNicknames,
        toggleFolder,
        handleLogout,
        handleSendMessage,
        handleMockAttachment,
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
        selectedFriendForSidebar,
        setSelectedFriendForSidebar,
        showRightPanel,
        setShowRightPanel,
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
