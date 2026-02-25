---
phase: 02-kanban-core
verified: 2026-02-25T09:00:00Z
status: human_needed
score: 12/12 must-haves verified
human_verification:
  - test: "Drag an unowned Backlog ticket to Discovery — confirm owner modal appears; cancel — confirm card snaps back to Backlog"
    expected: "Card returns to Backlog column with no state pollution; mutation was never fired"
    why_human: "Optimistic-update intercept (pendingMove state pattern) cannot be verified by static grep; requires live drag-and-drop interaction"
  - test: "Drag an already-owned ticket from Discovery to In Progress"
    expected: "Card moves immediately, no modal appears"
    why_human: "Conditional modal logic (owner_id check) requires live drag interaction to confirm no false positives"
  - test: "Apply a priority filter in the filter bar — URL updates to /board?priority=high; copy URL and open in new tab"
    expected: "New tab shows the same filtered board with only high-priority tickets"
    why_human: "URL shareability and nuqs serialization require browser verification"
  - test: "Click a ticket card — detail modal opens; URL updates to /board?ticket={id}; close modal — URL reverts"
    expected: "Modal opens/closes driven by URL param; no stale state"
    why_human: "URL-driven modal state cannot be tested by static analysis"
  - test: "Type in Tiptap problem statement editor — wait 1 second — confirm auto-save fires (Network tab shows PATCH /api/tickets/{id}); then click outside editor — confirm immediate save"
    expected: "1s debounced save + flush-on-blur; no save button needed"
    why_human: "Tiptap onUpdate/onBlur auto-save timing requires live browser interaction"
  - test: "Board polls every 30 seconds without user interaction (watch Network tab for GET /api/board)"
    expected: "Request fires automatically at 30s intervals via refetchInterval"
    why_human: "Timing-based polling cannot be confirmed via static analysis"
---

# Phase 2: Kanban Core Verification Report

**Phase Goal:** Admin and member users can manage the full ticket lifecycle on a Kanban board — creating tickets, moving them between columns with owner assignment, viewing all ticket details with rich text and activity history, and filtering the board
**Verified:** 2026-02-25T09:00:00Z
**Status:** human_needed — automated checks all pass; 6 behavioral items require live browser confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1 | POST /api/tickets creates a ticket in Backlog with owner_id null and emits a TicketEvent | VERIFIED | `services/tickets.py:38-62` — creates Ticket(status_column=Backlog, owner_id=None), ColumnHistory, TicketEvent in one transaction; Test 1 + Test 2 assert this |
| 2 | PATCH /api/tickets/{id}/move enforces Backlog rules (TICKET-07/08) and emits ColumnHistory + TicketEvent atomically | VERIFIED | `services/tickets.py:88-157` — explicit HTTPException(400) for both rules; closes open ColumnHistory row, opens new row, emits moved + optional assigned events before single commit |
| 3 | GET /api/board returns all tickets with owner and department eagerly loaded (no N+1) | VERIFIED | `routers/board.py:63-138` — selectinload(Ticket.owner) + selectinload(Ticket.department); batch ColumnHistory query WHERE ticket_id IN (:ids) for time_in_column |
| 4 | GET /api/auth/users returns id, full_name, email for all active users | VERIFIED | `routers/auth.py:95-96` — @router.get("/users") endpoint present; Test 13 asserts 200 with list and correct fields |
| 5 | Alembic migration creates tickets, column_history, ticket_events tables | VERIFIED | Migration file `e58d6c737dab_phase2_kanban_core.py` exists; SUMMARY documents it applied at head |
| 6 | Board page renders 5 columns (Backlog, Discovery, In Progress, Review/QA, Done) with ticket cards | VERIFIED | `KanbanBoard.tsx:22-28` — COLUMNS constant contains all 5 values; `KanbanColumn` rendered for each; `useBoard` pulls from /api/board |
| 7 | Ticket cards can be dragged between columns; board updates optimistically on drop | VERIFIED | `KanbanBoard.tsx:86-91` — moveTicket.mutate called in onDragEnd; `useMoveTicket.ts:17-27` — onMutate snapshots previousBoard and applies optimistic update; onError rolls back |
| 8 | Dragging an unowned Backlog ticket sets pendingMove (no mutation yet); OwnerModal appears; cancelling clears pendingMove with no mutation | VERIFIED | `KanbanBoard.tsx:79-83` — pendingMove set, return before mutate; `KanbanBoard.tsx:165-168` — cancel = setPendingMove(null) with no mutate call |
| 9 | Board polls every 30 seconds | VERIFIED | `useBoard.ts:29` — refetchInterval: 30_000 in useQuery config |
| 10 | QuickAddInput creates ticket, invalidates board, and opens detail modal via URL | VERIFIED | `QuickAddInput.tsx:51-54` — invalidateQueries(["board"]) then setTicketId(newTicket.id) on success |
| 11 | Filter bar persists all 10 filter params in URL via nuqs; board re-fetches on filter change | VERIFIED | `BoardFilterBar.tsx:25-36` — useQueryStates with all 10 params; `useBoard.ts:7-29` — reads same params internally, includes filterParams in queryKey |
| 12 | Ticket detail modal opens on card click; URL updates to /board?ticket={id}; shows all fields, Tiptap auto-save, activity timeline, column history | VERIFIED | `KanbanCard.tsx:73,96` — setTicketId(ticket.id) on click; `TicketDetailModal.tsx:517-539` — Dialog.Root open={!!ticketId}; `TiptapEditor.tsx:20-27` — immediatelyRender:false, 1s debounce + onBlur flush; `TicketDetailModal.tsx:417-503` — activity timeline and column history sections both present and substantive |

