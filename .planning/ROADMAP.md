# Roadmap: XBO AI TeamHub

## Overview

XBO AI TeamHub is built in six progressive phases, each leaving the application in a fully runnable state. Phase 1 establishes the foundation that every subsequent phase depends on. Phase 2 delivers the core Kanban workflow — the visible heart of the product. Phase 3 adds collaboration tools and the department intake portal. Phase 4 delivers the ROI estimation and executive analytics that justify the build. Phase 5 extends the system with advanced workflow features and the wiki. Phase 6 adds AI-assisted capabilities behind a feature flag, using the real ticket data accumulated in earlier phases to generate useful output.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Auth** - Runnable stack with user authentication, role enforcement, and seeded departments (completed 2026-02-25)
- [x] **Phase 2: Kanban Core** - Full ticket lifecycle on a drag-and-drop board with column time tracking and ticket detail (completed 2026-02-25)
- [x] **Phase 3: Collaboration and Department Portal** - Comment threads, subtasks, and structured department intake with templates (completed 2026-02-25)
- [x] **Phase 4: ROI Estimation and Executive Dashboard** - ROI panel on every ticket and KPI analytics for leadership (completed 2026-02-25)
- [ ] **Phase 5: Advanced Features** - Ticket dependencies, sprints, custom fields, saved filters, and wiki
- [ ] **Phase 6: AI Features** - AI-assisted subtask generation, effort estimation, and ticket summarization behind a feature flag

## Phase Details

### Phase 1: Foundation and Auth
**Goal**: Any XBO AI team member can create an account, log in, and access the application with appropriate role-based permissions — on a fully containerized stack with correct architectural foundations in place
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, DEPT-01, DEPT-02, DEPT-03
**Success Criteria** (what must be TRUE):
  1. A new user can register with email and password, log in, and stay logged in across browser refreshes without re-entering credentials
  2. Logging out clears the session; attempting to access any protected page redirects to the login screen
  3. An admin can assign a role (admin or member) to any user, and the user's access changes immediately within one token TTL cycle
  4. The sidebar displays all 7 XBO departments with navigation links
  5. The application runs end-to-end via `docker compose up` with no manual database setup
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Backend foundation: Docker Compose, PostgreSQL, SQLAlchemy 2.x async, Alembic async env.py, User + Department models, GET /api/departments, idempotent seed (departments + admin user)
- [ ] 01-02-PLAN.md — Auth endpoints: POST /login (httpOnly cookie JWT), GET /me, POST /logout, POST /refresh (sliding window), POST /users (admin-only), PATCH /users/{id}/role, token_version invalidation, pytest suite
- [ ] 01-03-PLAN.md — Frontend auth: Next.js 14 App Router scaffold, middleware.ts + verifySession() DAL two-layer guard, login page (inline errors, no signup link), fixed sidebar with departments, board placeholder

### Phase 2: Kanban Core
**Goal**: Admin and member users can manage the full ticket lifecycle on a Kanban board — creating tickets, moving them between columns with owner assignment, viewing all ticket details with rich text and activity history, and filtering the board
**Depends on**: Phase 1
**Requirements**: TICKET-01, TICKET-02, TICKET-03, TICKET-04, TICKET-05, TICKET-06, TICKET-07, TICKET-08, TICKET-09, TICKET-10, BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-06
**Success Criteria** (what must be TRUE):
  1. A user can create a ticket that appears in the Backlog column with no owner, then drag it to another column — which opens an owner-assignment modal before the move commits
  2. Every column move is reflected in a column history log; the ticket detail shows how long the ticket spent in each column
  3. The board filter bar narrows visible cards by owner, department, priority, date range, and aging; applied filters are reflected in the URL so the view is shareable
  4. A ticket card shows department badge, owner initials, due date, urgency, effort estimate, and time in current column at a glance
  5. Clicking a card opens a detail view with Tiptap rich text editing, a full activity timeline, and the complete column history
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Backend data layer: Ticket/ColumnHistory/TicketEvent ORM models, Alembic migration, ticket CRUD + move endpoint, GET /api/board eager-load, GET /api/auth/users
- [x] 02-02-PLAN.md — Kanban board frontend: TanStack Query + NuqsAdapter providers, 5-column board with dnd-kit drag-and-drop, optimistic updates, owner modal, QuickAddInput, full card metadata display, 30s polling
- [x] 02-03-PLAN.md — Board filters + ticket detail: nuqs filter bar with URL persistence, Tiptap detail modal with auto-save, inline editing, activity timeline, column history
- [x] 02-04-PLAN.md — End-to-end human verification checkpoint for complete Phase 2 workflow

