# API Documentation

本文件定義後端提供的 RESTful API 以及 Socket.io 即時通訊接口。

---

## 0. 通用規則 (General)

### Base URL

所有 REST API 路徑以 `/api/v1` 開頭。

### 認證方式 (Authentication)

除 `POST /auth/register` 與 `POST /auth/login` 外，所有端點均需驗證，提供以下任一方式：

| 方式 | 說明 |
| :--- | :--- |
| **HttpOnly Cookie** | 登入後自動設置 `auth_token` Cookie，瀏覽器會自動帶上（推薦） |
| **Bearer Token** | Request Header: `Authorization: Bearer <token>` |

JWT 預設有效期為 `15m`，可透過環境變數 `JWT_EXPIRES_IN` 調整。Token 過期後需重新登入取得新 Token。

### 錯誤回應格式 (Error Response)

所有錯誤均回傳以下 JSON 結構：

```json
{
  "statusCode": 400,
  "message": "Human-readable description",
  "code": "MACHINE_READABLE_CODE"
}
```

| `code` | `statusCode` | 說明 |
| :--- | :---: | :--- |
| _(無 code)_ | 401 | 未提供或無效的 Token |
| `VALIDATION_ERROR` | 400 | 請求參數不合法 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `FORBIDDEN` | 403 | 無操作權限 |
| `CONFLICT` | 409 | 資源衝突（如重複的好友邀請） |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤 |

---

## 1. 共用型別 (Shared Types)

### PublicUser
```json
{
  "userId": "string (UUID)",
  "name": "string",
  "avatarUrl": "string (URL) | null"
}
```

### UserProfile
```json
{
  "userId": "string (UUID)",
  "name": "string",
  "bio": "string | null",
  "avatarUrl": "string (URL) | null"
}
```

### MyProfile
```json
{
  "userId": "string (UUID)",
  "name": "string",
  "email": "string",
  "bio": "string | null",
  "avatarUrl": "string (URL) | null"
}
```

### UserSettings
```json
{
  "warningEnabled": "boolean",
  "warningDays": "number (integer, min 0)",
  "language": "string (BCP 47 tag, e.g. zh-TW, en)",
  "theme": "\"light\" | \"dark\"",
  "notifyDesktop": "boolean",
  "notifySound": "boolean"
}
```

### AuthResponse
```json
{
  "token": "string (JWT)",
  "user": "PublicUser"
}
```

### Room
```json
{
  "roomId": "string (UUID)",
  "type": "\"group\" | \"private\"",
  "name": "string | null  (group only)",
  "avatarUrl": "string (URL) | null",
  "inviteCode": "string | null  (group only)",
  "requireApproval": "boolean",
  "viewHistory": "boolean",
  "isArchived": "boolean",
  "createdAt": "string (ISO 8601)"
}
```
> `isArchived = true` 表示聊天室已封存，封存後唯讀。

### RoomSummary _(extends Room)_
```json
{
  "...Room fields...",
  "latestMessage": {
    "messageId": "string (UUID)",
    "senderId": "string (UUID) | null",
    "content": "string",
    "sentAt": "string (ISO 8601)"
  },
  "unreadCount": "number"
}
```
> `latestMessage` 為 `null` 時表示無訊息紀錄。

### RoomMember
```json
{
  "roomId": "string (UUID)",
  "userId": "string (UUID)",
  "role": "\"owner\" | \"admin\" | \"member\" | \"pending\"",
  "nickname": "string | null",
  "isMuted": "boolean",
  "lastReadId": "string (UUID) | null",
  "joinTime": "string (ISO 8601)"
}
```

### MessageWithSender
```json
{
  "messageId": "string (UUID)",
  "roomId": "string (UUID)",
  "senderId": "string (UUID) | null",
  "content": "string",
  "replyToId": "string (UUID) | null",
  "isRecalled": "boolean",
  "sentAt": "string (ISO 8601)",
  "attachments": ["Attachment"],
  "sender": "PublicUser | null  (null 表示發送者帳號已刪除)",
  "mentions": ["string (userId)"]
}
```

### FriendRequestResponse
```json
{
  "requesterId": "string (UUID)",
  "addresseeId": "string (UUID)",
  "status": "\"pending\" | \"accepted\"",
  "createdAt": "string (ISO 8601)",
  "requester": "PublicUser (optional)",
  "addressee": "PublicUser (optional)"
}
```

### Attachment
```json
{
  "attachmentId": "string (UUID)",
  "messageId": "string (UUID) | null",
  "fileUrl": "string (URL)",
  "originalName": "string",
  "fileType": "string (MIME type)",
  "uploadedAt": "string (ISO 8601)"
}
```

### FriendResponse
```json
{
  "friend": "PublicUser",
  "friendshipCreatedAt": "string (ISO 8601)"
}
```

