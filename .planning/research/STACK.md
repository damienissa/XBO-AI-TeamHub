# Technology Stack

**Project:** XBO AI TeamHub
**Researched:** 2026-02-24
**Research mode:** Training data only (WebSearch/WebFetch/Context7 unavailable in this session)

> **Note on confidence:** All version numbers and library recommendations are based on training data with an August 2025 cutoff. External verification was not possible this session. Items marked LOW confidence should be spot-checked against npm, PyPI, or official docs before finalizing.

---

## Recommended Stack

### Backend Core

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.12 | Runtime | 3.12 is the stable LTS-equivalent as of 2025; 3.13 released but ecosystem lagging |
| FastAPI | 0.111+ | API framework | Async-native, Pydantic v2 integrated, OpenAPI auto-docs, fastest Python web framework for new projects |
| Uvicorn | 0.29+ | ASGI server | Standard pairing with FastAPI; Gunicorn+Uvicorn workers for production |
| Pydantic | 2.x | Data validation | v2 is 5-17x faster than v1; FastAPI 0.100+ requires/uses it; do NOT use v1 |
| SQLAlchemy | 2.x | ORM | 2.0 style (mapped_column, select() syntax) is the standard; async session support built-in |
| Alembic | 1.13+ | Migrations | Only migration tool for SQLAlchemy; autogenerate + env.py pattern |
| asyncpg | 0.29+ | Async PG driver | Required for SQLAlchemy async with PostgreSQL; faster than psycopg2 for async workloads |
| psycopg2-binary | 2.9+ | Sync PG driver | Fallback/Alembic migrations (Alembic needs sync connection); keep alongside asyncpg |

**Confidence:** MEDIUM — FastAPI/Pydantic v2/SQLAlchemy 2.x are well-established as of Aug 2025. Exact patch versions not verified.

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 | Primary database | JSONB for custom fields schema, good JSON operators, mature, RDS-compatible. PG 17 released late 2024 but 16 has wider managed service support |
| Redis | 7.x | Background job queue / rate limit cache | Optional in v1 if polling-only; needed if you add ARQ or Celery later |

**Confidence:** MEDIUM — PostgreSQL 16 is safe. Redis is optional in v1 per out-of-scope constraints.

### Auth

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| python-jose[cryptography] | 3.3+ | JWT encode/decode | **Recommended over authlib for pure JWT use** — simpler API, narrower scope, widely used in FastAPI docs and tutorials. authlib is the better choice if you need OAuth2/OIDC flows, which are out of scope for v1 |
| passlib[bcrypt] | 1.7.4 | Password hashing | bcrypt via passlib is the FastAPI-documented standard; argon2-cffi is stronger but overkill for internal tool |
| python-multipart | 0.0.9+ | Form data parsing | Required by FastAPI for OAuth2PasswordRequestForm (used in login endpoint even with JWT) |

**Do NOT use:**
- `authlib` for this project — powerful but over-engineered for email/password + JWT only; its async support adds complexity without benefit here
- `PyJWT` alone — lacks the claim validation helpers that python-jose provides; usable but more manual work
- `djangorestframework-simplejwt` — Django ecosystem only

**Confidence:** MEDIUM — python-jose is the FastAPI tutorial standard. However: python-jose has had slow maintenance cadence since 2022. If the team finds it unmaintained, `PyJWT` (2.8+) is a solid drop-in with similar API surface.

### Background Jobs (v1: not needed; v2: add if polling becomes painful)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ARQ | 0.25+ | Async task queue | Async-native (asyncio), Redis-backed, minimal config. Preferred over Celery for FastAPI projects — Celery's sync worker model fights asyncio |

**Do NOT use:**
- `Celery` with FastAPI — requires sync workers or complex greenlet bridges; ARQ is the idiomatic async choice

**Confidence:** MEDIUM — ARQ is well-regarded in the FastAPI community as of Aug 2025.

---

### Frontend Core

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 14.x (App Router) | React framework | App Router is stable and the default since 14; Server Components reduce client bundle; locked per requirements |
| TypeScript | 5.x | Type safety | 5.4+ with strictNullChecks; required per project constraints |
| Tailwind CSS | 3.4+ | Styling | Locked per requirements; v4 (Oxide engine) released early 2025 — evaluate stability before upgrading from 3.4 |
| React | 18.x | UI library | Paired with Next.js 14; React 19 released late 2024 but Next.js 14 ships React 18 by default |

