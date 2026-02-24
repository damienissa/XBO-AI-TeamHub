# Feature Landscape

**Domain:** Internal task management platform (replacing Trello/Monday/Asana/ClickUp/Notion)
**Project:** XBO AI TeamHub
**Researched:** 2026-02-24
**Confidence:** MEDIUM — Web and Context7 access unavailable; analysis drawn from PROJECT.md requirements and training-data knowledge of Trello/Monday/Asana/ClickUp/Notion feature sets (knowledge cutoff August 2025). Core feature categorizations are well-established and unlikely to have shifted materially.

---

## Table Stakes

Features users expect from any task management tool. Missing = product feels broken or incomplete, users revert to spreadsheets or the SaaS tool being replaced.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Kanban board with drag-and-drop | Trello established this as the baseline UX for visual task tracking; anything without it feels archaic | Medium | Five columns: Backlog, Discovery, In Progress, Review/QA, Done. Use `@hello-pangea/dnd` or `dnd-kit` |
| Card creation with title + description | Absolute baseline — every tool has this | Low | Rich text editor for problem statement/notes |
| Task status / column assignment | Users need to know where a ticket is in the workflow | Low | Column IS the status in this design — clean single source of truth |
| Owner assignment | Accountability is the #1 reason teams adopt task tools over email | Low | Owner prompt when moving out of Backlog is a smart UX decision |
| Due dates | Without due dates there is no urgency signal; overdue detection requires it | Low | Stored as date field; overdue derived at query time |
| Priority / urgency field | Users need to triage across ticket volume | Low | Urgency enum (Critical/High/Medium/Low) covers this |
| Filtering and search | At 30+ tickets, unfiltered boards become unusable | Medium | Filter by owner, department, urgency, date range, aging |
| Activity log / audit trail | "Who changed this and when?" is asked within the first week of any deployment | Medium | Event sourcing on ticket actions: created, moved, assigned, edited |
| Comments / threaded discussion | Async communication on the work item itself, not Slack/email | Medium | Chat thread on ticket detail |
| Subtasks / checklist | Most tasks decompose; teams expect to track sub-steps | Medium | Subtasks checklist with reorder + done toggle |
| User roles and access control | Minimum viable: admin vs regular user; prevents accidental destruction | Low | Three roles: admin, member, requester |
| Department / team grouping | Internal tools that span teams need org-unit separation | Low | Seven fixed departments seeded at startup |
| Basic reporting / overview | "How many tickets are open right now?" must be answerable at a glance | Medium | KPI cards: open count, throughput, overdue count |

---

## Differentiators

Features that set this product apart from a plain Kanban board. Not expected by every user, but create strong retention and justify the switch from SaaS tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ROI estimation on tickets | Turns "someone requested a thing" into "this request saves $X/year" — makes prioritization data-driven instead of political | High | Inputs: time cost, employees affected, hourly rate, error rate, revenue blocked, strategic value. Computed: weekly_cost, annual_savings, roi, adjusted_roi |
| Executive KPI dashboard | Gives leadership a single-screen answer to "what is the team working on, where are bottlenecks, what is cycle time" | Medium | Throughput, avg cycle time, avg time per column, bottleneck column, workload per user, department breakdown |
| Department portal (request submission) | Requesters who don't manage tickets still need a structured intake form — prevents free-text Slack requests | Medium | Per-department form with ROI inputs + ticket templates |
| Column time tracking (cycle time analytics) | "How long did this ticket sit in Review?" is the single most actionable bottleneck signal; none of the free tools surface it clearly | High | entered_at / exited_at timestamps per column per ticket; aggregate into avg_time_per_column |
| Ticket templates | Reduces friction for recurring request types; improves field completion rates | Medium | Template CRUD at workspace level; "create from template" on portal form |
| AI-powered subtask generation | Turns a vague ticket description into a concrete work breakdown in seconds | High | POST /ai/subtasks using Claude API; feature-flagged; requires good prompt engineering |
| AI effort estimation | Removes the subjective guesswork from story pointing; produces defensible estimates | High | POST /ai/effort_estimate; uses ticket fields + historical context |
| AI ticket summary | "Catch me up on this ticket" for executives or returning team members | Medium | POST /ai/summary synthesizing comments + subtasks + events |
| Wiki / docs linked to tickets | Keeps reference documentation co-located with the work — prevents "where is that spec?" | Medium | Wiki CRUD with rich text; linkable from ticket detail |
| Ticket dependencies (blocking) | Prevents premature column moves; surfaces "this is blocked by X" explicitly | Medium | Many-to-many blocking relationship; enforced at column transition |
| Saved filters per user | Power users build personal views; without this they re-apply filters every session | Low | Persisted filter state in user preferences |
| Custom fields (JSON schema) | Different departments have different metadata needs; without this, teams add workarounds | High | Workspace-level schema definition; per-ticket values stored as JSONB |
| Sprint support with velocity metrics | Dev teams expect sprint cadences; velocity gives capacity planning signal | Medium | Sprint CRUD, ticket-sprint assignment, velocity chart |
| Gantt / timeline view from due dates | High-stakes projects need a visual timeline; executives expect it | High | Read-only Gantt derived from due dates; no interactive scheduling required in v1 |

