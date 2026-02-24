# Phase 1: Foundation and Auth - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a fully containerized, runnable stack (Docker Compose + PostgreSQL + FastAPI + Next.js) with JWT authentication for admin and member roles, 7 seeded departments, and a Next.js shell with login/register pages, auth guard, and an authenticated sidebar. Creating tickets, Kanban board, and any feature work are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Registration access
- **Admin-creates-users only — no open self-registration**
- Only an existing admin can create new user accounts (POST /api/auth/users, admin-only)
- The very first admin is created exclusively via the seed script (`python -m app.scripts.seed`)
- This is an internal tool for the AI dev team only; open sign-up is a security risk
- The login page has no "Sign up" link — just email + password fields

### Sidebar layout
- **Fixed left sidebar, always visible** — no collapsible/hamburger in desktop view
- Top: XBO logo / app name ("XBO TeamHub")
- Middle nav section: main navigation links (Board, Dashboard, Department Portal, Wiki)
- Below nav: department list as individual clickable nav links with department name
- Bottom: current user's avatar initials + full name + role badge (admin/member), and a logout button
- Active nav item highlighted with accent color
- Sidebar does NOT collapse in v1 — fixed width (~240px)

### Post-login landing
- **Default landing after login: Kanban board (`/board`)**
- After registration by admin, the new user is NOT auto-logged-in — admin creates the account, shares credentials separately; new user logs in manually
- On session expiry, redirect to `/login?reason=expired` — login page shows a dismissable "Session expired, please log in again" banner

### Auth UX & error handling
- **Inline form validation errors** (not toast) for login/register forms — errors appear below the relevant field
- Wrong password / user not found: generic "Invalid email or password" message (don't reveal which is wrong)
- Successful login: no toast, just redirect to `/board`
- Admin user creation success: toast notification "User created successfully"
- JWT stored in **httpOnly + Secure + SameSite=Strict cookie** — never in localStorage
- Access token TTL: 15 minutes; refresh token TTL: 7 days
- Token versioning (`token_version` integer on User row) — deactivating a user increments version, invalidating all existing tokens within one TTL cycle

### First-run / seed behavior
- Seed script creates:
  1. All 7 departments (cashier, fintech360, xbo_studio, xbo_marketing, xbo_dev, xbo_legal, xbo_hr)
  2. One admin user: email `admin@xbo.com`, password from `SEED_ADMIN_PASSWORD` env var (no hardcoded credentials)
- Seed is idempotent — safe to run multiple times without duplicating data

### Navigation structure (sidebar nav items)
- Board → `/board` (Kanban)
- Dashboard → `/dashboard` (Executive KPIs — Phase 4, link present but disabled or hidden until Phase 4 ships)
- Department Portal → `/portal` (Phase 3, same)
- Wiki → `/wiki` (Phase 5, same)
- Departments section below nav: clicking a department filters the board by that department

### Claude's Discretion
- Exact color palette / design tokens for the sidebar (use Tailwind slate/gray neutrals as base)
- Loading skeleton vs spinner on page transitions
- Exact Tailwind component choices for form inputs (shadcn/ui Input and Button components are fine)
- Refresh token rotation strategy details (sliding window or fixed TTL — researcher should determine best practice)
- Whether to use Next.js middleware or layout-level auth guard (researcher should confirm best App Router pattern)

</decisions>

<specifics>
## Specific Ideas

- The user referenced a "screenshot" of a sidebar layout during initial scoping but did not attach it. Apply a clean, Linear/Notion-style sidebar: subtle background differentiation, department names as plain nav links, nothing ornate.
- Internal tool aesthetic: functional over decorative. No marketing-style landing page — the login page is simple (centered card, logo, form fields, submit button).
- Departments in the sidebar are static (seeded), not user-created in v1 — they should render as a plain nav list, not a complex expandable tree.

</specifics>

<deferred>
## Deferred Ideas

- Invite-by-email flow — would require email infrastructure (out of scope v1)
- Admin user management UI (list users, deactivate, change roles) — deferred to a future admin panel phase; v1 admin creates users via API or a minimal admin page
- Sidebar collapsible / responsive mobile nav — v2 if mobile usage is observed
- "Remember me" / persistent login beyond 7-day refresh — out of scope v1

</deferred>

---

*Phase: 01-foundation-and-auth*
*Context gathered: 2026-02-24*
