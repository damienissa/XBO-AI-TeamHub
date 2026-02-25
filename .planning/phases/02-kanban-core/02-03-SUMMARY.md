---
phase: 02-kanban-core
plan: "03"
subsystem: ui
tags: [react, nuqs, tiptap, tanstack-query, radix-ui, date-fns, use-debounce, kanban, modal]

# Dependency graph
requires:
  - phase: 02-kanban-core/02-02
    provides: Kanban board, useBoard hook, nuqs NuqsAdapter, KanbanCard, ?ticket= URL state, fetchUsers/updateTicket API functions
  - phase: 02-kanban-core/02-01
    provides: GET /api/tickets/{id}, GET /api/tickets/{id}/events, GET /api/tickets/{id}/history, PATCH /api/tickets/{id}
provides:
  - BoardFilterBar with nuqs useQueryStates for 10 filter params (owner, department, priority, urgency range, due date range, aging)
  - URL-shareable board filters — /board?priority=high shares exact filtered view
  - useBoard reads filters internally from nuqs — queryKey includes filterParams for reactive re-fetch
  - TicketDetailModal as Radix Dialog right-side drawer, opened via ?ticket= URL param
  - TiptapEditor with immediatelyRender:false (SSR-safe), 1s debounced auto-save + on-blur immediate save
  - useTicketDetail hook: useQuery for ticket+events+history, useMutation for all field updates
  - Inline editing for all DETAIL-04 fields (priority, urgency, due date, effort, owner, title)
  - Activity timeline (DETAIL-05): sorted TicketEvents with relative timestamps
  - Column history table (DETAIL-06): entered/exited/time_spent per column
