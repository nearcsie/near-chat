# Development Guide

本專案為容器化的聊天通訊應用程式，採用 Next.js、Node.js (Express)、PostgreSQL 與 Socket.io 構建。

---

## 技術說明

- 前端: Next.js (App Router), Tailwind CSS
- 後端: Node.js, Express, Socket.io
- 資料庫: PostgreSQL 18, pg (原生 SQL), node-pg-migrate
- 基礎設施: Docker, Docker Compose
- 包管理: pnpm

---

## 快速啟動環境

### 1. 準備環境變數
請複製專案根目錄的 .env.example 並重新命名為 .env：
```bash
cp .env.example .env
```
注意：.env 檔案已被加入 .gitignore，請勿將其上傳至 Git 儲存庫。

### 2. 啟動容器
使用 Docker Compose 啟動所有服務：
```bash
# 首次啟動或修改 Dockerfile 後請重新編譯
docker compose build

# 啟動服務（分離模式）
docker compose up -d
```

### 3. 確認狀態
```bash
# 查看容器運行狀態
docker compose ps

# 查看後端執行日誌
docker compose logs -f backend
```

---

## 環境變數與常數管理

本專案採用環境變數集中管理所有部署常數。

### 開發環境
1. 建立 .env：首次開發請複製 .env.example 並重新命名。
2. 安全性：.env 已加入 .gitignore 以保護開發密碼與機密。
3. 前端限制：前端環境變數必須以 NEXT_PUBLIC_ 開頭，才能在瀏覽器端存取。

### 部署注意事項
1. 正式環境不依賴原始碼中的 .env 檔案，應直接透過平台面板（如 Vercel, AWS Secrets Manager）注入。
2. 自管伺服器部署時，請在根目錄手動建立正式版 .env 檔案，並設定嚴格的權限（如 chmod 600 .env）。
3. 維護範本：新增變數時請同步更新 .env.example，但請維持留空或填入假資料。

---

## 資料庫管理

### 常用指令
- 建立新的遷移檔: pnpm run migrate:create <name>
- 執行遷移 (Up): pnpm run migrate:up
- 回退遷移 (Down): pnpm run migrate:down

提示：若要在 Docker 容器內執行遷移，可使用以下指令：
```bash
docker compose exec backend pnpm run migrate:up
```

---

## 服務位址
- 前端首頁: http://localhost:3000
- 後端 API: http://localhost:4000
- 資料庫連線: localhost:5432
