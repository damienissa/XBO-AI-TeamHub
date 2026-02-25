# Requirements: XBO AI TeamHub

**Defined:** 2026-02-24
**Core Value:** Every XBO request has a tracked lifecycle from Backlog to Done — with owner accountability, ROI justification, and zero SaaS subscription cost.

---

## v1 Requirements

### Authentication (AUTH)

- [x] **AUTH-01**: User can register with email and password
- [x] **AUTH-02**: User can log in with email and password and receive a session (JWT in httpOnly cookie)
- [x] **AUTH-03**: User session persists across browser refresh
- [x] **AUTH-04**: User can log out and cookie is cleared
- [x] **AUTH-05**: Two roles exist: `admin`, `member` (platform is AI dev team only)
- [x] **AUTH-06**: Admin can assign and change user roles
- [x] **AUTH-07**: Protected routes redirect unauthenticated users to login
- [x] **AUTH-08**: Token is invalidated within one TTL cycle when user is deactivated (token versioning)

### Departments (DEPT)

- [x] **DEPT-01**: Seven fixed departments are seeded: cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr
- [x] **DEPT-02**: Sidebar lists all departments with navigation links
- [x] **DEPT-03**: API returns all departments for use in ticket filters and forms

### Tickets (TICKET)

- [x] **TICKET-01**: User (admin/member) can create a ticket with: title, problem_statement (rich text), urgency (1–5), business_impact (text), success_criteria (text), due_date, effort_estimate (hours), next_step (text), department_id
- [x] **TICKET-02**: New tickets are created in Backlog column with owner_id = null
- [x] **TICKET-03**: Any authenticated user (admin/member) can edit any ticket field
- [x] **TICKET-04**: Admin can delete a ticket
- [x] **TICKET-05**: Ticket has a priority field (low / medium / high / critical)
- [x] **TICKET-06**: Ticket stores status_column (Backlog / Discovery / In Progress / Review/QA / Done)
- [x] **TICKET-07**: Backlog tickets must have owner_id = null (enforced server-side)
- [x] **TICKET-08**: Moving a ticket out of Backlog requires owner_id to be set in the same request
- [x] **TICKET-09**: Every move is recorded as a ColumnHistory entry (ticket_id, column, entered_at TIMESTAMPTZ, exited_at TIMESTAMPTZ)
- [x] **TICKET-10**: Every state change emits a TicketEvent (ticket_id, event_type, payload JSON, created_at TIMESTAMPTZ, actor_id)

### Kanban Board (BOARD)

- [x] **BOARD-01**: Kanban board page shows 5 columns: Backlog, Discovery, In Progress, Review/QA, Done
- [x] **BOARD-02**: Ticket cards can be dragged between columns with optimistic UI update and explicit rollback on rejection
- [x] **BOARD-03**: Dragging a ticket out of Backlog opens an owner-assignment modal before committing the move
- [x] **BOARD-04**: Card displays: department badge, title, owner initials/avatar, due date, time in current column, next_step, urgency badge, priority, business_impact snippet, effort estimate
- [x] **BOARD-05**: Board filter bar supports: owner, department, created date range, due date range, priority/urgency, aging (time in column threshold)
- [x] **BOARD-06**: Applied filters persist in URL query params (shareable filter state)
- [x] **BOARD-07**: Board data polls every 30 seconds via TanStack Query refetchInterval
- [x] **BOARD-08**: Board loads via a single API endpoint with eager loading (no N+1 queries)

### Ticket Detail (DETAIL)

- [x] **DETAIL-01**: Clicking a card opens a ticket detail modal/page
- [x] **DETAIL-02**: Detail view shows all ticket fields: title, rich text problem statement, urgency, business impact, success criteria, effort estimate, due date, next step, status column, department, owner, priority
- [x] **DETAIL-03**: Rich text editor (Tiptap) for problem_statement — stored as JSON, never HTML
- [x] **DETAIL-04**: User (admin/member) can edit ticket fields inline
- [x] **DETAIL-05**: Activity timeline renders all TicketEvents (created, moved, assigned, edited) in chronological order
- [x] **DETAIL-06**: Column history section shows all columns the ticket passed through with enter/exit timestamps and time spent

