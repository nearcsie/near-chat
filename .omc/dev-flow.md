# Development Flow — 1142-ntnu-db-app

> Local only. Do not commit. Stored in .omc/ (untracked by git).

## Architecture Goal

4-layer refactor using TDD + API-First methodology:

```
Controller/Route  →  Service  →  Repository  →  pg (PostgreSQL)
```

## Phase Sequence

```
Phase -1  →  Phase 0       →  Phase 1a  →  Phase 1b (parallel)  →  Phase 2 (parallel)  →  Phase 3
  [#0]       [#1][#2][#3][#4]   [#5a]      [#5b~#5e][#6][#7][#8]   [#9][#10][#11]       [#12][#13][#14]
```

Each phase's gate: all items in the phase must be merged before the next phase starts.
Exception: Phase 1b is a parallel fan-out — all items can be worked concurrently after [#5a] lands.

## Per-Issue Workflow

1. **Branch**: `git checkout -b fix/<plan-number>-<slug>` from `dev`
2. **Implement**: TDD — write failing test first, then implement
3. **Verify**: Run acceptance criteria from the GitHub issue body
4. **PR**: Open PR against `dev` with `Closes #<github-issue-number>` in body
5. **Board**: Move project item `Todo → In Progress` when PR opens
6. **Merge**: Merge PR → move item `In Progress → Done`

## Project Board

URL: https://github.com/users/Ray05202006/projects/2
Owner: Ray05202006
Project ID: PVT_kwHOBd0sts4BYtQS

### Field IDs (for gh CLI)
- Status field: `PVTSSF_lAHOBd0sts4BYtQSzhTxGVc`
  - Todo: `f75ad846`
  - In Progress: `47fc9ee4`
  - Done: `98236657`
- Phase field: `PVTSSF_lAHOBd0sts4BYtQSzhTxGdA`

### Update status command
```bash
gh project item-edit \
  --project-id PVT_kwHOBd0sts4BYtQS \
  --id <PVTI_...> \
  --field-id PVTSSF_lAHOBd0sts4BYtQSzhTxGVc \
  --single-select-option-id <option-id>
```

## Repository

- Remote: https://github.com/minstrike520/1142-ntnu-db-app
- Main integration branch: `dev`
- Production branch: `main`

## Current Progress (updated 2026-05-25)

| Plan # | GitHub Issue | Title | Status |
|--------|-------------|-------|--------|
| #0 | #1 | Quarantine broken Prisma files | Done (merged PR #20) |
| #1 | #2 | Shared API contract + non-root Docker | In Progress (PR #21) |
| #2–#14 | #3–#19 | All remaining | Todo |

## Runtime

- Development: `docker compose up -d` (Fat Handler in Docker)
- Test DB: `docker compose -f docker-compose.test.yml up -d` (ephemeral postgres on port 5433)
- TypeScript check: `./backend/node_modules/.bin/tsc --noEmit` (run from `backend/`)
- No global pnpm — use `npm` or local `node_modules/.bin/` binaries
