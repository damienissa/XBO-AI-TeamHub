---
phase: 03-collaboration-and-department-portal
plan: 03
subsystem: frontend
tags: [nextjs, react-hook-form, zod, tiptap, tanstack-query, portal, roi]

# Dependency graph
requires:
  - phase: 03-01
    provides: GET /api/config (ai_team_hourly_rate), GET /api/departments, POST /api/tickets with ROI stub columns
provides:
  - /portal page — department selection grid (7 departments)
  - /portal/[dept] page — full-page intake form with live ROI calculation
  - Portal nav item enabled in AppSidebar
affects:
  - 03-04 (Templates plan — Portal nav pattern established; sidebar nav item enabling pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "valueAsNumber register option on number inputs for zod v4 number type compatibility (avoid coerce)"
    - "Explicit interface for form values when zod v4 coerce causes unknown input inference with zodResolver"
    - "z.unknown().optional() for Tiptap JSON fields (accepts object from Controller onChange)"
    - "TanStack Query for fetchDepartments (staleTime 300s) and fetchConfig (staleTime 300s)"
    - "useMutation for form submission — success state replaces form; no auto-redirect"

key-files:
  created:
    - frontend/src/app/(app)/portal/page.tsx
    - frontend/src/app/(app)/portal/[dept]/page.tsx
  modified:
    - frontend/src/components/sidebar/AppSidebar.tsx

key-decisions:
  - "valueAsNumber instead of z.coerce for number inputs: zod v4 coerce outputs unknown in resolver generics; valueAsNumber keeps field types as number natively — cleaner TS"
  - "problem_statement typed as z.unknown().optional(): Tiptap outputs arbitrary JSON object; z.record() requires explicit key/value types which complicates the schema"
  - "TiptapEditor imported from @/app/(app)/board/_components/TiptapEditor — component lives in board subdirectory; reused via @ path alias without copying"

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 3 Plan 03: Department Portal — Department Grid and Intake Form with Live ROI Summary

**Department Portal frontend: /portal department selection grid and /portal/[dept] full-page structured intake form with live ROI calculation using react-hook-form + zod v4**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T11:01:50Z
- **Completed:** 2026-02-25T11:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Enabled "Department Portal" nav item in AppSidebar (was `enabled: false`)
- Created `/portal` — responsive grid (2/3/4 cols) fetching departments from GET /api/departments via TanStack Query; each card has dept icon, name, and description
- Created `/portal/[dept]` — full-page Client Component with 4 form sections: Request Details, Problem Description, ROI Information, Attachment
- Live ROI calculation: `watch("hours_saved_per_month")` × `ai_team_hourly_rate` from GET /api/config; displays as "Estimated monthly value: $X,XXX" with green highlight when > 0
- Zod cross-field refine: at least one ROI field (hours_saved_per_month, cost_savings_per_month, revenue_impact) must be non-zero
- Tiptap rich text editor for problem_statement with `immediatelyRender: false` (reusing existing pattern)
- Success confirmation state with "View on board" link and "Submit another request" link — no auto-redirect
- Build passes: /portal (2.52 kB) and /portal/[dept] (45.2 kB) both compiled

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal department selection page and sidebar nav** - `1698406` (feat)
2. **Task 2: Full-page portal intake form with live ROI calculation** - `ce618b0` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/app/(app)/portal/page.tsx` — Department grid page; fetches /api/departments; 7 cards with Lucide icons
- `frontend/src/app/(app)/portal/[dept]/page.tsx` — Intake form with react-hook-form + zod schema; 4 sections; live ROI calculation; success state
- `frontend/src/components/sidebar/AppSidebar.tsx` — Department Portal nav item enabled: false → true

## Decisions Made

- **valueAsNumber over z.coerce:** Zod v4's `z.coerce.number()` infers `input: unknown` which breaks the `zodResolver` generic constraint `Input extends FieldValues`. Using `z.number()` with react-hook-form's `{ valueAsNumber: true }` register option passes actual numbers to the schema, avoiding the type mismatch entirely.
- **problem_statement as z.unknown().optional():** Tiptap's `editor.getJSON()` returns `Record<string, unknown>` but zod v4's `z.record()` requires explicit key and value schemas, making it verbose. `z.unknown()` accepts any value and is simpler for unstructured JSON.
- **TiptapEditor imported from board subdirectory:** No duplication — used `@/app/(app)/board/_components/TiptapEditor` via the existing `@/*` tsconfig alias.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod v4 coerce type incompatibility with zodResolver**
- **Found during:** Task 2 (build verification)
- **Issue:** `z.coerce.number()` in zod v4 has `input: unknown`, causing TypeScript error: resolver type mismatch `unknown` not assignable to `number` in `useForm<PortalFormValues>`.
- **Fix:** Replaced `z.coerce.number()` with `z.number()` throughout schema; added `{ valueAsNumber: true }` to all number input `register()` calls. This is the correct react-hook-form pattern for native number parsing.
- **Files modified:** `frontend/src/app/(app)/portal/[dept]/page.tsx`
- **Commit:** ce618b0

**2. [Rule 1 - Bug] Fixed z.record() requiring 2 arguments in zod v4**
- **Found during:** Task 2 (build verification)
- **Issue:** `z.record(z.unknown())` fails in zod v4 — requires `z.record(keySchema, valueSchema)` (2 args).
- **Fix:** Changed to `z.unknown().optional()` — appropriate for Tiptap JSON output which is an arbitrary object.
- **Files modified:** `frontend/src/app/(app)/portal/[dept]/page.tsx`
- **Commit:** ce618b0

**3. [Rule 1 - Bug] Removed unused `submittedTicketId` state variable**
- **Found during:** Task 2 (build verification)
- **Issue:** ESLint `@typescript-eslint/no-unused-vars` error on `submittedTicketId`.
- **Fix:** Removed state variable and its setter from `onSuccess` callback (success state only needs `setSubmitted(true)` since link is always `/board`).
- **Files modified:** `frontend/src/app/(app)/portal/[dept]/page.tsx`
- **Commit:** ce618b0

---

**Total deviations:** 3 auto-fixed (Rule 1 - Bug) — all zod v4 API changes vs the plan's zod v3-style examples.

## Issues Encountered

The plan's Zod schema examples used zod v3 API patterns (`errorMap`, `z.coerce`, `or(z.literal(""))`) that don't translate cleanly to zod v4. All fixed automatically using zod v4's correct API and react-hook-form's `valueAsNumber` option.

## User Setup Required

None - portal pages are fully functional once backend is running. The GET /api/config and GET /api/departments endpoints were already delivered in Plan 03-01.

## Self-Check: PASSED

All files verified:
- frontend/src/app/(app)/portal/page.tsx: FOUND
- frontend/src/app/(app)/portal/[dept]/page.tsx: FOUND
- frontend/src/components/sidebar/AppSidebar.tsx: FOUND (modified)
- .planning/phases/03-collaboration-and-department-portal/03-03-SUMMARY.md: FOUND

Commits verified:
- 1698406: FOUND
- ce618b0: FOUND

Build: PASSED — /portal and /portal/[dept] both present in build output

---
*Phase: 03-collaboration-and-department-portal*
*Completed: 2026-02-25*
