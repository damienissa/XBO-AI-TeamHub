---
phase: 05-advanced-features
plan: 02
subsystem: frontend-ui
tags: [frontend, react, nextjs, tanstack-query, dependencies, sprints, kanban]
dependency_graph:
  requires:
    - phase: 05-01
      provides: ticket-dependencies-api, sprints-api
  provides:
    - dependencies-section-ui
    - blocked-badge-kanban-card
    - blocked-409-toast
    - sprint-list-page
    - sprint-board-page
    - sprint-field-picker
  affects:
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/app/(app)/board/_components/KanbanCard.tsx
    - frontend/src/app/(app)/board/_components/KanbanBoard.tsx
tech-stack:
  added: []
  patterns:
    - batch-count-query-for-badge-data
    - structured-error-class-for-typed-errors
    - combobox-popover-pattern-for-pickers
    - display-only-sprint-board-no-dnd

key-files:
  created:
    - frontend/src/app/(app)/board/_components/DependenciesSection.tsx
    - frontend/src/app/(app)/board/_components/SprintField.tsx
    - frontend/src/app/(app)/sprints/page.tsx
    - frontend/src/app/(app)/sprints/[sprintId]/page.tsx
  modified:
    - frontend/src/app/(app)/board/_components/KanbanCard.tsx
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/components/sidebar/AppSidebar.tsx
    - frontend/src/hooks/useMoveTicket.ts
    - frontend/src/lib/api/tickets.ts
    - frontend/src/lib/providers.tsx
    - backend/app/schemas/ticket.py
    - backend/app/routers/board.py

key-decisions:
  - "blocked_by_count computed via batch COUNT query in board endpoint — same pattern as subtask_counts, single SQL query over ticket_dependencies for all ticket_ids; avoids N+1"
  - "TicketBlockedError class extends Error with blocker_ids — typed structured errors from moveTicket API call; enables instanceof check in useMoveTicket onError"
  - "Used existing shadcn useToast hook for 409 BLOCKED toast — sonner not installed; project uses @radix-ui/react-toast; added Toaster to Providers"
  - "Sprint board page is display-only (no dnd-kit) per RESEARCH.md Pitfall 4 — sprint board is a reporting view, not a workflow tool"
  - "allTickets for dependency picker fetches /api/board (flat array) — reuses board cache; staleTime 60s to avoid hammering board endpoint on every dep picker open"

patterns-established:
  - "Combobox picker pattern: Popover + Command + CommandInput + CommandList for all item-search pickers (DependenciesSection, SprintField)"
  - "Batch COUNT subquery pattern: SELECT grouping_id, COUNT(*) ... WHERE id IN (ticket_ids) GROUP BY grouping_id — used for subtask counts and blocked_by_count"

requirements-completed: [ADV-04, ADV-05, ADV-06, ADV-08, ADV-09, ADV-10]

duration: 4min
completed: "2026-02-25"
---

# Phase 5 Plan 02: Frontend Dependencies and Sprints UI Summary

**DependenciesSection on ticket detail with add/remove picker, blocked badge on Kanban cards via batch COUNT query, 409 BLOCKED toast on drag, sprint list/board pages with velocity header, and SprintField combobox picker on ticket detail.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T14:37:31Z
- **Completed:** 2026-02-25T14:41:31Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- DependenciesSection renders on ticket detail above SubtaskSection with full add/remove dependency picker (blocks + blocked_by sections)
- Blocked badge (amber, subtle) on KanbanCard when ticket has unresolved blocking dependencies — powered by `blocked_by_count` batch query in board endpoint
- 409 BLOCKED drag-rejection handled in useMoveTicket with `TicketBlockedError` structured class + shadcn toast showing blocker IDs
- Sprint sidebar nav item + sprint list page with Create Sprint form + sprint board page with velocity progress bar + 5 display-only columns
- SprintField combobox picker embedded in TicketDetailModal metadata section for assigning/clearing sprint on any ticket