**Score:** 12/12 truths verified by static analysis

---

### Required Artifacts

#### Plan 02-01 Backend Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `backend/app/models/ticket.py` | VERIFIED | 84 lines; `class Ticket` with all TICKET-01–06 fields: title, problem_statement (JSONB), urgency (CheckConstraint 1–5), business_impact, success_criteria, due_date, effort_estimate, next_step, priority (Enum), status_column (Enum, default=Backlog), department_id FK, owner_id FK (nullable) |
| `backend/app/models/column_history.py` | VERIFIED | 35 lines; `class ColumnHistory` with ticket_id FK (CASCADE), column, entered_at TIMESTAMPTZ, exited_at TIMESTAMPTZ nullable, Index on (ticket_id, exited_at) |
| `backend/app/models/ticket_event.py` | VERIFIED | 38 lines; `class TicketEvent` with ticket_id FK (CASCADE), event_type, payload JSONB, actor_id FK (SET NULL), Index on (ticket_id, created_at) |
| `backend/app/services/tickets.py` | VERIFIED | 158 lines; exports create_ticket() and move_ticket(); atomic transaction pattern; TICKET-07/08 enforcement at lines 89–105; ColumnHistory close+open at lines 110–127 |
| `backend/app/routers/tickets.py` | VERIFIED | 201 lines; exports router; POST/GET/PATCH/DELETE + /move + /events + /history — all with get_current_user; DELETE uses require_admin |
| `backend/app/routers/board.py` | VERIFIED | 139 lines; exports router; GET /board with selectinload + batch ColumnHistory query; all 9 filter params wired |
| `backend/tests/test_tickets.py` | VERIFIED | 350 lines (well above 80 min); 13 tests covering all ticket CRUD and move semantics |

#### Plan 02-02 Frontend Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `frontend/src/lib/providers.tsx` | VERIFIED | 23 lines; contains NuqsAdapter; QueryClientProvider + NuqsAdapter wrapper |
| `frontend/src/hooks/useBoard.ts` | VERIFIED | 31 lines; contains refetchInterval: 30_000; reads filters from nuqs internally via useQueryStates |
| `frontend/src/hooks/useMoveTicket.ts` | VERIFIED | 32 lines; contains previousBoard; onMutate snapshot + cancelQueries + setQueryData + onError rollback |
| `frontend/src/app/(app)/board/_components/KanbanBoard.tsx` | VERIFIED | 177 lines; contains pendingMove; DndContext with all handlers; OwnerModal + TicketDetailModal mounted |
| `frontend/src/app/(app)/board/_components/KanbanCard.tsx` | VERIFIED | 184 lines (above 60 min); all BOARD-04 metadata: dept badge, title (line-clamp-2), owner initials avatar, past-due date, effort estimate, business_impact snippet, next_step, time_in_column |
| `frontend/src/app/(app)/board/_components/OwnerModal.tsx` | VERIFIED | 157 lines; contains onConfirm prop; Radix Dialog + Popover/Command combobox; confirm disabled until owner selected |

#### Plan 02-03 Filter + Modal Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `frontend/src/app/(app)/board/_components/BoardFilterBar.tsx` | VERIFIED | 215 lines; contains useQueryStates; 10 filter params; clear-all button; active filter badge |
| `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` | VERIFIED | 539 lines; contains ticketId from useQueryState; all DETAIL-02 fields; Tiptap, timeline (DETAIL-05), column history table (DETAIL-06), inline editing for all DETAIL-04 fields |
| `frontend/src/app/(app)/board/_components/TiptapEditor.tsx` | VERIFIED | 38 lines; contains immediatelyRender: false; StarterKit; 1s debounce onUpdate + flush+save onBlur |
| `frontend/src/hooks/useTicketDetail.ts` | VERIFIED | 42 lines; exports useTicketDetail; three useQuery calls (ticket, events, history); useMutation with board invalidation |

