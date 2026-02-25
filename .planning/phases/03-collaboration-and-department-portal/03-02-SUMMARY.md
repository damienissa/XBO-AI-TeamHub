---
phase: 03-collaboration-and-department-portal
plan: 02
subsystem: ui
tags: [nextjs, react, dnd-kit, tanstack-query, tailwind, fastapi, sqlalchemy]

# Dependency graph
requires:
  - phase: 03-collaboration-and-department-portal
    plan: 01
    provides: TicketComment/TicketSubtask ORM models, comment/subtask REST endpoints, TicketSubtask.position management
  - phase: 02-kanban-core
    provides: KanbanCard, TicketDetailModal, KanbanBoard, DndContext, useBoard, Ticket type

provides:
  - SubtaskSection.tsx: subtask checklist with inline add (Enter), optimistic checkbox toggle, drag-to-reorder via nested DndContext + SortableContext, delete per item
  - CommentSection.tsx: comment thread with always-visible textarea + Post button, author avatar, author/admin delete with AlertDialog confirm
  - SubtaskSection + CommentSection embedded in TicketDetailModal at correct positions
  - KanbanCard subtask count pill badge (green when all done, hidden when zero)
  - Board endpoint now returns subtasks_total + subtasks_done per ticket via batch subquery (no N+1)

affects:
  - 03-03 (portal intake form — uses KanbanCard and board patterns established here)
  - 03-04 (templates settings page — uses TicketDetailModal patterns)
  - 04-roi-estimation (board subtask count subquery pattern can be extended)

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/sortable@^10.0.0 — vertical sortable list abstraction over existing @dnd-kit/core"
    - "@radix-ui/react-alert-dialog — Radix primitive for AlertDialog confirm component"
  patterns:
    - "Nested DndContext for subtask drag: SubtaskSection wraps its own DndContext inside the modal; completely isolated from Kanban board DndContext (RESEARCH.md Pitfall 1 fix)"
    - "Optimistic update for checkbox toggle: cancelQueries + setQueryData on mutate, revert on error, invalidate on settle"
    - "Deterministic avatar color from author_id: hash % AVATAR_COLORS.length for stable per-user visual identity"
    - "Board subtask counts via batch GROUP BY subquery: avoids N+1 / full-row selectinload (RESEARCH.md Pitfall 3)"
    - "fetchMe() in CommentSection via useQuery(['me']) with staleTime 60s — current user for delete permission check"

key-files:
  created:
    - frontend/src/app/(app)/board/_components/SubtaskSection.tsx
    - frontend/src/app/(app)/board/_components/CommentSection.tsx
    - frontend/src/components/ui/alert-dialog.tsx
  modified:
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/app/(app)/board/_components/KanbanCard.tsx
    - frontend/src/lib/api/tickets.ts
    - backend/app/schemas/ticket.py
    - backend/app/routers/board.py
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "@dnd-kit/sortable used for subtask reorder — already in dnd-kit ecosystem; separate DndContext per SubtaskSection prevents Kanban interference (RESEARCH.md Pitfall 1)"
  - "AlertDialog confirm on comment delete instead of window.confirm — consistent with shadcn pattern used in OwnerModal"
  - "fetchMe() called via TanStack Query in CommentSection (staleTime 60s) — avoids prop-drilling current user through TicketDetailModal"
  - "Board subtask counts via single GROUP BY query on ticket_ids batch — not selectinload which would load full subtask rows into memory"
  - "subtasks_total/subtasks_done default to 0 in TicketOut schema — safe default when no subtasks exist, badge hidden via > 0 check in KanbanCard"

patterns-established:
  - "Nested DndContext isolation: wrap sortable list in its own DndContext with separate sensors; no stopPropagation needed"
  - "Optimistic toggle pattern: cancelQueries -> setQueryData -> mutate -> revert on error -> invalidate on settle"
  - "alert-dialog.tsx: new shadcn component following existing dialog.tsx pattern; use for destructive action confirmation"
  - "BatchSubqueryCount: fetch counts for N items in one GROUP BY query; populate into a dict keyed by parent ID; loop over results"

requirements-completed: [COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, COLLAB-07]

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 3 Plan 02: Subtask and Comment UI — SubtaskSection, CommentSection, KanbanCard badge Summary

