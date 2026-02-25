---
phase: 01-foundation-and-auth
plan: "03"
subsystem: ui
tags: [nextjs, typescript, tailwind, shadcn, jose, jwt, cookies, middleware, auth]

# Dependency graph
requires:
  - phase: 01-foundation-and-auth/01-02
    provides: FastAPI auth endpoints (login, logout, me, refresh) with httpOnly cookie JWT
provides:
  - Next.js 14 App Router frontend with working login/logout/session flow
  - Two-layer auth guard (middleware.ts + verifySession DAL)
  - Fixed 240px sidebar with department nav and user info
  - Authenticated app shell for all future phases to build into
affects:
  - 02-kanban-board (builds board page into app shell, uses sidebar dept filter)
  - 03-ai-assistant (uses authenticated layout, user session)
  - 04-notifications (uses app layout)
  - 05-analytics (uses app layout and sidebar)
  - 06-admin (admin role check from verifySession)

# Tech tracking
tech-stack:
  added:
    - next@14 (App Router, TypeScript, Tailwind)
    - shadcn/ui (sidebar, button, input, form, label, card, badge)
    - jose (edge-compatible JWT verification for middleware)
    - server-only (DAL protection)
  patterns:
    - Two-layer auth guard: middleware.ts (edge, fast cookie/JWT check) + verifySession() DAL (full /api/auth/me call)
    - Route groups: (auth) for public routes, (app) for protected routes
    - Server Actions for logout (cookie clearing requires server-side)
    - AppSidebar receives user from verifySession() in layout — no client-side user fetching

key-files:
  created:
    - frontend/src/middleware.ts
    - frontend/src/lib/dal.ts
    - frontend/src/lib/api/client.ts
    - frontend/src/app/(auth)/layout.tsx
    - frontend/src/app/(auth)/login/page.tsx
    - frontend/src/app/(app)/layout.tsx
    - frontend/src/app/(app)/board/page.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/components/sidebar/AppSidebar.tsx
    - frontend/src/app/actions/auth.ts
  modified:
    - docker-compose.yml
    - frontend/package.json
    - frontend/next.config.ts
    - frontend/tailwind.config.ts

key-decisions:
  - "NEXT_PUBLIC_SESSION_SECRET matches backend SECRET_KEY — middleware uses same key for JWT verification without a DB call"
  - "jose used instead of jsonwebtoken — edge runtime requires ESM-compatible crypto; jose works in Next.js middleware"
  - "Server Action (logoutAction) used for logout — cookie deletion requires server-side; client-side fetch-only cannot clear httpOnly cookies"
  - "COOKIE_SECURE defaults false — allows local dev over HTTP; production sets COOKIE_SECURE=true"
  - "useTransition replaced with plain useState for login form — avoids async state update issues with Next.js router.push inside transitions"
  - "Browser vs server-side API URLs split — NEXT_PUBLIC_API_URL for browser fetches (localhost:8000), INTERNAL_API_URL for server-side fetches (backend:8000 via Docker network)"

patterns-established:
  - "Pattern: Two-layer auth — middleware fast-rejects at edge, verifySession() does full API call in protected layout"
  - "Pattern: DAL isolation — verifySession() in lib/dal.ts marked server-only; imported only by server components/layouts"
  - "Pattern: Route groups — (auth) and (app) enable layout isolation without URL path segments"
  - "Pattern: User passed as prop — AppSidebar receives SessionUser from layout; no useContext or client-side session hook"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-07, DEPT-02]

# Metrics
duration: 45min
completed: 2026-02-25
---

# Phase 1 Plan 03: Next.js Frontend with Two-Layer Auth Guard Summary

**Next.js 14 App Router with jose-based middleware auth guard, verifySession() DAL, login page with inline errors, fixed 240px shadcn sidebar with 7 departments and Server Action logout**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files modified:** 20+

## Accomplishments

- Complete two-layer auth guard: edge middleware (jose JWT check, no DB) + verifySession() DAL (FastAPI /api/auth/me call) in protected layout
- Login page with inline error "Invalid email or password", dismissable session-expiry banner, no Sign Up link, no toast on success
- Fixed 240px AppSidebar with Board (active), Dashboard/Portal/Wiki (grayed disabled), 7 department links, user initials + name + role badge + logout
- Server Action logout that clears httpOnly cookies and redirects to /login
- All 8 human verification checks passed (unauthenticated redirect, login UX, wrong credentials inline error, successful login, sidebar appearance, session persistence, logout, expiry banner)

## Task Commits

Each task was committed atomically:

1. **Task 1: Next.js scaffold, middleware auth guard, DAL, API client, route groups** - `afa10df` (feat)
2. **Task 2: LoginForm with inline errors, AppSidebar with department nav and logout** - `d4c1eb6` (feat)

**Auto-fixes during Task 1-2 verification:**
- `49e06a0` — fix: replace default Next.js page with /board redirect
- `4d669da` — fix: split browser vs server-side API URLs
- `dd23c4d` — fix: replace useTransition with plain useState for login form
- `89a7a7b` — fix: make COOKIE_SECURE configurable, default false for local dev

## Files Created/Modified

