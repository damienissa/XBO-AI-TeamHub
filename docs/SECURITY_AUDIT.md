# Security Audit & Remediation Report

**Date:** 2026-03-06
**Scope:** Full-stack security scan of XBO AI TeamHub (FastAPI + Next.js 14)
**Findings:** 34 vulnerabilities (3 Critical, 10 High, 14 Medium, 7 Low)
**Status:** All code-level fixes applied. Operational steps (secret rotation) required separately.

---

## Vulnerabilities Found & Fixes Applied

### Phase 0: Secret Rotation (Operational — Manual Action Required)

| # | Severity | Issue | Action Required |
|---|----------|-------|-----------------|
| 1 | **Critical** | Anthropic API key in plaintext `.env` on disk | Rotate key in Anthropic console, update `.env` |
| 2 | **Critical** | JWT `SECRET_KEY` in plaintext `.env` on disk | Generate new 64-char hex, update `.env` |
| 3 | **High** | Weak seed admin password (`Admin123!`) | Set strong 20+ char password in `.env` |

---

### Phase 1: Critical Frontend Security

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 4 | **Critical** | JWT secret exposed via `NEXT_PUBLIC_` prefix — bundled into client JS | Renamed to `SESSION_SECRET` (server-only) | `middleware.ts:4`, `.env.local.example:2`, `docker-compose.yml:51`, `docs/DEPLOYMENT.md` |
| 5 | **High** | No security headers (CSP, X-Frame-Options, etc.) | Added `headers()` in next.config with X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy | `next.config.mjs` |
| 6 | **High** | `/settings` and `/dept` routes not protected by middleware | Added to `protectedRoutes` array | `middleware.ts:6` |
| 7 | **Low** | Hardcoded `http://localhost:8000` fallback in production | Added production guard that throws if `NEXT_PUBLIC_API_URL` missing | `client.ts:1` |
| 8 | **Medium** | Production source maps not explicitly disabled | Added `productionBrowserSourceMaps: false` | `next.config.mjs` |

---

### Phase 2: Auth Hardening

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 9 | **High** | No rate limiting on login (brute-force possible) | Added `slowapi` with 5/min limit on login | `requirements.txt`, `main.py`, `auth.py:27` |
| 10 | **High** | No rate limiting on AI endpoints (cost abuse) | Added 20/min on AI endpoints, 30/min on chat | `ai.py`, `assistant.py` |
| 11 | **Medium** | Logout doesn't invalidate token server-side | Logout now calls `invalidate_user_tokens()` to increment `token_version` | `auth.py:49-53` |
| 12 | **Medium** | No `is_active` check in `get_current_user` | Added check after token_version validation | `dependencies.py:55` |
| 13 | **Medium** | `COOKIE_SECURE` defaults to `false` | Changed default to `True` (override in `.env` for local dev) | `config.py:9` |
| 14 | **Medium** | 8-hour access token TTL | Reduced to 30 minutes (refresh token handles continuity) | `security.py:14` |
| 15 | **Medium** | No password strength validation on `UserCreate` | Added validator: 12+ chars, uppercase, lowercase, digit, max 128 | `schemas/auth.py` |
| 16 | **Low** | No email validation on `UserCreate` | Changed to `EmailStr` (added `email-validator` package) | `schemas/auth.py:19` |

---

### Phase 3: Backend Authorization & Input Validation

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 17 | **Medium** | Mass assignment via `setattr` loops (tickets, wiki, templates) | Added `frozenset` allowlists from schema `model_fields.keys()` | `tickets.py:149`, `wiki.py:105`, `templates.py:74` |
| 18 | **High** | Unvalidated custom field values (arbitrary JSON, no size limit) | Added 64KB size limit on JSONB payload | `tickets.py:251` |
| 19 | **Medium** | Any user can modify/delete any template | Added ownership check: creator or admin only | `templates.py:58,82` |
| 20 | **Medium** | No auth on `GET /api/departments` | Added `get_current_user` dependency | `departments.py:13`, `client.ts:87` |
| 21 | **Medium** | File upload reads entire body before size check (DoS) | Changed to chunked streaming with early 413 rejection | `attachments.py:88`, `ai.py:288` |
| 22 | **High** | Unbounded in-memory conversation store (memory DoS) | Added `MAX_CONVERSATIONS_PER_USER = 20` with LRU eviction | `assistant.py:20` |

---

### Phase 4: Error Handling & CORS Hardening

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 23 | **Medium** | AI error messages forwarded to client (info leak) | Replaced with generic message; log details server-side | `ai.py:108,162,207,340`, `assistant.py:181` |
| 24 | **Medium** | No global exception handler (stack traces in responses) | Added `@app.exception_handler(Exception)` returning generic 500 | `main.py` |
| 25 | **Medium** | CORS allows all methods/headers (`["*"]`) | Restricted to explicit `GET/POST/PATCH/DELETE/OPTIONS` and `Content-Type/X-Requested-With` | `main.py:31-37` |
| 26 | **Medium** | CORS origin hardcoded to `localhost:3000` | Made configurable via `CORS_ORIGINS` setting in `config.py` | `config.py`, `main.py` |
| 27 | **Low** | Anthropic client created per-request in assistant (resource waste) | Consolidated to reuse singleton from `ai.py` | `assistant.py:61-67` |

