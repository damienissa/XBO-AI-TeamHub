---
phase: 01-foundation-and-auth
plan: "01"
subsystem: infra
tags: [docker, postgres, fastapi, sqlalchemy, alembic, asyncpg, pydantic-settings, uvicorn]

# Dependency graph
requires: []
provides:
  - Docker Compose stack: postgres:16-alpine + FastAPI backend + frontend placeholder
  - Async SQLAlchemy 2.x engine with TIMESTAMPTZ type_annotation_map and NAMING_CONVENTION MetaData
  - Alembic async env.py with autogenerate support (both models explicitly imported)
  - Initial migration bc1748a61656: users table (UUID PK, email index, role enum, token_version, TIMESTAMPTZ) + departments table (UUID PK, slug unique index, TIMESTAMPTZ)
  - GET /api/departments endpoint returning all departments as DepartmentOut Pydantic v2 schema
  - Idempotent seed script: 7 departments + admin@xbo.com (INSERT ON CONFLICT DO NOTHING)
  - pytest-asyncio + httpx AsyncClient conftest.py for future auth tests
affects:
  - 01-02 (auth endpoints need User model and database foundation)
  - 01-03 (frontend needs running backend with /api/departments)
  - all subsequent phases

# Tech tracking
tech-stack:
  added:
    - fastapi>=0.115
    - uvicorn[standard]>=0.29
    - sqlalchemy[asyncio]>=2.0
    - asyncpg>=0.29
    - alembic>=1.13
    - pyjwt>=2.8
    - pwdlib[argon2]>=0.2 (PasswordHash.recommended())
    - pydantic-settings>=2.0
    - python-dotenv>=1.0
    - pytest>=8.0, pytest-asyncio>=0.23, anyio>=4.0, httpx>=0.27
    - ruff>=0.4
    - postgres:16-alpine (Docker)
  patterns:
    - Async SQLAlchemy engine with pool_pre_ping, pool_size=5, max_overflow=10
    - NAMING_CONVENTION MetaData for constraint tracking across DB versions
    - type_annotation_map with DateTime(timezone=True) forces all datetime columns to TIMESTAMPTZ
    - Alembic async env.py: async_engine_from_config + NullPool + asyncio.run()
    - INSERT ON CONFLICT DO NOTHING for idempotent seeding
    - FastAPI CORS with exact allow_origins (not *) + allow_credentials=True
    - pydantic-settings Settings class with env_file=".env" + extra="ignore"

key-files:
  created:
    - docker-compose.yml
    - .env.example
    - backend/Dockerfile
    - backend/requirements.txt
    - backend/pyproject.toml
    - backend/app/main.py
    - backend/app/core/config.py
    - backend/app/core/database.py
    - backend/app/models/base.py
    - backend/app/models/user.py
    - backend/app/models/department.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/versions/bc1748a61656_initial_schema.py
    - backend/app/routers/departments.py
    - backend/app/schemas/department.py
    - backend/app/scripts/seed.py
    - backend/tests/conftest.py
  modified: []

key-decisions:
  - "pwdlib uses PasswordHash.recommended() not PasswordHasher() — corrected from plan's sample code which had wrong class name"
  - "Frontend placeholder uses alpine:tail -f /dev/null so docker compose up succeeds before plan 01-03 builds the real Next.js frontend"
  - "DATABASE_URL set via docker-compose environment override (postgresql+asyncpg://...) not just env_file, so correct URL is available inside container"
  - "Alembic migration generated inside the running Docker container to use the same Python environment and DB as production"

patterns-established:
  - "Pattern: All datetime columns use TIMESTAMPTZ via type_annotation_map — never bare DateTime"
  - "Pattern: Alembic env.py imports all model files with # noqa: F401 so autogenerate sees all tables"
  - "Pattern: Seed script uses INSERT ... ON CONFLICT DO NOTHING on natural unique keys (slug, email)"
  - "Pattern: Settings loaded via pydantic-settings with extra='ignore' so unknown env vars don't crash startup"

requirements-completed:
  - DEPT-01
  - DEPT-03

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 1 Plan 01: Foundation and Auth — Monorepo Scaffold Summary

**Docker Compose stack with postgres:16-alpine + FastAPI async backend, SQLAlchemy 2.x TIMESTAMPTZ engine, Alembic async migrations, User/Department ORM models, GET /api/departments, and idempotent seed script for 7 departments + admin@xbo.com**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T06:03:39Z
- **Completed:** 2026-02-25T06:09:14Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Full Docker Compose stack: postgres:16-alpine with healthcheck, FastAPI backend with uvicorn --reload, alpine placeholder frontend for now
- SQLAlchemy 2.x async engine with MetaData NAMING_CONVENTION and TIMESTAMPTZ type_annotation_map, plus async_session_maker and get_db dependency
- Alembic async env.py using async_engine_from_config + NullPool + asyncio.run(); initial migration creates users and departments tables with all required columns including token_version
- GET /api/departments returns all 7 seeded departments as DepartmentOut Pydantic v2 schema; seed script runs idempotently with ON CONFLICT DO NOTHING

## Task Commits

Each task was committed atomically:

