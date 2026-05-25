<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# ui

## Purpose
Planned low-level UI primitives for building the chat application interface. **No component files exist yet** — this directory currently only contains this AGENTS.md. When implemented, components should accept `className` overrides and use the `cn` utility for Tailwind class merging. Design tokens (`surface`, `border-primary`, `text-muted`, `primary`) come from CSS variables defined in `app/globals.css`.

## Planned Components

The following components are intended for this directory (not yet created):

| File | Planned Purpose |
|------|----------------|
| `Avatar.tsx` | Circular user avatar — initials fallback; `sm`/`md`/`lg` sizes |
| `Badge.tsx` | Small status/label chip — role labels and online indicators |
| `Button.tsx` | Styled button with variant support (`primary`, `ghost`, `danger`) |
| `ChatBubble.tsx` | Message bubble — outgoing/incoming layout, reply-quote, read receipts, recalled state |
| `Checkbox.tsx` | Accessible checkbox with label, styled to design tokens |
| `Dropdown.tsx` | Context menu / dropdown — message actions and member management |
| `Input.tsx` | Styled text input wrapping native `<input>` |
| `Modal.tsx` | Overlay modal dialog with backdrop |

## For AI Agents

### Working In This Directory
- All components export named exports (e.g., `export function ChatBubble(...)`), not default exports — import accordingly.
- Use the `cn` helper from `@/lib/utils` for any conditional Tailwind classes.
- `ChatBubble` is the most complex component — it renders differently based on `isOutgoing`, `roomType`, `isRecalled`, and presence of `replyTo`/`attachments`. Read it carefully before modifying.
- Design tokens like `bg-surface-card`, `border-border-primary`, `text-text-muted`, `text-primary` are Tailwind classes mapped to CSS variables in `globals.css` — do not replace them with raw colors.

### Common Patterns
- Props interfaces are defined immediately above each component function.
- All components spread or forward standard HTML element props where applicable.
- `cn(baseClasses, conditionalClasses)` is the universal pattern for dynamic styling.

## Dependencies

### Internal
- `@/lib/utils` — `cn` helper (used by all components)
- `Avatar` — imported by `ChatBubble` for sender avatar rendering

### External
- Tailwind CSS v4 — all styling
- React 19 — component runtime

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
