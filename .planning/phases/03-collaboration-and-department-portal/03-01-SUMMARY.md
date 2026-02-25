---
phase: 03-collaboration-and-department-portal
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, alembic, postgresql, pydantic, jsonb]

# Dependency graph
requires:
  - phase: 02-kanban-core
    provides: Ticket model, tickets table, TicketEvent model, existing router/auth patterns
provides:
  - TicketComment ORM model and CRUD endpoints (POST/GET/DELETE /api/tickets/{id}/comments)
  - TicketSubtask ORM model with position management (POST/PATCH/DELETE/reorder /api/tickets/{id}/subtasks)
  - TicketTemplate ORM model and CRUD endpoints (GET/POST/PATCH/DELETE /api/templates)
  - ROI stub columns on tickets (hours_saved_per_month, cost_savings_per_month, revenue_impact)
  - Attachment stub columns on tickets (attachment_filename, attachment_size_bytes)
  - GET /api/config endpoint returning ai_team_hourly_rate
  - Alembic migration 93dab7e5b92c applied at head
affects:
  - 03-02 (CommentSection frontend)
  - 03-03 (SubtaskSection frontend)
  - 03-04 (Portal intake form, template settings page)
  - 04-roi-estimation (Phase 4 migration extends these stub columns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Nested FastAPI router: prefix="/tickets/{ticket_id}/comments" mounted via app.include_router with /api prefix
    - Position resequencing on delete: reindex remaining subtasks 0..N-1 in same transaction (prevents Pitfall 2 gaps)
    - selectinload on all relationship accesses to prevent N+1 / lazy=raise errors
    - Inline author/admin guard: compare comment.author_id vs current_user.id, fallback to role check
    - Public config endpoint: GET /api/config with no auth required for frontend ROI hourly rate

key-files:
  created:
    - backend/app/models/ticket_comment.py
    - backend/app/models/ticket_subtask.py
    - backend/app/models/ticket_template.py
    - backend/app/schemas/ticket_comment.py
    - backend/app/schemas/ticket_subtask.py
    - backend/app/schemas/ticket_template.py
    - backend/app/routers/comments.py
    - backend/app/routers/subtasks.py
    - backend/app/routers/templates.py
    - backend/alembic/versions/93dab7e5b92c_phase3_collab_portal.py
  modified:
    - backend/app/models/ticket.py
    - backend/app/models/__init__.py
    - backend/app/core/config.py
    - backend/app/main.py

key-decisions:
  - "ROI stub columns (hours_saved_per_month, cost_savings_per_month, revenue_impact) only: Phase 3 stores raw inputs; Phase 4 adds computed ROI-01 fields in separate migration per CONTEXT.md decision"
  - "User.full_name used in CommentOut.author_name — User model has full_name not first_name/last_name"
  - "GET /api/config added in Phase 3 alongside routers so portal live ROI calc has config endpoint to call"
  - "Subtask delete resequences positions 0..N-1 in same transaction (RESEARCH.md Pitfall 2 fix)"
  - "Reorder endpoint validates ordered_ids set == ticket's subtask ID set — rejects partial or foreign IDs"

patterns-established:
  - "Nested router: define prefix on router, mount with app.include_router(router, prefix='/api') — results in /api/tickets/{id}/comments"
  - "Position management: max(existing)+1 for append, 0..N-1 reindex on delete, full reassign on reorder"
  - "Author/admin guard: inline check — no new dependency, just compare IDs and role"

requirements-completed: [COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, PORTAL-04, PORTAL-06, PORTAL-07, PORTAL-08]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 3 Plan 01: Collaboration Backend — Comments, Subtasks, and Templates Summary

**Three new FastAPI routers (comments, subtasks, templates) with SQLAlchemy models, Pydantic schemas, and a single Alembic migration adding 3 tables + 5 stub columns on tickets**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T10:42:23Z
- **Completed:** 2026-02-25T10:45:32Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Alembic migration 93dab7e5b92c applied at head: ticket_comments, ticket_subtasks, ticket_templates tables created; ROI + attachment stub columns added to tickets
- Comments router: POST/GET/DELETE /api/tickets/{id}/comments with author/admin guard and selectinload on author (no N+1)
- Subtasks router: POST/PATCH/DELETE/reorder with gapless position resequencing on delete and atomic reorder
- Templates router: full CRUD at /api/templates for any authenticated user
- GET /api/config (no auth) returning ai_team_hourly_rate=75 for frontend live ROI display

## Task Commits

Each task was committed atomically:

1. **Task 1: ORM models, schemas, and Alembic migration** - `381fb6d` (feat)
2. **Task 2: Comment, subtask, and template routers wired into app** - `4385244` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/app/models/ticket_comment.py` - TicketComment ORM model (CASCADE delete, lazy=raise)
- `backend/app/models/ticket_subtask.py` - TicketSubtask ORM model with position integer
- `backend/app/models/ticket_template.py` - TicketTemplate ORM model with JSONB problem_statement
- `backend/app/models/ticket.py` - Extended with ROI stub + attachment stub columns + comments/subtasks relationships
- `backend/app/models/__init__.py` - Added imports for 3 new models (required for Alembic autogenerate)
- `backend/app/schemas/ticket_comment.py` - CommentCreate, CommentOut
- `backend/app/schemas/ticket_subtask.py` - SubtaskCreate, SubtaskOut, SubtaskToggle, SubtaskReorderRequest
- `backend/app/schemas/ticket_template.py` - TemplateCreate, TemplateUpdate, TemplateOut
- `backend/app/routers/comments.py` - POST/GET/DELETE with author/admin guard
- `backend/app/routers/subtasks.py` - POST/PATCH/DELETE/reorder; gapless positions on delete
- `backend/app/routers/templates.py` - GET/POST/PATCH/DELETE CRUD
- `backend/alembic/versions/93dab7e5b92c_phase3_collab_portal.py` - Phase 3 migration at head
- `backend/app/core/config.py` - Added AI_TEAM_HOURLY_RATE: float = 75.0
- `backend/app/main.py` - Wired 3 new routers + GET /api/config endpoint

## Decisions Made
- User.full_name (not first_name/last_name) used for author_name in CommentOut — User model has single full_name column; discovered during Task 2 implementation, fixed inline
- Reorder endpoint validates that ordered_ids set exactly matches ticket's subtask set — prevents partial reorders and cross-ticket ID injection
- GET /api/config added in Phase 3 alongside routers so portal live ROI calc works without a separate Phase 4 dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CommentOut.author_name to use User.full_name**
- **Found during:** Task 2 (comments router implementation)
- **Issue:** Plan specified `author_name` in CommentOut. Initial code used `f"{author.first_name} {author.last_name}"` but User model has `full_name` not split name fields
- **Fix:** Changed to `author.full_name` — single field on User model
- **Files modified:** backend/app/routers/comments.py
- **Verification:** Backend starts without error; no AttributeError on author access
- **Committed in:** 4385244 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** One-line fix, no scope change.

## Issues Encountered
None beyond the author_name field name correction above.

## User Setup Required
None - no external service configuration required. AI_TEAM_HOURLY_RATE defaults to 75.0 and can be overridden via environment variable.

## Next Phase Readiness
- All collaboration backend endpoints are available for Plans 02 (CommentSection UI), 03 (SubtaskSection UI), and 04 (Portal intake form + templates settings page)
- /api/config endpoint is ready for live ROI calculation in portal form
- No blockers for Phase 3 Plans 02–04

## Self-Check: PASSED

All files verified:
- backend/app/models/ticket_comment.py: FOUND
- backend/app/models/ticket_subtask.py: FOUND
- backend/app/models/ticket_template.py: FOUND
- backend/app/routers/comments.py: FOUND
- backend/app/routers/subtasks.py: FOUND
- backend/app/routers/templates.py: FOUND
- backend/alembic/versions/93dab7e5b92c_phase3_collab_portal.py: FOUND
- .planning/phases/03-collaboration-and-department-portal/03-01-SUMMARY.md: FOUND

Commits verified:
- 381fb6d: FOUND
- 4385244: FOUND

---
*Phase: 03-collaboration-and-department-portal*
*Completed: 2026-02-25*
