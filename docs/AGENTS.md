<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-14 | Updated: 2026-06-14 -->

# docs

## Purpose
Project design, API, and development documentation. Consolidates database models, UI components, APIs, and guides to provide a simple, clean, and comprehensive resource for development.

## Key Files

| File | Description |
|------|-------------|
| `DEVELOPMENT.md` | Developer guide for local setup (environment variables, docker, database seeding) and testing strategy (Vitest unit & integration tests, CI configuration) |
| `database-design.md` | Full database schema details containing the ER diagram (Mermaid), Entity/Relationship mappings, table constraints, business invariants, and the v1 E2E encryption scope |
| `ui-design.md` | UI/UX specifications outlining design tokens (palette, typography, layout) and page layouts (Login, Register, Main Chat Split, and Settings) |
| `api-documentation.md` | Detailed REST API specs and Socket.IO real-time event definitions, including request schemas, codes, and host port integrations |
| `reports/` | Directory hosting historical course project snapshot reports (`report-1.md`, `report-2.md`, `report-3.md`) |

## For AI Agents

### Working In This Directory
- The active database schema implements all tables described in `database-design.md`. Consult it and write migrations under `backend/migrations/` when updating tables.
- Dev guidelines, Docker workflows, and testing procedures are detailed in `DEVELOPMENT.md`.
- Shared API payloads, path schemas, and WebSockets events must adhere strictly to `api-documentation.md`.

### Common Patterns
- Documentation is written in a mix of English (diagrams, structures) and Traditional Chinese (explanatory details).