- `frontend/src/middleware.ts` — Edge-layer JWT cookie presence check using jose; redirects unauthenticated to /login
- `frontend/src/lib/dal.ts` — verifySession() DAL; calls FastAPI /api/auth/me; used in (app)/layout.tsx as second auth layer
- `frontend/src/lib/api/client.ts` — Typed fetch wrapper: login(), logout(), getDepartments()
- `frontend/src/app/(app)/layout.tsx` — Protected layout; calls verifySession(), wraps with SidebarProvider and AppSidebar
- `frontend/src/app/(auth)/layout.tsx` — Public routes layout; centered card on slate-50 background
- `frontend/src/app/(auth)/login/page.tsx` — Login page; centered card, no Sign Up link
- `frontend/src/components/auth/LoginForm.tsx` — Login form with inline errors, expiry banner, no toast on success
- `frontend/src/components/sidebar/AppSidebar.tsx` — Fixed 240px sidebar; collapsible="none"; 7 departments; user footer with logout
- `frontend/src/app/actions/auth.ts` — Server Action logoutAction(); clears cookies server-side, redirects to /login
- `frontend/src/app/(app)/board/page.tsx` — Placeholder board page for Phase 2
- `docker-compose.yml` — Updated frontend service with real Next.js build

## Decisions Made

- **jose over jsonwebtoken:** Edge runtime (Next.js middleware) requires ESM-compatible crypto. jose works in the edge runtime; jsonwebtoken does not.
- **Server Action for logout:** httpOnly cookies can only be deleted server-side. Using a Server Action (not client-side fetch) ensures the cookie is actually cleared.
- **COOKIE_SECURE=false default:** FastAPI sets `secure=True` on cookies only if COOKIE_SECURE env var is set. Defaults to false so local HTTP dev works without HTTPS.
- **useState over useTransition:** useTransition caused issues with async router.push inside the transition; plain useState + async handleSubmit resolved the form state bug.
- **Split API URLs:** NEXT_PUBLIC_API_URL (http://localhost:8000) for browser fetches; INTERNAL_API_URL (http://backend:8000) for server-side fetches inside Docker network.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Default Next.js page replaced with /board redirect**
- **Found during:** Task 1 verification (build + smoke test)
- **Issue:** create-next-app generated a default page.tsx at app/ root that rendered Next.js welcome UI instead of redirecting authenticated users to /board
- **Fix:** Replaced with redirect("/board") so root path sends users to the correct destination
- **Files modified:** frontend/src/app/page.tsx
- **Verification:** Visiting http://localhost:3000 redirects to /board (or /login if unauthenticated)
- **Committed in:** `49e06a0`

**2. [Rule 1 - Bug] Split browser vs server-side API base URLs**
- **Found during:** Task 2 verification (DAL fetch in Docker network)
- **Issue:** NEXT_PUBLIC_API_URL=http://localhost:8000 is correct for browser-side fetches, but server-side fetches (dal.ts inside Docker) need http://backend:8000 (internal Docker hostname)
- **Fix:** Added INTERNAL_API_URL env var for server-side fetches; dal.ts uses process.env.INTERNAL_API_URL, client.ts uses NEXT_PUBLIC_API_URL
- **Files modified:** frontend/src/lib/dal.ts, docker-compose.yml, frontend/.env.local.example
- **Verification:** verifySession() reaches FastAPI at backend:8000 inside Docker network
- **Committed in:** `4d669da`

**3. [Rule 1 - Bug] Replaced useTransition with plain useState for login form**
- **Found during:** Task 2 verification (form submit behavior)
- **Issue:** useTransition wrapping async router.push caused React state update warnings and inconsistent isPending behavior
- **Fix:** Replaced useTransition with plain useState(false) for isPending; async handleSubmit handles loading state directly
- **Files modified:** frontend/src/components/auth/LoginForm.tsx
- **Verification:** Form disables correctly during submission, error state updates reliably
- **Committed in:** `dd23c4d`

**4. [Rule 2 - Missing Critical] COOKIE_SECURE made configurable**
- **Found during:** Task 2 verification (login fails silently over HTTP)
- **Issue:** Backend set cookies with secure=True by default, causing browsers to reject cookies over HTTP in local dev
- **Fix:** Added COOKIE_SECURE env var to FastAPI auth router; defaults to False so local HTTP dev works; production sets COOKIE_SECURE=true
- **Files modified:** backend/app/api/routers/auth.py, docker-compose.yml
- **Verification:** Login over HTTP localhost:3000 correctly sets cookie; auth flow completes end-to-end
- **Committed in:** `89a7a7b`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 1 bug, 1 Rule 2 missing critical)
**Impact on plan:** All auto-fixes were necessary for the app to function correctly in local Docker dev. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above. All 8 human verification checks passed on first review.

## User Setup Required

None - no external service configuration required. Local dev uses docker compose up with existing .env.

## Next Phase Readiness

- App shell is complete and stable — Phase 2 (Kanban Board) builds the board page into `frontend/src/app/(app)/board/page.tsx`
- Sidebar dept filter links (`/board?dept={slug}`) are already wired; Phase 2 reads the `dept` query param to filter board columns
- verifySession() provides user.role to all protected layouts — admin-gated features in Phase 6 can use this directly
- docker-compose.yml frontend service is production-ready for dev; Dockerfile builds correctly

---
*Phase: 01-foundation-and-auth*
*Completed: 2026-02-25*