---

## Anti-Features

Features to deliberately NOT build. These kill adoption through complexity, maintenance burden, or scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-tenant / workspace isolation | XBO is single-tenant; adding workspace isolation doubles the data model complexity, forces every query to be scoped, and adds auth surface area with no benefit | Single-tenant by design; enforce at infrastructure level |
| SSO / OAuth login | For < 30 internal users, identity provider dependency adds setup friction and failure modes | Email + password + JWT is sufficient; add SSO only if IT mandates it |
| Real-time WebSocket (v1) | At < 30 users with low concurrency, WebSocket infrastructure (connection management, reconnect logic, pub/sub) adds significant complexity for minimal gain | Polling on 10-30s interval; add WS in a future phase when concurrent editing is proven necessary |
| File hosting / CDN | Binary storage (S3, CDN config, presigned URLs, MIME type handling, virus scanning) is a full subsystem; teams rarely need file storage for internal task tracking | Store filename + size as metadata stub; link to existing file storage (Google Drive, etc.) |
| Native mobile app | Internal tools used at desks do not need native apps; they add a separate build pipeline, app store deployment, and maintenance overhead | Responsive web is sufficient; PWA installability can be added later cheaply |
| Email / Slack notifications (v1) | Notification systems require transactional email infrastructure, unsubscribe handling, and spam risk; adds ops complexity | Users check the dashboard; notifications can be Phase 2 once usage patterns are established |
| Public-facing / external access | Exposing internal tooling to external users introduces security surface area and requires tenant isolation | Internal network / VPN only; no external auth flows |
| Advanced automation rules (Zapier-style) | Rule engines (if-this-then-that triggers) are notoriously complex to build correctly and maintain | Use AI features for intelligent suggestions instead; no automation engine in v1 |
| Time tracking / billing (Toggl-style) | XBO is not a client-billing agency; effort estimates serve planning, not invoicing | ROI estimation covers the planning use case; actual time tracking adds friction with no clear XBO use case |
| Resource / capacity planning (Gantt scheduling) | Interactive drag-to-schedule Gantt charts are one of the hardest UX problems in project management software | Read-only timeline from due dates is sufficient; do not build scheduling logic |
| Embeds / integrations marketplace | Building an integration layer (webhooks, app directory, OAuth flows) requires its own product investment | Focus on core utility; add specific integrations (e.g., GitHub issues) only when validated |
| Per-project board proliferation | ClickUp/Notion allow infinite board/space nesting; this creates organizational chaos and "where does this live?" confusion | Fixed workflow: department portals feed one shared Kanban; structure comes from department + status, not board hierarchy |

