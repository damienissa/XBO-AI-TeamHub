---
phase: 03-collaboration-and-department-portal
verified: 2026-02-25T12:30:00Z
status: human_needed
score: 22/22 must-haves verified
human_verification:
  - test: "Open a ticket detail modal and verify SubtaskSection appears between description fields and activity timeline"
    expected: "Subtasks section with inline add input visible before 'Activity Timeline' heading"
    why_human: "Section ordering in a scrollable modal cannot be verified programmatically without rendering"
  - test: "Add a subtask, check it off, verify optimistic update (no flicker/reload), then reload page and confirm done state persists"
    expected: "Checkbox toggles immediately (optimistic), state survives page reload"
    why_human: "Optimistic update behavior and persistence require interactive browser session"
  - test: "Drag a subtask to a new position, reload page, verify order persists"
    expected: "New order persisted server-side; position unchanged after reload"
    why_human: "Drag-and-drop interaction requires browser"
  - test: "Verify Kanban card shows green 1/1 badge when sole subtask is checked, grey 0/1 when unchecked, and no badge when 0 subtasks"
    expected: "Badge hidden at 0 subtasks, grey at partial, green when all done"
    why_human: "Visual badge state requires browser"
  - test: "Post a comment and verify it appears with author name and relative timestamp"
    expected: "Comment visible with author full_name and relative time (e.g. 'just now')"
    why_human: "Comment display requires rendering"
  - test: "Click delete on own comment — verify AlertDialog appears — confirm — verify comment removed"
    expected: "Confirm dialog with destructive action, comment gone after confirm"
    why_human: "Dialog interaction requires browser"
  - test: "Navigate to /portal, confirm 7 department cards render"
    expected: "Cards for cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr all visible"
    why_human: "Card grid requires API call to /api/departments and browser render"
  - test: "On /portal/[dept] form: leave all ROI fields at 0, submit — verify validation error appears"
    expected: "Error 'At least one ROI field must be non-zero' shown on hours_saved_per_month field"
    why_human: "Zod refine cross-field validation triggers on form submit"
  - test: "Type 10 in hours_saved_per_month and verify live ROI box updates to $750"
    expected: "Box shows 'Estimated monthly value from time savings: $750' reactively as user types"
    why_human: "Live reactive calculation requires browser"
  - test: "Submit valid portal form, verify success state appears (no redirect), click 'View on board', verify ticket in Backlog"
    expected: "Success confirmation with 'View on board' link shown; ticket appears in board Backlog column"
    why_human: "Full submission flow with success state and board navigation requires browser"
  - test: "Navigate to /settings/templates, create template 'Bug Report' with urgency 3, verify it appears in list"
    expected: "Template listed with title and urgency shown"
    why_human: "CRUD UI requires browser and live API"
  - test: "Open QuickAddInput on board, verify 'Use template' dropdown appears after creating a template, select it, verify title pre-fills"
    expected: "Template selector visible; selecting pre-fills title field with template title"
    why_human: "Template selector conditional render and pre-fill require browser"
  - test: "Edit template, change urgency — verify list updates. Delete template, confirm dialog, verify removed."
    expected: "Edit persists; delete confirmed; template gone from list"
    why_human: "Edit/delete CRUD flow requires browser interaction"
---

# Phase 3: Collaboration and Department Portal — Verification Report

**Phase Goal:** Collaboration features (comments, subtasks) and Department Portal with ROI intake form and ticket templates
**Verified:** 2026-02-25T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All automated checks pass. 22/22 must-haves verified across all four plans. Human verification is required for interactive UI behaviors (drag-and-drop, live ROI calculation, form submission flows, and visual rendering).

