# Testing Guide

## 架構說明

### 為什麼測試要在 container 裡跑？

本專案開發環境完全跑在 Docker 內。`backend/` 的 `node_modules` 存在 Docker anonymous volume 裡，**host 上沒有 node_modules**，所以不能直接在 host 上執行 `pnpm run test`。

所有 vitest 指令都要透過 `docker compose exec backend` 在 container 內執行。

### 測試分層

| 層級 | 執行位置 | 需要 DB | 指令 |
|---|---|---|---|
| **Unit** | backend container 內 | 否 | `docker compose exec backend pnpm run test:unit` |
| **Integration** | backend container 內 | 是（`db-test`）| `docker compose exec backend pnpm run test:integration` |

### 為什麼 `DATABASE_URL_TEST` 用 `db-test:5432` 而不是 `localhost:5433`？

測試跑在 backend container 內，container 之間透過 Docker 網路通訊，hostname 是 **service 名稱**（`db-test`），不是 `localhost`。
`docker-compose.test.yml` 讓 `db-test` 加入 `1142-ntnu-db-app_default` 網路，因此 backend container 可以找到它。

CI（GitHub Actions）例外：測試直接跑在 runner 上，所以 CI 用 `localhost:5433`。

---

## 第一次設定（只需做一次）

### Step 1：確認主開發環境正在跑

```bash
docker compose ps
```

預期輸出包含三個 `Up` 的 container：

```
1142-ntnu-db-app-backend-1    Up   0.0.0.0:4000->4000/tcp
1142-ntnu-db-app-db-1         Up   0.0.0.0:5432->5432/tcp
1142-ntnu-db-app-frontend-1   Up   0.0.0.0:3000->3000/tcp
```

如果沒有跑，先啟動：

```bash
docker compose up -d
```

### Step 2：建立 `.env.test`

```bash
cp backend/.env.test.example backend/.env.test
```

這個檔案預設內容：

```env
# db-test 是 docker-compose.test.yml 裡的 service 名稱
# 從 backend container 內連線要用 service 名稱，不是 localhost
DATABASE_URL_TEST=postgresql://postgres:postgres@db-test:5432/ntnu_test
```

> `.env.test` 已加入 `.gitignore`，**不會被 commit**。

### Step 3：確認 vitest 已安裝

```bash
docker compose exec backend pnpm run test:unit
```

如果看到：

```
No test files found, exiting with code 0
```

代表 vitest 安裝正常，可以繼續。

---

## 跑 Unit Tests

Unit test 不需要資料庫，隨時可以跑。

```bash
docker compose exec backend pnpm run test:unit
```

目前沒有 unit test 檔案是正常的，會看到：

```
No test files found, exiting with code 0
```

---

## 跑 Integration Tests

Integration test 需要一個獨立的測試用 postgres（`db-test`），**與開發用 `db` 完全分開**，測完資料自動清除。

### Step 1：啟動測試資料庫（從 host 執行）

```bash
pnpm -C backend run test:db:up
```

等同於：

```bash
docker compose -f docker-compose.test.yml up -d --wait
```

`--wait` 會等到 postgres 通過 healthcheck 才結束，所以指令完成後就可以直接跑測試。

正常輸出最後應該看到：

```
Container 1142-ntnu-db-app-db-test-1 Healthy
```

確認 `db-test` 跑起來：

```bash
docker compose -f docker-compose.test.yml ps
```

### Step 2：（首次）對測試 DB 跑 migration

測試 DB 是空的，`resetDb()` 要 TRUNCATE 的四張表必須先存在。

```bash
docker compose exec -e DATABASE_URL=postgresql://postgres:postgres@db-test:5432/ntnu_test backend pnpm run migrate:up
```

> 之後每次 `test:db:up` 重新建立容器（使用 `tmpfs`，關掉就清空），都要重跑 migration。
> 建議把這步驟加入 integration test 的 global setup（後續 Issue 會補）。

### Step 3：跑 integration tests（在 container 內執行）

```bash
docker compose exec backend pnpm run test:integration
```

正常輸出：

```
✓ tests/integration/testDb.test.ts (1 test) 17ms
Test Files  1 passed (1)
      Tests  1 passed (1)
```

### Step 4：關閉測試資料庫（從 host 執行）

```bash
pnpm -C backend run test:db:down
```

等同於：

```bash
docker compose -f docker-compose.test.yml down
```

container 刪除後，測試資料全部消失。

---

## 跑全部測試

```bash
# 啟動測試 DB
pnpm -C backend run test:db:up

# 跑所有 test（unit + integration）
docker compose exec backend pnpm run test

# 關閉測試 DB
pnpm -C backend run test:db:down
```

---

## 寫 Unit Tests

### 存放位置

```
backend/tests/unit/
  services/
    userService.test.ts
  utils/
    someHelper.test.ts
```

