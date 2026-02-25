---
phase: 01-foundation-and-auth
plan: "02"
subsystem: auth
tags: [jwt, pyjwt, pwdlib, argon2, fastapi, sqlalchemy, httponly-cookie, pytest, asyncpg]

# Dependency graph
requires:
  - phase: 01-01
    provides: User model with token_version column, Department model, async DB engine, get_db dependency, conftest.py test fixtures

provides:
  - Six FastAPI auth endpoints: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout, POST /api/auth/refresh, POST /api/auth/users (admin), PATCH /api/auth/users/{id}/role (admin)
  - JWT security layer: create_access_token, create_refresh_token, decode_token in backend/app/core/security.py
  - httpOnly cookie management: set_auth_cookies (configurable SameSite via COOKIE_SAMESITE env var), clear_auth_cookies
  - get_current_user FastAPI dependency with token_version enforcement (AUTH-08)
  - require_admin FastAPI dependency (403 if not admin role)
  - Auth service: authenticate_user (generic error per CONTEXT.md), create_user, refresh_tokens (sliding window), invalidate_user_tokens
  - Pydantic v2 schemas: LoginRequest (plain str email), UserCreate, UserOut, RoleUpdate
  - pytest test suite: 16 tests covering full auth contract (AUTH-01 through AUTH-08, DEPT-03)

affects:
  - 01-03 (Next.js frontend calls these endpoints: POST /login, GET /me, POST /logout, POST /refresh)
  - all subsequent phases (get_current_user dependency used by all protected endpoints)

# Tech tracking
tech-stack:
  added: []  # All libraries already in requirements.txt from 01-01 (pyjwt, pwdlib[argon2])
  patterns:
    - JWT access token (15 min TTL) + refresh token (7 days TTL) in httpOnly cookies, SameSite configurable via settings.COOKIE_SAMESITE
    - Sliding window refresh: every /refresh call issues new access + refresh tokens
    - token_version enforcement: get_current_user rejects any token where payload.token_version != user.token_version in DB
    - Refresh cookie scoped to path="/api/auth/refresh" — browser only sends it on that one endpoint
    - Generic "Invalid email or password" for all login failures — never reveals which field was wrong (CONTEXT.md locked)
    - NullPool for pytest asyncpg engines — prevents "Future attached to a different loop" errors

key-files:
  created:
    - backend/app/core/security.py
    - backend/app/dependencies.py
    - backend/app/services/__init__.py
    - backend/app/services/auth.py
    - backend/app/schemas/auth.py
    - backend/app/routers/auth.py
    - backend/tests/test_auth.py
    - backend/tests/test_departments.py
  modified:
    - backend/app/main.py (added auth_router include)
    - backend/tests/conftest.py (added seeded_db fixture, NullPool engine per test)

key-decisions:
  - "pwdlib ph.verify(password, hash) argument order — plan sample code had them swapped (ph.verify(hash, password)); fixed to correct API signature"
  - "NullPool required for pytest asyncpg test engines — prevents RuntimeError: Future attached to a different loop when anyio creates fresh event loop per test"
  - "asyncio_mode=auto from pyproject.toml used instead of @pytest.mark.anyio decorators — avoids anyio TestRunner creating its own isolated event loop that conflicts with fixture teardown"
  - "extract_cookies(response) helper returns dict(response.cookies) — httpx deprecated passing httpx.Cookies objects as per-request cookies; plain dict works correctly"
  - "settings.COOKIE_SAMESITE env var controls SameSite attribute — defaults to strict per CONTEXT.md locked decision, can be set to lax for local dev with different ports"

patterns-established:
  - "Pattern: get_current_user reads access_token cookie, decodes JWT, checks token_version against DB row — all protected endpoints use this dependency"
  - "Pattern: require_admin depends on get_current_user, raises 403 if role != admin — keeps role check DRY"
  - "Pattern: Refresh cookie scoped to /api/auth/refresh — browser sends it only to that endpoint, not every API call"
  - "Pattern: pytest conftest uses NullPool per-function engine + seeded_db fixture for integration tests"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07
  - AUTH-08
  - DEPT-03

# Metrics
duration: 7min
completed: 2026-02-25
---

# Phase 1 Plan 02: Auth Endpoints Summary

**Six FastAPI auth endpoints with PyJWT httpOnly cookie auth, token_version invalidation, admin role enforcement, and 16-test pytest suite — all requirements AUTH-01 through AUTH-08 complete**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-25T06:12:42Z
- **Completed:** 2026-02-25T06:20:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Full auth layer: POST /login sets httpOnly access + refresh cookies; GET /me reads access cookie; POST /logout clears both; POST /refresh does sliding window rotation
- Admin endpoints: POST /users (admin-only create); PATCH /users/{id}/role (admin-only role change, increments token_version for immediate invalidation per AUTH-08)
- Security dependency chain: get_current_user decodes JWT + verifies token_version against DB; require_admin enforces role; any mismatch → 401/403
- pytest test suite: 16 tests, 0 failures — covers every entry in the auth contract (login OK/bad-pass/unknown-email, /me with/without cookie, logout, admin create, member blocked, role change, token version invalidation, refresh, departments)

## Task Commits

Each task was committed atomically:

