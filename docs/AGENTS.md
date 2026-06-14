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
- The active database schema implements all tables described in the ER diagram and relational schema, including `users`, `chat_rooms`, `room_members`, `messages`, `attachments`, `friendships`, `blocks`, `folders`, `folder_rooms`, `emergency_contacts`, `message_mentions`, as well as system tables like `refresh_tokens` and `emergency_alert_logs`.
- When extending the database schema, consult `er_diagram.md` and `relation-schema.md` for the entity relationships before writing migrations.
- Environment variable documentation is documented in `.env.example` in the project root and `DEVELOPMENT.md` for setup instructions.

### Common Patterns
- Documentation is written in a mix of English (diagrams, code) and Traditional Chinese (explanatory prose).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
