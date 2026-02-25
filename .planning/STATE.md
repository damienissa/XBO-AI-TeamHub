# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Every XBO request has a tracked lifecycle from Backlog to Done — with owner accountability, ROI justification, and zero SaaS subscription cost.
**Current focus:** Phase 4 — ROI Estimation and Executive Dashboard

## Current Position

Phase: 4 of 6 (ROI Estimation and Executive Dashboard)
Plan: 2 of 3 in current phase — COMPLETE
Status: Plan 04-02 complete — RoiPanel.tsx component; TicketDetailModal extended with always-visible ROI section; Ticket interface updated with 14 ROI fields
Last activity: 2026-02-25 — Completed plan 04-02 (ROI panel component + ticket detail integration)

Progress: [███████████████] 70%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 9.0 min
- Total execution time: 1.36 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-auth | 3 | 58 min | 19.3 min |
| 02-kanban-core | 4 | 16 min | 4.0 min |
| 03-collaboration-and-department-portal | 4 | 21 min | 5.25 min |
| 04-roi-estimation-and-executive-dashboard | 2 | 5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 4 min, 1 min, 3 min, 3 min, 2 min
- Trend: fast

*Updated after each plan completion*
| Phase 03-collaboration-and-department-portal P04 | 3 | 2 tasks | 3 files |
| Phase 04-roi-estimation-and-executive-dashboard P01 | 3 | 3 tasks | 6 files |
| Phase 04-roi-estimation-and-executive-dashboard P02 | 2 | 2 tasks | 3 files |

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
- [Phase 03-02]: Nested DndContext for subtask drag in SubtaskSection — completely isolated from Kanban board DndContext; no stopPropagation needed (RESEARCH.md Pitfall 1 fix)
- [Phase 03-02]: Board subtask counts via batch GROUP BY subquery — single query for all ticket_ids, no selectinload full rows (RESEARCH.md Pitfall 3 fix)
- [Phase 03-02]: fetchMe() in CommentSection via useQuery(['me'], staleTime 60s) — avoids prop-drilling current user down from TicketDetailModal; clean separation of concerns
- [Phase 03-02]: @radix-ui/react-alert-dialog installed; alert-dialog.tsx created as shadcn wrapper — used for comment delete confirm; available for future destructive actions
- [Phase 03]: valueAsNumber instead of z.coerce for number inputs: zod v4 coerce outputs unknown in resolver generics; valueAsNumber keeps field types as number natively
- [Phase 03]: problem_statement typed as z.unknown().optional(): Tiptap outputs arbitrary JSON; z.record() requires explicit key/value types
- [Phase 03-04]: TiptapEditor uses initialContent/onSave props not content/onChange — named export from board subdirectory (auto-fixed Rule 1 during Task 1 build)
- [Phase 03-04]: Template selector in QuickAddInput conditionally rendered (hasTemplates guard); pre-fills title via React state (no react-hook-form in QuickAddInput)
- [Phase 04-01]: compute_roi_fields() is a pure Python function (no ORM dependency) — fully testable in isolation; called from PATCH handler via _ROI_INPUT_FIELDS frozenset intersection check
- [Phase 04-01]: ROI-05 guard: dev_cost==0 yields roi=NULL via explicit check before division (not try/except ZeroDivisionError)
- [Phase 04-01]: Portal .refine() requires all three Row 1 ROI fields together (hours/employees/avg_hourly_cost) per ROI-06 — partial group submission not allowed
- [Phase 04-01]: effort_estimate included in _ROI_INPUT_FIELDS trigger set — dev_cost formula depends on it; ROI recomputes when effort changes
- [Phase 04-02]: RoiPanel always-visible in TicketDetailModal — no accordion, no conditional render, placed between SubtaskSection and Activity Timeline
- [Phase 04-02]: Live preview uses draft state for weekly/yearly/annual costs; ROI and adjusted_roi are display-only from server (require effort_estimate outside RoiPanel scope)
- [Phase 04-02]: draft resets via useEffect([ticket]) after PATCH completes — server values replace local draft preventing stale display

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6 planning]: Needs `/gsd:research-phase` before planning — Claude API structured output format for subtask extraction and effort estimation prompts are not reliably covered by training data
- [Phase 5 planning, optional]: If custom fields JSONB schema grows complex (nested types, per-department schemas), consider additional research before planning

## Session Continuity

Last session: 2026-02-25
Stopped at: 04-roi-estimation-and-executive-dashboard/04-02-PLAN.md — COMPLETE. RoiPanel component and TicketDetailModal integration done.
Resume file: None
