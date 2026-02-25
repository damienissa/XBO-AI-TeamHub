---
phase: 05-advanced-features
verified: 2026-02-25T00:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
product_decisions:
  - requirements: [ADV-08, ADV-09, ADV-10]
    decision: "Sprints feature removed by user after human verification passed"
    commits: ["596e889"]
    impact: "sprint.py model, sprints.py router, SprintField.tsx, sprint pages all removed from codebase"
  - requirements: [ADV-11]
    decision: "Timeline / Gantt view removed by user after human verification passed"
    commits: ["590c505"]
    impact: "timeline/page.tsx removed from codebase; sidebar nav entry removed"
human_verification:
  checkpoint: "05-05 Task 2 — Phase 5 end-to-end human verification checkpoint"
  outcome: "Approved by user"
  features_verified:
    - "Ticket dependencies (ADV-04, ADV-05, ADV-06)"
    - "Sprints (ADV-08, ADV-09, ADV-10) — approved, then removed"
    - "Custom fields (ADV-01, ADV-02, ADV-03)"
    - "Saved filters (ADV-07)"
    - "Wiki (WIKI-01 through WIKI-05)"
    - "Timeline (ADV-11) — approved, then removed"
---

# Phase 5: Advanced Features Verification Report

**Phase Goal:** Power users can manage ticket dependencies, organize work into sprints, define custom fields per workspace, save filter presets, view a timeline, and read or write wiki pages linked to tickets

**Verified:** 2026-02-25
**Status:** PASSED
**Re-verification:** No — initial verification

## Product Decisions (Features Removed After Approval)

Two features were built, human-verified, approved, and then removed at user request. These are not gaps.

| Feature | Requirements | Removed In | Status |
|---------|-------------|-----------|--------|
| Sprints (list, board, velocity, sprint assignment on tickets) | ADV-08, ADV-09, ADV-10 | commit 596e889 | Removed by product decision |
| Timeline / Gantt view (Recharts horizontal BarChart) | ADV-11 | commit 590c505 | Removed by product decision |

The human verification checkpoint in plan 05-05 explicitly covered all six feature areas (including sprints and timeline) before removal. The user's approval stands for the features that remain.

## Goal Achievement

### Observable Truths

The 14 verified truths cover all remaining features (dependencies, custom fields, saved filters, wiki). Truths for removed features (sprints, timeline) are noted as "removed by product decision."

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/tickets/{id}/dependencies returns blocks and blocked_by lists | VERIFIED | `backend/app/routers/dependencies.py` lines 24-46: selectinload on Ticket.blocks and Ticket.blocked_by, returns DependenciesOut |
| 2 | POST /api/tickets/{id}/dependencies adds a dependency; DELETE removes one | VERIFIED | `dependencies.py` lines 49-117: POST inserts into ticket_dependencies table; DELETE removes row with 404 on miss |
| 3 | PATCH /api/tickets/{id}/move returns 409 with BLOCKED code when blockers are not Done | VERIFIED | `backend/app/services/tickets.py`: check_not_blocked() called on is_backlog_exit; raises HTTP 409 with {code: "BLOCKED", blocker_ids, message} |
| 4 | GET /api/custom-field-defs returns workspace defs plus caller's personal defs | VERIFIED | `backend/app/routers/custom_fields.py`: OR filter on scope=workspace OR (scope=personal AND owner_id=current_user.id) |
| 5 | GET /api/saved-filters returns caller's named filter presets | VERIFIED | `backend/app/routers/saved_filters.py`: WHERE user_id=current_user.id |
| 6 | GET /api/wiki returns all pages; GET /api/wiki/{id} returns single page with content | VERIFIED | `backend/app/routers/wiki.py` lines 22-71: list endpoint ordered by created_at; detail endpoint with 404 guard |
| 7 | POST /api/wiki creates page; PATCH edits; DELETE is admin-only | VERIFIED | `wiki.py` lines 32-130: POST uses get_current_user (any auth); PATCH uses get_current_user; DELETE uses require_admin |
| 8 | Ticket detail shows a Dependencies section listing blocks and blocked_by with ticket titles | VERIFIED | `DependenciesSection.tsx` imported and rendered in `TicketDetailModal.tsx` line 428; full blocks/blocked_by UI with add/remove |
| 9 | Blocked tickets on the Kanban board show a subtle blocked badge on the card | VERIFIED | `KanbanCard.tsx` lines 210-217: ShieldAlert badge shown when ticket.blocked_by_count > 0; batch count query in board.py feeds blocked_by_count |
| 10 | Dragging a blocked ticket out of Backlog shows a toast listing blocking ticket IDs | VERIFIED | `useMoveTicket.ts`: catches TicketBlockedError instanceof, calls useToast with blocker_ids; Toaster mounted in providers.tsx |
| 11 | Ticket detail has a Custom Fields section showing workspace and personal fields with type-aware inputs | VERIFIED | `CustomFieldsSection.tsx` imported and rendered in `TicketDetailModal.tsx` line 436; workspace + personal filter, text/number/date inputs |
| 12 | Admin can navigate to /settings/custom-fields and define workspace-wide fields | VERIFIED | `frontend/src/app/(app)/settings/custom-fields/page.tsx` exists with create/delete form; admin-only sidebar link in AppSidebar.tsx |
| 13 | Board filter bar has a Saved dropdown where user can name and save the current filter state | VERIFIED | `SavedFilterDropdown.tsx` imported and rendered in `BoardFilterBar.tsx` lines 213-216; save/restore/delete via /api/saved-filters |
| 14 | Wiki sidebar nav item leads to /wiki; list shows hierarchical tree; page view/edit uses Tiptap; WikiLinkField on ticket detail | VERIFIED | Wiki nav at AppSidebar line 20; buildTree + WikiTreeNode in wiki/page.tsx; TiptapEditor in wiki/[pageId]/page.tsx; WikiLinkField in TicketDetailModal line 424 |

