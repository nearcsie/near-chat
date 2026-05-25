<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# app

## Purpose
Next.js App Router directory. Contains the root layout, global styles, and the home page. The chat UI is **not yet implemented** — `page.tsx` is currently the default Next.js boilerplate template.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout component — loads Geist Sans and Geist Mono fonts via `next/font/google`, applies CSS variable classes, sets page `<html>` and `<body>` wrappers with full-height flex layout |
| `page.tsx` | Home page (`/`) — currently the default Next.js boilerplate template; the chat UI is not yet implemented here |
| `globals.css` | Tailwind CSS v4 base styles and custom CSS variables (color tokens for `surface`, `border`, `text`, `primary`) imported by `layout.tsx` |
| `favicon.ico` | Browser tab icon |

## For AI Agents

### Working In This Directory
- When implementing the chat UI in `page.tsx`, add `"use client"` at the top (it will need hooks and Socket.IO).
- New routes (e.g., `/login`, `/register`) are created by adding a `page.tsx` inside a named subdirectory under `app/`.
- Custom Tailwind color tokens (e.g., `bg-surface-card`, `text-text-muted`, `border-border-primary`, `text-primary`) are defined in `globals.css` — use these instead of raw Tailwind colors for consistency.

### Testing Requirements
- No automated tests for the frontend yet.
- Verify changes by running `pnpm dev` and opening `http://localhost:3000` in a browser.

### Common Patterns
- Import path alias `@/` maps to the project root (configured in `tsconfig.json`).
- Font CSS variables (`--font-geist-sans`, `--font-geist-mono`) are available globally via the root layout's class names.

## Dependencies

### Internal
- `globals.css` — imported by `layout.tsx`

### External
- `next/font/google` — Geist font loading
- `next/image` — optimized image component (used in `page.tsx`)
- Tailwind CSS — styling

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