### Folder
```json
{
  "folderId": "string (UUID)",
  "userId": "string (UUID)",
  "name": "string",
  "createdAt": "string (ISO 8601)",
  "roomIds": ["string (UUID)"]
}
```

### ApiError _(Socket.IO error event payload)_
```json
{
  "statusCode": "number",
  "message": "string",
  "code": "string (optional)"
}
```

---

## 2. RESTful API (HTTP)

### A. 認證與帳號 (Authentication & Profile)

#### `POST /auth/register`
> 無需驗證

**Request Body:**
```json
{
  "email": "string (valid email, required)",
  "name": "string (min 1 char, required)",
  "password": "string (min 8 chars, required)"
}
```
**Response `201`:** `AuthResponse` + 設置 `auth_token` HttpOnly Cookie

---

#### `POST /auth/login`
> 無需驗證

**Request Body:**
```json
{
  "email": "string (valid email, required)",
  "password": "string (required)"
}
```
**Response `200`:** `AuthResponse` + 設置 `auth_token` HttpOnly Cookie

---

#### `POST /auth/logout`

**Response `204`** (清除 `auth_token` Cookie)

---

#### `GET /users/me`

取得目前登入者的個人資料檢視結果。

**Response `200`:** `MyProfile`

---

#### `GET /users/:id`

取得公開個人資料頁所需資訊。

**Response `200`:** `UserProfile`

---

#### `PATCH /users/me`

更新目前登入者的個人資料欄位（不含偏好設定）。

**Request Body:**
```json
{
  "name": "string (min 1 char)  [optional]",
  "email": "string (valid email)  [optional]",
  "password": "string (min 8 chars)  [optional]",
  "bio": "string  [optional]",
  "avatarUrl": "string (valid URL)  [optional]"
}
```
**Response `200`:** `MyProfile`

---

#### `GET /users/me/settings`

取得目前登入者的設定頁資料。

**Response `200`:** `UserSettings`

---

#### `PATCH /users/me/settings`

更新目前登入者的設定頁欄位。

**Request Body:**
```json
{
  "warningEnabled": "boolean  [optional]",
  "warningDays": "number (integer, min 0)  [optional]",
  "language": "string (BCP 47 tag)  [optional]",
  "theme": "\"light\" | \"dark\"  [optional]",
  "notifyDesktop": "boolean  [optional]",
  "notifySound": "boolean  [optional]"
}
```
**Response `200`:** `UserSettings`

---

#### `DELETE /users/me`

**Response `204`** (軟刪除，標記帳號為已刪除)

---

#### `GET /users?q=<query>`

搜尋使用者。

**Query Parameters:**

| 參數 | 必填 | 說明 |
| :--- | :---: | :--- |
| `q` | ✅ | 搜尋字串 (min 1 char)，依名稱或 ID 過濾 |

**Response `200`:** `PublicUser[]`

---

### B. 好友與封鎖 (Friends & Blocks)

#### `GET /friends`

**Response `200`:** `FriendResponse[]`

---

#### `DELETE /friends/:id`

移除好友。`:id` 為對方的 `userId`。

**Response `204`**

---

#### `GET /friend-requests`

取得所有待處理的好友邀請（含已發送與已接收）。

**Response `200`:** `FriendRequestResponse[]`

---

#### `POST /friend-requests`

**Request Body:**
```json
{
  "targetUserId": "string (UUID, required)"
}
```
**Response `201`:** `FriendRequestResponse`
> 若邀請已存在，回傳 `409 CONFLICT`

---

#### `PATCH /friend-requests/:id`

回覆好友邀請。`:id` 為發出邀請者（requester）的 `userId`。

**Request Body:**
```json
{
  "status": "\"accepted\" | \"rejected\""
}
```
**Response `200`:** `FriendRequestResponse`

---

#### `POST /blocks`

封鎖使用者。

**Request Body:**
```json
{
  "targetUserId": "string (UUID, required)"
}
```
**Response `201`**

---

#### `DELETE /blocks/:id`

取消封鎖。`:id` 為被封鎖者的 `userId`。

**Response `204`**

---

### C. 聊天室 (Chat Rooms)

#### `GET /rooms`

**Response `200`:** `RoomSummary[]`

---

#### `POST /rooms`

建立聊天室。`type` 決定所需欄位。

**Request Body — group:**
```json
{
  "type": "\"group\"",
  "name": "string (min 1 char, required)",
  "avatarUrl": "string (valid URL)  [optional]",
  "requireApproval": "boolean (default: false)  [optional]",
  "viewHistory": "boolean (default: true)  [optional]"
}
```

**Request Body — private:**
```json
{
  "type": "\"private\"",
  "targetUserId": "string (UUID, required)"
}
```