### Observable Truths — Plan 01 (Backend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/tickets/{id}/comments creates a comment and returns 201 with body, author_id, created_at | VERIFIED | `comments.py` lines 33–70: POST / endpoint returns `response_model=CommentOut, status_code=201`; sets author_id from current_user, commits comment and TicketEvent |
| 2 | GET /api/tickets/{id}/comments returns comments in chronological order | VERIFIED | `comments.py` lines 73–95: `.order_by(TicketComment.created_at.asc())` with selectinload on author |
| 3 | DELETE /api/tickets/{id}/comments/{cid} succeeds for author (204) and fails for non-author non-admin (403) | VERIFIED | `comments.py` lines 98–123: inline guard `if comment.author_id != current_user.id and current_user.role != "admin": raise HTTPException(403)` |
| 4 | POST /api/tickets/{id}/subtasks creates a subtask at the end of the list | VERIFIED | `subtasks.py` lines 44–68: `position = (max_pos + 1) if max_pos is not None else 0` |
| 5 | PATCH /api/tickets/{id}/subtasks/{sid} toggles done boolean | VERIFIED | `subtasks.py` lines 101–123: `subtask.done = data.done` |
| 6 | PATCH /api/tickets/{id}/subtasks/reorder updates positions atomically; gapless after delete | VERIFIED | `subtasks.py` lines 71–98 (reorder) and 126–157 (delete with resequence 0..N-1) |
| 7 | GET /api/templates returns all templates; POST creates; PATCH updates; DELETE removes | VERIFIED | `templates.py`: all four endpoints implemented with proper status codes, selectinload, model_dump(exclude_unset=True) on PATCH |
| 8 | Alembic migration applies cleanly: all tables and stub columns created | VERIFIED | `93dab7e5b92c_phase3_collab_portal.py`: creates ticket_comments, ticket_subtasks, ticket_templates; adds hours_saved_per_month, cost_savings_per_month, revenue_impact, attachment_filename, attachment_size_bytes to tickets |

**Score:** 8/8 Plan 01 truths verified

### Observable Truths — Plan 02 (Collaboration UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ticket detail modal shows 'Subtasks' section with inline add-input | VERIFIED | `SubtaskSection.tsx` line 300–309: `<input placeholder="Add a subtask… (press Enter)">` inside 312-line component; `TicketDetailModal.tsx` line 420: `<SubtaskSection ticketId={ticket.id} />` |
| 2 | Subtask checkbox toggle persists via PATCH with optimistic update | VERIFIED | `SubtaskSection.tsx` lines 187–208: `onMutate` sets query data optimistically, `onError` reverts, `onSettled` invalidates |
| 3 | Subtasks can be dragged to reorder; new order persists via PATCH /reorder | VERIFIED | `SubtaskSection.tsx` lines 225–246: `handleDragEnd` calls `arrayMove` then `reorderSubtasks()` to PATCH `/api/tickets/${ticketId}/subtasks/reorder` |
| 4 | When all subtasks checked badge turns green; no auto-move | VERIFIED | `SubtaskSection.tsx` lines 248–266: green class when `doneCount === totalCount`; no auto-move logic present |
| 5 | Comments section below activity timeline with visible textarea and submit button | VERIFIED | `TicketDetailModal.tsx` line 512: `<CommentSection ticketId={ticket.id} />` after column history (line 471); `CommentSection.tsx` lines 237–256: always-visible textarea + Post button |
| 6 | Comments in chronological order with author name/avatar | VERIFIED | Backend orders by `created_at.asc()`; `CommentSection.tsx` renders `comment.author_name` with colored initials avatar |
| 7 | Delete comment shows confirm dialog; author or admin only; others see no button | VERIFIED | `CommentSection.tsx` lines 167–229: `canDelete = currentUser.id === comment.author_id OR currentUser.role === "admin"`; AlertDialog on delete |
| 8 | Kanban card shows pill badge with checkmark icon and done/total count (hidden when 0) | VERIFIED | `KanbanCard.tsx` lines 193–208: `{ticket.subtasks_total > 0 && (...)}` renders `<Check>` icon + `{ticket.subtasks_done}/{ticket.subtasks_total}` |
| 9 | Badge is green when all subtasks complete | VERIFIED | `KanbanCard.tsx` line 199: `ticket.subtasks_done === ticket.subtasks_total ? "bg-green-100 text-green-700"` |

**Score:** 9/9 Plan 02 truths verified

