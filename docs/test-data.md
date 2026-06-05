# 預設測試資料 (Test Data)

為了方便本機與 Docker 環境的開發與驗證，系統提供了一組可重現的測試資料。
你可以透過執行 seed script 來將這些資料注入至資料庫中。

## 如何匯入測試資料

在啟動 Docker 容器後，執行以下指令：

```bash
docker compose exec backend pnpm run db:seed
```

這會清空當前資料庫中的相關資料表，並重新寫入以下的測試資料。

## 預設使用者 (Users)

所有使用者的預設密碼皆為：`password123`

| 姓名    | Email              | User ID                                | 備註                 |
| ------- | ------------------ | -------------------------------------- | -------------------- |
| Alice   | `alice@test.com`   | `11111111-1111-4111-a111-111111111111` | 預設群組的管理員(群主) |
| Bob     | `bob@test.com`     | `22222222-2222-4222-a222-222222222222` | 預設群組的 Admin     |
| Charlie | `charlie@test.com` | `33333333-3333-4333-a333-333333333333` |                      |
| Dave    | `dave@test.com`    | `44444444-4444-4444-a444-444444444444` |                      |
| Eve     | `eve@test.com`     | `55555555-5555-4555-a555-555555555555` |                      |
| Frank   | `frank@test.com`   | `66666666-6666-4666-a666-666666666666` |                      |

## 好友關係 (Friendships)

| 狀態    | 關係                     |
| ------- | ------------------------ |
| 已接受  | Alice & Bob 互為好友     |
| 已接受  | Alice & Charlie 互為好友 |
| 待確認  | Dave 發送好友請求給 Alice  |

## 封鎖名單 (Blocks)

| 狀態   | 關係                     |
| ------ | ------------------------ |
| 已封鎖 | Eve 封鎖了 Alice         |

## 群組聊天室 (Group Rooms)

預設會建立一個名為 **Study Group** 的群組聊天室。

- **Room ID:** `77777777-7777-4777-a777-777777777777`
- **邀請碼 (Invite Code):** `STUDY123`
- **審核機制 (Require Approval):** 關閉 (`false`)
- **歷史訊息可見 (View History):** 開啟 (`true`)

### 群組成員

| 使用者  | 角色   |
| ------- | ------ |
| Alice   | Owner  |
| Bob     | Admin  |
| Charlie | Member |
| Frank   | Member |

### 預設訊息

群組內會預先放入兩則基礎訊息，方便測試 WebSocket 接收與前端 UI 渲染：

1. **Alice:** "Hello everyone! Welcome to the study group."
2. **Bob:** "Hi Alice, thanks for inviting me!"

## 適用驗證場景

這套測試資料非常適合用來驗證以下常見流程：
- 使用 `alice@test.com` 或 `bob@test.com` 登入與登出流程
- 確認首頁的好友列表與上線狀態
- 同意或拒絕 Dave 送來的好友請求
- 在群組聊天室內發送訊息，驗證 WebSocket 廣播功能
- 測試群組設定、踢人、權限轉移 (Alice 與 Bob 皆具有管理權限)
- 測試已封鎖的使用者 (Eve) 的相關互動限制