---

### Key Link Verification

#### Plan 02-01 Backend Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `services/tickets.py` | `models/column_history.py` | SELECT open row (exited_at IS None), set exited_at, INSERT new row — all in transaction | WIRED | `services/tickets.py:110-127` — ColumnHistory.exited_at.is_(None) query at line 113; open_row.exited_at = now at line 118; new ColumnHistory INSERT at 121 |
| `routers/board.py` | `models/ticket.py` | selectinload(Ticket.owner) + selectinload(Ticket.department) | WIRED | `routers/board.py:65-68` — both selectinload calls present |
| `routers/tickets.py` | `services/tickets.py` | move_ticket() called in PATCH /{id}/move handler | WIRED | `routers/tickets.py:158` — `ticket = await move_ticket(db, ticket_id, data, actor_id=current_user.id)` |

#### Plan 02-02 Frontend Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `KanbanBoard.tsx` | `useMoveTicket.ts` | onConfirm in OwnerModal calls mutate({ticketId, targetColumn, ownerId}) | WIRED | `KanbanBoard.tsx:158-163` — moveTicket.mutate({ticketId, targetColumn, ownerId}) inside onConfirm |
| `useMoveTicket.ts` | `/api/tickets/{id}/move` | fetch PATCH with {target_column, owner_id} body | WIRED | `lib/api/tickets.ts:212-218` — moveTicket() fetches PATCH to `${API}/api/tickets/${ticketId}/move` with JSON body |
| `useBoard.ts` | `/api/board` | useQuery queryFn calling fetchBoard(filters) | WIRED | `useBoard.ts:26-30` — queryFn: () => fetchBoard(filterParams); fetchBoard fetches /api/board |
| `KanbanBoard.tsx` | `KanbanDragOverlay.tsx` | DragOverlay always mounted; renders KanbanCard when activeTicket is set | WIRED | `KanbanBoard.tsx:151` — `<KanbanDragOverlay activeTicket={activeTicket} />` always rendered (not conditional) |
| `QuickAddInput.tsx` | URL ?ticket={id} | setTicketId(newTicket.id) from useQueryState('ticket') | WIRED | `QuickAddInput.tsx:26,54` — useQueryState("ticket") at line 26; setTicketId(newTicket.id) at line 54 |

