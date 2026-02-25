---
phase: 05-advanced-features
plan: 04
subsystem: ui
tags: [react, tiptap, tanstack-query, wiki, shadcn, combobox]

# Dependency graph
requires:
  - phase: 05-01
    provides: Wiki backend (GET/POST/PATCH/DELETE /api/wiki, wiki_pages table, wiki_page_id on tickets)

provides:
  - Wiki sidebar nav item enabled at /wiki
  - /wiki list page with hierarchical parent-child tree (buildTree, WikiTreeNode collapsible)
  - New Page creation inline form that redirects to /wiki/[pageId]
  - /wiki/[pageId] view/edit page with TiptapEditor (auto-save debounced, inline title edit)
  - Delete page with 403 toast (admin-only server enforcement, child pages promoted to top-level)
  - WikiLinkField combobox on TicketDetailModal linking one wiki page per ticket
  - wiki_page_id added to Ticket type in tickets.ts

affects:
  - 05-05 (AI features — may build on wiki content)
  - 06 (phase 6 — full wiki feature complete)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - buildTree utility using Map for parent-child nesting (Array.from for ES2015 compat)
    - WikiTreeNode recursive collapsible with ChevronRight expand/collapse state
    - Tiptap reuse pattern: TiptapEditor with initialContent/onSave props in wiki context
    - WikiLinkField Popover+Command combobox for entity linking on ticket detail

key-files:
  created:
    - frontend/src/app/(app)/wiki/page.tsx
    - frontend/src/app/(app)/wiki/[pageId]/page.tsx
    - frontend/src/app/(app)/board/_components/WikiLinkField.tsx
  modified:
    - frontend/src/components/sidebar/AppSidebar.tsx
    - frontend/src/app/(app)/board/_components/TicketDetailModal.tsx
    - frontend/src/lib/api/tickets.ts
    - frontend/src/app/(app)/portal/[dept]/page.tsx

key-decisions:
  - "buildTree uses Array.from(map.values()) instead of for..of map.values() — TypeScript target below ES2015 in tsconfig requires downlevelIteration flag; Array.from is always safe"
  - "Delete 403 handled client-side with useToast destructive toast — server enforces admin role; all users see button but server returns 403 for non-admins"
  - "WikiLinkField shares wiki-pages queryKey with /wiki list page — same TanStack Query cache prevents double-fetching when both are used in the same session"
  - "portal/[dept] unused hourlyRate + config/fetchConfig removed — leftover from ROI field removal in b3fbbe9; caused ESLint build failure, auto-fixed (Rule 1)"

patterns-established:
  - "WikiLinkField pattern: Popover+Command combobox for entity linking, X button to unlink, ExternalLink to open in new tab"
  - "Wiki tree pattern: buildTree(Array.from) + WikiTreeNode recursive depth-aware indentation with border-l"

requirements-completed: [WIKI-01, WIKI-02, WIKI-03, WIKI-04, WIKI-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 5 Plan 04: Wiki Frontend Summary

**Full wiki UI with hierarchical tree list, TiptapEditor page view/edit, and WikiLinkField combobox on ticket detail — completing WIKI-01 through WIKI-05**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T14:52:02Z
- **Completed:** 2026-02-25T14:55:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Wiki sidebar nav item enabled; /wiki list page renders all pages as collapsible parent-child tree using buildTree utility
- /wiki/[pageId] delivers view/edit with inline title edit, debounced TiptapEditor auto-save, and admin-enforced delete with toast feedback
- WikiLinkField Popover+Command combobox on TicketDetailModal links/unlinks wiki pages with ExternalLink navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Wiki sidebar nav, wiki list page with hierarchical tree, New Page creation** - `6e3417b` (feat)
2. **Task 2: Wiki page view/edit with Tiptap + WikiLinkField on ticket detail** - `1722094` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `frontend/src/app/(app)/wiki/page.tsx` - Wiki list page: buildTree, WikiTreeNode collapsible tree, New Page inline form
- `frontend/src/app/(app)/wiki/[pageId]/page.tsx` - Wiki page detail: TiptapEditor, inline title edit, delete with toast
- `frontend/src/app/(app)/board/_components/WikiLinkField.tsx` - Combobox picker for linking wiki pages to tickets
- `frontend/src/components/sidebar/AppSidebar.tsx` - Enabled Wiki nav item (was disabled: false)
- `frontend/src/app/(app)/board/_components/TicketDetailModal.tsx` - Added WikiLinkField import and render below SprintField
- `frontend/src/lib/api/tickets.ts` - Added wiki_page_id?: string | null to Ticket interface
- `frontend/src/app/(app)/portal/[dept]/page.tsx` - Removed unused hourlyRate, config, fetchConfig, AppConfig (auto-fix)

## Decisions Made

- **Array.from(map.values())** instead of `for..of map.values()` — TypeScript tsconfig target requires this for Map iterator compatibility (auto-fixed during Task 1 build)
- **Server-enforced admin delete** — delete button visible to all users; server returns 403 for non-admins; client shows destructive toast. Simplest approach consistent with existing patterns.
- **Shared wiki-pages queryKey** — WikiLinkField reuses `["wiki-pages"]` cache shared with /wiki list page. staleTime 60s prevents redundant fetches.
- **Portal cleanup** — removed unused `hourlyRate`/`config`/`fetchConfig`/`AppConfig` leftover from ROI field removal (b3fbbe9). Pre-existing build failure auto-fixed per Rule 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Map iterator compatibility in buildTree**
- **Found during:** Task 1 (wiki list page build)
- **Issue:** `for (const page of map.values())` fails TypeScript compilation; tsconfig target is below ES2015 without downlevelIteration flag
- **Fix:** Changed to `Array.from(map.values()).forEach(...)` — universally compatible
- **Files modified:** `frontend/src/app/(app)/wiki/page.tsx`
- **Verification:** Build passed after fix
- **Committed in:** `1722094` (Task 2 commit, bundled with portal fix)

**2. [Rule 1 - Bug] Removed unused hourlyRate/config from portal/[dept]/page.tsx**
- **Found during:** Task 2 verification (full build)
- **Issue:** Pre-existing ESLint error (`hourlyRate` assigned but never used) was blocking the build — leftover from ROI adjustment field removal in commit b3fbbe9
- **Fix:** Removed `hourlyRate` variable, `config` useQuery, `fetchConfig` function, and `AppConfig` interface since none were used after ROI removal
- **Files modified:** `frontend/src/app/(app)/portal/[dept]/page.tsx`
- **Verification:** Build compiled successfully with no ESLint errors
- **Committed in:** `1722094` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — TypeScript compat, pre-existing build error)
**Impact on plan:** Both fixes necessary for build success. No scope creep.

## Issues Encountered

- Map iterator required Array.from() wrapper — TypeScript tsconfig target restriction; fixed inline
- Pre-existing build failure in portal page blocked verification; fixed inline per Rule 1

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wiki frontend complete (WIKI-01 through WIKI-05) — full read/write experience via Tiptap, hierarchical tree, ticket linking
- Plan 05-05 (AI features) is the final wave 3 plan; requires 05-01 (complete) and 05-02 (complete)
- No blockers for 05-05

---
*Phase: 05-advanced-features*
*Completed: 2026-02-25*
