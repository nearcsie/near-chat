<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# components

## Purpose
Planned reusable UI component library for the frontend. **No component files exist yet** — this directory and its `ui/` subdirectory currently only contain AGENTS.md files. When implemented, components will be pure presentational React components consumed by `app/page.tsx`.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `ui/` | Planned low-level UI primitives — Avatar, Badge, Button, ChatBubble, Checkbox, Dropdown, Input, Modal; **no component files exist yet** (see `ui/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- All components use `"use client"` implicitly via their consumers — add the directive explicitly only if a component itself uses hooks or browser APIs.
- Import path alias `@/components/ui/ComponentName` is the standard import pattern used throughout `app/page.tsx`.
- The `cn` utility from `@/lib/utils` (a `clsx`/`tailwind-merge` wrapper) is used for conditional class merging — always use it instead of string concatenation for Tailwind classes.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