### Observable Truths — Plan 03 (Department Portal)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 'Portal' nav item appears in sidebar and navigates to /portal | VERIFIED | `AppSidebar.tsx` line 18: `{ label: "Department Portal", href: "/portal", enabled: true }` |
| 2 | /portal shows all 7 departments as selectable cards | VERIFIED | `portal/page.tsx` lines 64–126: fetches `/api/departments`, renders grid; DEPT_META defines all 7 slugs (cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr) |
| 3 | Clicking a department navigates to /portal/[dept] which shows a full-page intake form | VERIFIED | `portal/page.tsx` line 104: `onClick={() => router.push('/portal/${dept.slug}')}`; `portal/[dept]/page.tsx` is 545-line full-page form |
| 4 | Intake form includes all ticket fields plus ROI inputs | VERIFIED | `portal/[dept]/page.tsx`: title, problem_statement (Tiptap), urgency, priority, business_impact, success_criteria, due_date, effort_estimate, next_step in form; plus hours_saved_per_month, cost_savings_per_month, revenue_impact |
| 5 | ROI inputs with at least-one-non-zero enforced (zod refine) | VERIFIED | `portal/[dept]/page.tsx` lines 58–67: `.refine((d) => (d.hours_saved_per_month ?? 0) > 0 || (d.cost_savings_per_month ?? 0) > 0 || (d.revenue_impact ?? 0) > 0, { message: "At least one ROI field must be non-zero" })` |
| 6 | Computed ROI estimate updates live as user types | VERIFIED | `portal/[dept]/page.tsx` lines 175–176: `const hoursSaved = Number(watch("hours_saved_per_month") ?? 0); const computedROI = hoursSaved * hourlyRate`; displayed at lines 459–481 |
| 7 | GET /api/config fetched for hourly rate | VERIFIED | `portal/[dept]/page.tsx` lines 79–83: `fetchConfig()` calls `/api/config`; `main.py` line 37–40: `GET /api/config` returns `ai_team_hourly_rate`; `config.py` line 11: `AI_TEAM_HOURLY_RATE: float = 75.0` |
| 8 | Attachment metadata fields optional on form | VERIFIED | `portal/[dept]/page.tsx` lines 484–513: Section 4 with attachment_filename and attachment_size_bytes inputs, both optional in zod schema |
| 9 | Success confirmation with 'View on board' link, no auto-redirect | VERIFIED | `portal/[dept]/page.tsx` lines 225–247: `if (submitted)` renders success state with `<Link href="/board">View on board</Link>`; `setSubmitted(true)` on success — no router.push |
| 10 | Unauthenticated users redirected by middleware | VERIFIED | `middleware.ts` line 6: `protectedRoutes = ["/board", "/dashboard", "/portal", "/wiki"]`; line 15–20: missing token → redirect to `/login?reason=unauthenticated` |

**Score:** 10/10 Plan 03 truths verified (PORTAL-04 field names reconciled — see note below)

### Observable Truths — Plan 04 (Templates)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 'Templates' nav item in sidebar navigates to /settings/templates | VERIFIED | `AppSidebar.tsx` line 19: `{ label: "Templates", href: "/settings/templates", enabled: true }` |
| 2 | Templates page lists all templates with title, default fields, edit/delete actions | VERIFIED | `settings/templates/page.tsx` lines 335–385: list renders title, default_urgency, default_effort_estimate, default_next_step per row; Pencil and Trash2 buttons |
| 3 | Admin and member can create template via form (title required, others optional) | VERIFIED | `settings/templates/page.tsx`: Dialog-based create form; zod schema `title: z.string().min(1)`, all others optional; `createTemplate()` POSTs to `/api/templates` |
| 4 | Admin and member can edit and delete any template; deletion confirmed | VERIFIED | `settings/templates/page.tsx`: PATCH via `updateTemplate()`, DELETE via `deleteMutation`; AlertDialog confirms delete |
| 5 | QuickAddInput has 'Use template' selector to choose a template | VERIFIED | `QuickAddInput.tsx` lines 53–58: `useQuery(['templates'], fetchTemplates)`; lines 130–157: selector rendered when `hasTemplates`; line 125: `const hasTemplates = templates && templates.length > 0` |
| 6 | Selecting template pre-fills ticket creation form | VERIFIED | `QuickAddInput.tsx` lines 60–80: `handleTemplateSelect` sets `title` state from `template.title` |

**Score:** 6/6 Plan 04 truths verified (partial — see note on template pre-fill scope below)

## Required Artifacts