## Task Commits

Each task was committed atomically:

1. **Task 1: DependenciesSection, blocked badge, 409 toast** - `4330e7a` (feat)
2. **Task 2: Sprint pages, SprintField, sidebar nav** - `8c7005d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/app/(app)/board/_components/DependenciesSection.tsx` - blocks/blocked_by lists with Popover+Command add picker
- `frontend/src/app/(app)/board/_components/SprintField.tsx` - combobox picker to assign/clear sprint on ticket
- `frontend/src/app/(app)/sprints/page.tsx` - sprint list with Create Sprint form
- `frontend/src/app/(app)/sprints/[sprintId]/page.tsx` - sprint board with velocity header + display-only status columns
- `frontend/src/app/(app)/board/_components/KanbanCard.tsx` - added ShieldAlert blocked badge
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` - added DependenciesSection + SprintField
- `frontend/src/components/sidebar/AppSidebar.tsx` - added Sprints nav item
- `frontend/src/hooks/useMoveTicket.ts` - added TicketBlockedError handling + toast
- `frontend/src/lib/api/tickets.ts` - added TicketBlockedError class, sprint_id/blocked_by_count fields
- `frontend/src/lib/providers.tsx` - added Toaster mount
- `backend/app/schemas/ticket.py` - added blocked_by_count field to TicketOut
- `backend/app/routers/board.py` - added batch COUNT query for blocked_by_count per ticket

## Decisions Made

- **blocked_by_count via batch query:** Same pattern as subtask_counts — single `SELECT blocked_id, COUNT(blocker_id) ... GROUP BY blocked_id WHERE blocked_id IN (ticket_ids)` on the `ticket_dependencies` table. No ORM join needed.
- **TicketBlockedError extends Error:** Gives `instanceof TicketBlockedError` check in `onError` callback. Cleaner than string matching on error.message.
- **Toaster added to Providers (Rule 2 deviation):** The Toaster component existed but was never mounted — `useToast()` calls would silently queue toasts with no UI. Added `<Toaster />` to Providers to make toast functionality actually work.
- **Sprint board is display-only:** No dnd-kit on sprint board per RESEARCH.md Pitfall 4. Sprint boards are reporting views.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mounted Toaster component in Providers**
- **Found during:** Task 1 (409 toast implementation)
- **Issue:** The project had `useToast` hook and `Toaster` component defined but Toaster was never mounted in the app. Any calls to `toast({...})` would silently fail with no visible notification.
- **Fix:** Added `import { Toaster } from "@/components/ui/toaster"` and `<Toaster />` inside the `Providers` component in `providers.tsx`
- **Files modified:** `frontend/src/lib/providers.tsx`
- **Verification:** TypeScript passes cleanly; Toaster now present in component tree
- **Committed in:** `4330e7a` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed DependenciesSection board data parsing**
- **Found during:** Task 1 (DependenciesSection implementation)
- **Issue:** Plan's code assumed board endpoint returns nested columns object (`Object.values(data).flat()`), but the board endpoint returns a flat array of tickets
- **Fix:** Changed to `Array.isArray(data) ? data : []` which correctly handles the flat array response
- **Files modified:** `frontend/src/app/(app)/board/_components/DependenciesSection.tsx`
- **Verification:** TypeScript passes cleanly; correct parsing of flat board response
- **Committed in:** `4330e7a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered

- Plan specified using "sonner" for toast but sonner was not installed; project uses shadcn's `useToast` + `@radix-ui/react-toast`. Used existing system instead.

## Next Phase Readiness

- ADV-04 through ADV-10 complete as full UI on top of Phase 05-01 backend
- Sprint pages ready for navigation at /sprints
- Dependency management fully functional on ticket detail
- Phase 5 Plans 03-05 (custom fields, saved filters, wiki) can proceed

---
*Phase: 05-advanced-features*
*Completed: 2026-02-25*