---

## Feature Dependencies

```
Auth & Roles
  → All other features (authentication gates everything)

Departments (seeded)
  → Department Portal (portal is per-department)
  → Kanban card department badge
  → Executive dashboard department breakdown

Tickets (core model)
  → Kanban Board (cards are tickets)
  → Ticket Detail (detail view of a ticket)
  → Column Time Tracking (timestamps on ticket)
  → ROI Estimation (fields on ticket)
  → Subtasks (children of ticket)
  → Comments (thread on ticket)
  → Activity Log (events on ticket)
  → Dependencies (edges between tickets)
  → Wiki links (reference from ticket)

Ticket Detail
  → AI Subtask Generation (reads ticket fields)
  → AI Effort Estimation (reads ticket fields)
  → AI Summary (reads comments + subtasks + events)

Column Time Tracking (entered_at/exited_at per column)
  → Executive Dashboard avg_time_per_column
  → Executive Dashboard bottleneck_column
  → Executive Dashboard avg_cycle_time

ROI Estimation (fields on ticket)
  → Department Portal ROI inputs
  → Executive Dashboard (potential ROI surface)

Ticket Templates
  → Department Portal "create from template"

Sprint (sprint model)
  → Velocity metrics (requires sprint + ticket assignment)

Gantt View
  → Due dates on tickets (dependency)
  → Read-only; no scheduling engine dependency
```

---

## MVP Recommendation

For an internal tool with < 30 users, the MVP must prove the core loop: **request submitted → tracked on board → completed with accountability → ROI visible to executives.**

Prioritize in this order:

1. **Auth + Roles** — gates everything; must be first
2. **Kanban Board (5 columns, drag-and-drop)** — the visible heart of the product
3. **Ticket Detail** (all fields: urgency, business impact, success criteria, effort, next step, due date) — data quality from day one
4. **Column Time Tracking** — the key differentiator over Trello; cheap to add early, expensive to retrofit
5. **Department Portal** (submission form + templates) — requesters need intake without board access
6. **ROI Estimation Panel** — the explicit "why we built this instead of using Trello" moment for leadership
7. **Executive Dashboard** (KPI cards) — makes leadership buy-in immediate

Defer to later phases:

- **AI features** (feature-flagged; add after core workflow is stable and real ticket data exists for prompt context)
- **Wiki/Docs** (valuable but not blocking core workflow)
- **Dependencies** (adds complexity; valid once ticket volume is high enough to need blocking logic)
- **Sprints + Velocity** (add when dev team requests cadence management)
- **Custom Fields** (add when departments report missing metadata needs — avoid premature schema flexibility)
- **Gantt View** (add when executives explicitly request timeline visualization)
- **Saved Filters** (quick win, low complexity, add in same phase as filtering)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes | HIGH | These are well-established expectations across Trello/Monday/Asana/ClickUp/Notion; training data is solid here |
| Differentiators | MEDIUM | ROI tracking, cycle time analytics, and AI features are based on the explicit PROJECT.md requirements; the value propositions are sound but user adoption rates are unverified |
| Anti-features | MEDIUM | Based on known failure modes of similar internal tools and the explicit Out of Scope decisions in PROJECT.md |
| Feature dependencies | HIGH | Derived directly from the data model described in PROJECT.md; these are architectural facts, not opinions |
| MVP ordering | MEDIUM | Reflects standard "prove the core loop first" product reasoning; actual priority may shift based on stakeholder feedback |

---

## Sources

- `/Users/charleskr/Desktop/XBO/XBO-AI-TeamHub/.planning/PROJECT.md` — Primary source for XBO-specific requirements, constraints, and out-of-scope decisions (HIGH confidence)
- Training data: Trello, Asana, Monday.com, ClickUp, Notion feature sets as of August 2025 (MEDIUM confidence — web verification unavailable in this session)
- Training data: Common pitfalls in internal tool adoption, project management software design patterns (MEDIUM confidence)