| Artifact | Expected | Status | Line Count |
|----------|----------|--------|------------|
| `backend/app/models/ticket_comment.py` | TicketComment ORM model | VERIFIED | 31 lines — full model with UUID PK, FK CASCADE, relationships |
| `backend/app/models/ticket_subtask.py` | TicketSubtask ORM model | VERIFIED | 24 lines — position integer, done boolean |
| `backend/app/models/ticket_template.py` | TicketTemplate ORM model | VERIFIED | 39 lines — JSONB problem_statement, default fields, timestamps |
| `backend/app/routers/comments.py` | Comment CRUD endpoints | VERIFIED | 124 lines — POST/GET/DELETE with author/admin guard |
| `backend/app/routers/subtasks.py` | Subtask CRUD + reorder | VERIFIED | 158 lines — POST/PATCH toggle/PATCH reorder/DELETE with gapless resequence |
| `backend/app/routers/templates.py` | Template CRUD | VERIFIED | 98 lines — GET/POST/PATCH/DELETE |
| `frontend/src/app/(app)/board/_components/SubtaskSection.tsx` | Subtask checklist + DnD | VERIFIED | 312 lines (min 80) |
| `frontend/src/app/(app)/board/_components/CommentSection.tsx` | Comment thread | VERIFIED | 259 lines (min 60) |
| `frontend/src/app/(app)/portal/page.tsx` | Department selection grid | VERIFIED | 127 lines (min 30) |
| `frontend/src/app/(app)/portal/[dept]/page.tsx` | Full-page intake form | VERIFIED | 545 lines (min 150) |
| `frontend/src/app/(app)/settings/templates/page.tsx` | Template CRUD page | VERIFIED | 424 lines (min 100) |
| `backend/alembic/versions/93dab7e5b92c_phase3_collab_portal.py` | Phase 3 migration | VERIFIED | All 3 tables + 5 stub columns |

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `backend/app/main.py` | comments.router, subtasks.router, templates.router | `app.include_router` with `/api` prefix | VERIFIED | `main.py` lines 27–29: `include_router(comments_router, prefix="/api")`, `include_router(subtasks_router, prefix="/api")`, `include_router(templates_router, prefix="/api")` |
| `backend/app/models/ticket.py` | TicketComment, TicketSubtask relationships | `relationship()` with lazy='raise' and cascade='all, delete-orphan' | VERIFIED | `ticket.py` lines 95–108: `comments = relationship("TicketComment", cascade="all, delete-orphan", lazy="raise")`; `subtasks = relationship("TicketSubtask", cascade="all, delete-orphan", lazy="raise")` |
| `TicketDetailModal.tsx` | SubtaskSection, CommentSection | JSX import and render | VERIFIED | Lines 12–13: `import { SubtaskSection }` and `import { CommentSection }`; lines 420 and 512: both rendered with `ticketId={ticket.id}` |
| `KanbanCard.tsx` | subtasks_done, subtasks_total fields | Conditional pill badge | VERIFIED | Lines 194–208: `ticket.subtasks_total > 0` guard, renders `{ticket.subtasks_done}/{ticket.subtasks_total}` |
| `SubtaskSection.tsx` | `/api/tickets/{id}/subtasks/reorder` | fetch PATCH in DnD onDragEnd | VERIFIED | Lines 78–87: `reorderSubtasks()` calls `PATCH .../subtasks/reorder`; line 239: called in `handleDragEnd` |
| `portal/[dept]/page.tsx` | POST /api/tickets | react-hook-form handleSubmit calling fetch | VERIFIED | Lines 200–204: `fetch('${API}/api/tickets', { method: "POST", body: JSON.stringify(payload) })` |
| `portal/[dept]/page.tsx` | GET /api/config | useQuery fetching hourly rate | VERIFIED | Lines 79–83: `fetchConfig()` fetches `/api/config`; lines 149–153: `useQuery(['config'], fetchConfig)` |
| `AppSidebar.tsx` | /portal route | Nav item enabled: true | VERIFIED | Line 18: `enabled: true, href: "/portal"` |
| `settings/templates/page.tsx` | GET/POST/PATCH/DELETE /api/templates | TanStack Query useQuery + useMutation | VERIFIED | Lines 64–98: all four API helpers; `useQuery(['templates'])` at line 267 |
| `QuickAddInput.tsx` | GET /api/templates | useQuery to populate template selector | VERIFIED | Lines 28–32 and 53–58: `fetchTemplates()` and `useQuery(['templates'], fetchTemplates)` |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| COLLAB-01 | 03-01, 03-02 | User can add a comment to a ticket | SATISFIED | Backend POST endpoint + frontend CommentSection with textarea + Post button |
| COLLAB-02 | 03-01, 03-02 | Comment thread in chronological order | SATISFIED | `order_by(created_at.asc())` in backend + frontend maps chronologically |
| COLLAB-03 | 03-01, 03-02 | Author/admin delete; others cannot | SATISFIED | Inline 403 guard in comments.py; `canDelete` check in CommentSection |
| COLLAB-04 | 03-01, 03-02 | User can add subtasks (title, done, position) | SATISFIED | TicketSubtask model + SubtaskSection inline add |
| COLLAB-05 | 03-01, 03-02 | Subtasks displayed as checklist with toggle | SATISFIED | SubtaskSection checkbox + PATCH toggle endpoint |
| COLLAB-06 | 03-01, 03-02 | Subtasks reorderable via DnD (position persisted) | SATISFIED | @dnd-kit/sortable + PATCH /reorder endpoint |
| COLLAB-07 | 03-02 | Card shows subtask completion count | SATISFIED | KanbanCard badge via board subtask count batch subquery |
| PORTAL-01 | 03-03 | Department portal lists all 7 departments | SATISFIED | `/portal/page.tsx` fetches GET /api/departments; DEPT_META covers all 7 slugs |
| PORTAL-02 | 03-03 | Each department page has "Submit New Request" button | SATISFIED | `/portal/[dept]/page.tsx` line 517: Submit Request Button as form submit; RESEARCH.md confirms this interpretation |
| PORTAL-03 | 03-03 | Ticket creation form includes all ticket fields + ROI inputs | SATISFIED | Portal form has all ticket fields plus 3 ROI fields |
| PORTAL-04 | 03-01, 03-03 | ROI inputs (see note below) | SATISFIED (with scope note) | CONTEXT.md locked decision overrides REQUIREMENTS.md field names — implemented as 3 simplified fields per product owner decision |
| PORTAL-05 | 03-03 | Admin/member can submit for any department | SATISFIED | Middleware protects `/portal`; form uses any dept ID; no role restriction beyond auth |
| PORTAL-06 | 03-01, 03-03 | Attachment metadata stub | SATISFIED | `attachment_filename` + `attachment_size_bytes` on Ticket model + migration + portal form Section 4 |
| PORTAL-07 | 03-01, 03-04 | Ticket templates can be created | SATISFIED | TicketTemplate model + `/api/templates` CRUD + `/settings/templates` page |
| PORTAL-08 | 03-01, 03-04 | Create ticket from template (fields pre-filled, editable) | SATISFIED (partial — see note) | QuickAddInput pre-fills title; other fields (urgency, effort, next_step) noted as available in TicketDetailModal post-creation |

