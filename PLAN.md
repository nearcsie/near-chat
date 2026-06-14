# 後端分層架構設計

本專案後端嚴格落實四層分層架構設計，以確保程式碼的可維護性、可測試性與可擴充性。

---

## 1. 路由層 (Routes)
* **職責**：
  1. 定義 API 的網址路徑 (Endpoint) 與 HTTP 方法 (GET/POST/PATCH/DELETE)。
  2. 掛載通用中間件，如：JWT 身分驗證、Express Rate Limit 等。
  3. 掛載欄位格式與資料驗證中間件 (如 Zod 驗證架構)。
  4. 指引請求至對應的控制層 (Controller) 處理函數。
* **位置**：`backend/src/routes/`

---

## 2. 控制層 (Controllers)
* **職責**：
  1. 負責接收 HTTP 請求，解析並提取參數 (`req.params`、`req.query`、`req.body` 與 `req.user`)。
  2. 呼叫服務層 (Service) 對應的函數執行核心業務邏輯。
  3. 根據服務層回傳結果，包裝成標準的 HTTP 狀態碼與 JSON 回應。
  4. 不處理任何資料庫 SQL，亦不處理複雜的業務限制邏輯（全部交給 Service）。
* **位置**：`backend/src/controllers/`

---

## 3. 服務層 (Services)
* **職責**：
  1. 實作專案的核心業務邏輯與校驗規則。
  2. 獨立於 Express HTTP 框架，不直接接觸 `req` 與 `res` 物件，確保邏輯可被其他入口（如 CLI、任務排程）重用。
  3. 進行權限與限制規則校驗：
     - 檢查目標資源是否存在。
     - 驗證發送者是否有權限操作（如是否為聊天室成員、是否已被禁言、是否被封鎖等）。
  4. 驗證通過後，呼叫資料存取層 (Repository) 進行資料庫讀寫。
* **位置**：`backend/src/services/`

---

## 4. 資料存取層 (Repositories)
* **職責**：
  1. 直接與 PostgreSQL 資料庫溝通，封裝 SQL 操作。
  2. 使用 raw SQL 與 parameterised placeholders 執行 `pg` 查詢，保證效能並防止 SQL 注入。
  3. 「唯命是從」，只負責資料查詢與持久化，不負責任何業務邏輯校驗（如不管使用者是否被禁言，Service 叫它寫入，它就只管 INSERT）。
* **位置**：`backend/src/repositories/`

---

## 為什麼要分得這麼細？

1. **各司其職，定位問題快**：
   - 如果路由路徑對不上或驗證失敗 ──> 檢查 **Routes**。
   - 如果參數漏解析或 HTTP 回傳狀態碼錯誤 ──> 檢查 **Controller**。
   - 如果業務邏輯出錯 (如已被封鎖仍能寄信) ──> 檢查 **Service**。
   - 如果 SQL 語法錯誤或資料沒存進去 ──> 檢查 **Repository**。
2. **開發解耦與小組協作**：
   組員可以並行開發：有人負責寫複雜 SQL (Repository)，有人專注在商業邏輯校驗 (Service)，分工清晰，幾乎不會發生 Git 衝突。