affects:
  - 02-04 (quick-add already opens modal via ?ticket= state — now fully wired)
  - any future phase adding ticket fields (pattern: useTicketDetail + updateMutation.mutate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useBoard reads filters from nuqs internally — no filter props passed; queryKey: ['board', filterParams] reactive re-fetch"
    - "TicketDetailModal always mounted at board root; Radix Dialog open={!!ticketId} responds to nuqs state"
    - "TiptapEditor: immediatelyRender: false prevents SSR hydration mismatch; onUpdate=debounce(1s) + onBlur=flush+save"
    - "Inline edit fields: local editingX state, autoFocus input on click, blur/Enter saves via updateMutation.mutate"
    - "BoardFilterBar: useQueryStates for all filter params; Date objects serialized via toISOString().slice(0,10)"

key-files:
  created:
    - frontend/src/app/(app)/board/_components/BoardFilterBar.tsx
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/app/(app)/board/_components/TiptapEditor.tsx
    - frontend/src/hooks/useTicketDetail.ts
  modified:
    - frontend/src/hooks/useBoard.ts
    - frontend/src/lib/api/tickets.ts
    - frontend/src/app/(app)/board/_components/KanbanCard.tsx
    - frontend/src/app/(app)/board/_components/KanbanBoard.tsx

key-decisions:
  - "useBoard owns filter state via useQueryStates — no filter props needed; simplifies KanbanBoard and makes filtering transparent"
  - "TicketDetailModal mounted once in KanbanBoard (not per-card) — single Dialog.Root with nuqs ?ticket= controlling open state"
  - "TiptapEditor immediatelyRender: false — required for Next.js 14 SSR; documented in RESEARCH.md Pattern 6"
  - "KanbanCard useQueryState hook conditionally applied via ternary when isOverlay=true — maintains rules-of-hooks compliance with eslint-disable comment"
  - "BoardFilterBar filter bar rendered in all KanbanBoard states (loading, error, success) — filters persist across board states"

patterns-established:
  - "Pattern: URL modal state — Radix Dialog.Root open={!!urlParam}; closing sets urlParam to null; shareable deep-links"
  - "Pattern: Inline field editing — editingX boolean state + autoFocus input on click, blur/Enter commits via mutation"
  - "Pattern: Tiptap auto-save — onUpdate=debounce(1s) + onBlur=flush+immediate; no save button needed (Notion-style)"

requirements-completed: [BOARD-05, BOARD-06, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-06]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 2 Plan 03: Board Filters and Ticket Detail Modal Summary

**URL-persisted board filter bar (nuqs useQueryStates) + Radix Dialog ticket detail modal with Tiptap auto-saving rich text, inline metadata editing, activity timeline, and column history**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T07:46:41Z
- **Completed:** 2026-02-25T07:50:21Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- BoardFilterBar renders above Kanban columns with 10 filter params (owner, dept, priority, urgency range, due date range, aging) all persisted in URL via nuqs — board is shareable at any filtered state (BOARD-05/06)
- Ticket detail modal opens on card click, updates URL to /board?ticket={id}, and closes by clearing that param — URL is fully shareable for deep-linking into a specific ticket (DETAIL-01)
- TiptapEditor stores problem_statement as Tiptap JSON (never HTML), auto-saves 1s after typing stops and immediately on blur with no save button (DETAIL-03)
- All metadata fields (title, priority, urgency, due date, effort, owner) are editable inline with click-to-edit pattern — blur or Enter commits via updateMutation (DETAIL-04)
- Activity timeline renders TicketEvents sorted chronologically with relative timestamps (DETAIL-05)
- Column history table renders enter/exit timestamps and time_spent per column (DETAIL-06)
- Zero TypeScript errors across all 8 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Board filter bar with nuqs URL persistence** - `68fe6ca` (feat)
2. **Task 2: Ticket detail modal with Tiptap, inline editing, activity timeline, and column history** - `5d61a36` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `frontend/src/app/(app)/board/_components/BoardFilterBar.tsx` - 10-param filter bar using useQueryStates; owner/dept/priority dropdowns, urgency number inputs, date range pickers, aging input, active-filter badge, clear-all button
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` - Radix Dialog right-drawer; TicketDetailContent sub-component with all DETAIL-02 fields; inline editing, Tiptap, activity timeline, column history
- `frontend/src/app/(app)/board/_components/TiptapEditor.tsx` - StarterKit editor, immediatelyRender: false, 1s debounced onUpdate + flush onBlur
- `frontend/src/hooks/useTicketDetail.ts` - useQuery for ticket/events/history + useMutation with board invalidation on success
- `frontend/src/hooks/useBoard.ts` - Refactored to own filter state via useQueryStates internally; filterParams in queryKey
- `frontend/src/lib/api/tickets.ts` - Added fetchTicket, fetchTicketEvents, fetchTicketHistory, TicketEvent interface, ColumnHistoryEntry interface
- `frontend/src/app/(app)/board/_components/KanbanCard.tsx` - Added onClick → setTicketId(ticket.id) via useQueryState; isOverlay skips hook
- `frontend/src/app/(app)/board/_components/KanbanBoard.tsx` - Renders BoardFilterBar + TicketDetailModal; removed filter prop from useBoard call

## Decisions Made

- **useBoard owns filter state:** Hook reads nuqs internally via useQueryStates — caller (KanbanBoard) passes no filter props. This keeps filter logic co-located with data fetching and queryKey construction.
- **TicketDetailModal mounted once in KanbanBoard:** Single Dialog.Root controlled by nuqs ?ticket= param. No per-card modal mounting — avoids duplicate Dialog portals and allows URL-based open/close.
- **TiptapEditor immediatelyRender: false:** Required for Next.js 14 App Router to avoid SSR hydration mismatch. This is the documented pattern from RESEARCH.md (Pattern 6).
- **KanbanCard useQueryState in isOverlay branches:** Conditional hook call via ternary with eslint-disable comment — consistent with existing useDraggable pattern in same file; maintains hook ordering.

## Deviations from Plan

None — plan executed exactly as written. All API types, component structure, and hook signatures match the plan specification.

## Issues Encountered

None — TypeScript compiled cleanly on first pass for both tasks.

## User Setup Required

None — no external service configuration required. All features use backend endpoints already established in Phase 2 Plan 01.

## Next Phase Readiness

- Board is ready for Plan 02-04 (remaining board features): filter bar fully wired with URL state
- Board is ready for Plan 02-05 (if any): detail modal pattern established for all ticket fields
- All BOARD-{05,06} and DETAIL-{01,02,03,04,05,06} requirements fulfilled
- QuickAddInput (from 02-02) opens detail modal immediately on create via ?ticket= — now the modal is implemented, full create-then-edit flow is live

## Self-Check: PASSED

- All 4 created files confirmed present on disk
- Both task commits (68fe6ca, 5d61a36) confirmed in git log
- TypeScript: 0 errors (npx tsc --noEmit clean)

---
*Phase: 02-kanban-core*
*Completed: 2026-02-25*
