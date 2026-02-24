# XBO AI TeamHub

## What This Is

XBO AI TeamHub is an internal task management platform that replaces paid SaaS tools (Trello, Monday, Asana, ClickUp, Notion) with a single self-hosted system tailored to XBO's departments and workflows. It gives every team a unified Kanban workspace, executive KPI dashboards, ROI estimation on requests, and optional AI-powered planning — all under XBO's own infrastructure.

Deployed to cloud (AWS/GCP/Azure), single-tenant (XBO only), serving < 30 users across 7 departments.

## Core Value

Every XBO request has a tracked lifecycle from Backlog to Done — with owner accountability, ROI justification, and zero SaaS subscription cost.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Auth & Users**
- [ ] Email/password registration and login with JWT
- [ ] Three roles: admin, member, requester
- [ ] Protected routes; role-based access enforcement

**Departments**
- [ ] Seven fixed departments: cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr
- [ ] Department portal: each department can submit ticket requests

**Kanban Board**
- [ ] Five columns: Backlog, Discovery, In Progress, Review/QA, Done
- [ ] Backlog tickets have no owner (owner_id = null enforced)
- [ ] Moving a ticket out of Backlog prompts to assign an owner, then persists it
- [ ] Drag-and-drop card movement between columns
- [ ] Card shows: department badge, title, owner initials, due date, time in column, next step, urgency, business impact, effort estimate
- [ ] Filters: owner, department, created date range, due date range, urgency/priority, aging/time in column, status
- [ ] Column time tracking (entered/exited timestamps per column per ticket)

**Ticket Detail**
- [ ] Fields: title, problem statement, urgency, business impact, success criteria, effort estimate, due date, next step, status column
- [ ] Rich text editor for problem statement / notes
- [ ] Subtasks checklist with reorder and done/undone toggle
- [ ] Comments / chat thread
- [ ] Activity timeline rendered from ticket events (created, moved, assigned, edited)
- [ ] Full column history viewable

**Executive Dashboard**
- [ ] KPI cards: open tickets, throughput (done/week), avg cycle time, avg time per column, bottleneck column, overdue count
- [ ] Workload per user (sum of effort_hours on active tickets)
- [ ] Department breakdown table

**ROI Estimation**
- [ ] Inputs on ticket creation: current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate (optional), revenue_blocked (optional), strategic_value (1–5)
- [ ] Computed fields: weekly_cost, yearly_cost, expected_savings_rate, annual_savings, dev_cost, roi, risk_probability, adjusted_roi
- [ ] ROI panel displayed on ticket detail

**Department Portal**
- [ ] Per-department submission form with all ticket fields + ROI inputs
- [ ] Attachment metadata stub (store filename/size, no file hosting in v1)
- [ ] Ticket templates: create template, create ticket from template

**Advanced Features**
- [ ] Custom fields: workspace-level JSON schema + per-ticket values
- [ ] Saved filters per user
- [ ] Dependencies: block ticket move if blocking dependencies not Done
- [ ] Sprints: create sprint, assign tickets, basic velocity metrics
- [ ] Simple Gantt/timeline view from due dates

**Wiki / Docs**
- [ ] Wiki pages CRUD with rich text content
- [ ] Permissions: read for all roles, write for admin/member
- [ ] Linkable from ticket detail

**AI Features (feature-flagged)**
- [ ] /ai/subtasks — generate subtask roadmap from ticket fields
- [ ] /ai/effort_estimate — estimate effort hours from ticket fields
- [ ] /ai/summary — summarize ticket progress from comments + subtasks + events
- [ ] All AI endpoints gated by AI_ENABLED env flag (disabled in local dev by default)

### Out of Scope

- Multi-tenant / multi-workspace support — XBO single-tenant only
- Native mobile app — web-first
- Real-time WebSocket — polling first, WS added later if needed
- File hosting/CDN for attachments — metadata only in v1
- SSO / OAuth login — email/password sufficient for v1
- Email notifications — not in initial scope
- Public-facing access — internal only

## Context

- **Monorepo**: `/backend` (FastAPI) + `/frontend` (Next.js)
- **Database**: PostgreSQL via Docker Compose locally, managed RDS or equivalent in cloud
- **ORM**: SQLAlchemy + Alembic migrations
- **Departments fixed at seed time**: cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr
- **Test stack**: pytest (backend), Jest/Vitest (frontend)
- **AI**: Claude API behind AI_ENABLED flag

## Constraints

- **Tech Stack**: FastAPI + PostgreSQL + SQLAlchemy + Alembic + Next.js + TypeScript + Tailwind — locked per eng requirements
- **Auth**: JWT, no third-party auth provider
- **Secrets**: No hardcoded API keys or credentials; env vars only
- **Migration safety**: All schema changes via Alembic, never manual DDL
- **Incremental delivery**: Each phase must leave the codebase runnable
- **Cloud deployment**: Docker Compose for local dev; cloud-ready containers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-tenant architecture | XBO internal only; simpler data model, no workspace isolation needed | — Pending |
| Polling over WebSocket initially | Reduces complexity for v1; < 30 users means polling overhead is negligible | — Pending |
| JWT auth (no SSO) | Sufficient for internal team; avoids identity provider dependency | — Pending |
| AI behind feature flag | Allows local dev without API keys; production enables Claude | — Pending |
| ROI stored on ticket | First-class field, not a separate service — simpler queries | — Pending |

---
*Last updated: 2026-02-24 after initialization*