**SubtaskSection with nested DnD reorder, CommentSection with author/admin delete confirm, both embedded in TicketDetailModal, and KanbanCard showing live subtask count badge from board-level batch subquery**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-25T10:48:55Z
- **Completed:** 2026-02-25T10:58:08Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- SubtaskSection.tsx (200+ lines): inline add (Enter), optimistic checkbox toggle with rollback, drag-to-reorder via nested DndContext + SortableContext using @dnd-kit/sortable, delete with X button; GripVertical drag handle (listeners-only, not whole row)
- CommentSection.tsx (180+ lines): always-visible textarea + Post button, author avatar with deterministic color from author_id, relative timestamp, delete (author or admin only) via AlertDialog confirm dialog
- TicketDetailModal.tsx updated: SubtaskSection after description fields, CommentSection after column history — matches CONTEXT.md locked section order
- KanbanCard.tsx updated: subtask pill badge with Check icon (green when all done, hidden when subtasks_total === 0)
- Backend board endpoint: batch GROUP BY subquery for subtask counts (no N+1, no full-row selectinload)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit/sortable and build SubtaskSection** - `e599029` (feat)
2. **Task 2: CommentSection, embed both in TicketDetailModal, KanbanCard badge** - `4b3fa07` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/app/(app)/board/_components/SubtaskSection.tsx` - Subtask checklist: inline add, optimistic toggle, nested DndContext drag-to-reorder, delete
- `frontend/src/app/(app)/board/_components/CommentSection.tsx` - Comment thread: post, author avatar, delete with AlertDialog confirm
- `frontend/src/components/ui/alert-dialog.tsx` - New shadcn AlertDialog component (Radix primitive wrapper)
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` - Added SubtaskSection + CommentSection at correct positions
- `frontend/src/app/(app)/board/_components/KanbanCard.tsx` - Added subtask count pill badge
- `frontend/src/lib/api/tickets.ts` - Added subtasks_total/subtasks_done to Ticket interface; added fetchMe()
- `backend/app/schemas/ticket.py` - Added subtasks_total: int = 0, subtasks_done: int = 0 to TicketOut
- `backend/app/routers/board.py` - Added batch GROUP BY subquery for subtask counts per ticket
- `frontend/package.json` + `package-lock.json` - @dnd-kit/sortable@^10.0.0, @radix-ui/react-alert-dialog added

## Decisions Made

- Used `fetchMe()` in CommentSection via TanStack Query (staleTime 60s) rather than prop-drilling current user from TicketDetailModal — cleaner separation of concerns
- Board subtask count via single batch GROUP BY query (not selectinload) — only needs total/done counts, not full subtask rows; critical for performance at scale
- `subtasks_total`/`subtasks_done` default to 0 in TicketOut schema — badge hidden in KanbanCard via `> 0` check, clean for tickets with no subtasks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing ESLint error in command.tsx blocking build**
- **Found during:** Task 1 (build verification)
- **Issue:** `interface CommandDialogProps extends DialogProps {}` — empty interface extending supertype triggers `@typescript-eslint/no-empty-object-type` ESLint error, failing compilation
- **Fix:** Changed to `type CommandDialogProps = DialogProps` — functionally identical, no empty interface
- **Files modified:** `frontend/src/components/ui/command.tsx`
- **Verification:** `npm run build` passes after fix
- **Committed in:** `e599029` (Task 1 commit)

**2. [Rule 3 - Blocking] Installed @radix-ui/react-alert-dialog and created alert-dialog.tsx**
- **Found during:** Task 2 (CommentSection implementation — plan specifies shadcn AlertDialog)
- **Issue:** AlertDialog component not in project; @radix-ui/react-alert-dialog not installed
- **Fix:** `npm install @radix-ui/react-alert-dialog`; created `frontend/src/components/ui/alert-dialog.tsx` following existing dialog.tsx shadcn pattern
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/components/ui/alert-dialog.tsx` (new)
- **Verification:** CommentSection imports AlertDialog cleanly; build passes
- **Committed in:** `4b3fa07` (Task 2 commit)

**3. [Rule 3 - Blocking] Cleared stale .next build cache causing ENOENT rename error**
- **Found during:** Task 2 build verification (second build attempt)
- **Issue:** Next.js build failed with `ENOENT: rename .next/export/500.html -> .next/server/pages/500.html` — stale cache from prior background build process
- **Fix:** `rm -rf .next` then `npm run build` — fresh build succeeds
- **Files modified:** None (cache directory only)
- **Verification:** Clean build passes on second attempt
- **Committed in:** N/A (filesystem cache, not committed)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - Blocking)
**Impact on plan:** All fixes unblocked compilation. No scope changes. ESLint fix and AlertDialog creation were necessary prerequisites to verify build clean; .next cache issue was transient.

## Issues Encountered

None beyond the three auto-fixed blocking issues above.

## User Setup Required

None — no external service configuration required. All changes use existing API endpoints established in Plan 03-01.

## Next Phase Readiness

- SubtaskSection and CommentSection are live in the ticket detail modal
- Board endpoint now returns subtask counts for KanbanCard badge display
- Plans 03-03 (Portal) and 03-04 (Templates settings) can proceed — no blockers from this plan
- Alert-dialog component is available for reuse in any future destructive action confirmations

## Self-Check: PASSED

Files verified:
- frontend/src/app/(app)/board/_components/SubtaskSection.tsx: FOUND
- frontend/src/app/(app)/board/_components/CommentSection.tsx: FOUND
- frontend/src/components/ui/alert-dialog.tsx: FOUND
- TicketDetailModal.tsx (SubtaskSection + CommentSection embedded): VERIFIED (4 matches)
- KanbanCard.tsx (subtask badge): VERIFIED (3 matches on subtasks_total/subtasks_done)
- backend/app/schemas/ticket.py (subtask counts): VERIFIED
- backend/app/routers/board.py (subtask count subquery): VERIFIED

Commits verified:
- e599029: FOUND (Task 1 — SubtaskSection)
- 4b3fa07: FOUND (Task 2 — CommentSection, modal integration, KanbanCard)

---
*Phase: 03-collaboration-and-department-portal*
*Completed: 2026-02-25*