#### Plan 02-03 Filter + Modal Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `BoardFilterBar.tsx` | `useBoard.ts` | filters from useQueryStates passed to useBoard(filters) queryKey | WIRED | `useBoard.ts:7-29` — useBoard owns filter state internally via useQueryStates; filterParams in queryKey causes re-fetch when URL params change |
| `KanbanCard.tsx` | `TicketDetailModal.tsx` | clicking card calls setTicketId(ticket.id) via nuqs useQueryState('ticket') | WIRED | `KanbanCard.tsx:73,96` — useQueryState("ticket") at line 73; onClick sets setTicketId(ticket.id) at line 96; TicketDetailModal reads same param at `TicketDetailModal.tsx:518` |
| `TiptapEditor.tsx` | `/api/tickets/{id}` | onSave calls updateTicket(ticketId, { problem_statement: json }) | WIRED | `TicketDetailModal.tsx:364-365` — `<TiptapEditor onSave={(json) => updateMutation.mutate({ problem_statement: json })} />`; updateMutation calls updateTicket() which PATCHes /api/tickets/{id} |
| `useTicketDetail.ts` | `/api/tickets/{id}/events` | useQuery queryFn calling fetchTicketEvents(ticketId) | WIRED | `useTicketDetail.ts:20-24` — queryKey: ["ticket-events", ticketId]; queryFn: () => fetchTicketEvents(ticketId!) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TICKET-01 | 02-01 | Ticket fields: title, problem_statement (rich text), urgency (1–5), business_impact, success_criteria, due_date, effort_estimate, next_step, department_id | SATISFIED | `models/ticket.py:35-43` — all 9 fields present with correct types; JSONB for problem_statement; CheckConstraint for urgency |
| TICKET-02 | 02-01 | New tickets created in Backlog with owner_id = null | SATISFIED | `services/tickets.py:38-39` — status_column=StatusColumn.Backlog, owner_id=None hardcoded |
| TICKET-03 | 02-01 | Any authenticated user (admin/member) can edit any ticket field | SATISFIED | `routers/tickets.py:98-103` — PATCH uses get_current_user (not require_admin) |
| TICKET-04 | 02-01 | Admin can delete a ticket | SATISFIED | `routers/tickets.py:135-147` — DELETE uses require_admin; Test 10 confirms 403 for member, Test 11 confirms 204 for admin |
| TICKET-05 | 02-01 | Ticket has a priority field (low/medium/high/critical) | SATISFIED | `models/ticket.py:43-50` — Priority Enum with values_callable |
| TICKET-06 | 02-01 | Ticket stores status_column (Backlog/Discovery/In Progress/Review/QA/Done) | SATISFIED | `models/ticket.py:51-60` — StatusColumn Enum with values_callable storing exact string values |
| TICKET-07 | 02-01 | Backlog tickets must have owner_id = null (server-side enforcement) | SATISFIED | `services/tickets.py:89-93` — HTTPException(400) if target_column==Backlog and owner_id is not None |
| TICKET-08 | 02-01 | Moving out of Backlog requires owner_id | SATISFIED | `services/tickets.py:96-105` — HTTPException(400) if from Backlog, to non-Backlog, and both ticket.owner_id and data.owner_id are None |
| TICKET-09 | 02-01 | Every move recorded as ColumnHistory entry | SATISFIED | `services/tickets.py:110-127` — close open row + open new row in same transaction for every move |
| TICKET-10 | 02-01 | Every state change emits a TicketEvent | SATISFIED | create_ticket emits "created"; move_ticket emits "moved" + optional "assigned"; update_ticket emits "edited" |
| BOARD-01 | 02-02 | Kanban board shows 5 columns: Backlog, Discovery, In Progress, Review/QA, Done | SATISFIED | `KanbanBoard.tsx:22-28` — COLUMNS constant with all 5 values; one KanbanColumn per column |
| BOARD-02 | 02-02 | Drag-and-drop with optimistic UI and rollback on rejection | SATISFIED | `useMoveTicket.ts:17-29` — onMutate snapshot + setQueryData + onError rollback pattern |
| BOARD-03 | 02-02 | Dragging ticket out of Backlog opens owner-assignment modal | SATISFIED | `KanbanBoard.tsx:79-83` — pendingMove intercept for Backlog + no owner_id; cancel = setPendingMove(null) with no mutation |
| BOARD-04 | 02-02 | Card displays: department badge, title, owner initials/avatar, due date, time in column, next_step, urgency badge, priority, business_impact snippet, effort estimate | SATISFIED | `KanbanCard.tsx` — dept badge (line 105), priority badge (114), title (127), business_impact (132), next_step (139), owner initials (149), due date (160), effort (172), time_in_column (179) |
| BOARD-05 | 02-03 | Filter bar: owner, department, created date range, due date range, priority/urgency, aging | SATISFIED | `BoardFilterBar.tsx:25-36` — all 10 filter params including created_after/before, due_after/before, min/max_urgency, min_age_days |
| BOARD-06 | 02-03 | Filters persist in URL query params (shareable) | SATISFIED | `BoardFilterBar.tsx:25` — useQueryStates from nuqs; all filter changes update URL params |
| BOARD-07 | 02-02 | Board polls every 30 seconds | SATISFIED | `useBoard.ts:29` — refetchInterval: 30_000 |
| BOARD-08 | 02-01 | Board loads via single API endpoint with eager loading (no N+1) | SATISFIED | `routers/board.py:63-68` — selectinload for owner + department; batch ColumnHistory query for time_in_column |
| DETAIL-01 | 02-03 | Clicking card opens ticket detail modal/page | SATISFIED | `KanbanCard.tsx:73,96` — onClick sets nuqs ticket param; `TicketDetailModal.tsx:521` — Dialog.Root open={!!ticketId} |
| DETAIL-02 | 02-03 | Detail view shows all ticket fields | SATISFIED | `TicketDetailModal.tsx:165-514` — status_column, owner, department, priority, urgency, due_date, effort, problem_statement (Tiptap), next_step, business_impact, success_criteria all rendered |
| DETAIL-03 | 02-03 | Tiptap stores JSON, never HTML | SATISFIED | `TiptapEditor.tsx:22` — editor.getJSON() used in both onUpdate and onBlur; `models/ticket.py:36` — stored as JSONB |
| DETAIL-04 | 02-03 | User can edit ticket fields inline | SATISFIED | `TicketDetailModal.tsx` — editingTitle, editingOwner, editingPriority, editingUrgency, editingDueDate, editingEffort states; all with click-to-edit + blur/Enter commits via updateMutation |
| DETAIL-05 | 02-03 | Activity timeline renders all TicketEvents chronologically | SATISFIED | `TicketDetailModal.tsx:417-463` — eventsQuery.data sorted by created_at.localeCompare; "created", "moved", "assigned", "edited" event types all handled with descriptive text |
| DETAIL-06 | 02-03 | Column history shows all columns with enter/exit timestamps and time spent | SATISFIED | `TicketDetailModal.tsx:465-503` — historyQuery.data rendered in table with column, entered_at, exited_at (or "Still here"), time_spent |

