"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// --- Types ---
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
}

// --- Helper to map user display names to mock avatars ---
export const getAvatarForUser = (username: string, currentUserAvatar?: string, currentUsername?: string) => {
  if (username === "我" || (currentUsername && username === currentUsername)) {
    return currentUserAvatar || "";
  }
  const avatarMap: Record<string, string> = {
    "陳小明": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    "吳同學": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
    "鄭朋友": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    "李大大": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    "多點鹽不健康餐盒": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop",
    "王同學": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop"
  };
  return avatarMap[username] || "";
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
  handleMockAttachment: (roomId: string, filename: string) => void;
  handleRecallMessage: (msgId: string) => void;
  handleCreateRoom: (name: string, type: "msg" | "group", folderId: string) => string;
  handleCreateFolder: (name: string) => void;
  handleCategorizeRoom: (roomId: string, folderId: string | null) => void;
  handleModifyNickname: (roomId: string, nickname: string) => void;
  handleLeaveOrBlock: (roomId: string) => { isDeleted: boolean; newActiveId?: string };
  handleSavePersonalSettings: (settings: { username: string; email: string; avatar: string; theme: string; notifyDesktop: boolean; notifySound: boolean }) => void;
  saveGroupSettings: (roomId: string, settings: { name: string; description: string; isPublic: boolean; allowInvite: boolean; allowUpload: boolean; members: Member[] }) => void;
  handleDeleteGroupRoom: (roomId: string) => string | null;
  getReadAvatarsForMessage: (room: ChatRoom, msg: Message) => string[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User>({ username: "我", email: "your@email.com", avatar: "" });

  // --- Initial Mock Data States ---
  const [rooms, setRooms] = useState<ChatRoom[]>([
    { id: "1", type: "msg", name: "陳小明", isOnline: true, isArchived: false },
    {
      id: "2",
      type: "group",
      name: "師大資工117",
      description: "隨意聊天的地方",
      isPublic: false,
      allowInvite: true,
      allowUpload: true,
      members: [
        { name: "我", role: "member" },
        { name: "吳同學", role: "owner" },
        { name: "鄭朋友", role: "member" },
      ],
    },
    { id: "3", type: "msg", name: "李大大", isOnline: false, folderId: "study", isArchived: false },
    {
      id: "4",
      type: "group",
      name: "資料庫報告第九組",
      description: "資料庫期末專題小組報告討論區",
      isPublic: false,
      allowInvite: false,
      allowUpload: true,
      folderId: "study",
      members: [
        { name: "我", role: "owner" },
        { name: "王同學", role: "member" },
      ],
    },
    { id: "5", type: "msg", name: "多點鹽不健康餐盒", isOnline: true, folderId: "life", isArchived: false },
  ]);

  const [folders, setFolders] = useState<Folder[]>([
    { id: "study", name: "學業", collapsed: true },
    { id: "life", name: "生活", collapsed: true },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    { id: "m1-1", roomId: "1", senderName: "陳小明", content: "哈囉，你今天會來開會嗎？", timestamp: "10:15 AM" },
    { id: "m1-2", roomId: "1", senderName: "我", content: "會的，我大概下午兩點到。", timestamp: "10:16 AM", isOutgoing: true, isRead: true },
    { id: "m1-3", roomId: "1", senderName: "陳小明", content: "OK，那我們兩點見！", timestamp: "10:18 AM" },

    { id: "m2-1", roomId: "2", senderName: "鄭朋友", content: "這學期的資料庫專題報告要開始分組囉", timestamp: "Yesterday 3:40 PM" },
    { id: "m2-2", roomId: "2", senderName: "吳同學", content: "我們這組已經有三個人了，還缺一個", timestamp: "Yesterday 4:00 PM" },
    { id: "m2-3", roomId: "2", senderName: "我", content: "那我加入你們組好了！", timestamp: "Yesterday 4:10 PM", isOutgoing: true },

    { id: "m3-1", roomId: "3", senderName: "李大大", content: "作業寫完了嗎？", timestamp: "Monday 1:15 PM" },
    { id: "m3-2", roomId: "3", senderName: "我", content: "寫完了，等下傳給你參考。", timestamp: "Monday 1:20 PM", isOutgoing: true, isRead: true },

    { id: "m4-1", roomId: "4", senderName: "我", content: "我們來討論一下資料庫期末報告的題目吧", timestamp: "Tuesday 2:00 PM", isOutgoing: true },
    { id: "m4-2", roomId: "4", senderName: "王同學", content: "好啊，你有什麼想法嗎？", timestamp: "Tuesday 2:05 PM" },

    { id: "m5-1", roomId: "5", senderName: "多點鹽不健康餐盒", content: "您好！今天有限定餐盒：蒜香舒肥雞胸，歡迎訂購！", timestamp: "11:00 AM" },
  ]);

  const [groupReadStates, setGroupReadStates] = useState<Record<string, Record<string, string>>>({
    "2": {
      "吳同學": "m2-3",
      "鄭朋友": "m2-3",
    },
    "4": {
      "王同學": "m4-2",
    },
  });

  const [activeRoomNicknames, setActiveRoomNicknames] = useState<Record<string, string>>({});

  // --- Mount Gate & Auth Check ---
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (!token) {
      window.location.replace("/login");
    } else {
      setIsAuthenticated(true);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isMounted]);

  // --- Simulated Reply Helper ---
  const triggerReadAndReplySimulation = (newMsg: Message) => {
    const roomId = newMsg.roomId;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    if (room.type === "msg") {
      setTimeout(() => {
        setMessages((prevMessages) =>
          prevMessages.map((m) => (m.id === newMsg.id ? { ...m, isRead: true } : m))
        );
      }, 1500);

      setTimeout(() => {
        const recipientName = room.name;
        const replyMsg: Message = {
          id: `m-reply-${Date.now()}`,
          roomId: roomId,
          senderName: recipientName,
          content: `好的，我已經收到您的訊息了！「${newMsg.content.substring(0, 15)}${newMsg.content.length > 15 ? "..." : ""}」`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prevMessages) => [...prevMessages, replyMsg]);
      }, 3000);
    } else {
      const members = room.members || [];
      const nonSelfMembers = members.filter((m) => m.name !== "我" && m.name !== user.username);
      
      if (nonSelfMembers.length > 0) {
        nonSelfMembers.forEach((member, index) => {
          const delay = (index + 1) * 1200;
          setTimeout(() => {
            setGroupReadStates((prev) => {
              const roomReads = prev[roomId] || {};
              return {
                ...prev,
                [roomId]: {
                  ...roomReads,
                  [member.name]: newMsg.id,
                },
              };
            });
          }, delay);
        });

        setTimeout(() => {
          const replyingMember = nonSelfMembers[0].name;
          const replyMsg: Message = {
            id: `m-group-reply-${Date.now()}`,
            roomId: roomId,
            senderName: replyingMember,
            content: `收到！大家加油～`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prevMessages) => [...prevMessages, replyMsg]);
          
          setGroupReadStates((prev) => {
            const roomReads = prev[roomId] || {};
            return {
              ...prev,
              [roomId]: {
                ...roomReads,
                [replyingMember]: replyMsg.id,
              },
            };
          });
        }, 4000);
      }
    }
  };

  // --- Actions ---

  const toggleFolder = (folderId: string) => {
    setFolders(
      folders.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f))
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleSendMessage = (roomId: string, content: string, replyTarget: Message | null) => {
    if (!content.trim()) return;

    const sender = activeRoomNicknames[roomId] || user.username;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId: roomId,
      senderName: sender,
      content: content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      replyTo: replyTarget
        ? { senderName: replyTarget.senderName, content: replyTarget.content }
        : null,
    };

    setMessages((prev) => [...prev, newMsg]);
    triggerReadAndReplySimulation(newMsg);
  };

  const handleMockAttachment = (roomId: string, filename: string) => {
    const sender = activeRoomNicknames[roomId] || user.username;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId: roomId,
      senderName: sender,
      content: `上傳了檔案: ${filename}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      attachments: [{ filename, filetype: filename.split(".").pop() || "unknown" }],
    };

    setMessages((prev) => [...prev, newMsg]);
    triggerReadAndReplySimulation(newMsg);
  };

  const handleRecallMessage = (msgId: string) => {
    setMessages(
      messages.map((m) => (m.id === msgId ? { ...m, isRecalled: true, content: "" } : m))
    );
  };

  const handleCreateRoom = (name: string, type: "msg" | "group", folderId: string) => {
    const newId = `room-${Date.now()}`;
    const newRoom: ChatRoom = {
      id: newId,
      type: type,
      name: name,
      isOnline: type === "msg" ? true : undefined,
      folderId: folderId || null,
      description: type === "group" ? "隨意聊天的地方" : undefined,
      isPublic: type === "group" ? false : undefined,
      allowInvite: type === "group" ? true : undefined,
      allowUpload: type === "group" ? true : undefined,
      members:
        type === "group"
          ? [
              { name: "我", role: "owner" },
              { name: "吳同學", role: "member" },
            ]
          : undefined,
    };

    setRooms([...rooms, newRoom]);
    return newId;
  };

  const handleCreateFolder = (name: string) => {
    const folderId = `folder-${Date.now()}`;
    setFolders([...folders, { id: folderId, name: name, collapsed: false }]);
  };

  const handleCategorizeRoom = (roomId: string, folderId: string | null) => {
    setRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, folderId: folderId } : r))
    );
  };

  const handleModifyNickname = (roomId: string, nickname: string) => {
    setActiveRoomNicknames({
      ...activeRoomNicknames,
      [roomId]: nickname || "我",
    });
  };

  const handleLeaveOrBlock = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { isDeleted: false };

    if (room.type === "group") {
      setRooms(rooms.filter((r) => r.id !== roomId));
      const remaining = rooms.filter((r) => r.id !== roomId);
      return { isDeleted: true, newActiveId: remaining.length > 0 ? remaining[0].id : undefined };
    } else {
      setRooms(
        rooms.map((r) => (r.id === roomId ? { ...r, isArchived: !r.isArchived } : r))
      );
      return { isDeleted: false };
    }
  };

  const handleSavePersonalSettings = (settings: {
    username: string;
    email: string;
    avatar: string;
    theme: string;
    notifyDesktop: boolean;
    notifySound: boolean;
  }) => {
    const updatedUser = {
      username: settings.username,
      email: settings.email,
      avatar: settings.avatar,
      bio: "隨意聊天的地方",
    };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("notify-desktop", String(settings.notifyDesktop));
    localStorage.setItem("notify-sound", String(settings.notifySound));

    setUser(updatedUser);
  };

  const saveGroupSettings = (roomId: string, settings: {
    name: string;
    description: string;
    isPublic: boolean;
    allowInvite: boolean;
    allowUpload: boolean;
    members: Member[];
  }) => {
    setRooms(
      rooms.map((r) =>
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
    setRooms(rooms.filter((r) => r.id !== roomId));
    const remaining = rooms.filter((r) => r.id !== roomId);
    return remaining.length > 0 ? remaining[0].id : null;
  };

  const getReadAvatarsForMessage = (room: ChatRoom, msg: Message): string[] => {
    if (room.type !== "group") return [];
    
    const roomReads = groupReadStates[room.id];
    if (!roomReads) return [];
    
    const avatars: string[] = [];
    Object.entries(roomReads).forEach(([memberName, lastReadId]) => {
      if (memberName === "我" || memberName === user.username) return;
      if (memberName === msg.senderName) return;
      
      if (lastReadId === msg.id) {
        const avatarUrl = getAvatarForUser(memberName, user.avatar, user.username);
        avatars.push(avatarUrl);
      }
    });
    return avatars;
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
