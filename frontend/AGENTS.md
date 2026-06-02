<!-- Parent: ../AGENTS.md -->
<!-- Updated: 2026-06-01 -->

# frontend

## Purpose
The Next.js 16 / React 19 client application for the chat system. It is no longer a boilerplate app: it includes login/register flows, the main chat layout, chat rooms, personal settings, group settings, UI primitives, REST API wrappers, and Socket.IO helpers.

Docker Compose exposes the frontend on host port 3005 while the container still listens on port 3000.

## Key Files

| File | Description |
|------|-------------|
| `src/app/layout.tsx` | Root layout and global CSS import |
| `src/app/(main)/layout.tsx` | Authenticated app shell with sidebar and chat/settings content |
| `src/app/(main)/chat/[chatId]/page.tsx` | Chat room page and group member sidebar |
| `src/app/(main)/settings/page.tsx` | Personal settings page |
| `src/app/login/page.tsx` | Login form wired to the backend auth API |
| `src/app/register/page.tsx` | Register form wired to the backend auth API |
| `src/context/ChatContext.tsx` | Central client state for auth, rooms, messages, folders, sockets, and settings |
| `src/lib/api.ts` | Typed REST API helpers |
| `src/lib/socket.ts` | Socket.IO client helpers |
| `src/components/chat/Chatroom.tsx` | Main chat room UI |
| `src/components/settings/` | Personal and group settings components |
| `src/components/ui/` | Reusable UI primitives |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router routes and layouts |
| `src/components/` | Implemented React components used by the app |
| `src/context/` | Client-side React context/state |
| `src/lib/` | API, socket, and utility helpers |
| `components/` | Legacy AGENTS metadata only; do not add production components there |
| `public/` | Static assets served at `/` |

## For AI Agents

### Working In This Directory
- Uses the App Router under `src/app/`.
- Components that use hooks or browser APIs must include `"use client"`.
- Browser-exposed environment variables must start with `NEXT_PUBLIC_`.
- With Docker Compose, set `NEXT_PUBLIC_API_URL=http://localhost:4005` because the browser connects through the backend host port.
- Socket.IO uses the same `NEXT_PUBLIC_API_URL` and passes JWT data in `auth: { token }`.
- Package manager is pnpm; do not use npm or yarn.
- Run dev server: `pnpm dev` (requires Node, or use `docker compose up frontend`).
- No need to run Next.js production builds (`pnpm run build` or `next build`) during development. Verify via TypeScript checks (`pnpm exec tsc --noEmit`) and manual testing.

### Testing Requirements
- Run frontend type-checks with `pnpm exec tsc --noEmit` from `frontend/`, or through the frontend container.
- Visual/functional testing requires a running frontend at `http://localhost:3005` when using Docker Compose.

### Common Patterns
- Import path alias `@/` maps to `frontend/src`.
- UI styling uses Tailwind CSS classes and the project color tokens from `src/app/globals.css`.
- Prefer existing UI primitives in `src/components/ui/` before adding new component styles.
- Server Components by default; add `"use client"` directive for interactive components that use hooks or browser APIs.
- Font setup uses `next/font/google` (Geist Sans + Geist Mono) with CSS variables.
- Tailwind classes are the primary styling mechanism — no CSS modules or styled-components.
- **Centralized i18n**: UI translation strings are stored in `src/locales/zh-TW.json` and `src/locales/en.json`. Use the `useTranslation` hook from `@/hooks/useTranslation` in Client Components to look up text (`t("namespace.key", replacements?)`). Do not hardcode UI text strings or define local translation copy constants. Keep native language labels (`繁體中文` and `English`) statically set in select dropdowns.

## Dependencies

### Internal
- Communicates with `backend/` via REST (`NEXT_PUBLIC_API_URL`) and Socket.IO.
- Shares contracts from `shared/` through the root TypeScript config mount.

### External
- `next` 16.2.6
- `react` / `react-dom` 19.2.6
- `socket.io-client`
- `tailwindcss` v4
- `typescript` 6

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