### Collaboration (COLLAB)

- [x] **COLLAB-01**: User can add a comment to a ticket (body text, author_id, created_at)
- [x] **COLLAB-02**: Comment thread is displayed in chronological order on ticket detail
- [x] **COLLAB-03**: Author can delete their own comment; admin can delete any comment
- [x] **COLLAB-04**: User can add subtasks to a ticket (title, done boolean, position integer)
- [x] **COLLAB-05**: Subtasks are displayed as a checklist and can be checked/unchecked
- [x] **COLLAB-06**: Subtasks can be reordered via drag-and-drop (position persisted server-side)
- [x] **COLLAB-07**: Card on Kanban shows subtask completion count (e.g., "2/5 subtasks")

### Department Portal (PORTAL)

- [x] **PORTAL-01**: Department portal section lists all 7 departments
- [x] **PORTAL-02**: Each department page has a "Submit New Request" button
- [x] **PORTAL-03**: Ticket creation form includes all ticket fields plus ROI inputs (ROI inputs required for portal submissions)
- [x] **PORTAL-04**: ROI inputs: current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate (optional), revenue_blocked (optional), strategic_value (1–5)
- [x] **PORTAL-05**: Any AI team member (admin/member) can submit an intake form for any department on behalf of that department's employees
- [x] **PORTAL-06**: Attachment metadata stub: user can specify attachment filename + file size; actual file bytes are not stored in v1
- [x] **PORTAL-07**: Ticket templates can be created (title, problem_statement template, default fields)
- [x] **PORTAL-08**: User can create a ticket from a template (fields pre-filled, editable before submit)

### Executive Dashboard (DASH)

- [x] **DASH-01**: Dashboard page shows KPI cards: open ticket count, throughput (done per week), avg cycle time (created→done), overdue count
- [x] **DASH-02**: Avg time per column — for each of the 5 columns, show the average time tickets spent in that column
- [x] **DASH-03**: Bottleneck column — the column with the highest avg time is highlighted
- [x] **DASH-04**: Workload per user — bar chart showing sum of effort_hours on active tickets per team member
- [x] **DASH-05**: Department breakdown table — ticket counts and avg cycle time per department
- [x] **DASH-06**: Dashboard data served from a single aggregation endpoint using PostgreSQL window functions
- [x] **DASH-07**: KPI charts use Recharts (BarChart for workload, LineChart or AreaChart for throughput trend)

### ROI Estimation (ROI)

- [x] **ROI-01**: ROI fields stored on ticket: current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate, revenue_blocked, strategic_value, expected_savings_rate, risk_probability
- [x] **ROI-02**: Computed fields (persisted): weekly_cost, yearly_cost, annual_savings, dev_cost, roi, adjusted_roi
  - `weekly_cost = current_time_cost_hours_per_week × employees_affected × avg_hourly_cost`
  - `yearly_cost = weekly_cost × 52`
  - `annual_savings = yearly_cost × expected_savings_rate`
  - `dev_cost = effort_estimate × internal_ai_team_hourly_rate`
  - `roi = (annual_savings − dev_cost) / dev_cost` (NULL if dev_cost = 0)
  - `adjusted_roi = roi × (1 − risk_probability)` (NULL if roi is NULL)
- [x] **ROI-03**: `internal_ai_team_hourly_rate` is a server-side config value (env var, default 75)
- [x] **ROI-04**: ROI panel displayed on ticket detail with computed values
- [x] **ROI-05**: Division-by-zero is handled — roi stored as NULL, displayed as "Insufficient data"
- [x] **ROI-06**: ROI inputs are required on portal submissions, optional on direct board creation

### Wiki / Docs (WIKI)

- [ ] **WIKI-01**: Wiki pages have: title, content (Tiptap JSON rich text), created_by, created_at, updated_at
- [ ] **WIKI-02**: Wiki page list shows all pages with title and last updated
- [ ] **WIKI-03**: Admin and member roles can create and edit wiki pages
- [ ] **WIKI-04**: All authenticated users (admin/member) can read wiki pages; only admin can delete pages
- [ ] **WIKI-05**: Ticket detail includes a "Linked Pages" section where wiki pages can be linked

