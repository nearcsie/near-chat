<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-22 -->

# docs

## Purpose
Project design documentation. Contains the ER diagram for the full intended database schema (including advanced entities like Folder, Attachment, RoomMember, social graph) and the environment variable management guide for development and production deployment.

## Key Files

| File | Description |
|------|-------------|
| `er_diagram.md` | Full ER diagram in Mermaid (Chen's notation) plus detailed Chinese-language spec covering all entities, relationships, cardinalities, and architectural decisions (soft-delete, privacy uniqueness via `room_hash`, emergency contact automation) |
| `DESIGN.md` | System design document — architecture decisions, API design, component structure |
| `DEVELOPMENT.md` | Developer setup and workflow guide |
| `db-chat-ui.md` | UI design notes for the database chat interface |
| `report-1.md` | Course report 1 — project proposal and initial design |
| `report-2.md` | Course report 2 — implementation progress and results |
| `report-3.md` | Course report 3 — detailed feature description, flowcharts, UI wireframe specs, and raw pg database integration tech |

## For AI Agents

### Working In This Directory
- The ER diagram in `er_diagram.md` represents the **full intended design**, which is more complex than the current database schema. The active schema implements only `users`, `rooms`, and `messages` tables — a simplified subset.
- When extending the database schema, consult `er_diagram.md` for the intended entity relationships before writing migrations.
- Environment variable documentation was previously in `env.md` (deleted) — refer to `.env.example` in the project root and `DEVELOPMENT.md` for setup instructions.

### Common Patterns
- Documentation is written in a mix of English (diagrams, code) and Traditional Chinese (explanatory prose).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