### Phase 3: Collaboration and Department Portal
**Goal**: AI team members can collaborate on tickets via comments and subtasks, and can log intake tickets on behalf of any department using a structured portal form
**Depends on**: Phase 2
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, COLLAB-07, PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05, PORTAL-06, PORTAL-07, PORTAL-08
**Success Criteria** (what must be TRUE):
  1. A user can add a comment to any ticket; the author or an admin can delete it; comments appear in chronological order on the ticket detail
  2. A user can add subtasks to a ticket, check them off, and reorder them by dragging; the Kanban card shows the subtask completion count (e.g., "2/5 subtasks")
  3. An AI team member can navigate to any department's intake page and submit a new ticket on behalf of that department, with ROI inputs required
  4. An admin or member can create a ticket template and create a ticket from that template with fields pre-filled and editable before submission
  5. An attachment can be registered on a ticket by specifying filename and file size (no file bytes stored in v1)
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — Collaboration backend: TicketComment, TicketSubtask, TicketTemplate ORM models, Alembic migration, CRUD endpoints for comments/subtasks/templates, ROI stub columns + attachment stub columns on tickets, GET /api/config
- [ ] 03-02-PLAN.md — Subtasks and comments frontend: SubtaskSection (dnd-kit/sortable reorder, inline add, checkbox toggle), CommentSection (chronological thread, always-visible input, author/admin delete with confirm), both embedded in TicketDetailModal, KanbanCard subtask count badge
- [ ] 03-03-PLAN.md — Department portal: Portal sidebar nav, /portal department selection page, /portal/[dept] full-page intake form with all ticket fields + ROI inputs, live ROI calculation via /api/config, zod cross-field validation, success confirmation with "View on board" link
- [x] 03-04-PLAN.md — Templates and verification: /settings/templates CRUD page, "create from template" flow in ticket creation form (pre-fill with shouldValidate:true), human E2E verification checkpoint for all Phase 3 features (completed 2026-02-25)

### Phase 4: ROI Estimation and Executive Dashboard
**Goal**: Every ticket has a computed ROI panel visible to all users, and executives have a single dashboard showing throughput, cycle time, bottleneck columns, team workload, and department breakdowns
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, ROI-01, ROI-02, ROI-03, ROI-04, ROI-05, ROI-06
**Success Criteria** (what must be TRUE):
  1. The ticket detail displays a computed ROI panel showing weekly cost, yearly cost, annual savings, dev cost, ROI percentage, and adjusted ROI — with "Insufficient data" shown when ROI cannot be computed
  2. The executive dashboard shows KPI cards for open ticket count, throughput (done per week), average cycle time, and overdue count
  3. The dashboard highlights the bottleneck column (the one with highest average time) and shows average time spent per column across all tickets
  4. A bar chart shows each team member's active workload in effort hours, and a table shows ticket counts and average cycle time per department
  5. All dashboard data is served from a single aggregation endpoint using PostgreSQL window functions with no N+1 queries
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — ROI backend: Alembic migration replacing Phase 3 stub columns with full 14-column ROI field set, compute_roi_fields() service, TicketUpdate schema extended, PATCH handler triggers recompute, portal form updated to ROI-01 field names
- [ ] 04-02-PLAN.md — ROI panel frontend: RoiPanel component (hero stats, supporting grid, inline editable inputs, live preview, blur-to-save), embedded as always-visible section in TicketDetailModal
- [ ] 04-03-PLAN.md — Dashboard aggregation + frontend: GET /api/dashboard single endpoint (KPIs, column times, workload, dept breakdown, throughput trend), dashboard page at /dashboard with KPI cards, Recharts BarChart + AreaChart, bottleneck highlight, dept table, sidebar nav enabled

