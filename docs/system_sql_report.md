# 系統資料庫 SQL 指令對照與用途說明報告 (refactor-basic-sql-queries 分支最新版)

本報告根據 **`refactor-basic-sql-queries`** 分支的最新 Commit（包含已簡化的 Repository SQL 與引進的 Database Views）進行整理。詳細列出目前系統中每一個功能所對應的資料庫 SQL 指令（增、刪、改、查），並說明後端接收到這些資料後的業務邏輯與重構重點。

---

## 💡 重構核心設計理念
在最新的 `refactor-basic-sql-queries` 分支中，系統進行了關鍵的 SQL 語法簡化：
1. **移除複雜的巢狀子查詢與 Lateral Join**：原本在 SQL 中大量使用的 Lateral Join（如拉取訊息的附件、提及名單、聊天室的最新訊息與未讀數等）已被完全拆除。
2. **引進資料庫視圖 (Views)**：建立如 `message_with_sender_view` 與 `room_last_message_view` 等視圖，將基本的 Table Join 移至視圖處理，讓 Repository 代碼中的查詢極簡化。
3. **分解查詢並由 JavaScript 與輕量 SQL 進行關聯處理**：將原先龐大、難以優化的單一 SQL 拆解成多個平行且簡單的基礎查詢。其中，未讀訊息計數在 SQL 端透過 CTE 配合視窗函數（限制每個房間最高統計 100 筆）與 `COUNT(*)` 直接分組統計，而 Node.js 端僅以 Map 做數值對照與關聯拼接，最小化網路頻寬、資料庫 I/O 與 Node.js 的記憶體 CPU 開銷。

---

## 1. 訊息管理 (MessageRepository) - Ray
本模組在最新 Commit 中重構幅度最大。原本大量使用 Nest/Lateral Join 的 SQL，目前均已簡化。

### 核心私有方法：`fetchMessageWithSenderByIds`
此方法為重構後的核心，將訊息的基礎欄位、發送者、提及以及附件，拆解為三個獨立且簡單的 SQL 平行查詢，並在記憶體中合併。

* **SQL 語句 1 (查詢訊息主表與發送者基本資訊 - 呼叫視圖)**：
  ```sql
  SELECT *
  FROM message_with_sender_view
  WHERE message_id = ANY($1::uuid[]);
  ```
* **SQL 語句 2 (查詢提及名單)**：
  ```sql
  SELECT message_id, user_id
  FROM message_mentions
  WHERE message_id = ANY($1::uuid[]);
  ```
* **SQL 語句 3 (查詢附件名單)**：
  ```sql
  SELECT attachment_id, message_id, uploaded_by, file_type, original_name, uploaded_at
  FROM attachments
  WHERE message_id = ANY($1::uuid[])
  ORDER BY uploaded_at ASC;
  ```
* **後端用途**：當其他公開方法獲取訊息 ID 後，後端呼叫此方法，將這三部分數據在 Node.js 內用 `Map` 合併，組裝成完整的 `MessageWithSender` 物件（包含 `sender` 物件、`mentions` 陣列、`attachments` 陣列），並將軟刪除用戶的名稱格式化為 `"Deleted User"`。聊天訊息

---

### 查詢 (Read / Select)

#### `findById`
* **SQL 語句**：
  ```sql
  SELECT * FROM messages WHERE message_id = $1;
  ```
* **後端用途**：確認訊息是否存在。主要用於收回訊息、回覆訊息前的發送人與存在性驗證。

#### `findByRoom` (分頁載入)
* **SQL 語句**：
  * *有傳入 `beforeId`（分頁載入歷史紀錄）*：
    ```sql
    -- 1. 先查出該游標訊息的發送時間
    SELECT sent_at, message_id FROM messages WHERE message_id = $1 AND room_id = $2;
    
    -- 2. 分頁查詢更早的訊息 ID 清單 (主 SQL 簡化為僅查 ID)
    SELECT message_id
    FROM messages
    WHERE room_id = $1
      AND ($5::timestamptz IS NULL OR sent_at >= $5)
      AND (sent_at, message_id) < ($2, $3)
    ORDER BY sent_at DESC, message_id DESC
    LIMIT $4;
    ```
  * *無游標（載入最新訊息）*：
    ```sql
    SELECT message_id
    FROM messages
    WHERE room_id = $1
      AND ($3::timestamptz IS NULL OR sent_at >= $3)
    ORDER BY sent_at DESC, message_id DESC
    LIMIT $2;
    ```
