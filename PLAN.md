# 後端分層架構
## 第一層：路由層 (Routes)
*   **具體工作**：
    1.  定義 API 的網址路徑（Endpoint）與 HTTP 方法（GET/POST/PUT/DELETE）。
    2.  掛載中間件，例如：身分驗證（JWT）、欄位格式驗證（如驗證 content 不能為空、roomId 必須是 UUID 格式）。
    3.  指引通過驗證的請求去往哪一個 Controller 函數。
*   **程式碼示意**：
    ```typescript
    // routes/chat.routes.ts
    import { Router } from 'express';
    import { chatController } from '../controllers/chat.controller';
    import { authMiddleware } from '../middlewares/auth.middleware';
    import { validateBody } from '../middlewares/validation.middleware';

    const router = Router();

    // 只有通過 authMiddleware (JWT) 與 validateBody (格式驗證) 的請求，才能進入 controller
    router.post('/messages', authMiddleware, validateBody(sendMessageSchema), chatController.sendMessage);
    ```

## 第二層：控制層 (Controllers)
*   **具體工作**：
    1.  **不處理**任何資料庫 SQL，也**不處理**複雜的業務邏輯。
    2.  只負責「接收資料」與「回傳結果」。
    3.  從 `req` 提取資料（例如：從 `req.user` 拿發送者 ID，從 `req.body` 拿訊息內容與聊天室 ID）。
    4.  呼叫對應的 **Service** 來執行核心邏輯。
    5.  根據 Service 的回傳結果，決定要回傳什麼 HTTP 狀態碼與 JSON（例如：`201 Created` 或 `403 Forbidden`）。
*   **程式碼示意**：
    ```typescript
    // controllers/chat.controller.ts
    export const chatController = {
      sendMessage: async (req, res, next) => {
        try {
          const senderId = req.user.id; // 從 JWT 中間件塞入的 req.user 取得
          const { roomId, content } = req.body;

          // 呼叫 Service 處理核心邏輯
          const newMessage = await chatService.sendMessage(senderId, roomId, content);

          return res.status(201).json(newMessage);
        } catch (error) {
          next(error); // 丟給全域錯誤處理中間件 (Error Middleware)
        }
      }
    };
    ```

## 第三層：服務層 (Services)
*   **具體工作**：
    1.  所有的邏輯處理都寫在這裡。
    2.  這裡面不會出現 `req`、`res` 或任何與 Express 相關的程式碼，http 相關交給前面幾層，這裡專注處理邏輯。
    3.  **執行業務檢查**：
        *   發送者與聊天室是否存在？
        *   如果是私訊，雙方是否為好友關係？發送者有沒有被對方封鎖？
        *   如果是群組，發送者是不是該群組成員？有沒有被禁言？
    4.  檢查完畢後，呼叫 **Repository** 來對資料庫做真正的讀寫。
*   **程式碼示意**：
    ```typescript
    // services/chat.service.ts
    export const chatService = {
      sendMessage: async (senderId: string, roomId: string, content: string) => {
        // 1. 規則檢查：檢查成員關係
        const member = await chatRepository.getRoomMember(senderId, roomId);
        if (!member) {
          throw new CustomError('你不是該聊天室的成員', 403);
        }
        if (member.is_muted) {
          throw new CustomError('你已被禁言', 403);
        }

        // 2. 呼叫 Repository 寫入資料庫
        const message = await chatRepository.createMessage(senderId, roomId, content);
        return message;
      }
    };
    ```

## 第四層：資料存取層 (Repositories)
*   **具體工作**：
    1.  與資料庫溝通，使用 SQL 操作資料庫。
    2.  它只負責「你給我參數，我幫你拿/存資料」，不負責邏輯。例如：Service 叫它寫入一則訊息，它就只管執行 `INSERT INTO`，不管這個人有沒有被禁言。
*   **程式碼示意**：
    ```typescript
    // repositories/chat.repository.ts
    import { db } from '../config/db';

    export const chatRepository = {
      createMessage: async (senderId: string, roomId: string, content: string) => {
        const query = `
          INSERT INTO messages (sender_id, room_id, content, sent_time)
          VALUES ($1, $2, $3, NOW())
          RETURNING message_id, sender_id, room_id, content, sent_time, is_recalled;
        `;
        const { rows } = await db.query(query, [senderId, roomId, content]);
        return rows[0];
      },

      getRoomMember: async (userId: string, roomId: string) => {
        const query = `
          SELECT * FROM room_members 
          WHERE user_id = $1 AND room_id = $2;
        `;
        const { rows } = await db.query(query, [userId, roomId]);
        return rows[0] || null;
      }
    };
    ```

---

## 為什麼要分得這麼細？

1.  **各司其職，除錯極快**：
    *   如果畫面打不開 ──> 檢查 **Routes**。
    *   如果參數拿不到、回傳格式錯了 ──> 檢查 **Controller**。
    *   如果邏輯有問題（例如明明被禁言卻還能發訊息）──> 檢查 **Service**。
    *   如果 SQL 語法報錯或資料存不進去 ──> 檢查 **Repository**。
2.  **極易分工**：
    組員 A 可以只專心把所有的 SQL (Repository) 寫好；組員 B 專心在 Service 寫各種邏輯檢查，兩個人開發同一個功能時幾乎不會改到同一個檔案，能大幅提升小組協作的效率。