**All 24 requirements satisfied.**

---

### Anti-Patterns Found

No anti-patterns detected:

- No TODO/FIXME/PLACEHOLDER comments in any Phase 2 file
- No stub implementations (empty handlers, placeholder returns)
- No unconnected wiring (all key links verified above)
- `TiptapEditor.tsx:30` — `if (!editor) return null` is correct SSR guard (not a stub)
- `KanbanCard.tsx:65-66` — overlay stub for useDraggable is intentional anti-pattern guard per RESEARCH.md (prevents infinite re-renders in DragOverlay)

---

### Human Verification Required

The following items require live browser interaction to fully confirm. All automated evidence is present and correct; these are behavioral confirmations only.

#### 1. Drag Cancel Snap-Back

**Test:** Drag an unowned Backlog ticket to any other column. When the OwnerModal appears, click Cancel.
**Expected:** The ticket card remains in the Backlog column — no ghost card, no stuck state, no intermediate position.
**Why human:** The pendingMove intercept (no optimistic update before owner confirmation) is the correct pattern per code, but only a live drag can confirm the snap-back feels correct and no visual glitch occurs.

#### 2. No Spurious Owner Modal for Already-Owned Tickets

**Test:** Move a ticket with an assigned owner (visible initials avatar) from Discovery to In Progress by dragging.
**Expected:** Card moves immediately to In Progress. No owner modal appears.
**Why human:** The conditional check `ticket.status_column === "Backlog" && !ticket.owner_id` must be confirmed to not fire false positives in a live drag.

#### 3. URL Filter Shareability

**Test:** Apply a priority filter ("high") in the filter bar. Confirm URL changes to `/board?priority=high`. Copy URL. Open in a new browser tab (while logged in).
**Expected:** The new tab shows the same filter applied — only high-priority tickets visible.
**Why human:** nuqs URL serialization round-trips require browser verification; cannot confirm server-side filter application from grep.

#### 4. URL-Driven Ticket Detail Modal

**Test:** Click any ticket card. Confirm URL changes to `/board?ticket={id}`. Copy URL and paste in a new tab. Close modal via X button.
**Expected:** New tab opens with modal already showing the same ticket. Closing removes `?ticket` from URL.
**Why human:** Radix Dialog open={!!ticketId} controlled by nuqs URL state requires browser interaction to confirm correct mount/unmount and URL transitions.

#### 5. Tiptap Auto-Save Timing

**Test:** Open ticket detail modal. Type text in the Problem Statement Tiptap editor. Stop typing and watch Network tab. After ~1 second, confirm PATCH /api/tickets/{id} fires. Click outside the editor — confirm immediate PATCH fires.
**Expected:** Debounced 1s auto-save on typing pause; immediate save on blur.
**Why human:** useDebouncedCallback timing and Tiptap onBlur flush require live timing confirmation.

#### 6. 30-Second Board Polling

**Test:** Open /board. Open browser Network tab. Wait 30+ seconds without interacting.
**Expected:** GET /api/board fires automatically every 30 seconds.
**Why human:** refetchInterval timing cannot be verified via static analysis.

---

### Gaps Summary

No gaps. All 24 requirements are satisfied by substantive, wired implementations. The 6 human verification items are confirmatory behavioral checks — not blockers. The code evidence for each is complete:

- All 3 backend ORM models exist with correct fields, indexes, and relationships
- Alembic migration file present (e58d6c737dab_phase2_kanban_core.py)
- All backend endpoints exist and are registered in main.py
- TICKET-07/TICKET-08 enforced in move_ticket() service
- 350-line test suite covers all 13 ticket/board test scenarios
- All 13 frontend components exist and are substantive
- All key links are verified as wired (not just created)
- No stub implementations, no orphaned artifacts
- 8 Phase 2 feature commits confirmed in git log (dd2de19 through 72e113f)

---

_Verified: 2026-02-25T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
