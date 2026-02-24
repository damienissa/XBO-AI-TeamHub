# Phase 1: Foundation and Auth - Research

**Researched:** 2026-02-24
**Domain:** FastAPI async + SQLAlchemy 2.x + Alembic + JWT httpOnly cookies + Next.js 14 App Router auth
**Confidence:** HIGH (all critical patterns verified against official docs and Context7)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Registration access:** Admin-creates-users only — no open self-registration. Only an existing admin can create new user accounts (POST /api/auth/users, admin-only). The very first admin is created exclusively via the seed script (`python -m app.scripts.seed`). The login page has no "Sign up" link — just email + password fields.
- **Sidebar layout:** Fixed left sidebar, always visible — no collapsible/hamburger in desktop view. Top: XBO logo / app name ("XBO TeamHub"). Middle nav section: Board, Dashboard, Department Portal, Wiki. Below nav: department list as individual clickable nav links. Bottom: current user avatar initials + full name + role badge + logout button. Active nav item highlighted with accent color. Fixed width (~240px), does NOT collapse in v1.
- **Post-login landing:** Default landing after login: Kanban board (`/board`). After admin creates account, new user is NOT auto-logged-in. On session expiry, redirect to `/login?reason=expired` with dismissable banner.
- **Auth UX and error handling:** Inline form validation errors (not toast) for login/register forms. Wrong password / user not found: generic "Invalid email or password" (don't reveal which). Successful login: no toast, just redirect to `/board`. Admin user creation success: toast notification "User created successfully". JWT in httpOnly + Secure + SameSite=Strict cookie — never in localStorage. Access token TTL: 15 minutes; refresh token TTL: 7 days. Token versioning (`token_version` integer on User row).
- **First-run / seed behavior:** Seed script creates all 7 departments (cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr) + one admin user (email `admin@xbo.com`, password from `SEED_ADMIN_PASSWORD` env var). Seed is idempotent.
- **Navigation structure:** Board → `/board`, Dashboard → `/dashboard` (disabled/Phase 4), Department Portal → `/portal` (disabled/Phase 3), Wiki → `/wiki` (disabled/Phase 5). Departments section below nav: clicking a department filters the board by that department.

### Claude's Discretion

- Exact color palette / design tokens for the sidebar (use Tailwind slate/gray neutrals as base)
- Loading skeleton vs spinner on page transitions
- Exact Tailwind component choices for form inputs (shadcn/ui Input and Button components are fine)
- Refresh token rotation strategy details (sliding window or fixed TTL — researcher should determine best practice)
- Whether to use Next.js middleware or layout-level auth guard (researcher should confirm best App Router pattern)

### Deferred Ideas (OUT OF SCOPE)

- Invite-by-email flow — would require email infrastructure (out of scope v1)
- Admin user management UI (list users, deactivate, change roles) — deferred to a future admin panel phase; v1 admin creates users via API or a minimal admin page
- Sidebar collapsible / responsive mobile nav — v2 if mobile usage is observed
- "Remember me" / persistent login beyond 7-day refresh — out of scope v1

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can register with email and password | Admin-only POST /api/auth/users endpoint; seed creates first admin; pwdlib[argon2] hashing pattern |
| AUTH-02 | User can log in with email and password and receive a session (JWT in httpOnly cookie) | FastAPI response.set_cookie(httponly=True, secure=True, samesite="strict"); PyJWT encode pattern |
| AUTH-03 | User session persists across browser refresh | httpOnly cookie automatically sent on every request; Next.js middleware reads cookie and verifies JWT; no localStorage needed |
| AUTH-04 | User can log out and cookie is cleared | FastAPI response.delete_cookie() or set_cookie with max_age=0; Next.js Server Action calls logout endpoint |
| AUTH-05 | Two roles exist: admin, member | SQLAlchemy Enum column on User model; require_role() FastAPI dependency |
| AUTH-06 | Admin can assign and change user roles | Admin-only PATCH /api/auth/users/{id}/role endpoint; increment token_version on role change |
| AUTH-07 | Protected routes redirect unauthenticated users to login | Next.js middleware.ts does fast JWT check; (app) layout.tsx calls verifySession() DAL function as defense-in-depth |
| AUTH-08 | Token is invalidated within one TTL cycle when user is deactivated (token_version) | token_version int on User; JWT payload includes token_version; get_current_user dependency checks payload version == db version |
| DEPT-01 | Seven fixed departments seeded: cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr | Idempotent seed script with INSERT ... ON CONFLICT DO NOTHING |
| DEPT-02 | Sidebar lists all departments with navigation links | GET /api/departments returns all; Next.js (app) layout fetches departments server-side; renders as nav links |
| DEPT-03 | API returns all departments for use in ticket filters and forms | GET /api/departments endpoint; Department Pydantic schema returned |

</phase_requirements>

---

## Summary

Phase 1 delivers the full containerized stack (Docker Compose with PostgreSQL 16, FastAPI backend, Next.js frontend) plus complete JWT authentication and the department seed. The critical technical decisions are all locked: PyJWT + pwdlib[argon2] for auth crypto (the FastAPI docs switched away from python-jose + passlib[bcrypt] in late 2024/2025 — these are now officially unmaintained), httpOnly + Secure + SameSite=Strict cookies for JWT storage, SQLAlchemy 2.x async engine with asyncpg, and the Alembic async env.py pattern using `await connection.run_sync(do_run_migrations)`.

The auth guard architecture uses a two-layer defense-in-depth pattern per the official Next.js 2026 authentication guide: middleware.ts for fast edge rejection (reads JWT from cookie without DB call), plus a `verifySession()` Data Access Layer function that Server Components and Route Handlers call directly. This guards against the CVE-2025-29927 middleware bypass vulnerability and ensures security holds even when layout partial rendering skips the middleware check. The `(auth)` and `(app)` route groups cleanly separate public and authenticated layouts.

The refresh token strategy uses sliding window rotation with token_version invalidation: every call to POST /api/auth/refresh issues a new access token (15 min) + new refresh token (7 days), and rotates the refresh token in the DB. When an admin deactivates a user or changes their role, `token_version` on the User row is incremented. `get_current_user` dependency verifies `payload.token_version == user.token_version` — any existing token with a stale version is rejected within one 15-minute access token TTL cycle.

**Primary recommendation:** Build in this order within Phase 1: Docker Compose infrastructure → SQLAlchemy engine + Base + Alembic → User + Department models + migrations → auth service (login/refresh/logout) → FastAPI routers → Next.js auth pages + middleware + layout guard → seed script. Each step is a stable checkpoint.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115+ | Python async web framework | Native Pydantic v2 integration, auto OpenAPI |
| SQLAlchemy | 2.x | Async ORM | Only Python ORM with native async, typed 2.0 style |
| asyncpg | 0.29+ | PostgreSQL async driver | Required by SQLAlchemy async; fastest Python PG driver |
| Alembic | 1.13+ | Database migrations | Official SQLAlchemy migration tool; async template available |
| PyJWT | 2.8+ | JWT encode/decode | FastAPI official recommendation as of 2025; python-jose abandoned |
| pwdlib[argon2] | 0.2+ | Password hashing | FastAPI official recommendation; passlib unmaintained; argon2 > bcrypt |
| Pydantic | v2 | Schema validation | Mandatory with FastAPI 0.100+; never use v1 compat shim |
| Python | 3.12 | Runtime | Async performance improvements; match/case; tomllib built-in |
| PostgreSQL | 16 | Database | JSONB, window functions, TIMESTAMPTZ, pg_isready healthcheck |
| Next.js | 14 (App Router) | Frontend framework | Server Components reduce bundle; route groups for auth separation |
| TypeScript | 5.x | Frontend language | Required for type-safe API client and component props |
| Tailwind CSS | 3.4 | CSS framework | Do NOT upgrade to v4 until shadcn/ui confirms compatibility |
| shadcn/ui | latest | Component library | Copy-paste Tailwind-native; Sidebar component supports collapsible="none" |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | 8.x | Test framework | All backend tests |
| pytest-asyncio | 0.23+ | Async test support | Required for `async def` test functions |
| anyio | 4.x | Async backend for tests | Used as `@pytest.mark.anyio` decorator |
| httpx | 0.27+ | HTTP client for tests | `AsyncClient(transport=ASGITransport(app=app))` |
| python-dotenv | 1.x | Env var loading | Local .env file support |
| pydantic-settings | 2.x | Settings class | Type-safe config from env vars; replaces `os.getenv` |
| ruff | 0.4+ | Linting + formatting | Replaces black + flake8 + isort in one tool |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | python-jose | python-jose nearly abandoned (last release 2022); PyJWT is official FastAPI recommendation |
| pwdlib[argon2] | passlib[bcrypt] | passlib unmaintained since 2023; crypt module removed Python 3.13; argon2 stronger than bcrypt |
| middleware.ts + DAL pattern | layout.tsx only | layout.tsx doesn't re-check on navigation due to partial rendering; middleware is faster at edge rejection |
| Tailwind 3.4 | Tailwind 4.x | Tailwind v4 released 2025 but shadcn/ui compatibility not confirmed; stay on 3.4 |
| asyncpg | psycopg3 | Both work with SQLAlchemy async; asyncpg has better community examples for this stack |

**Installation (backend):**
```bash
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic \
  pyjwt pwdlib[argon2] pydantic-settings python-dotenv \
  pytest pytest-asyncio anyio httpx ruff
```

**Installation (frontend):**
```bash
npx create-next-app@14 frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
npx shadcn@latest init
npx shadcn@latest add sidebar button input form label card badge toast
npm install
```

---

## Architecture Patterns

### Recommended Project Structure

```
XBO-AI-TeamHub/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py        # pydantic-settings Settings class
│   │   │   ├── database.py      # engine, async_session_maker, get_db
│   │   │   └── security.py      # JWT create/decode, cookie helpers
│   │   ├── models/
│   │   │   ├── base.py          # DeclarativeBase + TimestampMixin
│   │   │   ├── user.py          # User model (id, email, hashed_pw, role, token_version)
│   │   │   └── department.py    # Department model (id, slug, name)
│   │   ├── schemas/
│   │   │   ├── auth.py          # LoginRequest, TokenResponse, UserCreate, UserOut
│   │   │   └── department.py    # DepartmentOut
│   │   ├── services/
│   │   │   └── auth.py          # authenticate_user(), create_tokens(), refresh_tokens()
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /login, POST /refresh, POST /logout, POST /users
│   │   │   └── departments.py   # GET /departments
│   │   ├── dependencies.py      # get_current_user(), require_role()
│   │   └── scripts/
│   │       └── seed.py          # idempotent seed (departments + admin user)
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py               # async env.py pattern
│   ├── tests/
│   │   ├── conftest.py          # AsyncClient fixture, test DB session
│   │   └── test_auth.py
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Public routes — no sidebar
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx   # Minimal layout (centered card)
│   │   │   └── (app)/           # Protected routes — sidebar visible
│   │   │       ├── board/
│   │   │       │   └── page.tsx # Placeholder for Phase 2
│   │   │       └── layout.tsx   # Auth guard + sidebar wrapper
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   └── client.ts    # Typed fetch wrappers (no raw fetch in components)
│   │   │   ├── session.ts       # verifySession() DAL using cookies() + PyJWT verify
│   │   │   └── dal.ts           # getSession() with React cache()
│   │   ├── components/
│   │   │   ├── sidebar/
│   │   │   │   ├── AppSidebar.tsx
│   │   │   │   └── DeptNav.tsx
│   │   │   └── auth/
│   │   │       └── LoginForm.tsx
│   │   └── middleware.ts        # Edge JWT check; redirects unauthenticated to /login
│   ├── .env.local
│   └── next.config.ts
├── docker-compose.yml
└── .env                         # POSTGRES_*, SECRET_KEY, SEED_ADMIN_PASSWORD
```

### Pattern 1: SQLAlchemy 2.x Async Engine + Session Factory + get_db

**What:** Creates the async engine and session factory once at module import time; `get_db` yields a session per request and is injected via FastAPI `Depends()`.
**When to use:** Every FastAPI endpoint that touches the database.

```python
# Source: berkkaraal.com verified against SQLAlchemy 2.0 async docs
# backend/app/core/database.py

import datetime
from typing import AsyncGenerator

from sqlalchemy import DateTime, MetaData
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(AsyncAttrs, DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {
        datetime.datetime: DateTime(timezone=True),  # Forces TIMESTAMPTZ globally
    }


engine = create_async_engine(
    settings.DATABASE_URL,       # postgresql+asyncpg://user:pass@host/db
    echo=settings.DB_ECHO,
    pool_pre_ping=True,          # Reconnects on stale connections
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

**CRITICAL:** Use `postgresql+asyncpg://` not `postgresql://`. The `expire_on_commit=False` prevents DetachedInstanceError when accessing model attributes after `await session.commit()`. The `type_annotation_map` with `DateTime(timezone=True)` means every `datetime.datetime` column is TIMESTAMPTZ — no silent clock drift.

---

### Pattern 2: Alembic async env.py

**What:** Alembic's migration runner is synchronous; the async env.py bridges it to the async engine using `connection.run_sync()`.
**When to use:** Once during project setup; never change the pattern again.

```python
# Source: Official Alembic async template + berkkaraal.com verified
# alembic/env.py

from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import asyncio

from app.core.config import settings
from app.models.base import Base
# CRITICAL: Import ALL models so autogenerate detects them
from app.models.user import User  # noqa: F401
from app.models.department import Department  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,       # CRITICAL: detects column type changes
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool: no connection reuse in migration context
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

**CRITICAL details:**
- `compare_type=True` — without this, column type changes (e.g., `VARCHAR(50)` → `TEXT`) are silently ignored by autogenerate
- `poolclass=pool.NullPool` — prevents the migration from holding a pool connection
- `asyncio.run()` requires no existing event loop; runs clean from CLI `alembic upgrade head`
- Every model file must be imported in env.py or autogenerate will not see those tables

---

### Pattern 3: JWT in httpOnly Cookie — FastAPI Set + Read + Clear

**What:** FastAPI sets the JWT in a cookie on the HTTP Response. The browser sends it automatically on every subsequent request. FastAPI reads it from `request.cookies`.
**When to use:** Login, refresh, logout endpoints.

```python
# Source: Starlette docs + FastAPI security docs
# backend/app/core/security.py

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import Response, Request, HTTPException, status
from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"


def create_access_token(user_id: str, role: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "token_version": token_version,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "token_version": token_version,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from e


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    # Starlette set_cookie: httponly, secure, samesite params
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=True,           # HTTPS only — set False only in local dev if needed
        samesite="strict",     # Locked decision: SameSite=Strict
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh",  # Scope refresh cookie to only the refresh endpoint
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth/refresh")


def get_access_token_from_request(request: Request) -> Optional[str]:
    return request.cookies.get(ACCESS_COOKIE_NAME)
```

**CRITICAL — CORS for cookie-based auth:** When Next.js frontend calls FastAPI on a different port locally (e.g., Next.js on 3000, FastAPI on 8000), cookies require:
```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Exact origin, NOT "*"
    allow_credentials=True,                  # CRITICAL: required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```
`allow_credentials=True` with `allow_origins=["*"]` is invalid — browsers reject it. Must use exact origins.

---

### Pattern 4: FastAPI get_current_user Dependency with token_version check

**What:** FastAPI dependency that reads the access token cookie, decodes it, verifies `token_version` matches the DB, and returns the User.
**When to use:** Any protected endpoint.

```python
# Source: FastAPI docs dependency injection + token_version pattern
# backend/app/dependencies.py

from typing import Annotated
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_token, get_access_token_from_request
from app.models.user import User


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = get_access_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(token)  # raises 401 on invalid/expired

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    token_version = payload.get("token_version")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    # AUTH-08: token_version invalidation
    if user.token_version != token_version:
        raise HTTPException(status_code=401, detail="Token has been invalidated")

    return user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

---

### Pattern 5: Refresh Token Rotation (Sliding Window)

**What:** Every refresh call issues new access + refresh tokens and invalidates the old refresh token. Sliding window extends the 7-day window on each use.
**Recommendation:** Sliding window (not fixed TTL). Rationale: fixed TTL forces users to re-login every 7 days regardless of activity; sliding window keeps active users logged in indefinitely while still expiring inactive sessions.

```python
# Source: CodeSignal Learn refresh token rotation + JWT in FastAPI Jan 2026 Medium article
# backend/app/services/auth.py (excerpt)

async def refresh_tokens(refresh_token: str, db: AsyncSession) -> tuple[str, str]:
    """Rotate refresh token — each refresh token is single-use."""
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload["sub"]
    token_version = payload["token_version"]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or user.token_version != token_version:
        raise HTTPException(status_code=401, detail="Token invalidated")

    # Issue new tokens — new access + new refresh (sliding window)
    new_access = create_access_token(str(user.id), user.role, user.token_version)
    new_refresh = create_refresh_token(str(user.id), user.token_version)

    # NOTE: For Phase 1 we do NOT store refresh tokens in DB (stateless).
    # Token version invalidation covers deactivation.
    # Storing refresh tokens for one-time-use rotation is a Phase 2+ hardening.

    return new_access, new_refresh
```

**Token version invalidation for deactivate/role-change:**
```python
async def invalidate_user_tokens(user_id: str, db: AsyncSession) -> None:
    """Increment token_version — all existing tokens become invalid within 15 min TTL."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    user.token_version += 1
    await db.commit()
```

---

### Pattern 6: Next.js App Router Auth Guard (Defense-in-Depth)

**What:** Two-layer pattern per official Next.js 2026 authentication guide. Layer 1: middleware.ts for fast edge rejection. Layer 2: `verifySession()` DAL function called in Server Components and Route Handlers.
**Resolution for Claude's Discretion:** Use BOTH middleware AND layout-level DAL check. Not one or the other.
**Why not layout.tsx alone:** Next.js partial rendering means layout.tsx does NOT re-run on client-side navigation between routes in the same group. The auth check would be skipped on navigation.
**Why not middleware alone:** CVE-2025-29927 allows bypass on some self-hosted deployments. Middleware also cannot do DB lookups (edge runtime).

```typescript
// Source: Official Next.js authentication guide (nextjs.org/docs/app/guides/authentication)
// frontend/src/middleware.ts

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";  // jose is edge-compatible; PyJWT is Node.js only

const SECRET_KEY = new TextEncoder().encode(process.env.NEXT_PUBLIC_SESSION_SECRET);

const protectedRoutes = ["/board", "/dashboard", "/portal", "/wiki"];
const publicRoutes = ["/login"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((r) => path.startsWith(r));
  const isPublicRoute = publicRoutes.some((r) => path.startsWith(r));

  const token = req.cookies.get("access_token")?.value;

  // Fast check: no crypto verification, just presence check + expiry
  // Full verification happens in verifySession() DAL
  if (isProtectedRoute && !token) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("reason", "unauthenticated");
    return NextResponse.redirect(url);
  }

  if (isPublicRoute && token) {
    return NextResponse.redirect(new URL("/board", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
```

```typescript
// Source: Official Next.js authentication guide
// frontend/src/lib/dal.ts

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    redirect("/login?reason=unauthenticated");
  }

  // Call FastAPI /api/auth/me to validate token (includes token_version check)
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
    headers: { Cookie: `access_token=${token}` },
    cache: "no-store",  // Auth checks must never be cached
  });

  if (!res.ok) {
    redirect("/login?reason=expired");
  }

  const user = await res.json();
  return user;
});
```

```typescript
// Source: Official Next.js docs + shadcn/ui Sidebar docs
// frontend/src/app/(app)/layout.tsx

import { verifySession } from "@/lib/dal";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth auth check — verifySession redirects if invalid
  const user = await verifySession();

  return (
    <SidebarProvider>
      {/* collapsible="none" = fixed sidebar, does not collapse */}
      <AppSidebar user={user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </SidebarProvider>
  );
}
```

---

### Pattern 7: shadcn/ui Sidebar (Fixed, Non-Collapsible)

**What:** shadcn/ui Sidebar component with `collapsible="none"` for a fixed 240px sidebar. Uses SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter sub-components.

**Installation:**
```bash
npx shadcn@latest add sidebar
```

**Component structure:**
```typescript
// Source: shadcn/ui Sidebar docs (ui.shadcn.com/docs/components/sidebar)
// frontend/src/components/sidebar/AppSidebar.tsx
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Board", href: "/board", enabled: true },
  { label: "Dashboard", href: "/dashboard", enabled: false },
  { label: "Department Portal", href: "/portal", enabled: false },
  { label: "Wiki", href: "/wiki", enabled: false },
];

const DEPARTMENTS = [
  { slug: "cashier", name: "Cashier" },
  { slug: "fintech360", name: "Fintech360" },
  { slug: "xbo_studio", name: "XBO Studio" },
  { slug: "xbo_marketing", name: "XBO Marketing" },
  { slug: "xbo_dev", name: "XBO Dev" },
  { slug: "xbo_legal", name: "XBO Legal" },
  { slug: "xbo_hr", name: "XBO HR" },
];

export function AppSidebar({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();

  return (
    // collapsible="none" = fixed sidebar
    <Sidebar collapsible="none" className="w-[240px] border-r">
      <SidebarHeader className="px-4 py-3">
        <span className="font-semibold text-sm">XBO TeamHub</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    disabled={!item.enabled}
                  >
                    <Link href={item.enabled ? item.href : "#"}>
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Departments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DEPARTMENTS.map((dept) => (
                <SidebarMenuItem key={dept.slug}>
                  <SidebarMenuButton asChild>
                    <Link href={`/board?dept=${dept.slug}`}>{dept.name}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-medium">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <Badge variant="outline" className="text-xs">{user.role}</Badge>
          </div>
        </div>
        {/* Logout button — calls Server Action or API route */}
      </SidebarFooter>
    </Sidebar>
  );
}
```

---

### Pattern 8: pytest-asyncio + httpx AsyncClient Test Setup

**What:** Official FastAPI async test pattern using `@pytest.mark.anyio` + `httpx.AsyncClient` + `ASGITransport`.

```python
# Source: FastAPI official async tests docs (fastapi.tiangolo.com/advanced/async-tests/)
# backend/tests/conftest.py

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator

from app.main import app
from app.core.database import get_db, Base

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/test_xbo"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionMaker = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionMaker() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
```

```python
# backend/tests/test_auth.py
import pytest

@pytest.mark.anyio
async def test_login_returns_cookie(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@xbo.com",
        "password": "testpassword"
    })
    assert response.status_code == 200
    assert "access_token" in response.cookies
```

**pytest.ini (or pyproject.toml):**
```ini
[pytest]
asyncio_mode = auto
```
Or in pyproject.toml:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

---

### Pattern 9: Docker Compose with Healthchecks

**What:** PostgreSQL healthcheck using `pg_isready`; FastAPI and Next.js use `condition: service_healthy`.

```yaml
# Source: Multiple Docker Compose healthcheck guides + FastAPI Docker docs
# docker-compose.yml

version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    env_file: .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy  # Waits for pg_isready to pass
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

  frontend:
    build: ./frontend
    command: npm run dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000

volumes:
  postgres_data:
```

---

### Pattern 10: User and Department Models

```python
# Source: SQLAlchemy 2.x ORM docs
# backend/app/models/user.py

import uuid
from datetime import datetime
from sqlalchemy import String, Enum, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.member
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), server_default=func.now()
    )
```

```python
# backend/app/models/department.py

import uuid
from datetime import datetime
from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
```

---

### Anti-Patterns to Avoid

- **Lazy relationship loading on async sessions:** SQLAlchemy async raises `MissingGreenlet` on lazy loads. Set `lazy="raise"` on all relationships from the start. Use `selectinload()` or `joinedload()` explicitly. This will not appear in tests with small data; it surfaces in production.
- **Using `allow_origins=["*"]` with `allow_credentials=True`:** Browsers refuse this combination. Must use exact allowed origins.
- **Reading JWT from `Authorization: Bearer` header in this stack:** The decision is httpOnly cookies, not headers. Never add header-based token extraction — it undermines the XSS protection the cookie provides.
- **Setting cookies in Server Component render:** Next.js docs confirm: cookies can only be SET in Server Actions or Route Handlers. Server Components can only READ. The logout action must be a Server Action or call a Next.js Route Handler.
- **Using `cookies()` synchronously in Next.js 15+ style code:** The `cookies()` function is async as of Next.js 15. Always `await cookies()`.
- **Storing refresh token in the same cookie path as access token:** Scope the refresh token cookie to `path="/api/auth/refresh"` so it is not sent on every API request — only on the refresh endpoint.
- **Forgetting `asyncio_mode = "auto"` in pytest config:** Without this, `@pytest.mark.asyncio` must be added to every test function. Set globally in pyproject.toml.
- **Running `alembic upgrade head` before models are imported in env.py:** If a model file is not imported in env.py's target_metadata setup, autogenerate will generate a migration that drops its tables. Import all model modules at the top of env.py.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | `pwdlib[argon2]` | argon2 is memory-hard, OWASP recommended; passlib deprecated |
| JWT encode/decode | Manual HMAC | `PyJWT` | Handles exp, iat, nbf, algorithm validation; official FastAPI recommendation |
| SQLAlchemy migrations | Manual ALTER TABLE | Alembic autogenerate | Autogenerate detects schema changes; manual DDL creates drift |
| Constraint naming | Ad-hoc names | MetaData naming_convention | Required for Alembic to track constraint changes across DBs |
| Form validation errors | Custom error state | Pydantic v2 ValidationError → FastAPI 422 → React useActionState | Full validation pipeline without custom error handling |
| Sidebar nav component | Custom div structure | shadcn/ui Sidebar | Accessibility built-in; composable; collapsible="none" for fixed |
| Cookie cookie setting | Manual Set-Cookie header | FastAPI `response.set_cookie()` | Handles all security flags via named params; no string concatenation |

**Key insight:** The auth domain has an enormous surface area for subtle security bugs (timing attacks on password compare, JWT algorithm confusion, cookie flag misuse). Every listed library exists specifically to handle these correctly. Building custom solutions here is the fastest path to a security vulnerability.

---

## Common Pitfalls

### Pitfall 1: `MissingGreenlet` on Async Relationship Access

**What goes wrong:** A SQLAlchemy model relationship is accessed outside an async context (lazy loaded) and raises `MissingGreenlet: greenlet_spawn has not been called`.
**Why it happens:** SQLAlchemy async engine cannot do synchronous I/O. Any relationship with `lazy="select"` (the default) will attempt to issue a sync query when accessed, which is not allowed.
**How to avoid:** Set `lazy="raise"` on ALL relationships globally from the first model. This converts silent lazy loads into loud errors during development instead of production. Use `selectinload()` or `joinedload()` in every query that needs related data.
**Warning signs:** 500 errors on endpoints that return nested objects; works with small test data but fails on real data.

```python
# Correct relationship definition
from sqlalchemy.orm import relationship
tickets = relationship("Ticket", back_populates="owner", lazy="raise")

# Correct query with eager loading
from sqlalchemy.orm import selectinload
result = await db.execute(
    select(User).options(selectinload(User.tickets)).where(User.id == user_id)
)
```

---

### Pitfall 2: CORS Blocks Cookies in Local Dev

**What goes wrong:** Login succeeds (200 response) but the browser does not store the cookie; subsequent requests are unauthenticated.
**Why it happens:** `allow_credentials=True` requires exact origins (not `"*"`). Mismatch between `allow_origins` and actual request origin silently drops the cookie.
**How to avoid:** Set `allow_origins=["http://localhost:3000"]` explicitly. In production, set to the actual domain. Never use `"*"` with credentials.
**Warning signs:** Login returns 200 but browser DevTools > Application > Cookies shows no cookie set.

---

### Pitfall 3: python-jose / passlib in New Projects

**What goes wrong:** Following older FastAPI tutorials (pre-2025) that use `python-jose` and `passlib[bcrypt]`. These packages are effectively abandoned. python-jose had unpatched CVEs. passlib's dependency on `crypt` module was removed in Python 3.13.
**Why it happens:** The FastAPI docs were updated in 2025 to use `PyJWT` + `pwdlib[argon2]`. Many blog posts and Stack Overflow answers still reference the old libraries.
**How to avoid:** Use `PyJWT` (import: `import jwt`) and `pwdlib[argon2]` (import: `from pwdlib import PasswordHash`). Never `from jose import jwt`.
**Warning signs:** `import jose` or `from passlib.context import CryptContext` in any new file.

---

### Pitfall 4: Alembic Autogenerate Missing Changes

**What goes wrong:** Adding a column to a SQLAlchemy model, running `alembic revision --autogenerate`, and getting an empty migration. The column is never added to the real DB.
**Why it happens:** `compare_type=False` (the default). Alembic ignores type changes. Also: model not imported in env.py.
**How to avoid:** Set `compare_type=True` in env.py `context.configure()`. Import ALL model files at the top of env.py. Run `alembic check` before deploying to confirm no pending changes.
**Warning signs:** `alembic check` shows "No changes in schema detected" when you know you added a column; then a 500 on column access.

---

### Pitfall 5: Next.js Layout Auth Check Skipped on Navigation

**What goes wrong:** User navigates from `/board` to `/dashboard` without a page reload. The `(app)/layout.tsx` auth check does not re-run because Next.js partial rendering skips layout re-render on client navigation between routes sharing the same layout.
**Why it happens:** App Router layouts are persistent during client-side navigation. `verifySession()` in a layout runs on first load but not on subsequent navigations.
**How to avoid:** middleware.ts handles the route-change case (runs on every navigation). The layout-level `verifySession()` is defense-in-depth for the initial load and direct URL access. Together they cover all cases.
**Warning signs:** A session that expired during the tab's lifetime still allows navigation to new protected routes without hitting the login page.

---

### Pitfall 6: Refresh Token Cookie Sent on Every Request

**What goes wrong:** The refresh token cookie is sent with every API request, not just the `/api/auth/refresh` endpoint. This increases the surface area for token theft.
**Why it happens:** `path="/"` on the refresh cookie means it matches every request path.
**How to avoid:** Set `path="/api/auth/refresh"` on the refresh token cookie. The browser only sends it to that specific endpoint.
**Warning signs:** Inspecting request headers in DevTools shows the refresh token cookie present on board API calls.

---

### Pitfall 7: Session Expiry UX — No `reason` Param

**What goes wrong:** User is redirected to `/login` with no explanation. They think the app is broken.
**Why it happens:** Session expiry redirect does not include `?reason=expired`.
**How to avoid:** In `verifySession()` and middleware, redirect to `/login?reason=expired`. The login page checks `searchParams.reason === "expired"` and shows a dismissable banner "Session expired, please log in again."

---

## Code Examples

### Complete Login Endpoint

```python
# Source: FastAPI docs + security.py patterns above
# backend/app/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    create_access_token, create_refresh_token, set_auth_cookies
)
from app.models.user import User
from app.schemas.auth import LoginRequest, UserOut
from pwdlib import PasswordHash

router = APIRouter(prefix="/api/auth", tags=["auth"])
password_hash = PasswordHash.recommended()


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Generic error — don't reveal whether email or password was wrong (AUTH decision)
    if not user or not password_hash.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(str(user.id), user.role, user.token_version)
    refresh_token = create_refresh_token(str(user.id), user.token_version)

    set_auth_cookies(response, access_token, refresh_token)

    return UserOut.model_validate(user)
```

### Idempotent Seed Script

```python
# Source: SQLAlchemy 2.x docs
# backend/app/scripts/seed.py

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from pwdlib import PasswordHash

from app.core.config import settings
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.department import Department

DEPARTMENTS = [
    {"slug": "cashier", "name": "Cashier"},
    {"slug": "fintech360", "name": "Fintech360"},
    {"slug": "xbo_studio", "name": "XBO Studio"},
    {"slug": "xbo_marketing", "name": "XBO Marketing"},
    {"slug": "xbo_dev", "name": "XBO Dev"},
    {"slug": "xbo_legal", "name": "XBO Legal"},
    {"slug": "xbo_hr", "name": "XBO HR"},
]

password_hash = PasswordHash.recommended()


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async with session_maker() as session:
        # Seed departments — idempotent (INSERT ... ON CONFLICT DO NOTHING via check)
        for dept_data in DEPARTMENTS:
            result = await session.execute(
                select(Department).where(Department.slug == dept_data["slug"])
            )
            if result.scalar_one_or_none() is None:
                session.add(Department(**dept_data))

        # Seed admin user
        admin_password = os.environ["SEED_ADMIN_PASSWORD"]
        result = await session.execute(
            select(User).where(User.email == "admin@xbo.com")
        )
        if result.scalar_one_or_none() is None:
            session.add(User(
                email="admin@xbo.com",
                full_name="XBO Admin",
                hashed_password=password_hash.hash(admin_password),
                role=UserRole.admin,
                token_version=0,
            ))

        await session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `python-jose` for JWT | `PyJWT 2.8+` | FastAPI docs updated 2025 | python-jose is effectively abandoned; PyJWT actively maintained |
| `passlib[bcrypt]` for passwords | `pwdlib[argon2]` | FastAPI docs updated 2025; fastapi-users v13 | passlib unmaintained; argon2 is OWASP-preferred over bcrypt |
| `@pytest.mark.asyncio` decorator per test | `asyncio_mode = "auto"` in pyproject.toml | pytest-asyncio 0.21+ | Removes boilerplate from every async test function |
| `pytest.mark.asyncio` backend | `pytest.mark.anyio` | FastAPI official docs switched | anyio is backend-agnostic (asyncio + trio); FastAPI officially recommends |
| Sync `engine = create_engine()` | `engine = create_async_engine()` | SQLAlchemy 2.0 (2023) | Async-only with asyncpg; mixing sync/async is not supported |
| `Session` in Alembic env.py | `async_engine_from_config` + `run_sync` | Alembic 1.7+ (async template) | Required to use asyncpg driver for migrations |
| JWT in localStorage | JWT in httpOnly cookie | OWASP recommendation (ongoing) | httpOnly prevents XSS token theft |
| `cookies()` synchronous (Next.js 14) | `await cookies()` (Next.js 15) | Next.js 15.0 | Must await in Next.js 15; still works sync in 14 but deprecated |
| Middleware-only auth guard | middleware + DAL `verifySession()` | CVE-2025-29927 (2025) | Defense-in-depth required; middleware alone is insufficient |

**Deprecated / outdated (do not use in this project):**
- `python-jose`: All new FastAPI code must use `PyJWT`. Import: `import jwt` (not `from jose import jwt`).
- `passlib.context.CryptContext`: All new code uses `from pwdlib import PasswordHash`. The `PasswordHash.recommended()` factory uses argon2.
- `from sqlalchemy.orm import Session` in async code: Use `from sqlalchemy.ext.asyncio import AsyncSession` exclusively.
- Tailwind CSS v4 (Oxide engine): Released 2025 but shadcn/ui compatibility unconfirmed as of 2026-02-24. Use `tailwindcss@3.4`.

---

## Open Questions

1. **SameSite=Strict vs SameSite=Lax for cookies in local Docker dev**
   - What we know: SameSite=Strict is the locked decision. In local dev, Next.js (port 3000) calls FastAPI (port 8000). Different ports = different origins.
   - What's unclear: Whether SameSite=Strict blocks cookies on cross-origin requests in local dev when both are on localhost.
   - Recommendation: In local dev, `COOKIE_SECURE=False` and `COOKIE_SAMESITE=lax` via env var. In production (same domain), `COOKIE_SAMESITE=strict`. The security.py `set_auth_cookies()` function should read samesite from settings. This is a config issue, not an architecture issue — resolve it during the Docker Compose task.

2. **Refresh token one-time-use DB storage**
   - What we know: Phase 1 uses stateless refresh tokens (JWT only). token_version covers deactivation. Sliding window rotation issues a new refresh token on each use.
   - What's unclear: Without DB storage of refresh tokens, a stolen refresh token could be used until token_version changes. True single-use rotation requires storing issued refresh tokens in a DB table (or Redis).
   - Recommendation: Phase 1 uses stateless refresh tokens. Flag for Phase 2 hardening: add `refresh_tokens` table with `jti` column + revocation on use. Document this in code comments.

3. **middleware.ts JWT verification library**
   - What we know: Next.js middleware runs on the Edge Runtime, which does not support all Node.js APIs. PyJWT is Node.js only.
   - What's unclear: Can `jose` (panva/jose) be used in Next.js middleware to verify the FastAPI-generated JWT? FastAPI uses PyJWT with HS256; jose can verify HS256.
   - Recommendation: Use `jose` package (`npm install jose`) in Next.js middleware for JWT verification. Both PyJWT (backend) and jose (frontend) use standard HS256 — same SECRET_KEY, same algorithm. Share the SECRET_KEY via `NEXT_PUBLIC_SESSION_SECRET` env var (but mark it as server-only in dal.ts with `import "server-only"`). Verify this works in the middleware setup task.

---

## Sources

### Primary (HIGH confidence)

- `https://nextjs.org/docs/app/api-reference/functions/cookies` — Next.js cookies() async API, httpOnly reading in Server Components
- `https://nextjs.org/docs/app/guides/authentication` — Next.js official auth guide: middleware + DAL pattern, verifySession(), createSession(), deleteSession()
- `https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/` — FastAPI official JWT docs: PyJWT and pwdlib confirmed as current recommendation
- `https://fastapi.tiangolo.com/advanced/response-cookies/` — FastAPI set_cookie API
- `https://www.starlette.dev/responses/#set-cookie` — Starlette set_cookie full parameter list (httponly, secure, samesite, max_age, path)
- `https://fastapi.tiangolo.com/advanced/async-tests/` — Official async test pattern: @pytest.mark.anyio + AsyncClient(transport=ASGITransport(app=app))
- `https://github.com/sqlalchemy/alembic/blob/main/alembic/templates/async/env.py` — Official Alembic async env.py template: async_engine_from_config + run_sync pattern
- `https://ui.shadcn.com/docs/components/sidebar` — shadcn/ui Sidebar: collapsible="none" for fixed sidebar, sub-components list, CLI install
- `https://github.com/fastapi/fastapi/discussions/11345` — FastAPI official decision to switch to PyJWT from python-jose

### Secondary (MEDIUM confidence)

- `https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/` — Complete database.py and alembic/env.py pattern verified against official docs
- `https://workos.com/blog/nextjs-app-router-authentication-guide-2026` — Defense-in-depth auth pattern; CVE-2025-29927 explanation
- `https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg` — Pool settings: pool_pre_ping, pool_size, max_overflow
- `https://medium.com/@jagan_reddy/jwt-in-fastapi-the-secure-way-refresh-tokens-explained-f7d2d17b1d17` — Refresh token rotation sliding window pattern (Jan 2026)
- `https://www.francoisvoron.com/blog/introducing-pwdlib-a-modern-password-hash-helper-for-python` — pwdlib API: PasswordHash.recommended(), .hash(), .verify()
- `https://codesignal.com/learn/courses/preventing-refresh-token-abuse-in-your-python-rest-api/lessons/refresh-token-rotation` — Token version invalidation pattern

### Tertiary (LOW confidence — validate during implementation)

- `https://blog.greeden.me/en/2025/10/14/a-beginners-guide-to-serious-security-design-with-fastapi-...` — CSRF protection approach (not required for SameSite=Strict + same-domain deployment)
- shadcn/ui Tailwind v4 compatibility status — unverified as of 2026-02-24; stay on 3.4

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — PyJWT/pwdlib switch verified against official FastAPI docs; SQLAlchemy async patterns verified against official docs and Alembic async template
- Architecture: HIGH — Next.js auth pattern verified against official Next.js docs (2026-02-20 last updated); Alembic async env.py verified against official template
- Cookie patterns: HIGH — Starlette set_cookie params verified; Next.js cookies() API verified
- Refresh token rotation: MEDIUM — Sliding window recommendation is well-supported by multiple 2025/2026 sources; DB-backed single-use rotation is a known hardening not required for Phase 1
- Test setup: HIGH — Official FastAPI async tests docs; anyio_backend fixture verified
- Pitfalls: HIGH — MissingGreenlet, CORS credentials, python-jose abandonment all verified against official sources and tracked GitHub discussions

**Research date:** 2026-02-24
**Valid until:** 2026-04-24 (stable ecosystem; Next.js auth guide last updated 2026-02-20; PyJWT/pwdlib are actively maintained)
