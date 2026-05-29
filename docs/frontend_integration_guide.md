# `dev` 分支近期改動總覽與前端測試指南

## 1. 近期 `dev` 分支改動總覽

### 🔧 後端基礎設施與 API (Backend)
- **架構與錯誤處理**：引入了 `AppError` 階層機制與 Express 全域錯誤處理器。
- **資料庫與遷移**：設定了 PostgreSQL 遷移腳本 (`migrate:up`)，並在 Docker 測試環境中加入了自動執行機制。
- **共用型別 (Shared Types)**：建立了 `shared/` 卷宗，統一管理前後端的型別定義，避免 API 介面不一致。
- **Repository 與 Service 實作**：完成了 `IUserRepository` 及 `RoomRepository` 的 PostgreSQL 實作，並具備完整的 Vitest 整合測試。加入了 `UserService`。
- **認證機制**：實作了 `auth` Middleware，能驗證並解析 JWT Token。
- **REST API (目前已開放)**：
  - `POST /auth/register` (註冊)
  - `POST /auth/login` (登入)
  - `GET /rooms` (取得聊天室列表)
  - `POST /rooms` (新增群組聊天室)
  - `GET /rooms/:id/messages` (取得特定聊天室歷史訊息)
- **WebSocket (Socket.IO)**：
  - 完成 Socket.IO 伺服器建置，並整合 JWT 驗證。
  - 實作了 `join_room` 事件用於加入特定聊天室頻道。
  - 實作了 `send_message` 事件發送訊息至資料庫，並透過 `new_message` 向房內客戶端廣播。

---

## 2. 給前端部門的測試與串接指南

為協助前端工程師替換 Mock Data 為真實 API，請參照以下步驟進行本地測試與開發：

### 🚀 如何啟動本地測試環境

**1. 準備環境變數**
請確保根目錄下有 `.env` 檔案。如果沒有，請直接複製範例檔（預設配置即可直接使用）：
```bash
cp .env.example .env
```
*(注意：前端會自動抓取 `NEXT_PUBLIC_API_URL=http://localhost:4000` 作為後端位址)*

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
第一次啟動或是重置資料庫後，必須透過後端容器執行 Migration 腳本來建立資料表 (`users`, `messages` 等)：
```bash
docker compose exec backend pnpm run migrate:up
```
如果沒有執行這一步，後端 API 在寫入或查詢資料時將會噴出「Table does not exist」的 500 錯誤。

**4. 驗證服務狀態**
- **前端測試**：開啟瀏覽器前往 [http://localhost:3000](http://localhost:3000) 
- **後端測試**：你可以使用 Postman 或 cURL 測試 API 是否正常。例如測試註冊功能：
  ```bash
  curl -X POST http://localhost:4000/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name": "testuser", "email": "test@example.com", "password": "password123"}'
  ```

**5. Socket.IO 連線資訊**
- 後端 Socket 支援 JWT 認證，連線時請於 `auth.token` 參數中帶上登入取得的 JWT。
- **發送訊息**：使用 `send_message` 事件，夾帶 `{ roomId, content }`。
- **接收訊息**：監聽 `new_message` 事件來取得其他人的發言與系統廣播。

**6. 如何清空測試資料 (重置資料庫)**
如果在開發與測試過程中想要清除資料庫內部的測試帳號與訊息紀錄，請在專案根目錄執行以下指令：
```bash
docker compose down -v
```
這會關閉容器並連同掛載的 `pgdata` 資料卷一起刪除。當您再次啟動 (`docker compose up -d`) 時，資料庫將會回到乾淨的初始狀態（請記得要進入 backend 容器重新執行 `pnpm run migrate:up` 來重建資料表）。
