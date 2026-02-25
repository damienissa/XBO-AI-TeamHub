---
phase: "01"
status: passed
verified_at: 2026-02-25
---

# Phase 1 Verification: Foundation and Auth

## Status: PASSED

**Goal:** Any XBO AI team member can create an account, log in, and access the application with appropriate role-based permissions — on a fully containerized stack with correct architectural foundations in place

## Must-Haves Verified

### From 01-01 (Backend Foundation)
- [x] `docker compose up` starts postgres, backend, and frontend containers without errors — confirmed running
- [x] `alembic upgrade head` runs cleanly — confirmed during execution
- [x] `GET /api/departments` returns JSON array of 7 departments
- [x] Seed script creates 7 departments and admin@xbo.com idempotently
- [x] FastAPI `/docs` reachable at http://localhost:8000/docs

### From 01-02 (Auth Endpoints)
- [x] `POST /api/auth/login` with valid credentials sets httpOnly cookie and returns user info
- [x] `POST /api/auth/login` with wrong password returns 401
- [x] `GET /api/auth/me` with valid cookie returns current user
- [x] `POST /api/auth/logout` clears cookies
- [x] `POST /api/auth/refresh` issues new tokens (sliding window)
- [x] `POST /api/auth/users` admin-only; member gets 403
- [x] `PATCH /api/auth/users/{id}/role` increments token_version
- [x] Protected endpoint without cookie returns 401
- [x] 16 pytest tests passing

### From 01-03 (Frontend Auth) — Human Verified
- [x] Unauthenticated visit to /board redirects to /login
- [x] Login page: no Sign Up link, inline errors
- [x] Successful login redirects to /board, no toast
- [x] Session persists across browser refresh
- [x] Fixed 240px sidebar: "XBO TeamHub", Board active, Dashboard/Portal/Wiki grayed, all 7 departments, user footer
- [x] Logout clears session and redirects to /login
- [x] /login?reason=expired shows dismissable amber banner

## Requirements Coverage

| Requirement | Plan | Status |
|-------------|------|--------|
| AUTH-01 (admin creates users) | 01-02 | ✓ Verified |
| AUTH-02 (login with JWT cookie) | 01-02, 01-03 | ✓ Verified |
| AUTH-03 (session persists) | 01-02, 01-03 | ✓ Verified |
| AUTH-04 (logout clears cookie) | 01-02, 01-03 | ✓ Verified |
| AUTH-05 (two roles: admin/member) | 01-02 | ✓ Verified |
| AUTH-06 (admin assigns roles) | 01-02 | ✓ Verified |
| AUTH-07 (protected routes redirect) | 01-02, 01-03 | ✓ Verified |
| AUTH-08 (token version invalidation) | 01-02 | ✓ Verified |
| DEPT-01 (7 seeded departments) | 01-01 | ✓ Verified |
| DEPT-02 (sidebar dept links) | 01-03 | ✓ Verified |
| DEPT-03 (API returns departments) | 01-01, 01-02 | ✓ Verified |

## Notes

Three local dev fixes applied during execution (not spec gaps):
1. `COOKIE_SECURE=false` — browsers drop Secure cookies on http://
2. `COOKIE_SAMESITE=lax` — Strict blocks cross-port fetches in local dev
3. `NEXT_PUBLIC_API_URL=http://localhost:8000` / `INTERNAL_API_URL=http://backend:8000` — split browser vs server-side URLs
