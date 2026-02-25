---
phase: 02-kanban-core
plan: "02"
subsystem: ui
tags: [react, dnd-kit, tanstack-query, nuqs, date-fns, tiptap, shadcn, kanban]

# Dependency graph
requires:
  - phase: 01-foundation-and-auth
    provides: Next.js App Router, AppSidebar, authentication, shadcn/ui button/input
  - phase: 02-kanban-core/02-01
    provides: GET /api/board, POST /api/tickets, PATCH /api/tickets/{id}/move, GET /api/auth/users, GET /api/departments
provides:
  - Kanban board at /board with 5 columns (Backlog, Discovery, In Progress, Review/QA, Done)
  - Drag-and-drop via @dnd-kit/core with 8px activation threshold
  - Optimistic UI updates with TanStack Query onMutate/onError rollback
  - Owner-assignment modal (OwnerModal) that intercepts unowned Backlog->other drags
  - Cancel snap-back: optimistic update never applied before owner confirmation
  - KanbanCard with urgency left border, dept/priority badges, owner initials avatar, due date, effort, business_impact, next_step, time_in_column
  - QuickAddInput in Backlog column: create ticket + open detail modal via nuqs ?ticket= param
  - 30-second polling via refetchInterval: 30_000 (BOARD-07)
  - Providers: QueryClientProvider (staleTime 10s) + NuqsAdapter wrapper in app layout
  - UI primitives: dialog.tsx, popover.tsx, command.tsx (shadcn Combobox pattern)
affects:
  - 02-03 (ticket detail modal — will use ?ticket= URL state established here)
  - 02-04 (board filter bar — will use useBoard/nuqs pattern established here)
  - any future phase using TanStack Query or nuqs

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core ^6 — drag-and-drop DndContext, useDraggable, useDroppable, DragOverlay"
    - "@dnd-kit/utilities ^3 — CSS.Transform.toString for drag animation"
    - "@tanstack/react-query ^5 — useQuery, useMutation, QueryClient, QueryClientProvider"
    - "nuqs ^2 — useQueryState with NuqsAdapter for URL state (ticket detail, filters)"
    - "@tiptap/react + @tiptap/pm + @tiptap/starter-kit ^2 — rich text editor (for 02-03)"
    - "use-debounce ^10 — debounced auto-save (for 02-03 detail modal)"
    - "date-fns ^3 — format/parseISO for due date display"
    - "@radix-ui/react-popover — Combobox trigger for owner selector"
    - "cmdk — Command primitive for searchable owner dropdown"
  patterns:
    - "Providers: client wrapper combining QueryClientProvider + NuqsAdapter in app layout"
    - "DragOverlay always mounted — children rendered conditionally (anti-pattern avoided)"
    - "pendingMove intercept: no optimistic update before owner selection; cancel = snap-back"
    - "useDraggable skipped when isOverlay=true (prevents infinite re-render in DragOverlay)"
    - "useBoard: refetchInterval 30_000 for passive 30s polling"
    - "useMoveTicket: onMutate snapshot + cancelQueries + setQueryData + onError rollback"

key-files:
  created:
    - frontend/src/lib/providers.tsx
    - frontend/src/lib/api/tickets.ts
    - frontend/src/hooks/useBoard.ts
    - frontend/src/hooks/useMoveTicket.ts
    - frontend/src/app/(app)/board/_components/KanbanBoard.tsx
    - frontend/src/app/(app)/board/_components/KanbanColumn.tsx
    - frontend/src/app/(app)/board/_components/KanbanCard.tsx
    - frontend/src/app/(app)/board/_components/KanbanDragOverlay.tsx
    - frontend/src/app/(app)/board/_components/QuickAddInput.tsx
    - frontend/src/app/(app)/board/_components/OwnerModal.tsx
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/popover.tsx
    - frontend/src/components/ui/command.tsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/app/(app)/layout.tsx
    - frontend/src/app/(app)/board/page.tsx

key-decisions:
  - "DragOverlay always mounted unconditionally — children null when no active drag (anti-pattern from RESEARCH.md avoided)"
  - "useDraggable conditionally skipped when isOverlay=true — prevents infinite re-render loops in DragOverlay children"
  - "pendingMove state (not optimistic update) for Backlog->other unowned drags — cancel truly snaps card back with no state cleanup"
  - "dialog.tsx, popover.tsx, command.tsx created as missing shadcn UI primitives (Rule 3 auto-fix)"
  - "PointerSensor with distance: 8 activation constraint prevents accidental drags on card clicks"
  - "getDepartments() reused from lib/api/client.ts for QuickAddInput department select"

patterns-established:
  - "Pattern: Provider wrapper — QueryClientProvider + NuqsAdapter in single client component wrapping server layout"
  - "Pattern: Drag intercept — onDragEnd stores pendingMove instead of firing mutation for conditional flows"
  - "Pattern: Kanban column — useDroppable(id=column) with isOver bg highlight; tickets rendered as list"
  - "Pattern: KanbanCard isOverlay — skip useDraggable hook when rendering inside DragOverlay"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-07, BOARD-08]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 2 Plan 02: Kanban Board Summary

