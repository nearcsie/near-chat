# Project Database Design Document (ER-Diagram)

## 1. Professional ER-Diagram (Chen's Notation with Cardinality)

```mermaid
flowchart TD
    %% --- Style Definitions ---
    classDef entity fill:#fff,stroke:#01579b,stroke-width:2px;
    classDef header fill:#e1f5fe,stroke:#01579b,stroke-width:2px,font-weight:bold;
    classDef relation fill:#fff,stroke:#333,stroke-width:1.5px,font-style:italic;

    %% --- Entity Layer 1: Actors & Organization ---
    User["<b>User</b><hr/><u>id</u><br/>email<br/>name<br/>bio<br/>last_activity"]
    Folder["<b>Folder</b><hr/><u>id</u><br/>name<br/>user_id"]
    class User,Folder entity;

    %% --- Entity Layer 2: Logic & Channel ---
    ChatRoom["<b>ChatRoom</b><hr/><u>id</u><br/>type<br/>name<br/>invite_code"]
    RoomMember["<b>RoomMember</b><hr/>role<br/>nickname<br/>join_time"]
    class ChatRoom,RoomMember entity;

    %% --- Entity Layer 3: Content & Data ---
    Message["<b>Message</b><hr/><u>id</u><br/>content<br/>is_recalled<br/>sent_at"]
    Attachment["<b>Attachment</b><hr/><u>id</u><br/>file_path<br/>file_type<br/>original_name"]
    class Message,Attachment entity;

    %% --- Relationship Diamonds ---
    rel_friend{friendship}
    rel_block{block}
    rel_emergency{emergency}
    rel_owns{owns}
    rel_folder_chat{grouped_in}
    rel_member{is_member}
    rel_room{belongs_to}
    rel_sends{sends}
    rel_contains{contains}
    rel_attach{has_attach}
    rel_mention{mentions}
    rel_reply{replies_to}

    %% --- Layout & Connections with Cardinality (1, N, M) ---
    
    %% User Social (Top) - N:M Relationships
    User -- N --- rel_friend
    rel_friend -- M --- User
    
    User -- 1 --- rel_block
    rel_block -- N --- User
    
    User -- 1 --- rel_emergency
    rel_emergency -- N --- User

    %% User to Room (Middle)
    User -- 1 --- rel_member
    rel_member -- N --- RoomMember
    RoomMember -- N --- rel_room
    rel_room -- 1 --- ChatRoom
    
    %% Folder Organization (Side)
    User -- 1 --- rel_owns
    rel_owns -- N --- Folder
    Folder -- N --- rel_folder_chat
    rel_folder_chat -- M --- ChatRoom

    %% Messaging (Bottom)
    User -- 1 --- rel_sends
    rel_sends -- N --- Message
    
    ChatRoom -- 1 --- rel_contains
    rel_contains -- N --- Message
    
    Message -- 1 --- rel_attach
    rel_attach -- N --- Attachment
    
    Message -- N --- rel_mention
    rel_mention -- M --- User
    
    Message -- N --- rel_reply
    rel_reply -- 1 --- Message

    %% --- Styling Applied ---
    style rel_friend stroke-dasharray: 5 5
    style rel_block stroke-dasharray: 5 5
```

---

## 2. 詳細設計規格說明

### A. 核心實體與屬性定義
| 實體 (Entity) | 角色功能 | 屬性詳解 |
| :--- | :--- | :--- |
| **User** | 系統的核心使用者 | `id` (主鍵), `email` (唯一索引), `name` (姓名), `password_hash`, `bio`, `last_activity`, `warning_enabled`, `warning_days`, `deleted_at`, `lang_preference`, `app_theme`, `notify_desktop`, `notify_sound` |
| **ChatRoom** | 溝通的管道橋樑 | `id` (主鍵), `type` (私訊/群組), `name` (群組名稱), `avatar_url`, `invite_code` (唯一索引), `require_approval`, `view_history`, `is_archived`, `is_readonly` |
| **Message** | 系統主要資料流 | `id` (主鍵), `room_id` (外鍵), `sender_id` (外鍵), `content`, `reply_to_id` (遞迴外鍵), `is_recalled`, `sent_at` |
| **Folder** | 使用者端的聊天室分類 | `id` (主鍵), `user_id` (外鍵), `name` (資料夾名稱) |
| **Attachment** | 訊息中的檔案附件 | `id` (主鍵), `message_id` (外鍵), `uploaded_by` (外鍵), `file_path`, `file_type`, `original_name`, `uploaded_at` |

### B. 關係邏輯與基數 (Cardinality) 說明
1.  **聊天室成員關係 (1:N:1)**:
    *   `User (1) --- (N) RoomMember (N) --- (1) ChatRoom`。
    *   一位使用者可擁有數個成員身分，一個聊天室擁有多位成員。
    *   **定義身份**: **Owner**, **Admin**, **Member**, **Pending**。

2.  **社交圖譜 (1:N 與 N:M)**:
    *   **Friendship (N:M)**：多位使用者與多位使用者間的雙向好友關係。
    *   **Block (1:N)**：一位使用者可以封鎖多位對象。
    *   **EmergencyContact (1:N)**：一位使用者可以指定多位緊急聯絡人。

3.  **內容組織 (1:N 與 N:M)**:
    *   **Folder Ownership (1:N)**：一位使用者擁候多個資料夾。
    *   **Folder Mapping (N:M)**：資料夾與聊天室間的多對多關聯（透過中介表）。
    *   **Messaging (1:N)**：一位使用者發送多則訊息；一個聊天室包含多則訊息。
    *   **Attachments (1:N)**：一則訊息可夾帶多個附件檔案。
    *   **Mentions (N:M)**：一則訊息可標記多位使用者；一位使用者可在多則訊息中被標記。
    *   **Replies (N:1)**：多則訊息可以回覆同一則特定訊息（遞迴關係）。

### C. 進階架構完整性
*   **私隱唯一性 (Privacy Uniqueness)**：系統在建立私聊前會先透過 `findPrivateRoomByMembers(userA, userB)` 檢查是否已存在兩者之間的私訊聊天室，並在 `friendships` 狀態變更時自動建立或重新啟用私訊，以防止重複建立私聊。
*   **資料持久化**: 透過 `User.deleted_at` 實施軟刪除（Soft-delete），確保即使帳號移除後，訊息審計追蹤與歷史脈絡仍能完整保留。
*   **安全自動化**: 系統任務會定期對照 `last_activity` 與 `warning_days`（即遺言模式天數），若超過設定期限則觸發 `緊急聯絡` 的通知程序。
