# claude advisor artifact

- Provider: claude
- Exit code: 0
- Created at: 2026-05-24T13:38:36.225Z

## Original task

根據專案與 @PLAN.md 推薦用什麼開發模式(DD)? 請分析專案架構（後端 Express + Socket.IO + PostgreSQL，前端 Next.js + React），以及 PLAN.md 中描述的四層架構（Routes → Controllers → Services → Repositories），推薦最適合的開發驅動模式 (TDD/BDD/DDD/等)，並說明理由。

## Final prompt

根據專案與 @PLAN.md 推薦用什麼開發模式(DD)? 請分析專案架構（後端 Express + Socket.IO + PostgreSQL，前端 Next.js + React），以及 PLAN.md 中描述的四層架構（Routes → Controllers → Services → Repositories），推薦最適合的開發驅動模式 (TDD/BDD/DDD/等)，並說明理由。

## Raw output

```text
分析完成。以下是針對這個專案的開發模式建議。

---

## 推薦：**TDD（測試驅動開發）**

---

### 為什麼是 TDD，而不是其他？

| 模式 | 適用場景 | 此專案適合度 |
|------|----------|-------------|
| **TDD** | 邏輯明確、層次分明的系統 | ✅ 最適合 |
| **BDD** | 需求模糊、非技術利害關係人多 | ❌ 小團隊 + 技術背景，工具成本高 |
| **DDD** | 複雜商業領域（保險、金融） | ❌ 聊天室的 domain 很單純 |
| **API-First** | 多前後端團隊同時開發 | ⚠️ 可作為輔助 |

---

### 核心理由：四層架構天生是 TDD 的形狀

PLAN.md 描述的四層架構，每一層都有**明確的輸入/輸出契約**，這正是 TDD 最愛的結構：

```
Routes        → 只測 HTTP 方法、路徑、middleware 是否正確掛載
Controllers   → 只測 req 解包 / res 格式是否正確
Services      ← 最重要：業務邏輯在這裡，mock Repository 來單元測試
Repositories  → 跑真實 DB 的整合測試（你的 user.test.ts 目前就是這個位置）
```

**最高價值的 TDD 點是 Service 層**，例如：

```typescript
// 先寫測試
it('should throw 403 if user is muted', async () => {
  mockRepo.getRoomMember.mockResolvedValue({ is_muted: true });
  await expect(chatService.sendMessage('u1', 'r1', 'hi')).rejects.toThrow('你已被禁言');
});

// 再實作 chatService.sendMessage，讓測試過
```

---

### 現有問題 vs TDD 如何解決

**現狀**：`index.ts` 是一個 Fat Handler，SQL、JWT 驗證、業務邏輯全混在路由裡，根本無法單元測試。

```
index.ts (現在)
├── POST /auth/register ← SQL + bcrypt + jwt 全混在一起
├── GET /rooms/:id/messages ← 直接 pool.query()
└── io.on("send_message") ← SQL + 廣播邏輯混在一起
```

**TDD 的重構流程**：
1. 先為 `userService.createUser()` 寫測試（定義期望行為）
2. 實作 `userRepository` + `userService`
3. 讓測試通過後，把 `index.ts` 的對應 handler 改成只呼叫 service
4. Socket.IO 的 `send_message` handler 也抽成 `messageService.send()`，同樣先測試再實作

---

### 輔助建議：TDD + API-First

由於前後端（Next.js ↔ Express）需要溝通，建議在 Service/Repository TDD 的基礎上，加一份**型別契約**：

```typescript
// shared/types.ts（前後端共用）
export interface Message {
  message_id: string;
  sender_id: string;
  room_id: string;
  content: string;
  sent_time: string;
}
```

這樣 Socket.IO 廣播的 `new_message` payload 和前端 `useState<Message[]>` 不會脫節。

---

### 總結

> **TDD** — 因為你的四層架構已經把「可測試性」設計進去了，現在只差「測試先行」這個習慣。  
> Service 層是核心戰場，用 mock Repository 做快速單元測試；Repository 層再跑一輪真實 DB 的整合測試（`user.test.ts` 的方向是對的，只需要把 Prisma 換成 pg）。

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