---

### Phase 5: Infrastructure Hardening

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 28 | **High** | Docker containers run as root | Added non-root `appuser` in both Dockerfiles | `backend/Dockerfile`, `frontend/Dockerfile` |
| 29 | **Medium** | PostgreSQL port exposed to all interfaces | Restricted to `127.0.0.1:5432:5432` | `docker-compose.yml:8-9` |
| 30 | **Medium** | Dev mode in docker-compose (`--reload`, `npm run dev`) | Created `docker-compose.prod.yml` override with production commands | `docker-compose.prod.yml` (new) |
| 31 | **Low** | Dev dependencies in production requirements | Moved pytest/ruff/httpx to `requirements-dev.txt` | `requirements.txt`, `requirements-dev.txt` (new) |
| 32 | **Medium** | Root `.gitignore` only has `.env` (too minimal) | Expanded to cover `.env.*`, `*.pem`, `*.key`, IDE dirs | `.gitignore` |

---

### Phase 6: Low-Priority Fixes

| # | Severity | Vulnerability | Fix | File(s) |
|---|----------|--------------|-----|---------|
| 33 | **Low** | Fragile `text("'week'")` SQL in dashboard | Changed to `literal_column("'week'")` | `dashboard.py:134` |
| 34 | **Low** | Silent exception swallowing in attachment text extraction | Added `logger.warning()` with `exc_info=True` | `attachments.py:165` |

---

## Positive Security Observations (No Issues Found)

- No SQL injection — all queries use SQLAlchemy ORM properly
- No XSS vectors — no `dangerouslySetInnerHTML`, `eval()`, or `innerHTML` usage
- No command injection — no `os.system()` or `subprocess` calls
- No insecure deserialization — no `pickle` or unsafe `yaml.load`
- Passwords hashed with `pwdlib` (Argon2)
- JWT stored in httpOnly cookies (not localStorage)
- Token version mechanism exists for revocation
- Rich text stored as TipTap JSON (not raw HTML)
- `.env` files not tracked in git

---

## Files Modified (24 total)

**Backend (17 files):**
- `backend/app/main.py` — rate limiter, global exception handler, CORS tightening
- `backend/app/core/config.py` — `COOKIE_SECURE` default, `CORS_ORIGINS` setting
- `backend/app/core/security.py` — access token TTL (480 -> 30 min)
- `backend/app/dependencies.py` — `is_active` check
- `backend/app/routers/auth.py` — rate limits, logout token invalidation
- `backend/app/routers/ai.py` — rate limits, error sanitization, streaming upload
- `backend/app/routers/assistant.py` — rate limits, error sanitization, bounded store, singleton client
- `backend/app/routers/tickets.py` — field allowlist, custom field size limit
- `backend/app/routers/wiki.py` — field allowlist
- `backend/app/routers/templates.py` — field allowlist, ownership check
- `backend/app/routers/departments.py` — added auth
- `backend/app/routers/attachments.py` — streaming upload, exception logging
- `backend/app/routers/dashboard.py` — `literal_column` fix
- `backend/app/schemas/auth.py` — password validation, email validation
- `backend/requirements.txt` — added `slowapi`, `email-validator`; removed dev deps
- `backend/Dockerfile` — non-root user

**Frontend (4 files):**
- `frontend/src/middleware.ts` — secret rename, route protection
- `frontend/next.config.mjs` — security headers, source maps
- `frontend/src/lib/api/client.ts` — production guard, `getDepartments` auth fix
- `frontend/.env.local.example` — secret rename
- `frontend/Dockerfile` — non-root user

**Infrastructure (3 files + 2 new):**
- `docker-compose.yml` — secret rename, restrict PG port
- `.gitignore` — expanded patterns
- `docs/DEPLOYMENT.md` — updated variable references
- `docker-compose.prod.yml` (new) — production overrides
- `backend/requirements-dev.txt` (new) — dev dependencies

---

## Remaining Manual Steps

1. **Rotate Anthropic API key** — generate new key in Anthropic console, update `.env`
2. **Rotate JWT SECRET_KEY** — run `python3 -c "import secrets; print(secrets.token_hex(32))"`, update `.env`
3. **Set strong SEED_ADMIN_PASSWORD** — 20+ random chars in `.env`
4. **Rename env var in local frontend** — change `NEXT_PUBLIC_SESSION_SECRET` to `SESSION_SECRET` in `frontend/.env.local`
5. **Install new dependencies** — `pip install slowapi email-validator` or rebuild Docker images