**Score:** 14/14 truths verified (plus 4 truths for removed features — not counted as gaps)

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `backend/app/models/ticket_dependency.py` | VERIFIED | Pure association table with blocker_id/blocked_id, both ON DELETE CASCADE, composite PK |
| `backend/app/models/custom_field.py` | VERIFIED | CustomFieldDef with FieldScope/FieldType enums and CHECK constraint |
| `backend/app/models/saved_filter.py` | VERIFIED | SavedFilter with user_id FK and filter_state JSONB |
| `backend/app/models/wiki_page.py` | VERIFIED | WikiPage with parent_id self-ref ON DELETE SET NULL, content JSONB, timestamps |
| `backend/app/models/ticket.py` (extensions) | VERIFIED | wiki_page_id FK, custom_field_values MutableDict JSONB; blocks/blocked_by M2M with explicit primaryjoin/secondaryjoin/foreign_keys |
| `backend/app/services/tickets.py` | VERIFIED | check_not_blocked() present, called on is_backlog_exit=True, raises 409 with BLOCKED code |
| `backend/alembic/versions/9c6cd841fe34_phase5_advanced_features.py` | VERIFIED | 92-line migration: creates custom_field_defs, saved_filters, wiki_pages (parent_id self-ref SET NULL), ticket_dependencies (CASCADE); adds tickets.sprint_id, wiki_page_id, custom_field_values |
| `backend/app/routers/dependencies.py` | VERIFIED | GET/POST/DELETE routes; selectinload on blocks/blocked_by |
| `backend/app/routers/custom_fields.py` | VERIFIED | GET with OR filter, POST with scope-based auth, DELETE |
| `backend/app/routers/saved_filters.py` | VERIFIED | GET/POST/DELETE scoped to current_user |
| `backend/app/routers/wiki.py` | VERIFIED | GET/POST/PATCH all authenticated; DELETE require_admin; parent validation |
| `backend/app/routers/tickets.py` (PATCH custom-fields) | VERIFIED | `@router.patch("/{ticket_id}/custom-fields")` at line 186; replaces custom_field_values dict |
| `frontend/.../DependenciesSection.tsx` | VERIFIED | blocks/blocked_by lists with Popover+Command add picker; fetch to /api/tickets/{id}/dependencies |
| `frontend/.../KanbanCard.tsx` (blocked badge) | VERIFIED | ShieldAlert badge when blocked_by_count > 0; subtle amber styling |
| `frontend/.../CustomFieldsSection.tsx` | VERIFIED | Workspace + personal field defs; text/number/date inputs; save on blur to /api/tickets/{id}/custom-fields; Add my field inline creation |
| `frontend/.../SavedFilterDropdown.tsx` | VERIFIED | Save/restore/delete named presets via /api/saved-filters; integrated in BoardFilterBar |
| `frontend/.../WikiLinkField.tsx` | VERIFIED | Popover+Command picker; PATCH wiki_page_id on ticket; ExternalLink display |
| `frontend/src/app/(app)/wiki/page.tsx` | VERIFIED | buildTree utility; WikiTreeNode collapsible; New Page inline form; fetches /api/wiki |
| `frontend/src/app/(app)/wiki/[pageId]/page.tsx` | VERIFIED | TiptapEditor (reused from board); inline title edit on blur; PATCH /api/wiki/{pageId}; DELETE with admin-enforced 403 toast |
| `frontend/src/app/(app)/settings/custom-fields/page.tsx` | VERIFIED | Create workspace field form; delete button; filters to workspace scope only |
| `backend/app/schemas/ticket.py` (extensions) | VERIFIED | TicketOut has wiki_page_id, custom_field_values, blocked_by_count=0 |
| `backend/app/routers/board.py` (blocked_by_count) | VERIFIED | Batch COUNT query on ticket_dependencies groups by blocked_id; sets blocked_by_count per ticket |

