# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Every XBO request has a tracked lifecycle from Backlog to Done — with owner accountability, ROI justification, and zero SaaS subscription cost.
**Current focus:** Phase 3 — Collaboration and Department Portal

## Current Position

Phase: 3 of 6 (Collaboration and Department Portal)
Plan: 1 of 4 in current phase
Status: Plan 03-01 complete — collaboration backend (comments, subtasks, templates) with migration
Last activity: 2026-02-25 — Completed plan 03-01 (3 new ORM models, 3 new routers, Alembic migration 93dab7e5b92c applied at head)

Progress: [████████░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 9.9 min
- Total execution time: 1.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-auth | 3 | 58 min | 19.3 min |
| 02-kanban-core | 4 | 16 min | 4.0 min |
| 03-collaboration-and-department-portal | 1 | 3 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 45 min, 6 min, 4 min, 1 min, 3 min
- Trend: fast

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: Single-tenant architecture — XBO internal only; simpler data model
- [Pre-phase]: Polling over WebSocket — reduces v1 complexity; TanStack Query refetchInterval
- [Pre-phase]: JWT in httpOnly cookie — not localStorage; prevents XSS account takeover
- [Pre-phase]: AI behind AI_ENABLED env flag — local dev runs without API keys
- [Pre-phase]: ROI stored on ticket — first-class field, not a separate service
- [Phase 01-01]: pwdlib uses PasswordHash.recommended() not PasswordHasher() — the plan sample code had the wrong class name; corrected during seed execution
- [Phase 01-01]: Frontend placeholder uses alpine:tail -f /dev/null so docker compose up succeeds before plan 01-03 builds the real Next.js frontend
- [Phase 01-01]: DATABASE_URL set via Docker Compose environment block (not just env_file) so correct asyncpg URL is available inside backend container
- [Phase 01-02]: pwdlib ph.verify() takes (password, hash) order — plan sample had them swapped; auto-fixed during Task 2 test run
- [Phase 01-02]: NullPool required for pytest asyncpg test engines to avoid cross-event-loop errors in pytest-asyncio 1.3.0 + anyio 4.12.1
- [Phase 01-02]: asyncio_mode=auto (pyproject.toml) used instead of @pytest.mark.anyio — avoids anyio TestRunner creating isolated event loops that conflict with fixture teardown
- [Phase 01-02]: httpx per-request cookies= requires plain dict not httpx.Cookies object (deprecated) — use dict(response.cookies) in tests
- [Phase 01-03]: jose used in middleware (not jsonwebtoken) — edge runtime requires ESM-compatible crypto
- [Phase 01-03]: Server Action used for logout — httpOnly cookie deletion requires server-side; client-side fetch cannot clear them
- [Phase 01-03]: COOKIE_SECURE defaults false — allows local HTTP dev; set COOKIE_SECURE=true in production
- [Phase 01-03]: Split NEXT_PUBLIC_API_URL (browser) vs INTERNAL_API_URL (server/Docker) — localhost:8000 unreachable inside Docker network for server-side fetches
- [Phase 02-01]: values_callable on SQLAlchemy sa.Enum forces .value storage ("In Progress"/"Review/QA") not .name ("InProgress"/"ReviewQA") — critical for correct DB storage and frontend compatibility
- [Phase 02-01]: lazy="raise" on Ticket.owner and Ticket.department — forces explicit selectinload on all callers; prevents silent N+1 regressions
- [Phase 02-01]: db.flush() in create_ticket before ColumnHistory/TicketEvent INSERT — gets ticket.id without committing so all three writes are in one transaction
- [Phase 02-02]: DragOverlay always mounted unconditionally; children null when no active drag (RESEARCH.md anti-pattern guard)
- [Phase 02-02]: pendingMove state for Backlog->other unowned drags; no optimistic update before owner confirmation; cancel = zero state reset needed
- [Phase 02-02]: useDraggable skipped when isOverlay=true on KanbanCard to prevent infinite re-render in DragOverlay
- [Phase 02-02]: dialog.tsx, popover.tsx, command.tsx created as missing shadcn UI primitives required by OwnerModal
- [Phase 02-03]: useBoard owns filter state via useQueryStates internally — no filter props needed; queryKey includes filterParams for reactive re-fetch
- [Phase 02-03]: TicketDetailModal mounted once in KanbanBoard, not per-card — single Dialog.Root controlled by nuqs ?ticket= param
- [Phase 02-03]: TiptapEditor immediatelyRender: false — required for Next.js 14 SSR; prevents hydration mismatch (RESEARCH.md Pattern 6)
- [Phase 02-03]: KanbanCard useQueryState hook applied via ternary when isOverlay=true — matches existing useDraggable pattern in same file
- [Phase 03-01]: User.full_name used in CommentOut.author_name — User model has single full_name column not split first_name/last_name fields
- [Phase 03-01]: ROI stub columns only (hours_saved_per_month, cost_savings_per_month, revenue_impact) — Phase 4 adds full ROI-01 computed fields in separate migration per CONTEXT.md
- [Phase 03-01]: GET /api/config (no auth) exposes AI_TEAM_HOURLY_RATE for frontend live ROI calculation; added in Phase 3 alongside comment/subtask/template routers
- [Phase 03-01]: Subtask delete resequences positions 0..N-1 in same transaction — prevents gaps that cause off-by-one errors on subsequent reorders (RESEARCH.md Pitfall 2)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6 planning]: Needs `/gsd:research-phase` before planning — Claude API structured output format for subtask extraction and effort estimation prompts are not reliably covered by training data
- [Phase 5 planning, optional]: If custom fields JSONB schema grows complex (nested types, per-department schemas), consider additional research before planning

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 03-collaboration-and-department-portal/03-01-PLAN.md — collaboration backend: 3 ORM models, 3 routers, Alembic migration 93dab7e5b92c. Ready for Plan 03-02.
Resume file: None