1. **Task 1: Security utilities, auth service, FastAPI dependencies, and Pydantic schemas** - `36b194f` (feat)
2. **Task 2: Auth router endpoints and pytest test suite** - `9db7770` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/core/security.py` - JWT create/decode, set_auth_cookies (httpOnly + SameSite from settings), clear_auth_cookies, get_access_token_from_request
- `backend/app/dependencies.py` - get_current_user (cookie → decode → token_version check), require_admin (403 if not admin)
- `backend/app/services/auth.py` - authenticate_user, create_user, refresh_tokens (sliding window), invalidate_user_tokens
- `backend/app/schemas/auth.py` - LoginRequest (plain str email), UserCreate, UserOut, RoleUpdate
- `backend/app/services/__init__.py` - Package init
- `backend/app/routers/auth.py` - All six endpoints with proper dependency injection
- `backend/app/main.py` - Added auth_router include_router call
- `backend/tests/conftest.py` - Added seeded_db fixture (7 depts + admin@xbo.com), NullPool per-function engine
- `backend/tests/test_auth.py` - 13 auth tests covering full contract
- `backend/tests/test_departments.py` - 3 department tests for DEPT-03

## Decisions Made

- Used `PasswordHash.recommended()` (consistent with Plan 01-01 deviation fix) — the plan's sample code still showed `PasswordHasher()` which doesn't exist in pwdlib
- pwdlib `ph.verify()` takes `(password, hash)` order — plan sample had arguments swapped; fixed automatically
- NullPool for test engines: asyncpg connections cannot be reused across event loops; NullPool creates a fresh connection per query and disposes cleanly
- Removed `@pytest.mark.anyio` decorators from tests — `asyncio_mode = "auto"` in pyproject.toml handles all async test functions with a consistent event loop per test function
- Cookie extraction in tests: httpx deprecated `cookies=<Cookies object>` per-request; using `dict(response.cookies)` instead, which works correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pwdlib ph.verify() argument order reversed**
- **Found during:** Task 2 (running test_login_valid_credentials_sets_cookie)
- **Issue:** Plan sample code showed `ph.verify(user.hashed_password, password)` — but pwdlib's API is `ph.verify(password, hash)`. Calling with args reversed caused `pwdlib.exceptions.UnknownHashError` because the hash string was treated as a password.
- **Fix:** Changed to `ph.verify(password, user.hashed_password)` in `backend/app/services/auth.py`
- **Files modified:** `backend/app/services/auth.py`
- **Verification:** test_login_valid_credentials_sets_cookie passes; test_login_invalid_password_returns_401 returns correct 401
- **Committed in:** `9db7770` (Task 2 commit)

**2. [Rule 3 - Blocking] asyncpg event loop mismatch in pytest teardown**
- **Found during:** Task 2 (initial pytest run)
- **Issue:** pytest-asyncio 1.3.0 + anyio 4.12.1 creates a new event loop per test function. The `db_session` fixture teardown (drop_all) ran in a different event loop context than the test, causing RuntimeError: Future attached to a different loop
- **Fix:** (a) Use `NullPool` in test engine so asyncpg never pools connections across loop boundaries; (b) Remove `@pytest.mark.anyio` decorators and rely on `asyncio_mode = "auto"` from pyproject.toml which gives consistent loop scoping per pytest-asyncio; (c) Manage session with explicit `session_maker()` + try/finally for clean close
- **Files modified:** `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_departments.py`
- **Verification:** All 16 tests pass with zero teardown errors
- **Committed in:** `9db7770` (Task 2 commit)

**3. [Rule 1 - Bug] httpx per-request cookies= doesn't forward Cookies object correctly**
- **Found during:** Task 2 (test_get_me_with_valid_cookie failing with 401)
- **Issue:** httpx deprecated passing `httpx.Cookies` objects as `cookies=` parameter in per-request calls. The secure=True cookies from login response were not being forwarded to subsequent requests.
- **Fix:** Added `extract_cookies(response)` helper that returns `dict(response.cookies)` — passing plain dicts works correctly
- **Files modified:** `backend/tests/test_auth.py`
- **Verification:** test_get_me_with_valid_cookie, test_member_cannot_create_user, test_token_version_invalidation all pass
- **Committed in:** `9db7770` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (Rule 1 x2 — incorrect API usage in plan samples; Rule 3 x1 — blocking pytest infrastructure issue)
**Impact on plan:** All three auto-fixes were correctness issues in plan sample code or test environment setup. No scope creep; plan objectives fully met.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — test database is created automatically via `create_all`. The test suite runs inside the Docker backend container with `TEST_DATABASE_URL` env var pointing to `xbo_test` database on the postgres service.

## Next Phase Readiness

- All six auth endpoints are live and tested: frontend (Plan 01-03) can call POST /login, GET /me, POST /logout, POST /refresh immediately
- get_current_user and require_admin dependencies ready for all future protected endpoints in subsequent phases
- Token versioning (AUTH-08) is enforced — role changes immediately invalidate existing tokens
- Admin can create users (AUTH-01) — no self-registration route exists as per CONTEXT.md locked decision
- Seed admin (admin@xbo.com) uses SEED_ADMIN_PASSWORD from env — ready for first login after `docker compose up`

## Self-Check: PASSED

Files verified to exist on disk:
- backend/app/core/security.py: FOUND
- backend/app/dependencies.py: FOUND
- backend/app/services/auth.py: FOUND
- backend/app/schemas/auth.py: FOUND
- backend/app/routers/auth.py: FOUND
- backend/tests/test_auth.py: FOUND
- backend/tests/test_departments.py: FOUND

Commits verified in git log:
- 36b194f: FOUND (Task 1)
- 9db7770: FOUND (Task 2)

Test count: 16 tests, 0 failures (verified by pytest run output above)

---
*Phase: 01-foundation-and-auth*
*Completed: 2026-02-25*