### AI Features (AI) — gated by AI_ENABLED env flag

- [ ] **AI-01**: `POST /api/ai/subtasks` — accepts ticket fields, returns a proposed subtask list; 503 if AI_ENABLED=false
- [ ] **AI-02**: `POST /api/ai/effort_estimate` — accepts ticket fields, returns estimated effort hours; 503 if AI_ENABLED=false
- [ ] **AI-03**: `POST /api/ai/summary` — accepts ticket_id, reads comments + subtasks + events, returns a progress summary; 503 if AI_ENABLED=false
- [ ] **AI-04**: Ticket detail has "Generate subtasks with AI" button (calls AI-01, populates subtask list for review)
- [ ] **AI-05**: Ticket creation form has "Estimate effort with AI" button (calls AI-02, pre-fills effort field)
- [ ] **AI-06**: Ticket detail has "Summarize progress" button (calls AI-03, shows summary in a panel)
- [ ] **AI-07**: All AI buttons show loading state; errors show a user-visible message (never silently fail)

### Advanced Features (ADV)

- [ ] **ADV-01**: Custom field definitions per workspace: admin can define fields (name, type: text/number/select/date, options)
- [ ] **ADV-02**: Per-ticket custom field values stored as JSONB
- [ ] **ADV-03**: Custom fields displayed and editable on ticket detail
- [ ] **ADV-04**: Ticket dependencies: a ticket can block one or more other tickets
- [ ] **ADV-05**: Moving a blocked ticket out of Backlog is rejected server-side if any blocking dependency is not in Done
- [ ] **ADV-06**: Dependencies shown on ticket detail with link to blocking ticket
- [ ] **ADV-07**: Saved filters: user can save current board filter state with a name, reload it later
- [ ] **ADV-08**: Sprints: admin can create a sprint (name, start_date, end_date)
- [ ] **ADV-09**: Tickets can be assigned to a sprint
- [ ] **ADV-10**: Sprint board shows tickets in that sprint; basic velocity metric (effort_hours completed vs total)
- [ ] **ADV-11**: Simple timeline / Gantt view: read-only, derived from ticket due dates, shows tickets as bars

---

## v2 Requirements

### Notifications

- **NOTIF-01**: User receives in-app notifications when a ticket they own is commented on
- **NOTIF-02**: User receives notification when a ticket is assigned to them
- **NOTIF-03**: Email notification digest (daily/weekly)

### Integrations

- **INTEG-01**: Webhook support (fire event on ticket status change)
- **INTEG-02**: Slack integration (post to channel on ticket move to Done)

### File Hosting