* **後端用途**：**載入歷史訊息**。後端執行上述基礎 SQL 取得訊息 ID 列表後，再調用 `fetchMessageWithSenderByIds` 批量載入完整訊息資料回傳給前端。

---

### 新增 (Create / Insert)

#### `create` (在 Transaction 事務中執行)
* **SQL 語句**：
  ```sql
  -- 1. 新增訊息主表
  INSERT INTO messages (room_id, sender_id, content, reply_to_id)
  VALUES ($1, $2, $3, $4)
  RETURNING message_id;
  
  -- 2. 若有提及他人，寫入關聯表
  INSERT INTO message_mentions (message_id, user_id) VALUES ($1, $2);
  
  -- 3. 若有附件，更新附件歸屬
  UPDATE attachments 
  SET message_id = $1 
  WHERE attachment_id = ANY($2::uuid[]) AND message_id IS NULL;
  ```
* **後端用途**：**發送訊息**。重構後的程式碼在 Transaction 內僅執行最基礎的寫入，寫入成功後再呼叫 `fetchMessageWithSenderByIds` 獲取剛發送的訊息物件，並透過 WebSocket (Socket.IO) 即時推播給群內在線成員。

---

### 修改 (Update)

#### `markRecalled`
* **SQL 語句**：
  ```sql
  UPDATE messages
  SET is_recalled = true
  WHERE message_id = $1
  RETURNING message_id;
  ```
* **後端用途**：**收回訊息**。後端在此處捨棄了原本長達數十行的 `WITH...SELECT` 合併查詢，改為執行此最簡單的 Update。更新完成後再呼叫 `fetchMessageWithSenderByIds` 獲取最新的收回訊息狀態，並對前端廣播收回事件。

---

## 2. 聊天室管理 (RoomRepository) - Mahiro

### 查詢 (Read / Select)

#### `findById`
* **SQL 語句**：
  ```sql
  SELECT * FROM chat_rooms WHERE room_id = $1;
  ```
* **後端用途**：獲取聊天室設定資料（類型、審批設定、歷史訊息可見性等），用於發話或管理前的權限檢查。

#### `findByInviteCode`
* **SQL 語句**：
  ```sql
  SELECT * FROM chat_rooms WHERE invite_code = $1;
  ```
* **後端用途**：透過邀請碼定位聊天室，供新成員申請入群。

#### `findPrivateRoomByMembers`
* **SQL 語句**：
  ```sql
  SELECT r.* FROM chat_rooms r
  JOIN room_members rm1 ON r.room_id = rm1.room_id AND rm1.user_id = $1
  JOIN room_members rm2 ON r.room_id = rm2.room_id AND rm2.user_id = $2
  WHERE r.type = 'private'
  ORDER BY r.is_archived ASC, r.created_at DESC
  LIMIT 1;
  ```
* **後端用途**：確認兩位用戶間是否已有私聊對話框。有的話直接跳轉，否則才創建新聊天室。

#### `findByMember` (核心重構方法)
在最新 Commit 中，原本用來計算未讀數與最新訊息的 Lateral Join 已經被移除，改為透過 `room_last_message_view` 進行基礎 JOIN，並將未讀數與私聊成員判定拆分。

* **SQL 語句 1 (查詢聊天室基本資訊與最新訊息 - 呼叫視圖)**：
  ```sql
  SELECT cr.*, rm.join_time, rm.last_read_id, last_read.sent_at AS last_read_sent_at,
         latest.message_id AS latest_message_id, latest.sender_id AS latest_sender_id,
         latest.content AS latest_content, latest.sent_at AS latest_sent_at
  FROM chat_rooms cr
  JOIN room_members rm ON rm.room_id = cr.room_id
  LEFT JOIN messages last_read ON last_read.message_id = rm.last_read_id
  LEFT JOIN room_last_message_view latest ON latest.room_id = cr.room_id
  WHERE rm.user_id = $1;
  ```