**Confidence:** MEDIUM — Next.js 14 App Router is stable. Tailwind v4 note flagged as LOW confidence — verify release/stability status.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x | Client state | Lightweight, no boilerplate, works well with App Router client components. For this scale (< 30 users, no complex offline sync), Zustand is sufficient. Redux Toolkit is overkill |
| TanStack Query (React Query) | 5.x | Server state / data fetching | Standard for REST APIs with Next.js App Router when you need caching, polling, optimistic updates. v5 is the current major version |

**Do NOT use:**
- `Redux Toolkit` — excessive ceremony for this scale; fine library but mismatched to project complexity
- `SWR` — less feature-rich than TanStack Query v5 for mutation flows and optimistic updates needed in Kanban

**Confidence:** MEDIUM — TanStack Query v5 and Zustand v4 are well-established as of Aug 2025.

### Drag-and-Drop

**Recommendation: dnd-kit**

| Library | Status | Verdict |
|---------|--------|---------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Active, maintained | **USE THIS** |
| `react-beautiful-dnd` | Effectively abandoned by Atlassian; no React 18 Strict Mode support | **DO NOT USE** |
| `@hello-pangea/dnd` | Community fork of react-beautiful-dnd | Acceptable fallback but less flexible than dnd-kit |

**Why dnd-kit:**
- Actively maintained; Atlassian deprecated react-beautiful-dnd in favor of Pragmatic Drag and Drop (their internal tool, not OSS-friendly for general use)
- Accessibility-first (keyboard navigation, screen reader announcements built-in)
- Works correctly with React 18 Strict Mode (react-beautiful-dnd has known Strict Mode issues)
- Headless — no imposed CSS, pairs well with Tailwind
- Supports the exact Kanban pattern needed: `@dnd-kit/sortable` for card reorder within columns, custom collision detection for cross-column drops

**Version:** `@dnd-kit/core` ~6.1.x, `@dnd-kit/sortable` ~8.0.x, `@dnd-kit/utilities` ~3.2.x

**Do NOT use:** `react-beautiful-dnd` — last meaningful release was 2022, React 18 Strict Mode bugs are unfixed, Atlassian publicly moved away from it.

**Confidence:** HIGH — react-beautiful-dnd deprecation is well-documented. dnd-kit is the clear community successor.

### Rich Text Editor

**Recommendation: Tiptap**

| Library | Status | Verdict |
|---------|--------|---------|
| Tiptap 2.x | Active, ProseMirror-based | **USE THIS** |
| Plate | Active, complex | Acceptable but over-engineered for this use case |
| Quill | Largely stagnant | **DO NOT USE** |
| Slate.js | Active but requires significant custom work | Skip unless Tiptap fails needs |

**Why Tiptap:**
- ProseMirror-based (battle-tested core), React bindings are clean
- Headless — works with Tailwind without fighting default styles
- Extension system covers everything needed: bold/italic/links, bullet lists, code blocks, mentions (for @user in comments future feature), image insertion stubs
- `@tiptap/starter-kit` gets you 90% of what's needed in one package
- MIT licensed free tier; paid Tiptap Cloud not needed for self-hosted
- Plate is powerful but the plugin system has a steep learning curve that isn't justified for a problem statement / notes field

**Do NOT use:**
- `Quill` — last major release was 2019; React integration is unofficial; no active development
- `react-quill` wrapper — same stagnation problems, plus the React wrapper itself has issues
- `CKEditor 5` — license complications, heavy bundle

**Version:** `@tiptap/react` ~2.4.x, `@tiptap/starter-kit` ~2.4.x, `@tiptap/extension-*` as needed

**Confidence:** HIGH — Quill's stagnation is well-known. Tiptap is the clear community recommendation as of Aug 2025.

### Charts / Dashboard KPIs

**Recommendation: Recharts**

| Library | Verdict |
|---------|---------|
| Recharts | **USE THIS** — React-native, composable, good TypeScript types |
| Chart.js + react-chartjs-2 | Acceptable but imperative API fights React's declarative model |
| Victory | Heavier bundle, less community traction than Recharts |
| Tremor | Component library built on Recharts — consider for dashboard cards |

**Why Recharts:**
- Native React components (not canvas wrappers); composable API fits declarative patterns
- Sufficient for KPI cards: BarChart (throughput), LineChart (cycle time trends), simple stat cards
- Tremor (built on Recharts) provides pre-built dashboard card components that could accelerate KPI panel development — evaluate if dashboard time matters

**Version:** `recharts` ~2.12.x

