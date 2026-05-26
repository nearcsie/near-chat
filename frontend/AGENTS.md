<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# frontend

## Purpose
The Next.js 16 / React 19 client application. Styled with Tailwind CSS v4 and served on port 3000. The frontend is **not yet implemented** — `app/page.tsx` is currently the default Next.js boilerplate template. The component library (`components/ui/`) is planned but no component files exist yet.

## Key Files

| File | Description |
|------|-------------|
| `app/layout.tsx` | Root layout — sets up Geist font variables, global CSS import, and the full-height flex body wrapper |
| `app/page.tsx` | Home page — currently the default Next.js welcome page (placeholder for chat UI) |
| `app/globals.css` | Global Tailwind CSS base styles |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration (strict mode) |
| `eslint.config.mjs` | ESLint configuration using `eslint-config-next` |
| `postcss.config.mjs` | PostCSS config for Tailwind v4 (`@tailwindcss/postcss`) |
| `Dockerfile` | Container image for docker-compose deployment |
| `package.json` | Dependencies and scripts (`dev`, `build`, `start`, `lint`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages and layouts (see `app/AGENTS.md`) |
| `components/` | Reusable UI component library (see `components/AGENTS.md`) |
| `public/` | Static assets served at `/` — SVG icons and images |

## For AI Agents

### Working In This Directory
- Uses the **App Router** (`app/` directory), not the older `pages/` router.
- Backend API URL is injected via `NEXT_PUBLIC_API_URL` environment variable — prefix all browser-exposed env vars with `NEXT_PUBLIC_`.
- Socket.IO client should connect to `process.env.NEXT_PUBLIC_API_URL` with the JWT token in `auth: { token }`.
- Run dev server: `pnpm dev` (requires Node, or use `docker compose up frontend`).
- Package manager is **pnpm** — do not use npm or yarn.

### Testing Requirements
- No tests are currently set up for the frontend.
- Visual/functional testing requires `pnpm dev` running and a browser.

### Common Patterns
- Server Components by default; add `"use client"` directive for interactive components that use hooks or browser APIs.
- Font setup uses `next/font/google` (Geist Sans + Geist Mono) with CSS variables.
- Tailwind classes are the primary styling mechanism — no CSS modules or styled-components.

## Dependencies

### Internal
- Communicates with `backend/` via REST (`NEXT_PUBLIC_API_URL`) and Socket.IO WebSocket.

### External
- `next` 16.2.6 — framework
- `react` / `react-dom` 19.2.6 — UI library
- `tailwindcss` ^4 — utility-first CSS framework
- `typescript` ^6.0.3 — type safety

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