* **SQL 語句 2 (分組統計各聊天室的未讀訊息數量 - 使用視窗函數與 COUNT(*) 限制上限 100)**：
  ```sql
  WITH filtered_unread_messages AS (
    SELECT 
      m.room_id,
      ROW_NUMBER() OVER (
        PARTITION BY m.room_id 
        ORDER BY m.sent_at DESC
      ) as rn
    FROM messages m
    JOIN chat_rooms cr ON cr.room_id = m.room_id
    JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = $1
    LEFT JOIN messages last_read ON last_read.message_id = rm.last_read_id
    WHERE m.room_id = ANY($2::uuid[])
      AND (m.sender_id IS NULL OR m.sender_id != $1)
      AND (last_read.sent_at IS NULL OR m.sent_at > last_read.sent_at)
      AND (cr.view_history = true OR m.sent_at >= rm.join_time)
  )
  SELECT room_id, COUNT(*)::int AS unread_count
  FROM filtered_unread_messages
  WHERE rn <= 100
  GROUP BY room_id;
  ```
* **SQL 語句 3 (拉取私聊中的對方成員 ID)**：
  ```sql
  SELECT room_id, user_id
  FROM room_members
  WHERE room_id = ANY($1::uuid[]) AND user_id != $2;
  ```
* **後端用途**：**載入聊天列表**。後端將聊天室基本資訊、最新消息、直接由 SQL 統計出的未讀數（小於等於 100 筆）、以及對方的成員 ID 合併包裝成 `RoomSummary` 陣列，排序後回傳給前端。

---

### 新增 (Create / Insert)

#### `create`
* **SQL 語句**：
  ```sql
  INSERT INTO chat_rooms (type, name, avatar_url, invite_code, require_approval, view_history)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *;
  ```
* **後端用途**：建立群組聊天室或私聊。

---

### 修改 (Update)

#### `update`
* **SQL 語句**：
  ```sql
  UPDATE chat_rooms
  SET name = $1, avatar_url = $2, require_approval = $3, view_history = $4, is_archived = $5, is_readonly = $6
  WHERE room_id = $n
  RETURNING *;
  ```
* **後端用途**：群組管理員修改聊天室設定，或系統自動封存對話。

---

### 刪除 (Delete)

#### `delete`
* **SQL 語句**：
  ```sql
  DELETE FROM chat_rooms WHERE room_id = $1;
  ```
* **後端用途**：解散聊天室，並透過外鍵級聯刪除自動清除關聯資料。

---
---

## 3. 使用者管理 (UserRepository) - Hank

### 查詢 (Read / Select)

#### `findById` / `findByEmail`
* **SQL 語句**：
  ```sql
  SELECT user_id, name, email, password_hash, bio, avatar_url, lang_preference, app_theme, notify_desktop, notify_sound, warning_enabled, warning_days, last_activity, created_at, deleted_at 
  FROM users 
  WHERE user_id = $1 (或 email = $1) AND deleted_at IS NULL;
  ```
* **後端用途**：驗證用戶身分、獲取個人偏好設定；用於登入比對與帳戶設定頁面。

#### `search` (在最新 Commit 中重構)
* **SQL 語句**：
  將原本的 `ILIKE` 改成了相容性更好且可以利用 Standard Index 優化的 `LOWER(name) LIKE LOWER($1)`。
  ```sql
  SELECT ... FROM users 
  WHERE (LOWER(name) LIKE LOWER($1) OR user_id::text = $2 OR LOWER(email) LIKE LOWER($1)) 
    AND deleted_at IS NULL 
  LIMIT 20;
  ```
* **後端用途**：加好友或拉人進群時的模糊搜尋。

#### `findAllWarningEnabled`
* **SQL 語句**：
  ```sql
  SELECT user_id, last_activity, warning_days 
  FROM users 
  WHERE warning_enabled = true AND deleted_at IS NULL;
  ```
* **後端用途**：不活躍偵測。Cron Job 讀取此資料後，在程式碼中計算是否已達不活躍臨界點，用以觸發警報。

---

### 新增 (Create / Insert)

#### `create`
* **SQL 語句**：
  ```sql
  INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *;
  ```
* **後端用途**：註冊新用戶。

---

### 修改 (Update)

#### `update`
* **SQL 語句**：
  ```sql
  UPDATE users SET name = $1, ... WHERE user_id = $n RETURNING *;
  ```
* **後端用途**：修改個人設定或主題偏好；在停用帳戶時將 `deleted_at` 標記為目前時間（軟刪除）。

---

### 刪除 (Delete)

#### `delete`
* **SQL 語句**：
  ```sql
  DELETE FROM users WHERE user_id = $1;
  ```
* **後端用途**：實體刪除（通常在清理測試數據時使用）。

---
---