**Response `201`:** `Room`（建立新的私聊）
**Response `200`:** `Room`（已存在既有私聊時直接回傳該房間）

> `private` 聊天室僅限一對一。若同一對好友已存在私聊，伺服器不得重複建立第二個 `private` 聊天室。

---

#### `GET /rooms/:id`

**Response `200`:** `Room`

---

#### `PATCH /rooms/:id`

此端點依 body 內容有兩種用途：

**用途 1 — 轉讓擁有者**（body 含 `ownerId` 時）
```json
{
  "ownerId": "string (UUID)"
}
```
**Response `200`:** `{ "message": "Ownership transferred" }`

**用途 2 — 更新群組設定**（其他情況，至少需一個欄位）
```json
{
  "name": "string (min 1 char)  [optional]",
  "avatarUrl": "string (valid URL)  [optional]",
  "requireApproval": "boolean  [optional]",
  "viewHistory": "boolean  [optional]",
  "isArchived": "boolean  [optional]"
}
```
**Response `200`:** `Room`

> 需為 owner 或 admin 身份。

---

#### `POST /rooms/:id/members`

透過邀請碼加入群組。

**Request Body:**
```json
{
  "inviteCode": "string (required)"
}
```
**Response `200`:** `Room`

> ⚠️ 目前伺服器以 `inviteCode` 解析目標房間，URL 中的 `:id` 暫時未被使用，可傳入任意佔位值（如 `0`）。

---

#### `DELETE /rooms/:id/members/me`

退出聊天室（自己離開）。

**Response `204`**

---

#### `DELETE /rooms/:id`

封存聊天室，需為 owner。封存後保留歷史資料，但聊天室進入唯讀狀態。

**Response `204`**

---

### D. 成員管理 (Member Management)

#### `GET /rooms/:id/members`

**Response `200`:** `RoomMember[]`

---

#### `PATCH /rooms/:id/members/:userId`

此端點依 body 內容有兩種用途：

**用途 1 — 審核成員**（body 含 `status: 'approved'` 時）
```json
{
  "status": "\"approved\""
}
```
**Response `200`:** `{ "message": "Member approved" }`

**用途 2 — 修改成員權限 / 暱稱**（其他情況）
```json
{
  "role": "\"admin\" | \"member\"  [optional]",
  "nickname": "string  [optional]",
  "isMuted": "boolean  [optional]"
}
```
**Response `200`:** `{ "message": "Member updated" }`

> 需為 owner 或 admin 身份。

---

#### `DELETE /rooms/:id/members/:userId`

踢出成員，需為 owner 或 admin。

**Response `204`**

---

### E. 訊息與附件 (Messages & Attachments)

#### `GET /rooms/:roomId/messages`

取得歷史訊息（cursor-based pagination，由新到舊）。

**Query Parameters:**

| 參數 | 必填 | 說明 |
| :--- | :---: | :--- |
| `before_id` | ❌ | 游標，取此 `messageId` 之前的訊息 |
| `limit` | ❌ | 每頁筆數，1–100，預設 `50` |

**Response `200`:** `MessageWithSender[]`

---

#### `POST /attachments`

上傳附件。

**Request:** `multipart/form-data`

| 欄位 | 型別 | 必填 | 說明 |
| :--- | :--- | :---: | :--- |
| `file` | binary | ✅ | 附件檔案 |
| `messageId` | string (UUID) | ❌ | 若提供則立即綁定到指定訊息；若未提供則為待綁定附件 |

**Response `201`:** `Attachment`

---

#### `GET /attachments/:id`

下載附件。

**Response `200`:** 檔案串流（`Content-Disposition: attachment`）

---

### E2EE 金鑰交換 (E2EE Key Exchange)

端對端加密的金鑰中繼端點；伺服器只儲存公鑰與「被公鑰包裝的房間金鑰」，無法解密訊息。架構設計詳見 [e2e-encryption.md](./e2e-encryption.md)。

#### `PUT /users/me/public-key`

註冊／更新本人 E2EE 公鑰（冪等）。

**Request Body:**
```json
{
  "publicKey": "string (base64 SPKI, 1–8192 chars, required)"
}
```
**Response `200`:** `{ "userId": "uuid", "publicKey": "..." }`

---

#### `GET /users/:id/public-key`

查詢使用者公鑰；未註冊時 `publicKey` 為 `null`。

**Response `200`:** `{ "userId": "uuid", "publicKey": "... | null" }`

---

#### `GET /rooms/:id/keys`

房間成員金鑰狀態（需為非 pending 成員），供客戶端補發金鑰。

**Response `200`:** `[{ "userId": "uuid", "publicKey": "... | null", "hasRoomKey": true }]`

---

#### `GET /rooms/:id/keys/me`

取得本人被包裝的房間金鑰。

