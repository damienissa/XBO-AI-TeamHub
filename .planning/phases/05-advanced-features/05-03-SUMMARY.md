---
phase: 05-advanced-features
plan: "03"
subsystem: frontend-ui
tags: [custom-fields, saved-filters, ticket-detail, settings, board-filter]
dependency_graph:
  requires: ["05-01"]
  provides: ["custom-fields-ui", "saved-filters-ui"]
  affects: ["TicketDetailModal", "BoardFilterBar", "AppSidebar"]
tech_stack:
  added: []
  patterns:
    - "TanStack Query useQuery/useMutation for custom field defs + saved filter presets"
    - "nuqs setFilters to restore saved filter state from JSONB preset"
    - "Popover (shadcn) for saved filter dropdown panel"
    - "MutableDict JSONB for custom_field_values in ticket model"
key_files:
  created:
    - frontend/src/app/(app)/board/_components/CustomFieldsSection.tsx
    - frontend/src/app/(app)/settings/custom-fields/page.tsx
    - frontend/src/app/(app)/board/_components/SavedFilterDropdown.tsx
  modified:
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/app/(app)/board/_components/BoardFilterBar.tsx
    - frontend/src/components/sidebar/AppSidebar.tsx
    - frontend/src/lib/api/tickets.ts
    - backend/app/routers/tickets.py
decisions:
  - "PATCH /api/tickets/{id}/custom-fields added as a separate narrow endpoint (not via TicketUpdate) — avoids mixing the full ticket PATCH flow with custom field JSONB replacement"
  - "Admin Custom Fields sidebar link uses user.role==='admin' guard in AppSidebar — consistent with existing role check pattern in sidebar footer"
  - "SavedFilterDropdown onApply passes savedState directly to setFilters from nuqs useQueryStates — nuqs silently ignores unknown keys so JSONB roundtrip is safe"
metrics:
  duration: "4 min"
  completed: "2026-02-25"
  tasks_completed: 2
  files_changed: 8
---

# Phase 05 Plan 03: Custom Fields UI + Saved Filters UI Summary

Custom fields inline editing on ticket detail and saved filter presets dropdown in board filter bar — built on top of 05-01 backend.

## What Was Built

### Task 1: CustomFieldsSection + Workspace Settings Admin Page
- **CustomFieldsSection.tsx** — Renders all custom field defs visible to the current user (workspace + personal), with type-aware inputs (text/number/date). Values save on blur via PATCH to `/api/tickets/{id}/custom-fields`. Personal fields can be created inline via "Add my field" button.
- **PATCH /api/tickets/{id}/custom-fields** — Added missing backend route that replaces the ticket's `custom_field_values` JSONB field entirely (auto-fixed: Rule 3 — missing backend route blocked frontend saving)
- **frontend/src/lib/api/tickets.ts** — Added `custom_field_values?: Record<string, unknown> | null` to Ticket interface
- **/settings/custom-fields/page.tsx** — Admin page to create workspace-wide field definitions (name + type) and delete them
- **AppSidebar.tsx** — Added admin-only "Settings" section with "Custom Fields" link (guarded by `user.role === 'admin'`)
- **TicketDetailModal.tsx** — CustomFieldsSection integrated below RoiPanel with border-t divider

### Task 2: SavedFilterDropdown in BoardFilterBar
- **SavedFilterDropdown.tsx** — Popover-based dropdown with "Save current filters" (opens name input), preset list with click-to-restore, and hover-visible delete buttons
- **BoardFilterBar.tsx** — SavedFilterDropdown added to right side of filter bar alongside Clear all; currentFilters wired from useQueryStates filters; onApply calls setFilters to restore URL state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PATCH /api/tickets/{id}/custom-fields route was missing from backend**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced this route in the action but it was listed as "ensure it's added" without a clear confirmation it existed in plan 05-01 Task 2. The route was not present in tickets.py.
- **Fix:** Added the PATCH handler to `backend/app/routers/tickets.py` — accepts a `dict` body and replaces `ticket.custom_field_values` using MutableDict JSONB
- **Files modified:** `backend/app/routers/tickets.py`
- **Commit:** ce7fb4f

## Pre-existing Issues (Deferred)

These were present before plan 05-03 and are documented in `deferred-items.md`:
1. `portal/[dept]/page.tsx:167` — unused `hourlyRate` variable (ESLint error, from commit b3fbbe9)
2. `OwnerModal.tsx:77` — combobox missing aria attributes (ESLint warning-as-error)

These cause `npm run build` to fail at the ESLint step, but TypeScript compilation (`tsc --noEmit`) passes cleanly for all 05-03 files.

## Self-Check: PASSED