### Phase 5: Advanced Features
**Goal**: Power users can manage ticket dependencies, organize work into sprints, define custom fields per workspace, save filter presets, view a timeline, and read or write wiki pages linked to tickets
**Depends on**: Phase 4
**Requirements**: WIKI-01, WIKI-02, WIKI-03, WIKI-04, WIKI-05, ADV-01, ADV-02, ADV-03, ADV-04, ADV-05, ADV-06, ADV-07, ADV-08, ADV-09, ADV-10, ADV-11
**Success Criteria** (what must be TRUE):
  1. An admin can define custom fields for the workspace; those fields appear on every ticket detail and accept values that are saved and displayed
  2. A ticket can be marked as blocked by another ticket; attempting to move a blocked ticket out of Backlog is rejected unless all blocking tickets are in Done
  3. An admin can create a sprint, assign tickets to it, and view a sprint board with velocity metrics (effort hours completed vs total)
  4. A user can save their current board filter state with a name and reload it from a saved filter picker
  5. A read-only timeline view renders all tickets as date bars derived from their due dates
  6. Any user can read wiki pages linked to tickets; admin and member roles can create and edit wiki pages with rich text content
**Plans**: 5 plans

Plans:
- [ ] 05-01-PLAN.md — Backend data layer: all 5 new ORM models (ticket_dependency, sprint, custom_field_def, saved_filter, wiki_page), single Alembic migration, Ticket model extensions (sprint_id/wiki_page_id/custom_field_values), all new routers + schemas, move_ticket extended with ADV-05 blocker check
- [ ] 05-02-PLAN.md — Dependencies + sprints frontend: DependenciesSection on ticket detail, blocked badge on KanbanCard, 409 BLOCKED toast in drag handler, Sprints sidebar nav, sprint list + board pages with velocity header, SprintField combobox picker on ticket detail
- [ ] 05-03-PLAN.md — Custom fields + saved filters frontend: CustomFieldsSection on ticket detail (workspace + personal, type-aware inputs, inline add personal field), Workspace Settings admin page, SavedFilterDropdown in BoardFilterBar
- [ ] 05-04-PLAN.md — Wiki frontend: sidebar nav, hierarchical tree list page with collapsible parent-child nodes, wiki page view/edit with Tiptap editor, WikiLinkField combobox picker on ticket detail
- [ ] 05-05-PLAN.md — Timeline view + human verification: read-only Recharts horizontal BarChart Gantt view at /timeline, sidebar nav, end-to-end Phase 5 checkpoint

### Phase 6: AI Features
**Goal**: Admin and member users can invoke AI assistance directly from ticket creation and detail views to generate subtask lists, estimate effort, and summarize ticket progress — all gated by an environment flag with no impact on users when disabled
**Depends on**: Phase 5
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Success Criteria** (what must be TRUE):
  1. Clicking "Generate subtasks with AI" on a ticket detail calls the AI endpoint and populates the subtask list for review before saving
  2. Clicking "Estimate effort with AI" on the ticket creation form calls the AI endpoint and pre-fills the effort hours field
  3. Clicking "Summarize progress" on a ticket detail returns a text summary of comments, subtasks, and events in a visible panel
  4. All AI buttons show a loading state while the request is in flight; any error produces a visible user-facing message instead of silent failure
  5. When AI_ENABLED=false, all AI endpoints return 503 and the AI buttons either hide or show a clear "not available" state — no broken UI
**Plans**: TBD

Plans:
- [ ] 06-01: AI backend — AI_ENABLED feature flag, POST /api/ai/subtasks, POST /api/ai/effort_estimate, POST /api/ai/summary with Claude API integration and 503 guard
- [ ] 06-02: AI frontend — "Generate subtasks with AI", "Estimate effort with AI", "Summarize progress" buttons with loading states, error handling, and disabled states when AI is off

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Auth | 3/3 | Complete    | 2026-02-25 |
| 2. Kanban Core | 4/4 | Complete   | 2026-02-25 |
| 3. Collaboration and Department Portal | 4/4 | Complete   | 2026-02-25 |
| 4. ROI Estimation and Executive Dashboard | 3/3 | Complete   | 2026-02-25 |
| 5. Advanced Features | 3/5 | In Progress|  |
| 6. AI Features | 0/2 | Not started | - |
