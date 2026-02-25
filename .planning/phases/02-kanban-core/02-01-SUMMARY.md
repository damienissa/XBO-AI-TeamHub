---
phase: 02-kanban-core
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, alembic, postgresql, jsonb, pytest, asyncio, pydantic-v2]

# Dependency graph
requires:
  - phase: 01-02
    provides: get_current_user dependency, require_admin dependency, User model, Department model, auth router, seeded_db pytest fixture

provides:
  - Ticket ORM model with StatusColumn/Priority enums, JSONB problem_statement, urgency CheckConstraint
  - ColumnHistory ORM model with (ticket_id, exited_at) composite index for open-row queries
  - TicketEvent ORM model with (ticket_id, created_at) index for timeline queries
  - phase2_kanban_core Alembic migration (revision e58d6c737dab) — tickets, column_history, ticket_events tables
  - Pydantic v2 schemas: TicketCreate, TicketUpdate, TicketOut, TicketMoveRequest, TicketEventOut, ColumnHistoryOut
  - services/tickets.py: create_ticket() and move_ticket() with atomic transactions and TICKET-07/08 enforcement
  - routers/tickets.py: POST/GET/PATCH/DELETE + /move + /events + /history — all protected by get_current_user
  - routers/board.py: GET /api/board with selectinload (BOARD-08), batch ColumnHistory query, optional filters
  - GET /api/auth/users: returns all active users ordered by full_name (owner selector)
  - 13 pytest tests covering all ticket CRUD, move semantics, and event/history endpoints

affects:
  - 02-02 (frontend KanbanBoard component calls GET /api/board)
  - 02-03 (ticket move drag-and-drop calls PATCH /api/tickets/{id}/move)
  - 02-04 (ticket detail panel calls GET /api/tickets/{id}/events and /history)
  - all subsequent phases (Ticket model and ticket service patterns established)

# Tech tracking
tech-stack:
  added: []  # All libraries already in requirements.txt from Phase 1
  patterns:
    - Atomic ticket operations: create_ticket uses db.flush() to get ticket.id, then creates ColumnHistory + TicketEvent in same session before commit
    - move_ticket: SELECT open ColumnHistory row (exited_at IS NULL), set exited_at=now(), INSERT new row — all before commit
    - selectinload(Ticket.owner) + selectinload(Ticket.department) on board query eliminates N+1
    - Batch ColumnHistory query: single SELECT WHERE ticket_id = ANY(:ids) for time_in_column computation across all board tickets
    - values_callable on SQLAlchemy Enum to store enum .value strings ("In Progress", "Review/QA") not Python enum .name ("InProgress", "ReviewQA")
    - lazy="raise" on Ticket.owner and Ticket.department forces explicit eager loading — prevents accidental N+1 in new endpoints
    - ColumnHistoryOut model_validator computes time_spent string on deserialization (closed rows only)

key-files:
  created:
    - backend/app/models/ticket.py
    - backend/app/models/column_history.py
    - backend/app/models/ticket_event.py
    - backend/app/schemas/ticket.py
    - backend/app/schemas/ticket_event.py
    - backend/app/schemas/column_history.py
    - backend/alembic/versions/e58d6c737dab_phase2_kanban_core.py
    - backend/app/services/tickets.py
    - backend/app/routers/tickets.py
    - backend/app/routers/board.py
    - backend/tests/test_tickets.py
  modified:
    - backend/app/models/__init__.py (added all three new model imports)
    - backend/alembic/env.py (added Ticket, ColumnHistory, TicketEvent imports for autogenerate)
    - backend/app/routers/auth.py (added GET /users endpoint)
    - backend/app/main.py (registered tickets and board routers)

key-decisions:
  - "values_callable on StatusColumn Enum: SQLAlchemy sa.Enum uses Python enum .name by default; values_callable=lambda e: [x.value for x in e] forces .value storage so DB stores 'In Progress'/'Review/QA' not 'InProgress'/'ReviewQA'"
  - "move_ticket uses db.flush() pattern: flush before commit to get ticket.id for FK references in same transaction, then single commit for atomicity"
  - "lazy='raise' on Ticket relationships: forces caller to always use selectinload; prevents silent N+1 regressions in any endpoint that forgets eager loading"
  - "Batch ColumnHistory query for board: one SELECT WHERE ticket_id IN (:ids) after the tickets query, avoiding per-ticket queries for time_in_column"

patterns-established:
  - "Pattern: Ticket operations always go through services/tickets.py — create_ticket and move_ticket are the authoritative entry points for state changes"
  - "Pattern: _load_ticket_out() helper in routers/tickets.py reloads ticket with selectinload after service call — single consistent fetch pattern for all TicketOut responses"
  - "Pattern: ColumnHistory open row = exited_at IS NULL — always one open row per ticket; move_ticket closes it and opens a new one atomically"
  - "Pattern: TicketEvent emitted for every state change: created, moved, assigned, edited — full audit trail for DETAIL-05/06"

requirements-completed:
  - TICKET-01
  - TICKET-02
  - TICKET-03
  - TICKET-04
  - TICKET-05
  - TICKET-06
  - TICKET-07
  - TICKET-08
  - TICKET-09
  - TICKET-10
  - BOARD-08

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 2 Plan 01: Kanban Backend API Summary

