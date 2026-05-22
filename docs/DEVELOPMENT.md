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

### Common Commands
- Create a new migration file: `pnpm run migrate:create <name>`
- Run migrations up: `pnpm run migrate:up`
- Roll migrations back: `pnpm run migrate:down`

To run migrations inside the Docker container, use:

```bash
docker compose exec backend pnpm run migrate:up
```

---

## Service URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Database connection: localhost:5432
