# 端對端加密架構設計 (End-to-End Encryption Architecture)

本文件定義即時通訊系統的端對端加密（E2EE）架構：訊息在**客戶端**加密後才送出，資料庫僅儲存密文；伺服器負責金鑰交換的中繼，但**永遠無法解密**任何訊息內容或房間金鑰。

> 取代 [e2e-encryption-scope.md](./e2e-encryption-scope.md) 中「v1 不實作」的範圍決議。

## 1. 威脅模型與設計目標

| 目標 | 說明 |
| :--- | :--- |
| 資料庫零明文 | `messages.content` 只儲存 `E2E.v1:` 密文信封；DBA 或資料庫外洩無法還原訊息 |
| 伺服器零金鑰 | 伺服器只保存「公鑰」與「被公鑰包裝後的房間金鑰」，無法解開任何一層 |
| 私鑰不離開裝置 | RSA 私鑰只存在瀏覽器 localStorage，不經過網路 |
| 本地解密搜尋 | 搜尋在客戶端對「已解密的記憶體內容」進行，查詢字串不離開裝置 |
| 向下相容 | 既有明文歷史訊息原樣顯示；未註冊金鑰的房間自動退回明文模式 |

非目標（課程專案範圍外）：前向保密（Forward Secrecy / 金鑰輪替）、多裝置金鑰同步、加密附件檔案本體、伺服器端可驗證的身分簽章（防中間人）。

## 2. 金鑰階層 (Key Hierarchy)

```
使用者裝置金鑰對 (RSA-OAEP-2048, SHA-256)
 ├─ 公鑰  → 上傳至 users.public_key（SPKI, base64）
 └─ 私鑰  → 僅存於瀏覽器 localStorage（PKCS8, base64）
        │
        └─ 解開 ↓
房間金鑰 (AES-256-GCM，每個聊天室一把)
 └─ 以「每位成員的公鑰」分別包裝後存入 room_keys.encrypted_key
        │
        └─ 加解密 ↓
訊息密文信封  E2E.v1:<iv base64>:<ciphertext base64>   ← 存入 messages.content
```

- **裝置金鑰對**：登入後由 `frontend/src/lib/e2ee.ts` 的 `initE2ee()` 產生或載入，公鑰以 `PUT /users/me/public-key` 註冊（冪等）。
- **房間金鑰**：第一位開啟該房間的已註冊成員在客戶端產生，並為「每一位已註冊公鑰的成員」各包裝一份，透過 `POST /rooms/:id/keys` 一次寫入。
- **訊息加密**：AES-256-GCM，每則訊息隨機 12-byte IV；信封格式版本化（`E2E.v1`）以利未來演算法升級。

## 3. 資料庫設計

Migration：`backend/migrations/2026061100000_e2e_encryption.sql`

```sql
ALTER TABLE users ADD COLUMN public_key TEXT;

CREATE TABLE room_keys (
  room_id       UUID        NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  encrypted_key TEXT        NOT NULL,   -- 房間 AES 金鑰，以該成員公鑰 RSA-OAEP 包裝後的 base64
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
```

設計重點：

- `room_keys` 為弱實體，複合主鍵 `(room_id, user_id)`，房間或使用者刪除時 CASCADE。
- 寫入採 `INSERT ... ON CONFLICT (room_id, user_id) DO NOTHING`：**既有的包裝金鑰永遠不可被覆寫**，防止惡意成員以假金鑰替換他人金鑰（key fixation）；同時讓多個客戶端同時建立房間金鑰時自然收斂於最先寫入的那把（以資料庫為準）。
- `messages` 資料表**不需要任何結構變更**：密文信封以既有 `content TEXT` 欄位儲存，由 `E2E.v1:` 前綴區分明文／密文，新舊訊息共存。

## 4. API 契約（金鑰交換）

所有端點皆需 JWT 認證；房間相關端點需通過成員資格檢查（`pending` 成員拒絕）。詳見 [api-documentation.md](./api-documentation.md)。

| Method | Path | 說明 |
| :--- | :--- | :--- |
| `PUT` | `/users/me/public-key` | 註冊／更新本人公鑰（base64 驗證，≤ 8192 字元） |
| `GET` | `/users/:id/public-key` | 查詢任一使用者公鑰（未註冊回 `publicKey: null`） |
| `GET` | `/rooms/:id/keys` | 房間成員金鑰狀態 `[{ userId, publicKey, hasRoomKey }]`，供客戶端判斷要補發給誰 |
| `GET` | `/rooms/:id/keys/me` | 取得本人被包裝的房間金鑰（尚未分發回 `404`） |
| `POST` | `/rooms/:id/keys` | 分發包裝金鑰 `{ keys: [{ userId, encryptedKey }] }`；收件人必須是房間成員，僅插入缺少者 |

