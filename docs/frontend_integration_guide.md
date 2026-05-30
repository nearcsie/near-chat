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

> ⚠️ **Controller / Route 層尚未完成**（Issue #14–#16）。目前 `index.ts` 仍以舊有 inline 方式提供 API；待 controller 重構完成後，路由行為不變但程式碼會整理乾淨。

- **REST API（目前已開放）**：
  - `POST /auth/register` — 註冊
  - `POST /auth/login` — 登入
  - `GET /rooms` — 取得聊天室列表
  - `POST /rooms` — 新增群組聊天室
  - `GET /rooms/:id/messages` — 取得特定聊天室歷史訊息
- **WebSocket (Socket.IO)**：
  - 完成 Socket.IO 伺服器建置，並整合 JWT 驗證。
  - `join_room`：加入特定聊天室頻道。
  - `send_message`：發送訊息至資料庫，並透過 `new_message` 廣播至房內所有客戶端。

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

後端 Socket 支援 JWT 認證，連線時請於 `auth.token` 參數帶上登入取得的 JWT。
- **發送訊息**：emit `send_message`，夾帶 `{ roomId, content }`
- **接收訊息**：監聽 `new_message` 取得廣播訊息

**6. 清空測試資料（重置資料庫）**

若需清除測試帳號與訊息紀錄：
```bash
docker compose down -v
```
這會刪除容器與 `pgdata` 資料卷。重新啟動後記得再執行一次 `migrate:up`。
