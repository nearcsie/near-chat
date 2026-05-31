# API Documentation

本文件定義後端提供的 RESTful API 以及 Socket.io 即時通訊接口。

## 1. RESTful API (HTTP)

所有 API 路徑以 `/api/v1` 開頭。

### A. 認證與帳號 (Authentication & Profile)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 註冊 | POST | `/auth/register` | email, name, password |
| 登入 | POST | `/auth/login` | email, password |
| 登出 | POST | `/auth/logout` | 清除 Session/Token |
| 取得個人資訊 | GET | `/users/me` | |
| 更新個人資訊 | PATCH | `/users/me` | name, bio, avatar_url, warning_config |
| 搜尋使用者 | GET | `/users/search` | query (by name or ID) |

### B. 好友與封鎖 (Friends & Blocks)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 列出好友 | GET | `/friends` | 取得已接受的好友列表 |
| 列出好友邀請 | GET | `/friends/requests` | 取得待處理邀請 |
| 發送好友邀請 | POST | `/friends/requests` | target_user_id |
| 回覆好友邀請 | PATCH | `/friends/requests/:id` | status ('accepted', 'rejected') |
| 刪除好友 | DELETE | `/friends/:id` | |
| 封鎖使用者 | POST | `/blocks` | target_user_id |
| 取消封鎖 | DELETE | `/blocks/:id` | |

### C. 聊天室 (Chat Rooms)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 列出所有聊天室 | GET | `/rooms` | 包含最後一則訊息片段 |
| 建立群組 | POST | `/rooms/group` | name, avatar_url |
| 取得聊天室詳情 | GET | `/rooms/:id` | |
| 更新群組設定 | PATCH | `/rooms/:id` | name, avatar, settings (owner/admin) |
| 加入群組 (代碼) | POST | `/rooms/join/:code` | |
| 退出聊天室 | DELETE | `/rooms/:id/leave` | |

### D. 訊息與附件 (Messages & Attachments)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 取得歷史訊息 | GET | `/rooms/:roomId/messages` | cursor pagination (before_id, limit) |
| 上傳附件 | POST | `/attachments` | multipart/form-data |
| 下載附件 | GET | `/attachments/:id` | |

### E. 資料夾分類 (Folders)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 列出資料夾 | GET | `/folders` | 包含收納的 room_ids |
| 建立資料夾 | POST | `/folders` | name |
| 刪除資料夾 | DELETE | `/folders/:id` | |
| 更新資料夾房間 | PUT | `/folders/:id/rooms` | room_ids (array) |

### F. 緊急聯絡 (Emergency Contacts)
| 功能 | 方法 | 路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 取得緊急聯絡人 | GET | `/users/me/emergency-contacts` | |
| 新增緊急聯絡人 | POST | `/users/me/emergency-contacts` | name, phone_number |
| 刪除緊急聯絡人 | DELETE | `/users/me/emergency-contacts/:contactId` | |
| 觸發緊急求救 | POST | `/users/me/emergency-alert` | message (optional) |
| 檢查不活躍狀態 | POST | `/users/me/emergency-alert/check-inactivity`| 觸發長時間未活躍的求救 |

---

## 2. Socket.io 即時通訊

客戶端連線時需帶上驗證資訊 (Token)。

### 客戶端發送事件 (Client-to-Server)
| 事件名稱 | Payload | 說明 |
| :--- | :--- | :--- |
| `join_room` | `{ roomId: string }` | 進入特定聊天室頻道 |
| `leave_room` | `{ roomId: string }` | 離開特定聊天室頻道 |
| `send_message` | `{ roomId: string, content: string, replyTo?: string, attachments?: string[] }` | 發送訊息 |
| `recall_message` | `{ messageId: string }` | 收回訊息 |
| `typing` | `{ roomId: string, isTyping: boolean }` | 輸入中狀態 |
| `read_receipt` | `{ roomId: string, messageId: string }` | 更新已讀進度 |

### 伺服器發送事件 (Server-to-Client)
| 事件名稱 | Payload | 說明 |
| :--- | :--- | :--- |
| `new_message` | `MessageObject` | 收到新訊息 (包含提及通知) |
| `message_recalled` | `{ messageId: string }` | 訊息被收回通知 |
| `user_typing` | `{ roomId: string, userId: string, isTyping: boolean }` | 廣播成員輸入狀態 |
| `read_update` | `{ roomId: string, userId: string, messageId: string }` | 廣播已讀進度更新 |
| `room_update` | `{ type: string, data: any }` | 房間設定變更、成員變動、被踢出通知 |
| `friend_request` | `RequestObject` | 收到新的好友邀請通知 |
| `emergency_alert` | `{ userId: string, message: string }` | 收到緊急聯絡通知 |
| `error` | `ApiError` | 錯誤回報 |
