---
phase: 04-roi-estimation-and-executive-dashboard
plan: "02"
subsystem: ui
tags: [react, tailwind, tanstack-query, roi, ticket-detail, inline-edit]

# Dependency graph
requires:
  - phase: 04-roi-estimation-and-executive-dashboard
    provides: TicketOut with 14 ROI fields (8 inputs + 6 computed outputs); PATCH handler that recomputes ROI on any input change

provides:
  - RoiPanel.tsx component with hero stats (ROI %, annual savings), supporting 4-cell grid, two input rows, collapsible optional inputs, live preview, and blur-to-save
  - TicketDetailModal extended with always-visible RoiPanel section between SubtaskSection and Activity Timeline
  - Ticket interface in tickets.ts updated with all 14 ROI fields

affects:
  - 04-03 (dashboard — can reference RoiPanel patterns for ROI display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RoiPanel draft state with useEffect([ticket]) reset — prevents drift after PATCH re-fetches ticket
    - Blur-to-save pattern: onChange updates local draft (live preview), onBlur calls onUpdate (triggers PATCH)
    - Hero stats + supporting grid layout for ROI display
    - Collapsible optional inputs via controlled useState toggle with ChevronDown/ChevronRight

key-files:
  created:
    - frontend/src/app/(app)/board/_components/RoiPanel.tsx
  modified:
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/lib/api/tickets.ts

key-decisions:
  - "RoiPanel always-visible in TicketDetailModal — no accordion, no conditional render, placed between SubtaskSection and Activity Timeline"
  - "Live preview uses local draft state for weekly/yearly cost; ROI and adjusted_roi are display-only from server (require effort_estimate not available in RoiPanel)"
  - "draft resets via useEffect([ticket]) after PATCH completes — server values replace local draft preventing stale display"
  - "Ticket interface extended with optional ROI fields (8 inputs + 6 computed) in tickets.ts alongside existing Ticket type"

patterns-established:
  - "Pattern: inline ROI inputs — draft state for live preview, blur triggers PATCH via onUpdate prop, useEffect([ticket]) syncs from server"
  - "Pattern: ghost state prompt — hasAnyRoiInput guard shows 'Add ROI inputs below to compute' when all row-1 fields are null"

requirements-completed: [ROI-04, ROI-05]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 04 Plan 02: ROI Panel Component Summary

**RoiPanel.tsx with hero ROI%/annual savings, 4-cell supporting grid, two inline-edit input rows, live preview draft state, and blur-to-save wired into TicketDetailModal as always-visible section**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T12:22:23Z
- **Completed:** 2026-02-25T12:24:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created RoiPanel.tsx with hero row (ROI %, annual savings), supporting 4-cell grid (weekly cost, yearly cost, dev cost, adjusted ROI), two input rows, and collapsible optional inputs
- Implemented blur-to-save pattern with local draft state for live preview; useEffect([ticket]) resets draft after PATCH to prevent drift
- Extended Ticket interface in tickets.ts with all 14 ROI fields (8 inputs + 6 computed outputs)
- Embedded RoiPanel as always-visible section in TicketDetailModal between SubtaskSection and Activity Timeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RoiPanel component** - `d923eda` (feat)
2. **Task 2: Embed RoiPanel in TicketDetailModal** - `9335762` (feat)

## Files Created/Modified
- `frontend/src/app/(app)/board/_components/RoiPanel.tsx` - ROI panel component with hero stats, live preview, input rows, and blur-to-save
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` - Modal extended with always-visible RoiPanel section
- `frontend/src/lib/api/tickets.ts` - Ticket interface extended with 14 ROI fields (8 input + 6 computed)

## Decisions Made
- RoiPanel is always-visible (not in accordion) — placed between SubtaskSection and Activity Timeline
- ROI and adjusted_roi are display-only from server because they require effort_estimate which isn't available inside RoiPanel; only weekly/yearly cost get live preview
- Ticket interface updated with optional ROI fields rather than creating a separate TicketOut type — consistent with existing single-type approach in the frontend

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ROI fields to Ticket interface in tickets.ts**
- **Found during:** Task 1 (Create RoiPanel component)
- **Issue:** The Ticket interface was missing all 14 ROI fields added in Plan 01; TypeScript would reject any ROI field access without them
- **Fix:** Added 8 ROI input fields and 6 computed output fields as optional properties to the Ticket interface
- **Files modified:** frontend/src/lib/api/tickets.ts
- **Verification:** TypeScript compiles clean with zero errors
- **Committed in:** d923eda (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — prerequisite type update)
**Impact on plan:** Required for TypeScript correctness; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RoiPanel renders in every ticket detail modal; inputs write to PATCH /api/tickets/{id}; computed values display from server-persisted TicketOut
- Plan 03 (dashboard) can reference these ROI output fields for aggregation; RoiPanel pattern establishes display conventions for ROI data

## Self-Check: PASSED

All files verified on disk:
- FOUND: frontend/src/app/(app)/board/_components/RoiPanel.tsx
- FOUND: frontend/src/lib/api/tickets.ts (ROI fields added)
- FOUND: TicketDetailModal.tsx (RoiPanel import + usage confirmed)

All task commits verified:
- FOUND: d923eda (feat(04-02): create RoiPanel component)
- FOUND: 9335762 (feat(04-02): embed RoiPanel in TicketDetailModal)

---
*Phase: 04-roi-estimation-and-executive-dashboard*
*Completed: 2026-02-25*
