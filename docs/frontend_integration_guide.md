# `dev` 分支近期改動總覽與前端測試指南

## 1. 近期 `dev` 分支改動總覽

### 🔧 後端基礎設施與 API (Backend)

- **架構與錯誤處理**：引入了 `AppError` 階層機制與 Express 全域錯誤處理器。
- **資料庫與遷移**：設定了 PostgreSQL 遷移腳本 (`migrate:up`)，並在 Docker 測試環境中加入了自動執行機制。
- **共用型別 (Shared Types)**：建立了 `shared/` 目錄，統一管理前後端型別定義（`User`, `Room`, `Message`, `RoomMember`, `MessageWithSender` 等）。
- **Repository 層（全部完成）**：`UserRepository`、`RoomRepository`、`MessageRepository`、`RoomMemberRepository` 均已實作 PostgreSQL 版本，並具備完整的 Vitest 整合測試。
  - `MessageRepository.findByRoom` 以 **reverse-chronological（由新到舊）** 順序回傳 `MessageWithSender[]`，支援 `beforeId` cursor pagination。
- **Service 層（全部完成）**：`userService`（register/login/bcrypt/JWT）、`roomService`（CRUD）、`messageService`（send、membership check）均已實作並通過 TDD。
- **認證機制**：實作了 `auth` Middleware，能驗證並解析 JWT Token。
- **Controller / Route 層（全部完成）**：Issue #14–#16 已完成。`index.ts` 完全移除 inline SQL，改用工廠函式 DI 掛載所有 Router。

- **REST API（目前已開放）**：

  | Method | Path | Auth | 說明 |
  |--------|------|------|------|
  | POST | `/auth/register` | — | 註冊，回傳 `{ token, user: PublicUser }`（201） |
  | POST | `/auth/login` | — | 登入，回傳 `{ token, user: PublicUser }`（200） |
  | POST | `/auth/logout` | JWT | 登出（204） |
  | GET | `/users/me` | JWT | 取得目前登入使用者資料 |
  | PATCH | `/users/me` | JWT | 更新個人資料（name/bio/avatarUrl/warningEnabled/warningDays） |
  | GET | `/users/search?query=` | JWT | 依姓名或 userId 搜尋使用者，回傳 `PublicUser[]` |
  | GET | `/rooms` | JWT | 列出我加入的聊天室 |
  | POST | `/rooms/group` | JWT | 建立群組（body: `{ name }`），回傳 `Room`（201） |
  | GET | `/rooms/:id` | JWT | 取得聊天室詳情（非成員 → 403） |
  | PATCH | `/rooms/:id` | JWT (owner/admin) | 更新群組設定 |
  | POST | `/rooms/join/:code` | JWT | 透過邀請碼加入群組 |
  | DELETE | `/rooms/:id/leave` | JWT | 退出聊天室（owner 不得退出） |
  | GET | `/rooms/:roomId/messages` | JWT | 取得歷史訊息，支援 `?before_id=&limit=`（cursor pagination） |

- **WebSocket (Socket.IO)**：
  - 完成 Socket.IO 伺服器建置，並整合 JWT 驗證（連線時於 `auth.token` 帶上 JWT）。
  - `join_room` `{ roomId }`：加入聊天室頻道。
  - `leave_room` `{ roomId }`：離開聊天室頻道。
  - `send_message` `{ roomId, content, replyTo? }`：發送訊息，廣播 `new_message`（`MessageWithSender`）。
  - `recall_message` `{ messageId }`：收回訊息，廣播 `message_recalled` `{ messageId }`。
  - `typing` `{ roomId, isTyping }`：打字狀態，廣播 `user_typing` `{ roomId, userId, isTyping }`。

---

## 2. 給前端部門的測試與串接指南

### 🚀 如何啟動本地測試環境

**1. 準備環境變數**

請確保根目錄下有 `.env` 檔案。如果沒有，直接複製範例檔（預設配置可直接使用）：
```bash
cp .env.example .env
```
*(前端會自動抓取 `NEXT_PUBLIC_API_URL=http://localhost:4000` 作為後端位址)*

**2. 啟動 Docker 服務**

請確認 Docker 正在運行，然後於專案根目錄執行：
```bash
docker compose up -d
```
這會啟動三個容器：
- `db` (PostgreSQL, Port: 5432)
- `backend` (Express API, Port: 4000)
- `frontend` (Next.js, Port: 3000)

**3. 建立資料庫資料表 (Migration)**

第一次啟動或重置資料庫後，需透過後端容器執行 Migration 腳本：
```bash
docker compose exec backend pnpm run migrate:up
```
若跳過此步驟，後端在存取資料時會噴出「Table does not exist」的 500 錯誤。

**4. 驗證服務狀態**

- **前端**：開啟瀏覽器前往 [http://localhost:3000](http://localhost:3000)
- **後端**：使用 Postman 或 cURL 測試。例如測試註冊：
  ```bash
  curl -X POST http://localhost:4000/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name": "testuser", "email": "test@example.com", "password": "password123"}'
  ```

**5. Socket.IO 連線資訊**

後端 Socket 支援 JWT 認證，連線時請於 `auth.token` 參數帶上登入取得的 JWT：

```ts
const socket = io('http://localhost:4000', {
  auth: { token: '<JWT from /auth/login>' }
});
```

| Client → Server | Payload | 說明 |
|----------------|---------|------|
| `join_room` | `{ roomId }` | 加入房間頻道 |
| `leave_room` | `{ roomId }` | 離開房間頻道 |
| `send_message` | `{ roomId, content, replyTo? }` | 發送訊息 |
| `recall_message` | `{ messageId }` | 收回訊息 |
| `typing` | `{ roomId, isTyping }` | 打字狀態 |

| Server → Client | Payload | 說明 |
|----------------|---------|------|
| `new_message` | `MessageWithSender` | 新訊息廣播 |
| `message_recalled` | `{ messageId }` | 訊息收回廣播 |
| `user_typing` | `{ roomId, userId, isTyping }` | 打字狀態廣播 |
| `error` | `{ statusCode, message }` | 錯誤回報 |

**6. 清空測試資料（重置資料庫）**

若需清除測試帳號與訊息紀錄：
```bash
docker compose down -v
```
這會刪除容器與 `pgdata` 資料卷。重新啟動後記得再執行一次 `migrate:up`。