## 4. 刷新憑證管理 (RefreshTokenRepository) - Ray

### 新增/修改 (RTR 與 Token 吊銷)

#### `create` / `rotate` / `revoke`
* **SQL 語句**：
  * *新增*：
    ```sql
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *;
    ```
  * *吊銷*：
    ```sql
    UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = COALESCE($2, replaced_by) WHERE token_id = $1;
    ```
  * *吊銷使用者全部憑證*：
    ```sql
    UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL;
    ```
* **後端用途**：實作 JWT 重新簽發與 Refresh Token Rotation 機制。後端用以管理使用者登入會話的生命週期，並防範 Token 竊取攻擊。

---

### 查詢 (Read / Select)

#### `findByHash`
* **SQL 語句**：
  ```sql
  SELECT * FROM refresh_tokens WHERE token_hash = $1;
  ```
* **後端用途**：無感刷新 Access Token 時，後端用以確認 Refresh Token 是否合法、過期或已被惡意重放。

---
---

## 5. 好友與封鎖關係 (FriendRepository) - Blade

### 查詢 (Read / Select)

#### `getPendingRequests`
* **SQL 語句**：
  ```sql
  SELECT f.requester_id, f.addressee_id, f.status, f.created_at,
         ur.user_id as req_user_id, ur.name as req_name, ur.avatar_url as req_avatar_url,
         ua.user_id as add_user_id, ua.name as add_name, ua.avatar_url as add_avatar_url
  FROM friendships f
  JOIN users ur ON ur.user_id = f.requester_id AND ur.deleted_at IS NULL
  JOIN users ua ON ua.user_id = f.addressee_id AND ua.deleted_at IS NULL
  WHERE (f.addressee_id = $1 OR f.requester_id = $1) AND f.status = 'pending';
  ```
* **後端用途**：取得當前用戶所有的好友申請清單，包含對方基本資料。

#### `getFriends`
* **SQL 語句**：
  分別查出「我發送的好友申請」與「我接受的好友申請」且皆未被封鎖的項目：
  ```sql
  SELECT f.created_at as friendship_created_at, u.user_id, u.name, u.email, u.avatar_url
  FROM friendships f
  JOIN users u ON u.user_id = f.addressee_id AND u.deleted_at IS NULL
  WHERE f.requester_id = $1 AND f.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM blocks b 
      WHERE (b.blocker_id = f.requester_id AND b.blocked_id = f.addressee_id)
         OR (b.blocker_id = f.addressee_id AND b.blocked_id = f.requester_id)
    );
  ```
* **後端用途**：載入好友清單。後端會執行兩個方向的 SQL 查詢並在 JS 記憶體中合併回傳。

#### `isBlocked` / `areFriends`
* **SQL 語句**：
  * *是否封鎖*：
    ```sql
    SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1);
    ```
  * *是否好友*：
    ```sql
    SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1));
    ```
* **後端用途**：安全與權限校驗。阻止已封鎖用戶發言或加好友。

---

### 新增/修改/刪除 (Create / Update / Delete)
* **好友申請與接受**：
  * `sendFriendRequest` -> `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`
  * `acceptFriendRequest` -> `UPDATE friendships SET status = 'accepted' WHERE ...`
  * `rejectFriendRequest` -> `DELETE FROM friendships WHERE ... AND status = 'pending'`
  * `deleteFriendship` -> `DELETE FROM friendships WHERE ...`
* **封鎖功能**：
  * `blockUser` -> `INSERT INTO blocks (blocker_id, blocked_id) VALUES ... ON CONFLICT DO NOTHING`
  * `unblockUser` -> `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`
* **後端用途**：控制好友關係與封鎖名單的狀態流轉。

---
---

## 6. 聊天室成員管理 (RoomMemberRepository) - Mahiro

### 查詢 (Read / Select)

#### `findMember` / `findByRoom`
* **SQL 語句**：
  ```sql
  SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2 (或 ORDER BY join_time ASC);
  ```
* **後端用途**：檢查該用戶是否屬於此聊天室，或列出群組的所有成員。

#### `resolveMentions`
* **SQL 語句**：
  ```sql
  SELECT u.user_id 
  FROM room_members rm 
  JOIN users u ON rm.user_id = u.user_id 
  WHERE rm.room_id = $1 
    AND (u.name = ANY($2) OR rm.nickname = ANY($2));
  ```