**Do NOT use:** Chart.js directly — the `react-chartjs-2` wrapper works but requires imperative ref management for dynamic updates; Recharts' component model is cleaner for React.

**Confidence:** MEDIUM — Recharts is consistently recommended; exact version not externally verified.

### Date Handling

**Recommendation: date-fns**

| Library | Verdict |
|---------|---------|
| `date-fns` | **USE THIS** — tree-shakeable, functional, TypeScript-first |
| `dayjs` | Good alternative; smaller bundle but less TypeScript completeness |
| `moment` | **DO NOT USE** — deprecated, massive bundle, not tree-shakeable |
| `luxon` | Solid but heavier than date-fns for this use case |

**Why date-fns:** Tree-shakeable (import only functions you use), pure functions (no mutation bugs), excellent TypeScript types. For due dates, cycle time calculations, column time tracking — date-fns `differenceInHours`, `formatDistance`, `parseISO` cover all cases.

**Version:** `date-fns` ~3.6.x

**Confidence:** HIGH — moment deprecation and date-fns recommendation are firmly established.

### HTTP Client (Frontend → Backend)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `axios` | ~1.7.x | API client | Interceptors for JWT token injection/refresh, consistent error handling. fetch() is viable but axios interceptors clean up auth boilerplate significantly |

**Confidence:** MEDIUM — axios interceptors for JWT are a common pattern; fetch with a wrapper is equally valid.

### Form Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | ~7.52.x | Form state | Performant (uncontrolled inputs), minimal re-renders, excellent Zod integration |
| Zod | ~3.23.x | Schema validation | Pairs with React Hook Form via `@hookform/resolvers`; share schemas with backend Pydantic models conceptually |

**Confidence:** MEDIUM — React Hook Form + Zod is the dominant 2024/2025 pattern.

### UI Component Base

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | Latest (not versioned — copy-paste) | Accessible component primitives | Tailwind-native, Radix UI primitives, no runtime dependency, accessible. For a < 30 user internal tool this is ideal: fast to build, easy to customize |

**Do NOT use:** Material UI (MUI) — heavy bundle, fights Tailwind; Ant Design — similar issue. shadcn/ui with Radix is the 2025 standard for Tailwind projects.

**Confidence:** HIGH — shadcn/ui dominance in the Tailwind+Next.js ecosystem is very well established.

---

### Infrastructure / Dev

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | Latest stable | Containerization | Locked per requirements |
| Docker Compose | v2 (compose.yaml) | Local orchestration | Use `compose.yaml` not `docker-compose.yml` — v2 syntax |
| PostgreSQL (Docker) | 16-alpine | Local DB | Matches production target; alpine reduces image size |
| Nginx (optional) | alpine | Reverse proxy in compose | Useful for replicating prod routing locally; optional for v1 |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pytest | ~8.2.x | Backend tests | Locked per requirements |
| pytest-asyncio | ~0.23.x | Async test support | Required for testing FastAPI async endpoints |
| httpx | ~0.27.x | Test HTTP client | FastAPI's TestClient uses httpx under the hood; also use directly for async endpoint tests |
| factory-boy | ~3.3.x | Test fixtures | Better than manual fixture construction for complex models |
| Vitest | ~1.6.x | Frontend unit tests | Locked per requirements; faster than Jest for Vite-based Next.js setups |
| @testing-library/react | ~16.x | React component tests | Paired with Vitest for component testing |

**Confidence:** MEDIUM — pytest-asyncio and httpx pairing is the FastAPI standard. Vitest version not externally verified.

### Code Quality