**Drag-and-drop Kanban board with dnd-kit, owner-assignment modal, optimistic UI, 30s polling, and full BOARD-04 card metadata using TanStack Query + nuqs**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T07:38:48Z
- **Completed:** 2026-02-25T07:43:24Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Full drag-and-drop Kanban board at /board with 5 columns using @dnd-kit/core with 8px activation threshold and DragOverlay
- Owner-assignment modal fires exclusively for unowned Backlog->other drags; cancel snaps card back via no-optimistic-update-before-confirm pattern
- KanbanCard displays all BOARD-04 metadata: urgency left border color, department/priority badges, owner initials avatar, past-due date highlighting, effort estimate, business_impact snippet, next_step, time_in_column
- QuickAddInput creates tickets in Backlog and immediately opens detail modal via nuqs ?ticket= URL state
- 30-second passive polling via useBoard refetchInterval (BOARD-07) with 10s staleTime
- Zero TypeScript errors across all 16 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and set up providers + API client + hooks** - `8a027bb` (feat)
2. **Task 2: KanbanBoard, KanbanColumn, KanbanCard, DragOverlay, QuickAddInput, OwnerModal** - `da91075` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `frontend/src/lib/providers.tsx` - QueryClientProvider + NuqsAdapter wrapper ("use client")
- `frontend/src/lib/api/tickets.ts` - Typed fetch functions: fetchBoard, createTicket, moveTicket, updateTicket, fetchUsers
- `frontend/src/hooks/useBoard.ts` - useQuery with refetchInterval: 30_000
- `frontend/src/hooks/useMoveTicket.ts` - useMutation with onMutate optimistic update + previousBoard rollback
- `frontend/src/app/(app)/board/page.tsx` - Server component rendering KanbanBoard client boundary
- `frontend/src/app/(app)/board/_components/KanbanBoard.tsx` - DndContext, pendingMove intercept, 5 columns, DragOverlay, OwnerModal
- `frontend/src/app/(app)/board/_components/KanbanColumn.tsx` - useDroppable, isOver highlight, QuickAddInput in Backlog
- `frontend/src/app/(app)/board/_components/KanbanCard.tsx` - 177 lines; all BOARD-04 metadata; urgency border, initials avatar, past-due date
- `frontend/src/app/(app)/board/_components/KanbanDragOverlay.tsx` - Always-mounted DragOverlay with isOverlay KanbanCard
- `frontend/src/app/(app)/board/_components/QuickAddInput.tsx` - Title + department select; setTicketId on success
- `frontend/src/app/(app)/board/_components/OwnerModal.tsx` - Radix Dialog + Popover/Command combobox for owner selection
- `frontend/src/components/ui/dialog.tsx` - shadcn Dialog primitive (new)
- `frontend/src/components/ui/popover.tsx` - shadcn Popover primitive (new)
- `frontend/src/components/ui/command.tsx` - shadcn Command/Combobox primitive (new)
- `frontend/src/app/(app)/layout.tsx` - Wrapped with Providers component
- `frontend/package.json` + `package-lock.json` - 76 packages added

## Decisions Made

- **Always-mounted DragOverlay:** DragOverlay component never conditionally rendered; only its children are conditional. This is the RESEARCH.md anti-pattern guard — unmounting DragOverlay during a drag kills drop animations.
- **Skip useDraggable in overlay:** When `isOverlay=true`, KanbanCard skips the `useDraggable` hook. Using useDraggable inside DragOverlay causes infinite re-render loops (RESEARCH.md anti-pattern).
- **No optimistic update before owner confirmation:** The `pendingMove` state holds the intended move without touching query data. If the user cancels the modal, no state reset is needed — the board is unchanged. Mutation fires only inside `onConfirm`.
- **dialog/popover/command.tsx auto-created:** OwnerModal required Radix Dialog + shadcn Combobox pattern. These UI primitives didn't exist yet (Rule 3 — blocking dependencies).
- **getDepartments reused from client.ts:** QuickAddInput uses the existing `getDepartments` function from lib/api/client.ts rather than duplicating in tickets.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing shadcn UI primitives: dialog.tsx, popover.tsx, command.tsx**
- **Found during:** Task 2 (OwnerModal implementation)
- **Issue:** OwnerModal requires Radix Dialog + shadcn Combobox (Popover + Command). None of these existed in frontend/src/components/ui/. Without them, OwnerModal could not be implemented.
- **Fix:** Created dialog.tsx (Radix Dialog wrapper), popover.tsx (Radix Popover wrapper), command.tsx (cmdk Command wrapper following shadcn pattern). @radix-ui/react-dialog was already installed; @radix-ui/react-popover and cmdk were installed in Task 1.
- **Files modified:** frontend/src/components/ui/dialog.tsx, popover.tsx, command.tsx
- **Verification:** TypeScript compiles all three without errors; OwnerModal imports correctly
- **Committed in:** da91075 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Required to implement OwnerModal as specified. No scope creep — these are standard shadcn UI components the plan implicitly required.

## Issues Encountered

None - TypeScript compiled cleanly on first pass for both tasks.

## User Setup Required

None - no external service configuration required. Board connects to the same backend established in Phase 1.

## Next Phase Readiness

- Board is ready for Plan 02-03 (ticket detail modal): ?ticket= URL state wired up via nuqs, fetchUsers/updateTicket API functions available, Tiptap dependencies installed
- Board is ready for Plan 02-04 (filter bar): useBoard accepts filters Record<string, string|null>, nuqs installed, URL state pattern established
- All BOARD-0{1,2,3,4,7,8} requirements fulfilled

## Self-Check: PASSED

- All 14 created/modified files confirmed present on disk
- Both task commits (8a027bb, da91075) confirmed in git log
- TypeScript: 0 errors (`npx tsc --noEmit` clean)

---
*Phase: 02-kanban-core*
*Completed: 2026-02-25*