**Removed artifacts (product decision — not gaps):**
- `backend/app/models/sprint.py` — removed with sprints feature
- `backend/app/routers/sprints.py` — removed with sprints feature
- `frontend/.../SprintField.tsx` — removed with sprints feature
- `frontend/src/app/(app)/sprints/page.tsx` — removed with sprints feature
- `frontend/src/app/(app)/sprints/[sprintId]/page.tsx` — removed with sprints feature
- `frontend/src/app/(app)/timeline/page.tsx` — removed with timeline feature

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `DependenciesSection.tsx` | `/api/tickets/{id}/dependencies` | useQuery + useMutation fetch | WIRED — fetch calls at lines 20, 39, 52 |
| `backend/app/services/tickets.py` | `ticket_dependencies` table | check_not_blocked() JOIN query | WIRED — join on ticket_dependencies.c.blocker_id |
| `backend/app/main.py` | `dependencies.py` router | include_router with /api/tickets prefix | WIRED — line 39 of main.py |
| `backend/app/models/ticket.py` | `ticket_dependencies` | secondary=ticket_dependencies in blocks/blocked_by | WIRED — explicit primaryjoin/secondaryjoin/foreign_keys |
| `CustomFieldsSection.tsx` | `/api/custom-field-defs` | useQuery(['custom-field-defs']) | WIRED — fetch at line 48 |
| `CustomFieldsSection.tsx` | `/api/tickets/{id}/custom-fields` | useMutation PATCH on blur | WIRED — fetch at line 60 |
| `SavedFilterDropdown.tsx` | `/api/saved-filters` | useQuery + POST/DELETE mutations | WIRED — fetch at lines 30, 38, 53 |
| `BoardFilterBar.tsx` | `SavedFilterDropdown` | import + render with currentFilters + onApply | WIRED — lines 7, 213-216 |
| `wiki/page.tsx` | `/api/wiki` | useQuery(['wiki-pages']) | WIRED — fetch at line 74 |
| `wiki/[pageId]/page.tsx` | `/api/wiki/{pageId}` | useQuery(['wiki-page', pageId]) | WIRED — fetch at line 33 |
| `WikiLinkField.tsx` | PATCH /api/tickets/{id} with wiki_page_id | useMutation PATCH body | WIRED — line 30: body includes wiki_page_id |
| `TicketDetailModal.tsx` | `DependenciesSection`, `WikiLinkField`, `CustomFieldsSection` | imports + rendered in JSX | WIRED — lines 13-16, 424, 428, 436 |
| `KanbanCard.tsx` | blocked_by_count | ticket.blocked_by_count from board data | WIRED — line 211; board.py batch query at line 171 |
| `useMoveTicket.ts` | TicketBlockedError toast | instanceof check + useToast | WIRED — line 29: err instanceof TicketBlockedError |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| ADV-01 | 05-03 | Custom field definitions per workspace: admin can define fields (name, type: text/number/date) | SATISFIED — /settings/custom-fields admin page; custom_fields.py router |
| ADV-02 | 05-01, 05-03 | Per-ticket custom field values stored as JSONB | SATISFIED — custom_field_values MutableDict JSONB on Ticket; PATCH /api/tickets/{id}/custom-fields |
| ADV-03 | 05-03 | Custom fields displayed and editable on ticket detail | SATISFIED — CustomFieldsSection on TicketDetailModal with type-aware inputs saving on blur |
| ADV-04 | 05-01, 05-02 | Ticket dependencies: a ticket can block one or more other tickets | SATISFIED — ticket_dependencies table; blocks/blocked_by M2M; DependenciesSection UI |
| ADV-05 | 05-01, 05-02 | Moving a blocked ticket out of Backlog is rejected if any blocker is not Done | SATISFIED — check_not_blocked() in move_ticket service; 409 BLOCKED code; toast in useMoveTicket |
| ADV-06 | 05-02 | Dependencies shown on ticket detail with link to blocking ticket | SATISFIED — DependenciesSection shows blocks + blocked_by lists with ticket titles |
| ADV-07 | 05-01, 05-03 | Saved filters: user can save current board filter state with a name, reload it later | SATISFIED — SavedFilter model + /api/saved-filters; SavedFilterDropdown in BoardFilterBar with nuqs restore |
| ADV-08 | REMOVED | Sprints: admin can create a sprint (name, start_date, end_date) | REMOVED BY PRODUCT DECISION — built and verified, then removed at user request |
| ADV-09 | REMOVED | Tickets can be assigned to a sprint | REMOVED BY PRODUCT DECISION — built and verified, then removed at user request |
| ADV-10 | REMOVED | Sprint board shows tickets in that sprint; basic velocity metric | REMOVED BY PRODUCT DECISION — built and verified, then removed at user request |
| ADV-11 | REMOVED | Simple timeline / Gantt view: read-only, derived from ticket due dates | REMOVED BY PRODUCT DECISION — built and verified, then removed at user request |
| WIKI-01 | 05-01, 05-04 | Wiki pages have: title, content (Tiptap JSON rich text), created_by, created_at, updated_at | SATISFIED — WikiPage model with all fields; TiptapEditor on page detail |
| WIKI-02 | 05-04 | Wiki page list shows all pages with title and last updated | SATISFIED — /wiki page renders buildTree with title + formatDistanceToNow |
| WIKI-03 | 05-01, 05-04 | Admin and member roles can create and edit wiki pages | SATISFIED — POST and PATCH routes use get_current_user (any auth); New Page button available to all |
| WIKI-04 | 05-01, 05-04 | All authenticated users can read wiki pages; only admin can delete | SATISFIED — GET uses get_current_user; DELETE uses require_admin; ON DELETE SET NULL on parent_id |
| WIKI-05 | 05-01, 05-04 | Ticket detail includes a section where wiki pages can be linked | SATISFIED — WikiLinkField on TicketDetailModal; wiki_page_id FK on Ticket; PATCH tickets sets wiki_page_id |

