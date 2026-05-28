# Relational Schema Design

本文件定義「即時文字通訊系統」的資料庫關聯架構。

## 1. 核心實體表

### users (使用者)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| user_id | UUID | 使用者唯一識別碼 | PK, Default: gen_random_uuid() |
| name | VARCHAR(50) | 帳號名稱 | UNIQUE, NOT NULL |
| email | VARCHAR(255) | 電子信箱 | UNIQUE, NOT NULL |
| password_hash | CHAR(60) | 雜湊密碼 (bcrypt) | NOT NULL |
| bio | TEXT | 個人簡介 | |
| avatar_url | VARCHAR(255) | 頭像路徑 | |
| warning_enabled | BOOLEAN | 是否開啟遺言模式 | NOT NULL, DEFAULT FALSE |
| warning_days | INT | 觸發遺言的天數 | DEFAULT 7 |
| last_activity | TIMESTAMP | 最後活躍時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| created_at | TIMESTAMP | 註冊時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### chat_rooms (聊天室)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| room_id | UUID | 聊天室唯一識別碼 | PK, Default: gen_random_uuid() |
| type | VARCHAR(10) | 類型 ('private', 'group') | NOT NULL |
| name | VARCHAR(100) | 群組名稱 | (群組時 NOT NULL) |
| avatar_url | VARCHAR(255) | 群組頭像 | |
| invite_code | VARCHAR(20) | 群組邀請代碼 | UNIQUE |
| require_approval | BOOLEAN | 加入是否須審核 | DEFAULT FALSE |
| view_history | BOOLEAN | 新成員可見歷史訊息 | DEFAULT TRUE |
| is_archived | BOOLEAN | 是否已封存 | DEFAULT FALSE |
| created_at | TIMESTAMP | 建立時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### messages (訊息)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| message_id | UUID | 訊息唯一識別碼 | PK, Default: gen_random_uuid() |
| room_id | UUID | 所屬聊天室 | FK(chat_rooms), NOT NULL |
| sender_id | UUID | 發送者 | FK(users), SET NULL (若帳號刪除) |
| content | TEXT | 訊息內容 | NOT NULL |
| reply_to_id | UUID | 回覆的訊息 ID | FK(messages) |
| is_recalled | BOOLEAN | 是否已被收回 | DEFAULT FALSE |
| sent_at | TIMESTAMP | 發送時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### attachments (附件)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| attachment_id | UUID | 附件唯一識別碼 | PK, Default: gen_random_uuid() |
| message_id | UUID | 所屬訊息 | FK(messages), CASCADE DELETE, NOT NULL |
| file_path | VARCHAR(255) | 儲存路徑 | NOT NULL |
| file_type | VARCHAR(50) | MIME type | NOT NULL |
| original_name | VARCHAR(255) | 原始檔名 | NOT NULL |
| uploaded_at | TIMESTAMP | 上傳時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

## 2. 關係與弱實體表

### room_members (聊天室成員)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| room_id | UUID | 聊天室 ID | PK, FK(chat_rooms), CASCADE DELETE |
| user_id | UUID | 使用者 ID | PK, FK(users), CASCADE DELETE |
| role | VARCHAR(20) | 角色 ('owner', 'admin', 'member', 'pending') | NOT NULL, DEFAULT 'member' |
| nickname | VARCHAR(50) | 在該室的暱稱 | |
| is_muted | BOOLEAN | 是否被禁言 | DEFAULT FALSE |
| last_read_id | UUID | 最後已讀訊息 ID | FK(messages) |
| join_time | TIMESTAMP | 加入時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### friendships (好友關係)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| requester_id | UUID | 發送邀請者 | PK, FK(users), CASCADE DELETE |
| addressee_id | UUID | 接受邀請者 | PK, FK(users), CASCADE DELETE |
| status | VARCHAR(20) | 狀態 ('pending', 'accepted') | NOT NULL |
| created_at | TIMESTAMP | 建立時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### blocks (封鎖關係)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| blocker_id | UUID | 封鎖者 | PK, FK(users), CASCADE DELETE |
| blocked_id | UUID | 被封鎖者 | PK, FK(users), CASCADE DELETE |
| created_at | TIMESTAMP | 封鎖時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### folders (分類資料夾)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| folder_id | UUID | 資料夾唯一識別碼 | PK, Default: gen_random_uuid() |
| user_id | UUID | 擁有者 | FK(users), CASCADE DELETE, NOT NULL |
| name | VARCHAR(50) | 資料夾名稱 | NOT NULL |
| created_at | TIMESTAMP | 建立時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### folder_rooms (資料夾內容)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| folder_id | UUID | 資料夾 ID | PK, FK(folders), CASCADE DELETE |
| room_id | UUID | 聊天室 ID | PK, FK(chat_rooms), CASCADE DELETE |
| user_id | UUID | 使用者 ID (用於限制唯一性) | FK(users), NOT NULL |
| UNIQUE(user_id, room_id) | | 確保同一使用者不能把同一房間放進兩個資料夾 | |

### emergency_contacts (緊急聯絡)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| user_id | UUID | 委託人 | PK, FK(users), CASCADE DELETE |
| contact_id | UUID | 緊急聯絡人 | PK, FK(users), CASCADE DELETE |
| message | TEXT | 預設發送訊息 | NOT NULL |
| created_at | TIMESTAMP | 設定時間 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### message_mentions (訊息提及)
| 欄位名 | 型別 | 說明 | 限制 |
| :--- | :--- | :--- | :--- |
| message_id | UUID | 訊息 ID | PK, FK(messages), CASCADE DELETE |
| user_id | UUID | 被提及者 ID | PK, FK(users), CASCADE DELETE |