### 基本範例

```typescript
// backend/tests/unit/services/userService.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('userService', () => {
  it('does something', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Unit test 應該用 `vi.mock()` mock 掉所有 repository，不碰真實 DB。

---

## 寫 Integration Tests

### 存放位置

```
backend/tests/integration/
  repositories/
    userRepository.test.ts
    roomRepository.test.ts
```

### 基本範例

```typescript
// backend/tests/integration/repositories/userRepository.test.ts
import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { testPool } from '../helpers/testPool';
import { resetDb } from '../helpers/resetDb';

describe('userRepository', () => {
  // 每個 test 前清空所有資料，確保測試獨立
  beforeEach(async () => {
    await resetDb();
  });

  // 最後關閉 pg pool，避免 vitest 掛住
  afterAll(async () => {
    await testPool.end();
  });

  it('inserts and retrieves a user', async () => {
    await testPool.query(
      "INSERT INTO users (username, password_hash) VALUES ('alice', 'hash')"
    );
    const result = await testPool.query(
      "SELECT username FROM users WHERE username = 'alice'"
    );
    expect(result.rows[0].username).toBe('alice');
  });
});
```

### Helper 說明

#### `testPool`（`tests/helpers/testPool.ts`）

一個綁定到 `DATABASE_URL_TEST` 的 pg `Pool`。直接用它執行 SQL：

```typescript
import { testPool } from '../helpers/testPool';

const result = await testPool.query('SELECT 1');
```

#### `resetDb`（`tests/helpers/resetDb.ts`）

TRUNCATE 四張資料表並重置 auto-increment：

```typescript
import { resetDb } from '../helpers/resetDb';

beforeEach(async () => {
  await resetDb(); // 清空 users, rooms, messages, room_members
});
```

> `resetDb` 要求四張表都存在。請確認 migration 已對測試 DB 執行過。

---

## CI（GitHub Actions）

`.github/workflows/ci.yml` 在每次 push / PR 自動執行兩個 job：

### `unit-tests` job

1. Checkout 程式碼
2. 安裝 Node.js
3. `pnpm --prefix backend install`（在 runner 上直接安裝 node_modules）
4. `pnpm --prefix backend run test:unit`

### `integration-tests` job

1. 啟動 GitHub Actions 原生 `postgres:16` service（`localhost:5433`）
2. 設定環境變數 `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/ntnu_test`
3. Checkout、安裝 Node.js、`pnpm install`
4. `pnpm --prefix backend run test:integration`

> **注意：** CI 用 `localhost:5433`，本地開發用 `db-test:5432`。兩者的連線 URL 不同，因為執行環境不同（CI 跑在 runner 上，本地跑在 container 內）。

---

## 排錯

### `vitest: not found`

backend container 的 node_modules 沒有 vitest。重建 container：

```bash
docker compose rm -v -s -f backend
docker compose up -d --build backend
```

### `DATABASE_URL_TEST is not set`

`.env.test` 不存在或沒被 vitest 讀到：

```bash
# 確認檔案存在
ls backend/.env.test

# 如果不存在
cp backend/.env.test.example backend/.env.test
```

### `db-test` 連不到（integration test 跑時 hang 或 timeout）

確認 `db-test` container 有在跑：

```bash
docker compose -f docker-compose.test.yml ps
```

如果沒有：

```bash
pnpm -C backend run test:db:up
```

### `TRUNCATE` 失敗（table 不存在）

測試 DB 沒有跑 migration：

```bash
docker compose exec -e DATABASE_URL=postgresql://postgres:postgres@db-test:5432/ntnu_test backend pnpm run migrate:up
```

### pnpm install 失敗（`ERR_PNPM_IGNORED_BUILDS`）

pnpm 11 要求明確 approve build scripts。`backend/pnpm-workspace.yaml` 已設定 `allowBuilds: esbuild: true`。
如果仍然失敗，在 backend 目錄確認檔案存在且格式正確：

```bash
cat backend/pnpm-workspace.yaml
```

應該看到：

```yaml
allowBuilds:
  esbuild: true
```

---

## 相關檔案

| 檔案 | 說明 |
|---|---|
| `backend/vitest.config.ts` | Vitest 設定（`@shared` alias、`loadEnv('.env.test')`）|
| `backend/.env.test.example` | `.env.test` 模板，`db-test:5432` |
| `backend/.env.test` | 實際 test 環境變數（**gitignored**）|
| `docker-compose.test.yml` | 短暫測試用 postgres，加入 app network |
| `backend/pnpm-workspace.yaml` | pnpm 11 esbuild build approval |
| `backend/tests/helpers/testPool.ts` | Integration test 用 pg pool |
| `backend/tests/helpers/resetDb.ts` | TRUNCATE all tables helper |
| `.github/workflows/ci.yml` | CI matrix（unit + integration）|