* **後端用途**：在訊息發送時，如果帶有 `@暱稱`，後端用以查出群組內對應成員的 UUID，以寫入提及關聯。

---

### 新增/修改/刪除 (Create / Update / Delete)
* **加群與退群**：
  * `add` -> `INSERT INTO room_members (room_id, user_id, role) VALUES ...`
  * `remove` -> `DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`
* **群內設定與已讀**：
  * `update` -> `UPDATE room_members SET role = $1, nickname = $2, is_muted = $3, last_read_id = $4 WHERE room_id = $5 AND user_id = $6`
* **後端用途**：更新使用者在聊天室的角色權限、靜音狀態與已讀訊息 ID。

---
---

## 7. 附件管理 (AttachmentRepository) - Hank

### 新增/查詢 (Create / Read)
* **建立上傳紀錄**：
  `create` -> `INSERT INTO attachments (uploaded_by, file_path, file_type, original_name) VALUES ... RETURNING *`
* **查詢下載**：
  `findById` -> `SELECT * FROM attachments WHERE attachment_id = $1`
* **後端用途**：當使用者上傳檔案時暫存紀錄（此時訊息 ID 為 NULL），待訊息正式發送後在 Transaction 中與 Message 綁定；下載時後端藉此讀取實體檔案並以串流回傳。

---
---

## 8. 資料夾分類 (FolderRepository)

### 新增/查詢/修改/刪除
* **建立**：`create` -> `INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING *`
* **查詢**：
  * `SELECT folder_id, user_id, name, created_at FROM folders WHERE user_id = $1 ORDER BY created_at ASC`
  * `SELECT folder_id, room_id FROM folder_rooms WHERE user_id = $1`
* **更新分類成員**：
  在 Transaction 中先 `DELETE FROM folder_rooms WHERE folder_id = $1`，再 `INSERT INTO folder_rooms (folder_id, room_id, user_id) VALUES ($1, $2, $3)`
* **更名**：`rename` ->
  ```sql
  -- 1. 更新資料夾名稱
  UPDATE folders SET name = $1 WHERE folder_id = $2 AND user_id = $3 RETURNING *;
  
  -- 2. 獲取該資料夾下所有聊天室關聯 ID
  SELECT room_id FROM folder_rooms WHERE folder_id = $1;
  ```
* **刪除**：`DELETE FROM folders WHERE folder_id = $1 AND user_id = $2`
* **後端用途**：管理與維護用戶自訂的聊天分組標籤，提供資料夾名稱的客製化、聊天室分類及刪除，以便對聊天列表進行客製化分組。

---
---

## 9. 緊急聯絡人與警報監控 (EmergencyContactRepository) - Hank

### 查詢 (Read / Select)

#### `findByUserId`
* **SQL 語句**：
  ```sql
  SELECT ec.*, u.name, u.email, u.avatar_url 
  FROM emergency_contacts ec
  JOIN users u ON ec.contact_id = u.user_id
  WHERE ec.user_id = $1;
  ```
* **後端用途**：展示該用戶當前設定的所有緊急聯絡人及聯絡訊息。

#### `recordAlertIfNew`
* **SQL 語句**：
  * *防重查*：`SELECT 1 FROM emergency_alert_logs WHERE user_id = $1 AND last_activity_at = $2`
  * *寫入*：`INSERT INTO emergency_alert_logs (user_id, last_activity_at) VALUES ($1, $2)`
* **後端用途**：警報流控。確保針對同一段不活躍的判定時間點，後端只會向緊急聯絡人發送一次警訊郵件，不會重複洗信。

---

### 新增/修改 (Upsert - Transaction 事務)

#### `upsert`
* **SQL 語句**：
  ```sql
  -- 1. 檢查是否已有設定
  SELECT user_id, contact_id FROM emergency_contacts WHERE user_id = $1 AND contact_id = $2;
  -- 2. 存在則修改
  UPDATE emergency_contacts SET message = $3 WHERE user_id = $1 AND contact_id = $2;
  -- 3. 不存在則新增
  INSERT INTO emergency_contacts (user_id, contact_id, message) VALUES ($1, $2, $3);
  ```
* **後端用途**：使用者新增或修改其緊急聯絡留言。

---

### 刪除 (Delete)

#### `delete`
* **SQL 語句**：
  ```sql
  DELETE FROM emergency_contacts WHERE user_id = $1 AND contact_id = $2;
  ```
* **後端用途**：移除緊急聯絡人。
