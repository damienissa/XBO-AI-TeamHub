# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Every XBO request has a tracked lifecycle from Backlog to Done — with owner accountability, ROI justification, and zero SaaS subscription cost.
**Current focus:** Phase 1 — Foundation and Auth

## Current Position

Phase: 1 of 6 (Foundation and Auth)
Plan: 3 of 3 in current phase
Status: Phase 1 complete
Last activity: 2026-02-25 — Completed plan 01-03 (Next.js frontend, two-layer auth guard, login page, sidebar, session flow)

Progress: [███░░░░░░░] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 19.3 min
- Total execution time: 0.95 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-auth | 3 | 58 min | 19.3 min |

**Recent Trend:**
- Last 5 plans: 6 min, 7 min, 45 min
- Trend: increasing (01-03 was frontend scaffold, larger scope)

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6 planning]: Needs `/gsd:research-phase` before planning — Claude API structured output format for subtask extraction and effort estimation prompts are not reliably covered by training data
- [Phase 5 planning, optional]: If custom fields JSONB schema grows complex (nested types, per-department schemas), consider additional research before planning

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 01-foundation-and-auth/01-03-PLAN.md — Next.js 14 App Router frontend, jose middleware auth guard, verifySession() DAL, LoginForm with inline errors, AppSidebar with 7 departments and Server Action logout. All 8 human verification checks passed. Phase 1 complete.
Resume file: None