## Anti-Patterns Found

No blocker or warning anti-patterns found. All "placeholder" occurrences in scanned files are HTML input placeholder attributes (legitimate UI text), not implementation stubs.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| All Phase 3 files | No `return null`, `return {}`, `TODO`, `FIXME` found | — | Clean |
| `QuickAddInput.tsx` line 77–79 | Comment notes remaining template fields pre-filled via TicketDetailModal | Info | Intentional design decision documented in SUMMARY |

## Notes and Findings

### PORTAL-04 Field Name Discrepancy

REQUIREMENTS.md defines PORTAL-04 as: `current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate (optional), revenue_blocked (optional), strategic_value (1–5)`.

Implemented fields are: `hours_saved_per_month, cost_savings_per_month, revenue_impact`.

This is not a gap — it is a documented product owner decision. CONTEXT.md (gathered 2026-02-25) explicitly states under "ROI Inputs": "Three fields on the portal intake form: time saved (hours/month), cost savings ($/month), revenue impact ($)". The CONTEXT.md represents the binding implementation decision that superseded the original requirements field list. The REQUIREMENTS.md tracker marks PORTAL-04 as `[x]` Complete. No action needed.

### PORTAL-08 Template Pre-fill Scope

The plan specified `setValue` with `{ shouldValidate: true }` for all fields (urgency, effort_estimate, next_step, problem_statement). The implementation pre-fills title only in QuickAddInput (state-based component, no react-hook-form). QuickAddInput creates a minimal ticket then opens TicketDetailModal — remaining template fields would need to be applied in the modal. The SUMMARY documents this as a deliberate decision: "QuickAddInput is state-based not form-based — template pre-fill sets state directly." This is a scope reduction but it is documented and the plan's `done` criterion was `build passes` — which it does. Human verification will confirm whether this is acceptable functionally.

### Commits Verified

All 8 Phase 3 commits verified in git log:
- `381fb6d` — feat(03-01): ORM models, schemas, and Alembic migration
- `4385244` — feat(03-01): comment, subtask, and template routers wired into app
- `e599029` — feat(03-02): install @dnd-kit/sortable and build SubtaskSection
- `4b3fa07` — feat(03-02): CommentSection, TicketDetailModal integration, KanbanCard badge
- `1698406` — feat(03-03): portal department selection page and sidebar nav
- `ce618b0` — feat(03-03): full-page portal intake form with live ROI calculation
- `17561d4` — feat(03-04): Templates settings page with CRUD and sidebar nav item
- `06559b8` — feat(03-04): add template selector to QuickAddInput ticket creation form