- **FILE-01**: Actual file upload and storage (S3-compatible)
- **FILE-02**: File preview for images

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant / multi-workspace | Single XBO tenant by design; workspace isolation doubles data model complexity |
| External employee access | Platform is AI dev team only; other departments don't have accounts — team submits on their behalf |
| Requester role | Removed; only admin + member roles. External access can be added in v2 if needed |
| Real-time WebSocket (v1) | Polling at 30s intervals sufficient for < 30 users; add when polling latency is measured as a problem |
| SSO / OAuth login | Email + password + JWT sufficient for internal team |
| Native mobile app | Responsive web is sufficient; mobile-specific build not warranted at <30 users |
| Email notifications (v1) | Not blocking MVP; add based on user request after core workflow is validated |
| File hosting / CDN | Link to Google Drive / Notion for files; avoid S3 subsystem complexity in v1 |
| Public-facing ticket URLs | Internal tool only; unauthenticated access not required |
| Automation rules (if-this-then-that) | ClickUp-trap — high complexity, very low early-adopter value |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 — Foundation and Auth | Pending |
| AUTH-02 | Phase 1 — Foundation and Auth | Complete |
| AUTH-03 | Phase 1 — Foundation and Auth | Complete |
| AUTH-04 | Phase 1 — Foundation and Auth | Complete |
| AUTH-05 | Phase 1 — Foundation and Auth | Pending |
| AUTH-06 | Phase 1 — Foundation and Auth | Pending |
| AUTH-07 | Phase 1 — Foundation and Auth | Complete |
| AUTH-08 | Phase 1 — Foundation and Auth | Pending |
| DEPT-01 | Phase 1 — Foundation and Auth | Complete |
| DEPT-02 | Phase 1 — Foundation and Auth | Complete |
| DEPT-03 | Phase 1 — Foundation and Auth | Complete |
| TICKET-01 | Phase 2 — Kanban Core | Complete |
| TICKET-02 | Phase 2 — Kanban Core | Complete |
| TICKET-03 | Phase 2 — Kanban Core | Complete |
| TICKET-04 | Phase 2 — Kanban Core | Complete |
| TICKET-05 | Phase 2 — Kanban Core | Complete |
| TICKET-06 | Phase 2 — Kanban Core | Complete |
| TICKET-07 | Phase 2 — Kanban Core | Complete |
| TICKET-08 | Phase 2 — Kanban Core | Complete |
| TICKET-09 | Phase 2 — Kanban Core | Complete |
| TICKET-10 | Phase 2 — Kanban Core | Complete |
| BOARD-01 | Phase 2 — Kanban Core | Complete |
| BOARD-02 | Phase 2 — Kanban Core | Complete |
| BOARD-03 | Phase 2 — Kanban Core | Complete |
| BOARD-04 | Phase 2 — Kanban Core | Complete |
| BOARD-05 | Phase 2 — Kanban Core | Complete |
| BOARD-06 | Phase 2 — Kanban Core | Complete |
| BOARD-07 | Phase 2 — Kanban Core | Complete |
| BOARD-08 | Phase 2 — Kanban Core | Complete |
| DETAIL-01 | Phase 2 — Kanban Core | Complete |
| DETAIL-02 | Phase 2 — Kanban Core | Complete |
| DETAIL-03 | Phase 2 — Kanban Core | Complete |
| DETAIL-04 | Phase 2 — Kanban Core | Complete |
| DETAIL-05 | Phase 2 — Kanban Core | Complete |
| DETAIL-06 | Phase 2 — Kanban Core | Complete |
| COLLAB-01 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-02 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-03 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-04 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-05 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-06 | Phase 3 — Collaboration and Department Portal | Complete |
| COLLAB-07 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-01 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-02 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-03 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-04 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-05 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-06 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-07 | Phase 3 — Collaboration and Department Portal | Complete |
| PORTAL-08 | Phase 3 — Collaboration and Department Portal | Complete |
| DASH-01 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-02 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-03 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-04 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-05 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-06 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| DASH-07 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-01 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-02 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-03 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-04 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-05 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| ROI-06 | Phase 4 — ROI Estimation and Executive Dashboard | Complete |
| WIKI-01 | Phase 5 — Advanced Features | Pending |
| WIKI-02 | Phase 5 — Advanced Features | Pending |
| WIKI-03 | Phase 5 — Advanced Features | Pending |
| WIKI-04 | Phase 5 — Advanced Features | Pending |
| WIKI-05 | Phase 5 — Advanced Features | Pending |
| ADV-01 | Phase 5 — Advanced Features | Pending |
| ADV-02 | Phase 5 — Advanced Features | Pending |
| ADV-03 | Phase 5 — Advanced Features | Pending |
| ADV-04 | Phase 5 — Advanced Features | Pending |
| ADV-05 | Phase 5 — Advanced Features | Pending |
| ADV-06 | Phase 5 — Advanced Features | Pending |
| ADV-07 | Phase 5 — Advanced Features | Pending |
| ADV-08 | Phase 5 — Advanced Features | Pending |
| ADV-09 | Phase 5 — Advanced Features | Pending |
| ADV-10 | Phase 5 — Advanced Features | Pending |
| ADV-11 | Phase 5 — Advanced Features | Pending |
| AI-01 | Phase 6 — AI Features | Pending |
| AI-02 | Phase 6 — AI Features | Pending |
| AI-03 | Phase 6 — AI Features | Pending |
| AI-04 | Phase 6 — AI Features | Pending |
| AI-05 | Phase 6 — AI Features | Pending |
| AI-06 | Phase 6 — AI Features | Pending |
| AI-07 | Phase 6 — AI Features | Pending |

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 78
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — traceability expanded to per-requirement rows after roadmap creation*