| Technology | Purpose | Why |
|------------|---------|-----|
| Ruff | Python lint + format | Replaces flake8 + black + isort in one fast tool; 2024/2025 standard |
| mypy | Python type checking | Works with Pydantic v2 plugin |
| ESLint (Next.js built-in) | JS/TS linting | Next.js ships ESLint config; extend with @typescript-eslint |
| Prettier | Frontend formatting | Standard pairing with ESLint; configure to avoid rule conflicts |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Drag-and-drop | dnd-kit | react-beautiful-dnd | Abandoned, React 18 Strict Mode bugs, Atlassian deprecated it |
| Drag-and-drop | dnd-kit | @hello-pangea/dnd | Community fork works but less flexible; dnd-kit is more actively developed |
| Rich text | Tiptap | Plate | Over-engineered plugin system; higher learning curve than needed |
| Rich text | Tiptap | Quill | No active development since 2019 |
| JWT | python-jose | authlib | authlib is correct choice for OAuth2/OIDC; overkill for email+JWT only |
| JWT | python-jose | PyJWT | More manual claim validation; acceptable if python-jose maintenance becomes concern |
| Charts | Recharts | Chart.js | Imperative API fights React's model; wrapper (react-chartjs-2) adds friction |
| State | Zustand + TanStack Query | Redux Toolkit | Too much ceremony for < 30 user internal tool |
| State | Zustand + TanStack Query | SWR | Less mutation support; TanStack Query v5 is feature-superior |
| Date | date-fns | moment | Deprecated, non-tree-shakeable |
| Components | shadcn/ui | MUI / Ant Design | Heavy bundles, fight Tailwind conventions |
| Background jobs | ARQ | Celery | Celery sync workers fight asyncio; ARQ is idiomatic for FastAPI |
| Python formatter | Ruff | black + flake8 + isort | Three tools replaced by one; Ruff is 10-100x faster |

---

## Installation

```bash
# Backend (Python 3.12)
pip install fastapi uvicorn[standard] pydantic[email] \
  sqlalchemy[asyncio] alembic asyncpg psycopg2-binary \
  python-jose[cryptography] passlib[bcrypt] python-multipart \
  httpx pytest pytest-asyncio factory-boy ruff mypy

# Frontend
npm create next-app@latest frontend -- --typescript --tailwind --app
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
npm install recharts date-fns axios zustand @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install -D vitest @testing-library/react @testing-library/user-event

# shadcn/ui (run interactively after Next.js setup)
npx shadcn-ui@latest init
# Then add components as needed:
npx shadcn-ui@latest add button card dialog badge input textarea
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| FastAPI + SQLAlchemy 2 + Pydantic v2 | MEDIUM | Well-established stack as of Aug 2025; patch versions unverified |
| python-jose for JWT | MEDIUM | FastAPI tutorial standard; maintenance cadence concern flagged |
| dnd-kit recommendation | HIGH | react-beautiful-dnd deprecation is public knowledge |
| Tiptap recommendation | HIGH | Quill stagnation widely documented |
| shadcn/ui recommendation | HIGH | Dominant Tailwind+Next.js component pattern |
| date-fns over moment | HIGH | Moment deprecated officially |
| Recharts | MEDIUM | Consistent recommendation; version unverified |
| TanStack Query v5 | MEDIUM | v5 stable as of late 2024; widely adopted |
| Tailwind v4 warning | LOW | Based on release timeline knowledge; verify actual stability |
| ARQ for background jobs | MEDIUM | FastAPI community recommendation; not needed in v1 |

---

## Key Decisions Summary

1. **dnd-kit over react-beautiful-dnd** — react-beautiful-dnd is effectively unmaintained; dnd-kit is the ecosystem successor with proper React 18 support
2. **Tiptap over Quill or Plate** — Quill is stagnant; Plate is over-engineered; Tiptap's headless ProseMirror approach pairs cleanly with Tailwind
3. **python-jose over authlib** — authlib is powerful but targets OAuth2/OIDC; python-jose has the right API surface for JWT-only auth
4. **SQLAlchemy 2.x async** — use `async_session` with `asyncpg` driver; do not mix sync and async session factories in the same app
5. **shadcn/ui + Radix** — copy-paste primitives with Radix accessibility baked in; avoids the MUI/Tailwind fight
6. **Pydantic v2 strictly** — do NOT install pydantic v1 compatibility shims; use `model_config = ConfigDict(...)` syntax throughout
7. **Ruff replaces black + flake8 + isort** — single tool, same standards, dramatically faster
8. **TanStack Query v5 for all data fetching** — its polling support (`refetchInterval`) is exactly what's needed given the "polling first, WebSocket later" architecture decision

---

## Sources

> All recommendations based on training data (knowledge cutoff August 2025). External verification unavailable this session.
>
> For manual verification:
> - dnd-kit status: https://github.com/clauderic/dnd-kit
> - react-beautiful-dnd deprecation: https://github.com/atlassian/react-beautiful-dnd
> - Tiptap docs: https://tiptap.dev/docs
> - python-jose: https://python-jose.readthedocs.io
> - FastAPI JWT tutorial: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
> - SQLAlchemy 2.0 async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
> - TanStack Query v5: https://tanstack.com/query/v5/docs
> - shadcn/ui: https://ui.shadcn.com
> - Recharts: https://recharts.org
> - date-fns: https://date-fns.org
