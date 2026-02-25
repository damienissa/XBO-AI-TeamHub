---
phase: 06-ai-features
plan: 01
subsystem: api
tags: [anthropic, claude, fastapi, pydantic, feature-flag, ai]

# Dependency graph
requires:
  - phase: 05-advanced-features
    provides: Router pattern, AsyncSession/get_db, get_current_user, models (Ticket, TicketComment, TicketSubtask, TicketEvent), /api/config endpoint

provides:
  - POST /api/ai/subtasks — generate subtask list from ticket context (AI-01)
  - POST /api/ai/effort_estimate — return effort hours estimate (AI-02)
  - POST /api/ai/summary — progress summary reading DB comments/subtasks/events (AI-03)
  - GET /api/config now returns ai_enabled boolean
  - AI_ENABLED, ANTHROPIC_API_KEY, AI_MODEL settings with safe defaults

affects: [06-02-frontend-ai-features, future-ai-phases]

# Tech tracking
tech-stack:
  added:
    - anthropic>=0.50 (AsyncAnthropic SDK with structured output via output_config.format)
  patterns:
    - Module-level AsyncAnthropic singleton (reuses httpx connection pool)
    - _require_ai_enabled() guard at top of every AI route returning 503 when disabled
    - Shared _call_claude() helper with unified RateLimitError/APIConnectionError/APIStatusError handling
    - _extract_text_from_tiptap() recursive extractor for Tiptap JSONB -> plain text
    - output_config.format with json_schema for structured subtask/effort responses

key-files:
  created:
    - backend/app/routers/ai.py
    - backend/app/schemas/ai.py
  modified:
    - backend/requirements.txt
    - backend/app/core/config.py
    - backend/app/main.py

key-decisions:
  - "AI_ENABLED: bool = False as default — app starts without ANTHROPIC_API_KEY, no ValidationError"
  - "ANTHROPIC_API_KEY: str = '' as default — pydantic-settings requires a default to avoid startup failure when key absent"
  - "Module-level AsyncAnthropic singleton with timeout=60.0 — overrides 10-min SDK default, reuses connection pool"
  - "All three routes return HTTP 503 with detail when AI_ENABLED=false, not 404 or 501"
  - "Tiptap JSON extracted server-side in summarize_ticket via _extract_text_from_tiptap — keeps frontend schema clean (only ticket_id needed for AI-03)"
  - "output_config.format json_schema for subtasks/effort — enforces JSON shape via constrained decoding; plain text for summary (no schema needed)"
  - "get_db imported from app.core.database (not app.database) — consistent with all other Phase 5 routers"

patterns-established:
  - "Pattern: AI feature flag guard — _require_ai_enabled() called at route entry, raises 503 when disabled"
  - "Pattern: Shared AI call helper — _call_claude(prompt, system, output_config, max_tokens) used by all three routes"
  - "Pattern: Tiptap plain text extraction — _extract_text_from_tiptap(node) for AI prompts reading JSONB problem_statement"

requirements-completed: [AI-01, AI-02, AI-03]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 6 Plan 01: AI Backend Endpoints Summary

**Three Anthropic Claude API endpoints (subtask generation, effort estimation, progress summarization) with AI_ENABLED feature flag, AsyncAnthropic singleton, structured JSON output, and /api/config extension**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T17:00:55Z
- **Completed:** 2026-02-25T17:02:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created three FastAPI AI endpoints under /api/ai/ all gated by AI_ENABLED feature flag returning 503 when disabled
- Extended pydantic-settings Settings class with AI_ENABLED/ANTHROPIC_API_KEY/AI_MODEL with safe defaults so app starts without Anthropic credentials
- Created six Pydantic v2 schemas (SubtaskRequest, SubtaskResponse, EffortRequest, EffortResponse, SummaryRequest, SummaryResponse)
- Extended GET /api/config to return ai_enabled boolean alongside ai_team_hourly_rate for frontend feature-flag reads

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings extension + /api/config update + AI schemas** - `260e004` (feat)
2. **Task 2: AI router with 3 endpoints + register in main.py** - `90e05b7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/routers/ai.py` - Three FastAPI AI endpoints with singleton client, 503 guard, and unified error handling
- `backend/app/schemas/ai.py` - Six Pydantic v2 request/response models for all three AI endpoints
- `backend/app/core/config.py` - AI_ENABLED, ANTHROPIC_API_KEY, AI_MODEL settings added
- `backend/app/main.py` - ai_router registered; /api/config extended with ai_enabled
- `backend/requirements.txt` - anthropic>=0.50 added

## Decisions Made
- `get_db` imported from `app.core.database` (not `app.database`) — discovered from reading wiki.py and dependencies.py; plan comment said "from app.database import get_db" but actual project path is app.core.database
- `output_config` parameter dict uses nested key (`{"output_config": {...}}`) that unpacks correctly via `**output_config` in `messages.create()` call — follows research pattern
- Summary endpoint (AI-03) reads comments, subtasks, events from DB via separate `select()` queries (not relationship loading) since Ticket relationships have `lazy="raise"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected get_db import path**
- **Found during:** Task 2 (AI router creation)
- **Issue:** Plan's router code specified `from app.database import get_db` but the actual project uses `from app.core.database import get_db` (confirmed by reading wiki.py and dependencies.py)
- **Fix:** Used `from app.core.database import get_db` in ai.py
- **Files modified:** backend/app/routers/ai.py
- **Verification:** `python3 -c "from app.routers.ai import router"` succeeded with no ImportError
- **Committed in:** 90e05b7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - import path bug)
**Impact on plan:** Necessary correction for correct import path. No scope creep.

## Issues Encountered
- Local environment has anthropic 0.18.1 (pre-structured-output version). Import-only verifications pass fine since `output_config` is just a dict kwarg. The Docker container will install anthropic>=0.50 (latest 0.84.0) from requirements.txt when rebuilt, which supports `output_config.format`.

## User Setup Required

**External services require manual configuration before AI features work:**
- `ANTHROPIC_API_KEY` — Get from Anthropic Console (console.anthropic.com) → API Keys → Create Key
- `AI_ENABLED=true` — Set in .env to enable AI features (default false; app runs without it)
- `AI_MODEL` — Optional. Defaults to `claude-haiku-4-5`. Override with `claude-sonnet-4-6` for higher quality.

After adding to .env, restart the backend container: `docker compose restart backend`

## Next Phase Readiness
- Backend AI endpoints ready for Plan 06-02 frontend integration
- All three routes verified to import cleanly and register at correct paths
- 503 feature-flag behavior confirmed in code; actual 503 response will be testable after Docker rebuild with anthropic>=0.50
- No DB migrations required — AI results are stateless and never persisted

## Self-Check: PASSED

- FOUND: backend/app/routers/ai.py
- FOUND: backend/app/schemas/ai.py
- FOUND: backend/app/core/config.py (modified)
- FOUND: backend/app/main.py (modified)
- FOUND: backend/requirements.txt (modified)
- FOUND: .planning/phases/06-ai-features/06-01-SUMMARY.md
- FOUND commit: 260e004 (Task 1)
- FOUND commit: 90e05b7 (Task 2)

---
*Phase: 06-ai-features*
*Completed: 2026-02-25*