**FastAPI ticket CRUD with atomic ColumnHistory + TicketEvent writes, Backlog ownership rules enforced in move service, and selectinload board endpoint eliminating N+1 — 29 tests pass**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T07:29:28Z
- **Completed:** 2026-02-25T07:35:51Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Three ORM models (Ticket, ColumnHistory, TicketEvent) with correct Postgres enum values, JSONB columns, and cascade-delete FKs
- Atomic move_ticket service: closes open ColumnHistory row, opens new row, emits "moved" + optional "assigned" events in one transaction
- Board endpoint with selectinload (no N+1) plus batch ColumnHistory query for time_in_column computation across all tickets
- All 13 TICKET-01–10 and BOARD-08 requirements satisfied; 29 total tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Ticket, ColumnHistory, TicketEvent ORM models and Alembic migration** - `dd2de19` (feat)
2. **Task 2: Ticket CRUD endpoints, move service, board endpoint, and GET /api/auth/users** - `66ef6d2` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/models/ticket.py` - Ticket model with StatusColumn/Priority enums, JSONB, urgency CheckConstraint, lazy="raise" relationships
- `backend/app/models/column_history.py` - ColumnHistory with composite index on (ticket_id, exited_at)
- `backend/app/models/ticket_event.py` - TicketEvent with JSONB payload, SET NULL actor FK, index on (ticket_id, created_at)
- `backend/app/schemas/ticket.py` - TicketCreate, TicketUpdate, TicketOut, TicketMoveRequest, BoardTicketOut
- `backend/app/schemas/ticket_event.py` - TicketEventOut
- `backend/app/schemas/column_history.py` - ColumnHistoryOut with model_validator for time_spent
- `backend/alembic/versions/e58d6c737dab_phase2_kanban_core.py` - Migration creating all three tables
- `backend/app/services/tickets.py` - create_ticket() and move_ticket() business logic
- `backend/app/routers/tickets.py` - Full CRUD + /move + /events + /history endpoints
- `backend/app/routers/board.py` - GET /api/board with selectinload and batch time_in_column computation
- `backend/tests/test_tickets.py` - 13 tests covering all ticket semantics
- `backend/app/models/__init__.py` - Updated to export all models
- `backend/alembic/env.py` - Added new model imports for autogenerate
- `backend/app/routers/auth.py` - Added GET /api/auth/users endpoint
- `backend/app/main.py` - Registered tickets and board routers

## Decisions Made

- `values_callable` on SQLAlchemy `sa.Enum` to store enum `.value` strings: without it, SQLAlchemy uses Python enum `.name` ("InProgress") instead of `.value` ("In Progress"). Critical for correct DB storage and frontend compatibility.
- `lazy="raise"` on Ticket relationships: any code path that doesn't use selectinload will raise an error at runtime rather than silently executing N+1 queries.
- `db.flush()` in create_ticket: gets ticket.id without committing so ColumnHistory and TicketEvent can reference it in the same transaction.
- Batch ColumnHistory query in board endpoint: after loading tickets, one query `WHERE ticket_id IN (ids) AND exited_at IS NULL` covers all open rows — avoids per-ticket sub-queries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLAlchemy Enum stores .name instead of .value for string enums**
- **Found during:** Task 1 (after first migration run)
- **Issue:** SQLAlchemy's `sa.Enum` with a Python enum class uses the enum member's `.name` attribute by default. StatusColumn.InProgress stores "InProgress" in DB instead of "In Progress". This would break any frontend expecting the exact string "In Progress" and any comparison against `StatusColumn.InProgress.value`.
- **Fix:** Added `values_callable=lambda enum_cls: [e.value for e in enum_cls]` to both Priority and StatusColumn Enum columns. Rolled back migration, dropped orphaned enum types from DB, regenerated migration, re-applied.
- **Files modified:** `backend/app/models/ticket.py`, `backend/alembic/versions/` (replaced migration file)
- **Verification:** `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_column_enum')` returns "Backlog", "Discovery", "In Progress", "Review/QA", "Done"
- **Committed in:** `dd2de19` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — enum value storage bug)
**Impact on plan:** Fix was required for correct DB storage and frontend compatibility. No scope creep.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None — migration auto-applied; test database created automatically by pytest fixtures.

Running tests requires `TEST_DATABASE_URL` env var pointing to Docker postgres service:
```bash
docker compose exec -e TEST_DATABASE_URL="postgresql+asyncpg://xbo:xbo_dev_password@postgres:5432/xbo_test" backend python -m pytest tests/ -x -q
```

## Next Phase Readiness

- All 11 ticket/board requirements fulfilled: frontend plans 02-02 through 02-05 can build against these endpoints immediately
- GET /api/board with selectinload ready for KanbanBoard component
- PATCH /api/tickets/{id}/move with TICKET-07/08 enforcement ready for drag-and-drop
- GET /api/tickets/{id}/events and /history ready for ticket detail panel
- GET /api/auth/users ready for owner selector dropdown
- DELETE requires admin role — enforced by require_admin dependency

---
*Phase: 02-kanban-core*
*Completed: 2026-02-25*
