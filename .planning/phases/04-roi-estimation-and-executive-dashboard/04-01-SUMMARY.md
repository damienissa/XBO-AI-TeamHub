---
phase: 04-roi-estimation-and-executive-dashboard
plan: "01"
subsystem: database, api
tags: [alembic, sqlalchemy, pydantic, fastapi, roi, migration, portal]

# Dependency graph
requires:
  - phase: 03-collaboration-and-department-portal
    provides: Phase 3 stub ROI columns (hours_saved_per_month etc.) that this migration replaces; portal form that this plan updates
provides:
  - Alembic migration f9e6148f9818 dropping 3 Phase 3 stubs and adding 14 new ROI columns
  - compute_roi_fields() utility in backend/app/services/roi.py
  - TicketUpdate accepts all 8 ROI input fields; TicketOut exposes all 14 new fields
  - PATCH /api/tickets/{id} recomputes 6 output fields when any of 6 ROI inputs are in payload
  - Portal form using ROI-01 field names with two-row layout and Row 1 required group validation
affects:
  - 04-02 (ROI panel on ticket detail — reads computed output fields from TicketOut)
  - 04-03 (dashboard aggregation — can include ROI columns in KPI breakdown)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - compute_roi_fields() as pure function in services/roi.py — testable, no DB dependency
    - PATCH handler intercepts _ROI_INPUT_FIELDS intersection to trigger server-side recompute
    - valueAsNumber on all ROI number inputs in portal form (consistent with Phase 3 decision)

key-files:
  created:
    - backend/alembic/versions/f9e6148f9818_phase4_roi_fields.py
    - backend/app/services/roi.py
  modified:
    - backend/app/models/ticket.py
    - backend/app/schemas/ticket.py
    - backend/app/routers/tickets.py
    - frontend/src/app/(app)/portal/[dept]/page.tsx

key-decisions:
  - "Phase 4 migration drops 3 Phase 3 stub columns and adds 8 input + 6 computed output columns in one migration"
  - "compute_roi_fields() is a pure Python function with no ORM dependency — fully testable in isolation"
  - "_ROI_INPUT_FIELDS frozenset in routers/tickets.py is the single source of truth for which fields trigger recompute"
  - "ROI-05 guard: dev_cost==0 yields roi=NULL not ZeroDivisionError; checked before division"
  - "Portal .refine() requires all three Row 1 fields (hours/employees/avg_hourly_cost) together per ROI-06 recommendation"

patterns-established:
  - "Pattern: ROI service as pure function — compute_roi_fields(inputs) -> dict, called from router, no side effects"
  - "Pattern: PATCH handler ROI recompute — frozenset intersection check, then apply computed dict to ORM object before commit"

requirements-completed: [ROI-01, ROI-02, ROI-03, ROI-05, ROI-06]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 04 Plan 01: ROI Fields Migration and Computation Summary

**Alembic migration replacing Phase 3 ROI stubs with 14-column ROI-01 field set, server-side compute_roi_fields() service with zero-division guard, and portal form updated to new field names**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T12:15:49Z
- **Completed:** 2026-02-25T12:18:49Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Dropped 3 Phase 3 stub columns and added 8 ROI input + 6 computed output columns via migration f9e6148f9818
- Created compute_roi_fields() pure function with full formula chain and ROI-05 zero-division guard
- Extended TicketUpdate/TicketOut schemas and wired PATCH handler to recompute ROI on any input change
- Updated portal form with ROI-01 field names, two-row layout, and group validation requiring all Row 1 fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration and Ticket model update** - `179fb36` (feat)
2. **Task 2: ROI computation service, TicketUpdate schema, and PATCH handler integration** - `981851e` (feat)
3. **Task 3: Update portal form to use ROI-01 field names** - `8b4d082` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/alembic/versions/f9e6148f9818_phase4_roi_fields.py` - Migration: drop 3 stubs, add 14 new ROI columns
- `backend/app/models/ticket.py` - Replace stub mapped_columns with full 14-column ROI field set
- `backend/app/services/roi.py` - compute_roi_fields() pure function with None-guards and zero-division guard
- `backend/app/schemas/ticket.py` - TicketUpdate + 8 ROI input fields; TicketOut + 14 ROI fields
- `backend/app/routers/tickets.py` - PATCH handler: _ROI_INPUT_FIELDS frozenset, recompute on any ROI input
- `frontend/src/app/(app)/portal/[dept]/page.tsx` - ROI-01 field names, two-row layout, Zod .refine() for Row 1 group

## Decisions Made
- compute_roi_fields() is a pure function with no ORM dependency — makes it fully testable without a DB session
- _ROI_INPUT_FIELDS frozenset in tickets.py is the single place that governs which fields trigger recompute; effort_estimate is included because dev_cost depends on it
- Portal .refine() requires all three Row 1 fields together (not just one) per ROI-06 recommendation from RESEARCH.md
- ROI-05 guard implemented as explicit `dev_cost != 0` check before division — Python ZeroDivisionError is not caught, only prevented

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB is at head with all 14 ROI columns; TicketOut now returns all ROI fields including computed output
- Plan 02 (ROI panel on ticket detail) can read computed values directly from TicketOut and patch input fields via the updated PATCH handler
- Plan 03 (dashboard) can include ROI aggregation from the new columns if needed

## Self-Check: PASSED

All files verified on disk. All task commits verified in git history (179fb36, 981851e, 8b4d082).

---
*Phase: 04-roi-estimation-and-executive-dashboard*
*Completed: 2026-02-25*