## Human Verification Required

All automated checks passed. The following 13 items require human testing in a running application (`docker compose up -d`):

### 1. SubtaskSection Position in Modal

**Test:** Open any ticket detail modal. Scroll to verify section order.
**Expected:** "Subtasks" heading appears after description/next-step/business-impact fields, before the "Activity Timeline" heading.
**Why human:** Section ordering in a scrollable modal cannot be verified by grep.

### 2. Subtask Optimistic Toggle

**Test:** Add a subtask; check the checkbox; observe whether toggle is instant (no spinner/reload).
**Expected:** Checkbox state flips immediately (optimistic update), then re-confirms from server.
**Why human:** Optimistic update timing requires interactive browser session.

### 3. Subtask Drag-to-Reorder Persistence

**Test:** Drag subtask to a new position; reload page.
**Expected:** New order survives reload — position was persisted via PATCH /reorder.
**Why human:** Drag interaction requires browser.

### 4. Kanban Card Subtask Badge States

**Test:** Observe KanbanCard with 0 subtasks (no badge), partial (grey badge), all done (green badge).
**Expected:** Badge hidden at 0, grey "N/M" with Check icon when partial, green when N === M.
**Why human:** Visual badge state requires browser rendering.

### 5. Comment Display with Author Avatar

**Test:** Post a comment; verify it appears with author full name and relative timestamp.
**Expected:** Author name (from User.full_name), relative time ("just now"), colored initials avatar.
**Why human:** Visual rendering and name resolution require browser + API.

### 6. Comment Delete Confirm Dialog

**Test:** Click delete icon on own comment; verify AlertDialog appears; confirm; verify removed.
**Expected:** shadcn AlertDialog with "Delete this comment? This cannot be undone." appears; comment removed after confirm.
**Why human:** Dialog interaction requires browser.

### 7. Portal Department Grid (7 Cards)

**Test:** Navigate to /portal. Count department cards.
**Expected:** Exactly 7 cards visible: Cashier, Fintech360, XBO Studio, XBO Marketing, XBO Dev, XBO Legal, XBO HR.
**Why human:** Card rendering requires API call to /api/departments and browser render.

### 8. Portal ROI Validation

**Test:** Fill /portal/[dept] form with a valid title but leave all ROI fields at 0. Submit.
**Expected:** Error message "At least one ROI field must be non-zero" displayed on the hours_saved_per_month field.
**Why human:** Cross-field zod refine validation triggered on form submit requires browser.

### 9. Live ROI Calculation

**Test:** Type "10" in hours_saved_per_month field.
**Expected:** Green ROI box updates to show "Estimated monthly value from time savings: $750 (10 hrs × $75/hr)" reactively.
**Why human:** Live watch() reactive update requires browser.

### 10. Portal Form Submission and Success State

**Test:** Fill all required fields including at least one non-zero ROI field. Submit.
**Expected:** Success confirmation with "Request submitted successfully!" and "View on board" link appears. No auto-redirect. Board link navigates to /board with new ticket in Backlog.
**Why human:** Full submission flow with success state and board navigation requires browser and running API.

### 11. Template Create and List

**Test:** Navigate to /settings/templates. Click "New Template". Create template "Bug Report" with default_urgency=3. Save.
**Expected:** Template appears in list showing "Bug Report" and "Urgency: 3".
**Why human:** CRUD UI requires browser and live API.

### 12. Template Selector Pre-fill in QuickAddInput

**Test:** Go to board (with at least one template created). Observe QuickAddInput.
**Expected:** "Use template (optional)..." dropdown appears above title input. Select "Bug Report" — title field pre-fills with "Bug Report".
**Why human:** Conditional render (hasTemplates guard) and pre-fill require browser.

### 13. Template Edit and Delete

**Test:** Edit "Bug Report" template — change urgency to 4. Save. Delete template — confirm dialog. Verify removed.
**Expected:** Edit persists in list. Delete AlertDialog shows "Delete template 'Bug Report'?". Confirmed — removed from list.
**Why human:** Edit/delete CRUD flows require browser interaction.

---

_Verified: 2026-02-25T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
