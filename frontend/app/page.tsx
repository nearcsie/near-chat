"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/ui/ChatBubble";

// --- Types ---
interface Member {
  name: string;
  role: "owner" | "admin" | "member";
  isMuted?: boolean;
}

interface ChatRoom {
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
  isArchived?: boolean; // For blocked DMs or archived rooms
}

interface Message {
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

export default function MainPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({ username: "我", email: "your@email.com", avatar: "" });

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

  const [folders, setFolders] = useState([
    { id: "study", name: "學業", collapsed: true },
    { id: "life", name: "生活", collapsed: true },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    // Room 1 (陳小明)
    { id: "m1-1", roomId: "1", senderName: "陳小明", content: "哈囉，你今天會來開會嗎？", timestamp: "10:15 AM" },
    { id: "m1-2", roomId: "1", senderName: "我", content: "會的，我大概下午兩點到。", timestamp: "10:16 AM", isOutgoing: true, isRead: true },
    { id: "m1-3", roomId: "1", senderName: "陳小明", content: "OK，那我們兩點見！", timestamp: "10:18 AM" },

    // Room 2 (師大資工117)
    { id: "m2-1", roomId: "2", senderName: "鄭朋友", content: "這學期的資料庫專題報告要開始分組囉", timestamp: "Yesterday 3:40 PM" },
    { id: "m2-2", roomId: "2", senderName: "吳同學", content: "我們這組已經有三個人了，還缺一個", timestamp: "Yesterday 4:00 PM" },
    { id: "m2-3", roomId: "2", senderName: "我", content: "那我加入你們組好了！", timestamp: "Yesterday 4:10 PM", isOutgoing: true },

    // Room 3 (李大大)
    { id: "m3-1", roomId: "3", senderName: "李大大", content: "作業寫完了嗎？", timestamp: "Monday 1:15 PM" },
    { id: "m3-2", roomId: "3", senderName: "我", content: "寫完了，等下傳給你參考。", timestamp: "Monday 1:20 PM", isOutgoing: true, isRead: true },

    // Room 4 (資料庫報告第九組)
    { id: "m4-1", roomId: "4", senderName: "我", content: "我們來討論一下資料庫期末報告的題目吧", timestamp: "Tuesday 2:00 PM", isOutgoing: true },
    { id: "m4-2", roomId: "4", senderName: "王同學", content: "好啊，你有什麼想法嗎？", timestamp: "Tuesday 2:05 PM" },

    // Room 5 (多點鹽不健康餐盒)
    { id: "m5-1", roomId: "5", senderName: "多點鹽不健康餐盒", content: "您好！今天有限定餐盒：蒜香舒肥雞胸，歡迎訂購！", timestamp: "11:00 AM" },
  ]);

  // --- Watermark Group Read States ---
  // Tracks the last read message ID for each group member in each group room
  const [groupReadStates, setGroupReadStates] = useState<Record<string, Record<string, string>>>({
    "2": {
      "吳同學": "m2-3",
      "鄭朋友": "m2-3",
    },
    "4": {
      "王同學": "m4-2",
    },
  });

  // --- Active Chat Room State ---
  const [activeRoomId, setActiveRoomId] = useState<string>("1");
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

  // --- View States ---
  const [activeView, setActiveView] = useState<"chat" | "personal-settings" | "group-settings">("chat");

