# Phase 2: Kanban Core - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin and member users can manage the full ticket lifecycle on a Kanban board — creating tickets, moving them between columns with owner assignment, viewing all ticket details with rich text and activity history, and filtering the board. Column configuration, notifications, and commenting are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Ticket Creation Flow
- Quick-add input in the Backlog column (title + department required)
- On submit, ticket is created and the detail modal opens immediately
- Tickets can only be created in Backlog — no "+" in other columns
- Department is required at creation time alongside title; all other fields optional

### Owner-Assignment Modal
- Modal fires only on moves out of Backlog for unowned tickets — already-owned tickets drag freely
- Hard gate: user must select an owner before the move commits; canceling returns the card to Backlog
- Owner selection is a searchable dropdown of team members
- Modal does NOT fire between non-Backlog columns (e.g., In Progress → Review)

### Card Metadata Display
- Urgency/priority: left border color — red (urgent), orange (high), blue (normal), grey (low)
- Effort estimate: displayed as time text (e.g., "2h", "1d")
- Time in current column: small text at the bottom of the card (e.g., "3d in column")
- Due date: always shown; text turns red when the date is past due
- Owner: displayed as initials avatar
- Department: colored badge

### Ticket Detail View
- Presented as a modal overlay; URL updates with ticket ID (shareable, e.g., /board?ticket=123)
- Tiptap rich text description auto-saves on blur / ~1s after typing stops (no save button)
- Activity timeline logs: column moves and owner changes only
- All metadata fields (priority, due date, owner, effort estimate, department) are editable inline in the modal

### Claude's Discretion
- Exact spacing, typography, and card layout within the above constraints
- Loading skeleton design for board and cards
- Error state handling (failed drag, failed save)
- Exact color values for priority border colors and due date warning threshold

</decisions>

<specifics>
## Specific Ideas

- Auto-save should feel like Notion — no save button, just works
- Owner modal cancel must snap the card back to its original position (not just remove the modal)
- Board URL should be shareable with filters and open ticket state preserved

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-kanban-core*
*Context gathered: 2026-02-25*