後端分層：`keyRoutes → keyController → keyService → keyRepository`（`backend/src/**/key*.ts`），與既有 Controller→Service→Repository 架構一致。

## 5. 客戶端流程

模組：`frontend/src/lib/crypto.ts`（Web Crypto 原語）、`frontend/src/lib/e2ee.ts`（金鑰生命週期）、整合於 `ChatContext.tsx`。

### 5.1 登入註冊金鑰（initE2ee）

1. localStorage 有金鑰對 → 載入；否則產生 RSA-OAEP-2048 金鑰對並存入。
2. `PUT /users/me/public-key` 冪等註冊（裝置重置後會以新公鑰重新佔位）。

### 5.2 取得房間金鑰（getRoomKey，per-room 快取與去重）

1. `GET /rooms/:id/keys/me` 成功 → 用私鑰解包 → 快取；並在背景檢查 `GET /rooms/:id/keys`，為「已註冊公鑰但尚無金鑰」的成員補發（re-distribution）。
2. `404` 且**沒有任何成員持有金鑰** → 本客戶端產生房間金鑰，為所有已註冊成員包裝並 `POST`；隨後重新 `GET` 自己的金鑰收斂競態。
3. `404` 但**已有其他成員持有金鑰** → 回傳 `null`，等待持有金鑰的成員上線補發（期間訊息顯示 🔒 佔位）。

### 5.3 傳送與接收

- 送出：`handleSendMessage` / 附件說明文字 → `encryptForRoom()` → 取不到金鑰時退回明文（legacy 房間），否則送出 `E2E.v1` 信封。
- 接收／載入歷史：`decryptForRoom()` 在記憶體解密後才進入 React state；解不開時顯示 `🔒 無法解密的訊息` 佔位，明文訊息原樣通過。
- 房間列表預覽：密文信封以 `🔒` 取代，待解密完成後由 state 重新計算為明文預覽。

### 5.4 本地解密搜尋

`Chatroom.tsx` 的搜尋列直接過濾 React state 中**已解密**的訊息內容（大小寫不敏感子字串），結果即時顯示筆數；查詢字串與明文皆不離開裝置——這也是資料庫只有密文之下唯一可行的搜尋方式。

## 6. 安全性分析

| 攻擊面 | 防護 |
| :--- | :--- |
| 資料庫外洩 | 只有密文信封與包裝金鑰，無私鑰即不可解 |
| 惡意伺服器讀取 | 同上；伺服器從未接觸明文或裸金鑰 |
| 成員偽造金鑰覆寫 | `ON CONFLICT DO NOTHING`——已存在的包裝金鑰不可覆寫 |
| 非成員索取金鑰 | 所有 `/rooms/:id/keys*` 端點強制成員資格（含 pending 拒絕） |
| 金鑰分發給外人 | `POST /rooms/:id/keys` 驗證每個收件人皆為房間成員 |
| 重放／竄改密文 | AES-GCM 自帶認證標籤（AEAD），竄改即解密失敗 |

已知限制：

1. **單裝置私鑰**：換裝置後需等其他持鑰成員上線補發；補發前的舊訊息（含補發空窗期）顯示 🔒。
2. **無身分驗證簽章**：公鑰由伺服器轉發，未做指紋比對，理論上伺服器可執行中間人攻擊（課程範圍接受）。
3. **@mention 解析失效**：伺服器無法解析密文中的 `@名稱`，加密房間的提及通知不生效。
4. **附件本體未加密**：僅訊息文字（含附件說明）加密。

## 7. 測試

| 層級 | 檔案 | 涵蓋 |
| :--- | :--- | :--- |
| Unit | `backend/tests/unit/services/keyService.test.ts`（16 例） | 成員資格、404/403、金鑰分發驗證 |
| Unit | `backend/tests/unit/validators/keySchemas.test.ts`（7 例） | base64 與長度驗證 |
| E2E | `backend/tests/e2e/routes/e2ee.e2e.test.ts`（10 例） | 金鑰交換全流程、**密文原樣入庫**、不可覆寫、非成員拒絕 |