  // --- Personal Settings States (embedded) ---
  const [personalUsername, setPersonalUsername] = useState("我");
  const [personalEmail, setPersonalEmail] = useState("your@email.com");
  const [personalAvatar, setPersonalAvatar] = useState("");
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [personalTheme, setPersonalTheme] = useState("light");
  const [personalLanguage, setPersonalLanguage] = useState("zh-TW");
  const [personalNewPassword, setPersonalNewPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [personalSuccessMsg, setPersonalSuccessMsg] = useState("");
  const [personalErrorMsg, setPersonalErrorMsg] = useState("");

  // --- Interactive UI States ---
  const [inputText, setInputText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  
  // Modals / Dropdowns
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  // Nickname change in active room
  const [activeRoomNicknames, setActiveRoomNicknames] = useState<Record<string, string>>({});

  // Create room form
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"msg" | "group">("msg");
  const [newRoomFolder, setNewRoomFolder] = useState<string>("");

  // Create folder form
  const [newFolderName, setNewFolderName] = useState("");

  // Group settings temporary save states
  const [groupSettingsName, setGroupSettingsName] = useState("");
  const [groupSettingsDesc, setGroupSettingsDesc] = useState("");
  const [groupSettingsPublic, setGroupSettingsPublic] = useState(false);
  const [groupSettingsInvite, setGroupSettingsInvite] = useState(false);
  const [groupSettingsUpload, setGroupSettingsUpload] = useState(false);
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<Member[]>([]);

  // Ref for auto scroll messages
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Helper to determine who read this message in the group (Messenger style)
  const getReadAvatarsForMessage = (msg: Message): string[] => {
    if (activeRoom.type !== "group") return [];
    
    const roomReads = groupReadStates[activeRoom.id];
    if (!roomReads) return [];
    
    const avatars: string[] = [];
    Object.entries(roomReads).forEach(([memberName, lastReadId]) => {
      // Messenger shows other group members who read this message.
      if (memberName === "我" || memberName === user.username) return;
      // Don't show the member's avatar on their own message.
      if (memberName === msg.senderName) return;
      
      if (lastReadId === msg.id) {
        const avatarUrl = getAvatarForUser(memberName, user.avatar, user.username);
        avatars.push(avatarUrl);
      }
    });
    return avatars;
  };

  // Simulate read status update and automatic incoming replies (simulation only)
  const triggerReadAndReplySimulation = (newMsg: Message) => {
    const roomId = newMsg.roomId;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    if (room.type === "msg") {
      // 1. Simulate recipient reading the DM message after 1.5s
      setTimeout(() => {
        setMessages((prevMessages) =>
          prevMessages.map((m) => (m.id === newMsg.id ? { ...m, isRead: true } : m))
        );
      }, 1500);

      // 2. Simulate recipient replying after 3.0s
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
      // Group room
      const members = room.members || [];
      const nonSelfMembers = members.filter((m) => m.name !== "我" && m.name !== user.username);
      
      if (nonSelfMembers.length > 0) {
        // 1. Simulate group members reading the message one-by-one with staggered timers
        nonSelfMembers.forEach((member, index) => {
          const delay = (index + 1) * 1200; // e.g. 1.2s, 2.4s...
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

        // 2. Simulate a group member replying after 4.0s
        setTimeout(() => {
          const replyingMember = nonSelfMembers[0].name; // choose first non-self member
          const replyMsg: Message = {
            id: `m-group-reply-${Date.now()}`,
            roomId: roomId,
            senderName: replyingMember,
            content: `收到！大家加油～`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prevMessages) => [...prevMessages, replyMsg]);
          
          // Also immediately advance this member's watermark to this new message so they have read it!
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

  // --- Mount Gate ---
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Check Auth ---
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

    // Apply saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isMounted]);

  // Scroll to bottom when room or messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRoomId, messages]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground font-sans">
        載入中...
      </div>
    );
  }

  // --- Actions ---

  // Folder Collapsing
  const toggleFolder = (folderId: string) => {
    setFolders(
      folders.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f))
    );
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  // Send Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId: activeRoom.id,
      senderName: activeRoomNicknames[activeRoom.id] || user.username,
      content: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      replyTo: replyTarget
        ? { senderName: replyTarget.senderName, content: replyTarget.content }
        : null,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setReplyTarget(null);
    triggerReadAndReplySimulation(newMsg);
  };

  // Mock upload attachments
  const handleMockAttachment = () => {
    const filename = prompt("請輸入擬真上傳檔案名稱：", "報告大綱.pdf");
    if (!filename) return;

    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId: activeRoom.id,
      senderName: activeRoomNicknames[activeRoom.id] || user.username,
      content: `上傳了檔案: ${filename}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      attachments: [{ filename, filetype: filename.split(".").pop() || "unknown" }],
    };

    setMessages((prev) => [...prev, newMsg]);
    triggerReadAndReplySimulation(newMsg);
  };

  // Recall Message
  const handleRecallMessage = (msgId: string) => {
    setMessages(
      messages.map((m) => (m.id === msgId ? { ...m, isRecalled: true, content: "" } : m))
    );
  };

  // Create Chat Room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newId = `room-${Date.now()}`;
    const newRoom: ChatRoom = {
      id: newId,
      type: newRoomType,
      name: newRoomName,
      isOnline: newRoomType === "msg" ? true : undefined,
      folderId: newRoomFolder || null,
      description: newRoomType === "group" ? "隨意聊天的地方" : undefined,
      isPublic: newRoomType === "group" ? false : undefined,
      allowInvite: newRoomType === "group" ? true : undefined,
      allowUpload: newRoomType === "group" ? true : undefined,
      members:
        newRoomType === "group"
          ? [
              { name: "我", role: "owner" },
              { name: "吳同學", role: "member" },
            ]
          : undefined,
    };

    setRooms([...rooms, newRoom]);
    setActiveRoomId(newId);
    setNewRoomName("");
    setNewRoomFolder("");
    setIsCreateRoomOpen(false);
  };

  // Create Folder
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const folderId = `folder-${Date.now()}`;
    setFolders([...folders, { id: folderId, name: newFolderName, collapsed: false }]);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  // Modify local nickname in active room
  const handleModifyNickname = () => {
    const currentNick = activeRoomNicknames[activeRoom.id] || "我";
    const nick = prompt("修改您的聊天室暱稱：", currentNick);
    if (nick !== null) {
      setActiveRoomNicknames({
        ...activeRoomNicknames,
        [activeRoom.id]: nick || "我",
      });
    }
  };

  // Leave / Block
  const handleLeaveOrBlock = () => {
    if (activeRoom.type === "group") {
      if (confirm(`確定要退出群組「${activeRoom.name}」嗎？`)) {
        setRooms(rooms.filter((r) => r.id !== activeRoom.id));
        // Reset to first room
        const remaining = rooms.filter((r) => r.id !== activeRoom.id);
        if (remaining.length > 0) setActiveRoomId(remaining[0].id);
      }
    } else {
      const action = activeRoom.isArchived ? "解除封鎖" : "封鎖";
      if (confirm(`確定要${action}「${activeRoom.name}」嗎？`)) {
        setRooms(
          rooms.map((r) => (r.id === activeRoom.id ? { ...r, isArchived: !r.isArchived } : r))
        );
      }
    }
  };

  // Helper to change room and close settings
  const selectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setActiveView("chat");
  };

  // Open Personal Settings Helper
  const openPersonalSettings = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setPersonalUsername(u.username || "我");
        setPersonalEmail(u.email || "your@email.com");
        setPersonalAvatar(u.avatar || "");
      } catch (e) {
        console.error(e);
      }
    } else {
      setPersonalUsername(user.username);
      setPersonalEmail(user.email);
      setPersonalAvatar(user.avatar);
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    setPersonalTheme(savedTheme);

    const savedNotify = localStorage.getItem("notify-desktop");
    setDesktopNotifications(savedNotify !== "false");

    const savedSound = localStorage.getItem("notify-sound");
    setMessageSounds(savedSound !== "false");

    setPersonalNewPassword("");
    setPersonalConfirmPassword("");
    setPersonalSuccessMsg("");
    setPersonalErrorMsg("");
    setActiveView("personal-settings");
  };

  // Save Personal Settings Changes
  const handleSavePersonalSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalErrorMsg("");
    setPersonalSuccessMsg("");

    if (personalNewPassword && personalNewPassword.length < 8) {
      setPersonalErrorMsg("新密碼長度至少需要 8 個字元");
      return;
    }

    if (personalNewPassword !== personalConfirmPassword) {
      setPersonalErrorMsg("密碼與確認密碼不相符");
      return;
    }

    const updatedUser = {
      username: personalUsername,
      email: personalEmail,
      avatar: personalAvatar,
      bio: "隨意聊天的地方",
    };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    localStorage.setItem("theme", personalTheme);
    localStorage.setItem("notify-desktop", String(desktopNotifications));
    localStorage.setItem("notify-sound", String(messageSounds));

    setUser(updatedUser);
    setPersonalSuccessMsg("設定已成功儲存！");
    setTimeout(() => {
      setActiveView("chat");
    }, 800);
  };

  // Theme Change Handler
  const handlePersonalThemeChange = (newTheme: string) => {
    setPersonalTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Avatar Change Handler
  const handlePersonalAvatarChange = () => {
    const avatars = [
      "",
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
    ];
    const currentIndex = avatars.indexOf(personalAvatar);
    const nextIndex = (currentIndex + 1) % avatars.length;
    setPersonalAvatar(avatars[nextIndex]);
  };

  // Group settings modal open helper
  const openGroupSettings = () => {
    setGroupSettingsName(activeRoom.name);
    setGroupSettingsDesc(activeRoom.description || "");
    setGroupSettingsPublic(!!activeRoom.isPublic);
    setGroupSettingsInvite(!!activeRoom.allowInvite);
    setGroupSettingsUpload(!!activeRoom.allowUpload);
    setGroupSettingsMembers(activeRoom.members || []);
    setActiveView("group-settings");
  };

  // Save Group Settings Changes
  const saveGroupSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setRooms(
      rooms.map((r) =>
        r.id === activeRoom.id
          ? {
              ...r,
              name: groupSettingsName,
              description: groupSettingsDesc,
              isPublic: groupSettingsPublic,
              allowInvite: groupSettingsInvite,
              allowUpload: groupSettingsUpload,
              members: groupSettingsMembers,
            }
          : r
      )
    );
    setActiveView("chat");
  };

  // Delete Group Chat Room (Danger zone)
  const handleDeleteGroupRoom = () => {
    if (confirm("警告！刪除群組聊天室將無法復原，所有訊息及成員資料都將被永久刪除。確認刪除嗎？")) {
      setRooms(rooms.filter((r) => r.id !== activeRoom.id));
      setActiveView("chat");
      const remaining = rooms.filter((r) => r.id !== activeRoom.id);
      if (remaining.length > 0) setActiveRoomId(remaining[0].id);
    }
  };

  // Group Settings - Invite member simulation
  const handleInviteMember = () => {
    const name = prompt("請輸入欲邀請的成員名稱：");
    if (!name) return;
    setGroupSettingsMembers([...groupSettingsMembers, { name, role: "member" }]);
  };

  // Group Settings - Remove member simulation
  const handleKickMember = (memberName: string) => {
    if (memberName === "我") {
      alert("您無法踢出自己！");
      return;
    }
    setGroupSettingsMembers(groupSettingsMembers.filter((m) => m.name !== memberName));
  };

  // Group Settings - Toggle mute member simulation
  const handleToggleMuteMember = (memberName: string) => {
    setGroupSettingsMembers(
      groupSettingsMembers.map((m) =>
        m.name === memberName ? { ...m, isMuted: !m.isMuted } : m
      )
    );
  };

  // --- Filtering Rooms by Folder ---
  const rootRooms = rooms.filter((r) => !r.folderId);
  const getFolderRooms = (folderId: string) => rooms.filter((r) => r.folderId === folderId);

  // Active user display nickname inside active chat
  const activeUserDisplayName = activeRoomNicknames[activeRoom.id] || user.username;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans transition-colors">
      {/* ========================================================
          LEFT SIDEBAR (280px)
         ======================================================== */}
      <div className="w-[280px] shrink-0 border-r border-border-primary bg-surface-card flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="h-14 border-b border-border-primary px-4 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <rect x="3" y="3" width="18" height="14" rx="2" strokeLinejoin="round" />
              <path d="M7 21h10M12 17v4" />
            </svg>
            <span className="font-mono text-sm font-bold uppercase tracking-wider">DB-9CHAT</span>
          </div>
          <div className="flex gap-1">
            {/* Create Folder Button */}
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              title="新增資料夾"
              className="p-1 text-text-muted hover:text-foreground border border-transparent hover:border-border-primary rounded-sm transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
            {/* Create Chat Room Button */}
            <button
              onClick={() => setIsCreateRoomOpen(true)}
              title="新增聊天室"
              className="p-1 text-text-muted hover:text-foreground border border-transparent hover:border-border-primary rounded-sm transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar Rooms & Folders Lists */}
        <div className="flex-1 overflow-y-auto divide-y divide-border-secondary/40 select-none">
          {/* Folders Section */}
          {folders.length > 0 && (
            <div className="py-2 flex flex-col gap-0.5">
              <span className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">
                分類資料夾
              </span>
              {folders.map((folder) => {
                const folderRooms = getFolderRooms(folder.id);
                return (
                  <div key={folder.id} className="flex flex-col">
                    {/* Folder Header */}
                    <div
                      onClick={() => toggleFolder(folder.id)}
                      className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={`h-3.5 w-3.5 text-text-muted transition-transform ${
                            folder.collapsed ? "" : "rotate-90"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>{folder.name}</span>
                      </div>
                      <Badge variant="default" className="scale-90">{folderRooms.length}</Badge>
                    </div>

                    {/* Folder Chat Items (collapsible) */}
                    {!folder.collapsed && (
                      <div className="pl-4 flex flex-col border-l border-border-secondary/30 ml-6 my-0.5 gap-0.5">
                        {folderRooms.length === 0 ? (
                          <span className="text-[10px] text-text-muted py-1 italic pl-2">
                            資料夾是空的
                          </span>
                        ) : (
                          folderRooms.map((room) => (
                            <RoomItem
                              key={room.id}
                              room={room}
                              isActive={room.id === activeRoomId}
                              onClick={() => selectRoom(room.id)}
                              avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Root Chats Section */}
          <div className="py-2 flex flex-col gap-0.5">
            <span className="px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">
              未分類
            </span>
            {rootRooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                onClick={() => selectRoom(room.id)}
                avatarSrc={getAvatarForUser(room.name, user.avatar, user.username)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar Footer User Details */}
        <div className="border-t border-border-primary p-4 bg-surface-muted select-none shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.username} src={user.avatar} size="sm" isOnline={true} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate leading-tight">
                {activeUserDisplayName}
              </p>
              <p className="text-[10px] text-text-muted truncate font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border-secondary/40 pt-3">
            <Button
              variant="ghost"
              onClick={openPersonalSettings}
              className="text-xs flex items-center gap-1.5 hover:underline"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              設定
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              登出
            </Button>
          </div>
        </div>
      </div>

      {activeView === "chat" && (
        <>
          {/* ========================================================
              MAIN CHAT PANEL
             ======================================================== */}
      <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
        {/* Chat Panel Header */}
        <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
          <div className="flex items-center gap-3">
            <Avatar name={activeRoom.name} src={getAvatarForUser(activeRoom.name, user.avatar, user.username)} size="sm" isOnline={activeRoom.isOnline} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-foreground truncate max-w-[200px]">
                  {activeRoom.name}
                </h1>
                {activeRoom.isArchived && <Badge variant="danger">唯讀</Badge>}
              </div>
              {activeRoom.type === "group" && (
                <span className="text-[10px] text-text-muted font-mono leading-none">
                  群組聊天室 • {activeRoom.members?.length || 0} 位成員
                </span>
              )}
            </div>
          </div>

          {/* Header Action Elements */}
          <div className="flex items-center gap-3">
            {/* Group Settings Button */}
            {activeRoom.type === "group" && (
              <Button
                variant="secondary"
                onClick={openGroupSettings}
                className="py-1 px-3 text-xs flex items-center gap-1.5"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                群組設定
              </Button>
            )}

            {/* Chat Options Dropdown */}
            <Dropdown
              trigger={
                <button
                  className="p-1.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer"
                  title="聊天室選項"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              }
              items={[
                { label: "修改暱稱", onClick: handleModifyNickname },
                {
                  label: activeRoom.type === "group" ? "退出聊天室" : activeRoom.isArchived ? "解除封鎖" : "封鎖聯絡人",
                  onClick: handleLeaveOrBlock,
                  variant: activeRoom.isArchived ? "default" : "danger",
                },
              ]}
            />
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {messages
            .filter((m) => m.roomId === activeRoom.id)
            .map((msg) => (
              <div
                key={msg.id}
                className={`group/msg flex flex-col ${msg.isOutgoing ? "items-end" : "items-start"}`}
              >
                {/* Chat Bubble Component */}
                <ChatBubble
                  content={msg.content}
                  senderName={msg.senderName}
                  timestamp={msg.timestamp}
                  isOutgoing={msg.isOutgoing}
                  isHighEmphasis={msg.isOutgoing}
                  isRecalled={msg.isRecalled}
                  replyTo={msg.replyTo || undefined}
                  attachments={msg.attachments}
                  senderAvatar={msg.isOutgoing ? user.avatar : getAvatarForUser(msg.senderName, user.avatar, user.username)}
                  isRead={msg.isRead}
                  readByAvatars={getReadAvatarsForMessage(msg)}
                  roomType={activeRoom.type}
                />

                {/* Message Hover Actions */}
                {!msg.isRecalled && (
                  <div className="opacity-0 group-hover/msg:opacity-100 flex gap-2.5 mt-1 select-none text-[10px] text-text-muted transition-opacity">
                    <button
                      onClick={() => setReplyTarget(msg)}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      回覆
                    </button>
                    {msg.isOutgoing && (
                      <button
                        onClick={() => handleRecallMessage(msg.id)}
                        className="hover:text-red-600 transition-colors cursor-pointer"
                      >
                        收回
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          {/* Scroll anchor */}
          <div ref={messageEndRef} />
        </div>

        {/* Reply Quote Banner */}
        {replyTarget && (
          <div className="bg-surface-muted border-t border-border-primary px-6 py-2 flex items-center justify-between text-xs select-none">
            <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
              <span className="font-bold text-foreground block">回覆給 {replyTarget.senderName}</span>
              <p className="text-text-muted truncate mt-0.5">{replyTarget.content}</p>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="text-text-muted hover:text-foreground cursor-pointer p-0.5 border border-transparent hover:border-border-primary rounded-sm ml-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Input Box Area */}
        <div className="border-t border-border-primary bg-surface-card px-6 py-4 shrink-0">
          {activeRoom.isArchived ? (
            <div className="w-full text-center py-2.5 bg-surface-muted text-xs text-text-muted uppercase tracking-wider select-none border border-dashed border-border-secondary rounded-sm">
              此聊天室已被封鎖或唯讀，無法發送訊息。
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex gap-4 items-end">
              {/* Mock File Attachment button */}
              <button
                type="button"
                onClick={handleMockAttachment}
                title="上傳附件檔案"
                className="p-2.5 border border-border-secondary hover:border-border-primary rounded-sm text-text-muted hover:text-foreground transition-colors cursor-pointer shrink-0 mb-0.5"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <input
                type="text"
                placeholder="輸入訊息..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3.5 py-2.5 text-sm text-foreground transition-colors"
              />

              <Button type="submit" variant="primary" className="py-2.5 px-5 shrink-0 select-none">
                發送
              </Button>
            </form>
          )}
        </div>
      </div>
        </>
      )}

      {/* ========================================================
          EMBEDDED SETTINGS PANELS
         ======================================================== */}
      {activeView === "personal-settings" && (
        <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
          <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
            <h1 className="text-sm font-bold text-foreground tracking-wider">個人設定</h1>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setActiveView("chat")} className="text-xs py-1 px-3">
                返回聊天
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
            <div className="w-full max-w-xl border border-border-primary rounded-sm bg-surface-card p-6 shadow-sm">
              <form onSubmit={handleSavePersonalSettings} className="flex flex-col gap-6">
                {/* Profile Section */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    個人資料
                  </h2>
                  <div className="flex items-center gap-6 py-2">
                    <Avatar name={personalUsername} src={personalAvatar} size="lg" />
                    <Button type="button" variant="secondary" onClick={handlePersonalAvatarChange}>
                      變更頭像
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="使用者名稱"
                      type="text"
                      value={personalUsername}
                      onChange={(e) => setPersonalUsername(e.target.value)}
                      required
                    />
                    <Input
                      label="電子郵件"
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="flex flex-col gap-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    通知設定
                  </h2>
                  <div className="flex flex-col gap-3.5 mt-1">
                    <Checkbox
                      label="啟用桌面通知"
                      checked={desktopNotifications}
                      onChange={(e) => setDesktopNotifications(e.target.checked)}
                    />
                    <Checkbox
                      label="啟用訊息音效"
                      checked={messageSounds}
                      onChange={(e) => setMessageSounds(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Appearance Section */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    外觀
                  </h2>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5 select-none">
                      主題
                    </label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="radio"
                          name="theme"
                          value="light"
                          checked={personalTheme === "light"}
                          onChange={() => handlePersonalThemeChange("light")}
                          className="accent-primary h-4.5 w-4.5"
                        />
                        <span>淺色</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="radio"
                          name="theme"
                          value="dark"
                          checked={personalTheme === "dark"}
                          onChange={() => handlePersonalThemeChange("dark")}
                          className="accent-primary h-4.5 w-4.5"
                        />
                        <span>深色</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Language Section */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    語言
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
                      顯示語言
                    </label>
                    <select
                      value={personalLanguage}
                      onChange={(e) => setPersonalLanguage(e.target.value)}
                      className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors max-w-xs cursor-pointer"
                    >
                      <option value="zh-TW">繁體中文</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                {/* Security Section */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    安全性 (變更密碼)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="新密碼"
                      type="password"
                      placeholder="留空則不修改"
                      value={personalNewPassword}
                      onChange={(e) => setPersonalNewPassword(e.target.value)}
                    />
                    <Input
                      label="確認新密碼"
                      type="password"
                      placeholder="再次輸入新密碼"
                      value={personalConfirmPassword}
                      onChange={(e) => setPersonalConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Feedback messages */}
                {personalErrorMsg && (
                  <p className="text-xs text-red-600 font-sans text-center mt-2">{personalErrorMsg}</p>
                )}
                {personalSuccessMsg && (
                  <p className="text-xs text-green-600 font-sans font-bold text-center mt-2">
                    {personalSuccessMsg}
                  </p>
                )}

                {/* Submit Actions */}
                <div className="border-t border-border-primary pt-6 mt-2 flex items-center justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setActiveView("chat")}>
                    取消
                  </Button>
                  <Button type="submit" variant="primary">
                    儲存變更
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeView === "group-settings" && (
        <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-border-primary px-6 flex items-center justify-between select-none shrink-0 bg-surface-card z-10">
            <h1 className="text-sm font-bold text-foreground tracking-wider">群組設定 - {groupSettingsName}</h1>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setActiveView("chat")} className="text-xs py-1 px-3">
                取消
              </Button>
              <Button type="button" variant="primary" onClick={saveGroupSettings} className="text-xs py-1 px-3">
                儲存變更
              </Button>
            </div>
          </div>

          {/* Centered Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
            <div className="w-full max-w-xl border border-border-primary rounded-sm bg-surface-card p-6 shadow-sm">
              <form onSubmit={saveGroupSettings} className="flex flex-col gap-6">
                {/* Section: Basic Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    基本資訊
                  </h3>
                  <Input
                    label="聊天室名稱"
                    value={groupSettingsName}
                    onChange={(e) => setGroupSettingsName(e.target.value)}
                    required
                  />
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
                      描述
                    </label>
                    <textarea
                      value={groupSettingsDesc}
                      onChange={(e) => setGroupSettingsDesc(e.target.value)}
                      className="w-full bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2 text-sm text-foreground transition-colors min-h-[60px]"
                    />
                  </div>
                  <Checkbox
                    label="公開聊天室"
                    description="允許任何人加入此聊天室"
                    checked={groupSettingsPublic}
                    onChange={(e) => setGroupSettingsPublic(e.target.checked)}
                  />
                </div>

                {/* Section: Member Management */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border-secondary pb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                      成員管理
                    </h3>
                    <Button type="button" variant="ghost" onClick={handleInviteMember} className="text-xs select-none">
                      邀請成員
                    </Button>
                  </div>
                  <span className="text-[10px] text-text-muted font-bold font-mono">
                    共 {groupSettingsMembers.length} 位成員
                  </span>
                  <div className="flex flex-col border border-border-primary divide-y divide-border-secondary rounded-sm overflow-hidden bg-surface-card max-h-[160px] overflow-y-auto">
                    {groupSettingsMembers.map((member, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Avatar name={member.name} src={getAvatarForUser(member.name, user.avatar, user.username)} size="sm" />
                          <span className="font-semibold">{member.name}</span>
                          <span className="text-[9px] text-text-muted capitalize font-mono">
                            ({member.role})
                          </span>
                        </div>
                        {member.name !== "我" && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleToggleMuteMember(member.name)}
                              className={`text-[10px] font-sans ${member.isMuted ? "text-green-600" : "text-text-muted"}`}
                            >
                              {member.isMuted ? "解禁" : "禁言"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleKickMember(member.name)}
                              className="text-[10px] text-red-600 font-sans"
                            >
                              踢出
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Permissions */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
                    權限設定
                  </h3>
                  <div className="flex flex-col gap-3.5">
                    <Checkbox
                      label="允許成員邀請他人"
                      description="成員可以邀請新成員加入聊天室"
                      checked={groupSettingsInvite}
                      onChange={(e) => setGroupSettingsInvite(e.target.checked)}
                    />
                    <Checkbox
                      label="允許成員上傳檔案"
                      description="成員可以在聊天室中上傳檔案"
                      checked={groupSettingsUpload}
                      onChange={(e) => setGroupSettingsUpload(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Section: Danger Zone */}
                <div className="flex flex-col gap-3 border border-red-500/20 p-4 bg-red-500/5 rounded-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">
                    危險區域
                  </h3>
                  <div className="flex flex-col items-start gap-2">
                    <Button type="button" variant="secondary" onClick={handleDeleteGroupRoom} className="text-red-600 border-red-600 hover:bg-red-500/10">
                      刪除聊天室
                    </Button>
                    <span className="text-[10px] text-red-600/70 leading-normal">
                      刪除後將無法復原，所有訊息和成員資料都會被永久刪除。
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setActiveView("chat")}>
                    取消
                  </Button>
                  <Button type="submit" variant="primary">
                    儲存變更
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          RIGHT SIDEBAR (MEMBER LIST FOR GROUPS, 240px)
         ======================================================== */}
      {(activeView === "chat" || activeView === "group-settings") && activeRoom.type === "group" && activeRoom.members && (
        <div className="w-[240px] shrink-0 border-l border-border-primary bg-surface-card flex flex-col h-full select-none">
          <div className="h-14 border-b border-border-primary px-4 flex items-center select-none shrink-0 bg-surface-muted">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
              成員列表 ({activeRoom.members.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-secondary/30">
            {activeRoom.members.map((member, index) => {
              const displayNick = member.name === "我" ? activeUserDisplayName : member.name;
              return (
                <div key={index} className="p-3.5 flex items-center justify-between hover:bg-surface-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={member.name} src={getAvatarForUser(member.name, user.avatar, user.username)} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{displayNick}</p>
                      <p className="text-[9px] text-text-muted capitalize mt-0.5 font-mono">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    {member.isMuted && (
                      <span title="禁言中" className="text-red-500 scale-90">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS
         ======================================================== */}

      {/* 2. Create Chat Room Modal */}
      <Modal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} title="新增聊天室">
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-5">
          <Input
            label="聊天室名稱"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            required
            placeholder="請輸入名稱"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
              聊天室類型
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="roomType"
                  checked={newRoomType === "msg"}
                  onChange={() => setNewRoomType("msg")}
                  className="accent-primary h-4.5 w-4.5"
                />
                <span>個人私訊 (DM)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="roomType"
                  checked={newRoomType === "group"}
                  onChange={() => setNewRoomType("group")}
                  className="accent-primary h-4.5 w-4.5"
                />
                <span>群組聊天室 (Group)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted select-none">
              收納至資料夾 (選填)
            </label>
            <select
              value={newRoomFolder}
              onChange={(e) => setNewRoomFolder(e.target.value)}
              className="bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors cursor-pointer"
            >
              <option value="">無分類</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateRoomOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              確認建立
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Create Folder Modal */}
      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title="新增分類資料夾">
        <form onSubmit={handleCreateFolder} className="flex flex-col gap-5">
          <Input
            label="資料夾名稱"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            required
            placeholder="請輸入資料夾分類名稱"
          />

          <div className="border-t border-border-primary pt-5 mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              確認建立
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// --- Inner Sidebar Room Item Component ---
interface RoomItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  avatarSrc?: string;
}

function RoomItem({ room, isActive, onClick, avatarSrc }: RoomItemProps) {
  return (
    <div
      onClick={onClick}
      className={`relative px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-muted/60 transition-colors select-none group/item ${
        isActive ? "bg-surface-muted font-semibold" : ""
      }`}
    >
      {/* Active Room Left Indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={room.name} src={avatarSrc} size="sm" isOnline={room.isOnline} />
        <span className="text-xs text-foreground truncate max-w-[140px]">{room.name}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {room.type === "group" ? (
          <Badge variant="secondary" className="scale-75 font-mono">G</Badge>
        ) : (
          <Badge variant="default" className="scale-75 font-mono">DM</Badge>
        )}
      </div>
    </div>
  );
}