1. **Task 1: Monorepo scaffold — Docker Compose, backend Dockerfile, env template, directory structure** - `fe80c6d` (feat)
2. **Task 2: SQLAlchemy models, Alembic setup, first migration, GET /api/departments, seed script** - `2750ecc` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `docker-compose.yml` - Services: postgres:16-alpine (healthcheck), backend (uvicorn --reload), frontend placeholder (alpine tail)
- `.env.example` - Template with POSTGRES_*, SECRET_KEY, SEED_ADMIN_PASSWORD, COOKIE_SAMESITE, DB_ECHO
- `backend/Dockerfile` - python:3.12-slim, installs requirements.txt
- `backend/requirements.txt` - Full async FastAPI stack with pyjwt, pwdlib[argon2], ruff, pytest-asyncio
- `backend/pyproject.toml` - asyncio_mode=auto, ruff line-length=100
- `backend/app/core/config.py` - pydantic-settings Settings with DATABASE_URL, SECRET_KEY, SEED_ADMIN_PASSWORD
- `backend/app/core/database.py` - Async engine (pool_pre_ping, pool_size=5), NAMING_CONVENTION MetaData, TIMESTAMPTZ type_annotation_map, async_session_maker, get_db
- `backend/app/models/base.py` - Re-exports Base from database.py
- `backend/app/models/user.py` - User model: UUID PK, email (unique/indexed), hashed_password, full_name, UserRole enum, is_active, token_version, TIMESTAMPTZ created_at/updated_at
- `backend/app/models/department.py` - Department model: UUID PK, slug (unique/indexed), name, TIMESTAMPTZ created_at
- `backend/alembic.ini` - script_location=alembic; URL set dynamically in env.py
- `backend/alembic/env.py` - Async migration pattern: async_engine_from_config, NullPool, compare_type=True, both models explicitly imported
- `backend/alembic/versions/bc1748a61656_initial_schema.py` - Creates users + departments tables with indexes
- `backend/app/routers/departments.py` - GET /api/departments ordered by name, DepartmentOut schema
- `backend/app/schemas/department.py` - DepartmentOut: id (UUID), slug, name; from_attributes=True
- `backend/app/scripts/seed.py` - Seeds 7 departments + admin@xbo.com idempotently (ON CONFLICT DO NOTHING)
- `backend/tests/conftest.py` - pytest-asyncio + httpx AsyncClient fixtures with test DB override
- `backend/app/main.py` - FastAPI with CORS (allow_origins localhost:3000, allow_credentials), /health endpoint, departments router
- `frontend/.gitkeep` - Placeholder until plan 01-03

## Decisions Made

- Used `PasswordHash.recommended()` from pwdlib instead of the plan's sample `PasswordHasher()` — the actual API class is `PasswordHash` (argon2 is the default hasher when using `.recommended()`)
- Frontend uses `alpine:tail -f /dev/null` as placeholder so `docker compose up` succeeds before the Next.js frontend is built in plan 01-03
- `DATABASE_URL` is set via Docker Compose `environment` block (not just `env_file`) so the container gets the correct asyncpg URL pointing to the `postgres` container hostname
- Alembic migration was generated inside the running Docker container to ensure the same Python environment and database connection are used

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pwdlib PasswordHash class name**
- **Found during:** Task 2 (seed script execution)
- **Issue:** Plan's sample code used `PasswordHasher()` which does not exist in pwdlib 0.3.0. The actual class is `PasswordHash` with factory method `.recommended()`
- **Fix:** Changed import to `from pwdlib import PasswordHash` and instantiation to `PasswordHash.recommended()`
- **Files modified:** `backend/app/scripts/seed.py`
- **Verification:** `python -m app.scripts.seed` ran successfully and printed "Seed complete: 7 departments + admin@xbo.com"
- **Committed in:** `2750ecc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — incorrect class name in plan sample code)
**Impact on plan:** Single line fix; no scope creep. pwdlib API is correct and seed is idempotent.

## Issues Encountered

None beyond the pwdlib class name fix above.

## User Setup Required

None — all configuration uses .env file. Copy `.env.example` to `.env` and set real values for non-dev deployments.

## Next Phase Readiness

- Database schema is stable: users table has token_version for AUTH-08, role enum for AUTH-05
- GET /api/departments is live and returns all 7 departments — DEPT-01 and DEPT-03 complete
- Backend container runs uvicorn with --reload; any changes to `./backend/` are instantly reflected
- alembic upgrade head is idempotent — safe to run on every deploy
- conftest.py test fixtures are ready for plan 01-02 auth endpoint tests
- Plan 01-02 (auth endpoints) can proceed immediately — User model and database foundation are ready

## Self-Check: PASSED

All 27 files verified to exist on disk. All commits confirmed in git log.

Artifact content checks: all 7 plan artifacts verified (create_async_engine, postgresql+asyncpg, token_version, class Department, service_healthy, async_engine_from_config, .on_conflict_do_nothing). Note: Plan specified "contains ON CONFLICT DO NOTHING" — the seed.py uses SQLAlchemy's `.on_conflict_do_nothing()` method which generates that SQL at runtime. Verified functionally: seed runs twice with identical result.

---
*Phase: 01-foundation-and-auth*
*Completed: 2026-02-25*
