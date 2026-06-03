# Development Guide

## Quick Start

### 1. Prepare Environment Variables
Copy the `.env.example` file from the project root and rename it to `.env`:

```bash
cp .env.example .env
```

The `.env` file is already listed in `.gitignore`, so do not commit it to the Git repository.

### 2. Start the Containers
Use Docker Compose to start all services:

```bash
# Rebuild after the first setup or after changing a Dockerfile
docker compose build

# Start the services in detached mode
docker compose up -d
```

### 3. Check the Status

```bash
# View container status
docker compose ps

# View backend logs
docker compose logs -f backend
```

---

## Environment Variables and Constants

This project uses environment variables to manage deployment constants in one place.

### Development
1. Create `.env`: copy `.env.example` and rename it before your first local setup.
2. Security: `.env` is ignored by Git to protect local secrets.
3. Frontend note: any browser-accessible environment variable must start with `NEXT_PUBLIC_`.

### Deployment Notes
1. Production should not depend on a checked-in `.env` file. Inject values through the platform settings instead, such as Vercel or AWS Secrets Manager.
2. For self-hosted deployments, create a production `.env` file in the project root and apply strict permissions, for example `chmod 600 .env`.
3. Template maintenance: when adding new variables, update `.env.example` as well, but keep values blank or use placeholder data.

---

## Frontend Development

The frontend is a Next.js application in the `frontend/` directory.

### Common Commands
- Start the development server: `pnpm dev`
- Build for production: `pnpm build`
- Start the production server: `pnpm start`
- Run lint checks: `pnpm lint`

### Notes
1. The project uses the App Router structure under `frontend/app/`.
2. `frontend/next.config.ts` currently uses the default configuration, so no extra Next.js settings are required at the moment.
3. If you add a new browser-side environment variable, prefix it with `NEXT_PUBLIC_`.

---

## Database Management

### Initialization Flow
When setting up the project for the first time, you must initialize the database schema. Ensure your Docker containers are running, then apply the migrations:

```bash
docker compose exec backend pnpm run migrate:up
```

### Common Commands
- Create a new migration file: `docker compose exec backend pnpm run migrate:create <name>`
- Run migrations up: `docker compose exec backend pnpm run migrate:up`
- Roll migrations back: `docker compose exec backend pnpm run migrate:down`

### Repairing a Broken Dev Database
If you encounter `relation ... already exists` errors during migration, or if `node-pg-migrate` reports that a new migration is preceding an already-run migration, your local database state is out of sync with the migration history (e.g. missing `pgmigrations` table). 

Because this is a development database, the safest and clearest way to repair it is to wipe the database volume and run migrations from a clean state:

```bash
# 1. Stop containers and wipe the database volume
docker compose down -v

# 2. Restart containers
docker compose up -d

# 3. Wait for the database to be ready, then run migrations again
docker compose exec backend pnpm run migrate:up
```

---

## Service URLs

Docker Compose exposes different host ports from the container-internal ports:

| Service | Host URL / port | Container port |
|---------|------------------|----------------|
| Frontend | http://localhost:3005 | 3000 |
| Backend API | http://localhost:4005 | 4000 |
| Database | localhost:5435 | 5432 |

Use `NEXT_PUBLIC_API_URL=http://localhost:4005` for browser-facing frontend requests when running through Docker Compose.

---

## Testing Strategy

This project uses three separate containers for testing. Each layer is tested in the container that matches its runtime.

### Container Roles

| Container | Role | When to use |
|-----------|------|-------------|
| `backend` | TypeScript type-check + unit tests | `tsc --noEmit`, Vitest unit tests (mocked repo) |
| `frontend` | TypeScript type-check | `tsc --noEmit` |
| `db` | Integration tests only | Vitest integration tests that need a real DB |

> **Note:** The `db` container is the production Postgres instance. Integration tests should use a separate ephemeral container defined in `docker-compose.test.yml` (see Issue #2).

### Running TypeScript Type Checks

```bash
# Backend
docker compose exec backend ./node_modules/.bin/tsc --noEmit

# Frontend
docker compose exec frontend ./node_modules/.bin/tsc --noEmit
```

### Running Tests

```bash
# Unit tests (no DB required)
docker compose exec backend pnpm run test:unit

# Start ephemeral test DB, then run integration tests
docker compose exec backend pnpm run test:db:up
docker compose exec backend pnpm run test:integration
```

### Why Non-Root Containers

Both `backend` and `frontend` containers run as the built-in `node` user (UID 1000) rather than root. This ensures any files written back to the bind-mounted source directory on the host are owned by the current user, preventing root-owned file accumulation.

The `db` container is intentionally left as-is — Postgres manages its own internal permission scheme and should not be modified.

### Shared Types

`shared/` and `tsconfig.base.json` (repo root) are mounted read-only into both `backend` and `frontend` containers:

```
/tsconfig.base.json   ← ./tsconfig.base.json
/shared/              ← ./shared/
```

This allows `import type { X } from '@shared/types'` to resolve correctly inside containers without a monorepo workspace setup.
