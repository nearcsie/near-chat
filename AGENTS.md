<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# 1142-ntnu-db-app

## Purpose
A real-time group chat application built as an NTNU database course project. The system provides user authentication, chat room management, and WebSocket-based messaging, backed by a PostgreSQL database. It is structured as a monorepo with a Node.js/Express backend and a Next.js frontend, orchestrated via Docker Compose.

## Key Files

| File | Description |
|------|-------------|
| `docker-compose.yml` | Defines the three-service stack: `db` (Postgres 17), `backend` (Express, port 4000), `frontend` (Next.js, port 3000) |
| `.env.example` | Template for required environment variables — copy to `.env` before running locally |
| `.gitignore` | Excludes `.env`, `node_modules`, build artifacts |
| `LICENSE` | Project licence |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `backend/` | Express + Socket.IO API server using raw SQL via `pg` (see `backend/AGENTS.md`) |
| `frontend/` | Next.js 16 / React 19 client application (see `frontend/AGENTS.md`) |
| `docs/` | Design documents: ER diagram and environment variable guide (see `docs/AGENTS.md`) |
| `reference/` | Source reference materials: original ER diagram image and project report PDF |

## For AI Agents

### Working In This Directory
- All services run via `docker compose up` from the project root; the `db` service must start before `backend`.
- Copy `.env.example` to `.env` and fill in real values before starting any service locally.
- The `DATABASE_URL` format is `postgresql://USER:PASS@localhost:5432/DBNAME` — used by `pg` and `node-pg-migrate`.
- The current git branch is `dev`.

### Testing Requirements
- Backend integration tests require a live PostgreSQL connection; run `docker compose up db` first.
- Tests live in `backend/tests/` and use Vitest.

### Common Patterns
- Environment variables are injected via Docker Compose from the root `.env` file.
- `NEXT_PUBLIC_*` prefix is required for any frontend env vars exposed to the browser.

## Dependencies

### Internal
- `backend/` depends on the `db` service defined in `docker-compose.yml`.
- `frontend/` depends on `backend/` (set via `NEXT_PUBLIC_API_URL`).

### External
- Docker + Docker Compose — container orchestration
- PostgreSQL 17 — primary datastore
- Node.js — runtime for both services

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