**Response `200`:** `{ "roomId": "uuid", "userId": "uuid", "encryptedKey": "base64" }`
**Response `404`:** 尚未有人分發金鑰給本人

---

#### `POST /rooms/:id/keys`

分發包裝後的房間金鑰；收件人必須是房間成員，**僅插入尚無金鑰者**（既有金鑰不可覆寫）。

**Request Body:**
```json
{
  "keys": [{ "userId": "uuid", "encryptedKey": "base64 (1–8192 chars)" }]
}
```
**Response `201`:** `{ "distributed": ["uuid"] }`

---

### F. 資料夾分類 (Folders)

#### `GET /folders`

**Response `200`:** `Folder[]`

---

#### `POST /folders`

**Request Body:**
```json
{
  "name": "string (1–50 chars, required)"
}
```
**Response `201`:** `Folder`

---

#### `DELETE /folders/:id`

**Response `204`**

---

#### `PUT /folders/:id/rooms`

整批更新資料夾內的房間列表（**全量覆蓋**，傳空陣列可清空）。

**Request Body:**
```json
{
  "roomIds": ["string (UUID)"]
}
```
**Response `200`:** `{ "success": true }`

---

### G. 緊急聯絡 (Emergency Contacts)

> 緊急聯絡人須為系統內已存在的使用者。`contactId` 為對方的 `userId`，`message` 為觸發緊急警報時預設發送給該聯絡人的訊息內容。

#### `GET /users/me/emergency-contacts`

**Response `200`:** EmergencyContact[]

---

#### `POST /users/me/emergency-contacts`

新增或更新緊急聯絡人（upsert）。

**Request Body:**
```json
{
  "contactId": "string (UUID, required)  — 對方的 userId",
  "message": "string (min 1 char, required)  — 預設警報訊息"
}
```
**Response `201`:** EmergencyContact（新增時）
**Response `200`:** EmergencyContact（更新現有聯絡人時）

---

#### `DELETE /users/me/emergency-contacts/:contactId`

`:contactId` 為對方的 `userId`。

**Response `200`:** `{ "success": true }`

---

#### `POST /users/me/emergency-alert`

立即觸發緊急求救，向所有緊急聯絡人發送警報。

**Request Body:**
```json
{
  "message": "string (optional)  — 覆蓋預設警報訊息"
}
```
**Response `202`**

---

#### `POST /users/me/emergency-alert/check-inactivity`

檢查是否達到設定的不活躍門檻，符合條件則自動觸發警報。

**Request Body:**
```json
{
  "now": "string (ISO 8601, optional)  — 指定參考時間點，預設為伺服器當前時間"
}
```
**Response `200`**

---

## 3. Socket.io 即時通訊

### 連線

- **URL**: 與 REST API 相同 host（預設 port `4000`）
- **Namespace**: `/`（root）
- **驗證**: 連線時需帶上 `auth_token` Cookie 或 `Authorization: Bearer <token>` Header

### 客戶端發送事件 (Client-to-Server)

| 事件名稱 | Payload | 說明 |
| :--- | :--- | :--- |
| `join_room` | `{ roomId: string }` | 訂閱特定聊天室的訊息推播（需為成員） |
| `leave_room` | `{ roomId: string }` | 取消訂閱 |
| `send_message` | `{ roomId: string, content: string, replyTo?: string, attachmentIds?: string[] }` | 發送訊息；`replyTo` 為引用的 `messageId`；`attachmentIds` 為待綁定附件 ID 陣列 |
| `recall_message` | `{ messageId: string }` | 收回訊息（僅限原發送者） |
| `typing` | `{ roomId: string, isTyping: boolean }` | 廣播輸入中狀態 |
| `read_receipt` | `{ roomId: string, messageId: string }` | 更新已讀游標至指定訊息 |

### 伺服器發送事件 (Server-to-Client)

| 事件名稱 | Payload 型別 | 說明 |
| :--- | :--- | :--- |
| `new_message` | `MessageWithSender` | 收到新訊息（@mention 也透過此事件通知） |
| `message_recalled` | `{ messageId: string }` | 訊息被收回 |
| `user_typing` | `{ roomId: string, userId: string, isTyping: boolean }` | 其他成員的輸入狀態 |
| `read_update` | `{ roomId: string, userId: string, messageId: string }` | 其他成員的已讀游標更新 |
| `room_update` | `{ type: string, data: unknown }` | 房間設定變更、成員異動、被踢出通知 |
| `friend_request` | `{ requesterId: string, addresseeId: string, status: string, createdAt: string }` | 收到新的好友邀請 |
| `emergency_alert` | `{ userId: string, message: string }` | 收到緊急聯絡人的警報通知 |
| `error` | `ApiError` | 事件處理失敗的錯誤回報 |