### Anti-Patterns Found

No blockers or critical anti-patterns detected.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `wiki/[pageId]/page.tsx` | Delete button visible to all users, server enforces 403 for non-admins | Info | Intentional design decision per plan: server enforces role; client shows toast on 403. Acceptable pattern. |
| `DependenciesSection.tsx` | `placeholder="Search tickets..."` in CommandInput | Info | Expected placeholder text, not a stub indicator. |

One pre-existing build issue was noted in 05-03 SUMMARY and auto-fixed during execution:
- `portal/[dept]/page.tsx` — unused `hourlyRate` ESLint error from prior ROI field removal (commit b3fbbe9) — fixed in commit 1722094.

### Human Verification

The human verification checkpoint (plan 05-05, Task 2) was explicitly approved by the user covering all six Phase 5 feature areas. The approval stands for the features that remain in the codebase. Sprints and Timeline were approved and subsequently removed at user direction — this is a product decision, not a quality gap.

Items still requiring human observation for remaining features (already approved in checkpoint):

1. **Tiptap auto-save on wiki page edit**
   - Test: Open /wiki/[pageId], type content, wait for auto-save
   - Expected: Updated timestamp changes; content persists on reload
   - Why human: Auto-save timing and persistence cannot be verified statically

2. **Saved filter URL restore**
   - Test: Save a filter preset with active nuqs URL params; clear filters; apply preset
   - Expected: URL params restore exactly; board updates to match
   - Why human: nuqs round-trip behavior requires runtime verification

3. **Blocked drag toast appearance**
   - Test: Create dependency A blocks B; drag B out of Backlog
   - Expected: Toast appears with blocker ID listed
   - Why human: UI toast timing and DOM rendering require browser

All three were covered and approved in the 05-05 human verification checkpoint.

### Gaps Summary

No gaps. All verified truths pass all three levels (exists, substantive, wired).

The four requirements marked REMOVED (ADV-08, ADV-09, ADV-10, ADV-11) represent deliberate product decisions made by the user after human verification passed. They are not implementation gaps and should not block phase completion.

---

_Verified: 2026-02-25_
_Verifier: Claude (gsd-verifier)_
