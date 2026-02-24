# Project Research Summary

**Project:** XBO AI TeamHub
**Domain:** Internal task management platform (replacing Trello/Monday/Asana for a single-tenant team of <30 users)
**Researched:** 2026-02-24
**Confidence:** MEDIUM (stack and architecture HIGH; features and pitfall mitigations MEDIUM)

## Executive Summary

XBO AI TeamHub is a single-tenant, internal Kanban-based task management platform differentiated from generic SaaS tools by three capabilities that directly serve leadership: ROI quantification on every ticket, column-level cycle time analytics, and AI-assisted work breakdown. Research confirms that this class of product is built most efficiently as a strict monorepo with a FastAPI (Python) backend, Next.js App Router frontend, and PostgreSQL database — a stack with well-established async patterns, mature migration tooling, and strong library support for the domain-specific UI requirements (drag-and-drop Kanban, rich text, KPI charts). The recommended approach is to build in six progressive layers — foundation, auth, Kanban core, collaboration, analytics/ROI, then advanced/AI features — where each layer leaves the application in a runnable state and the next layer has no hard dependency on anything not yet built.

The core product risk is underestimating the number of cross-cutting concerns that must be decided correctly in Phase 1 (foundation and auth): timezone-aware timestamps, async relationship loading strategy, JWT storage mechanism, and Alembic migration discipline. These are cheap to get right at the start and expensive to retrofit. The secondary risk is the Kanban board N+1 query problem: the board must issue a single query with explicit eager loading from day one, because the polling architecture (every 30 seconds from up to 30 concurrent users) will surface poor query design rapidly under real usage.

AI features (subtask generation, effort estimation, ticket summarization) should be built last and behind a feature flag. They require real ticket data for useful prompt context and have no blocking dependency on any earlier feature. The architecture deliberately avoids real-time WebSockets, file hosting, multi-tenancy, email notifications, and automation rules in v1 — each of these is an independently scoped subsystem that would materially increase build time without serving the <30 user constraint.

---

## Key Findings

### Recommended Stack

The backend is Python 3.12 + FastAPI (0.111+) + SQLAlchemy 2.x async + asyncpg + PostgreSQL 16. Pydantic v2 is mandatory — do not use v1 compatibility shims. Alembic handles migrations. For auth: python-jose[cryptography] for JWT with passlib[bcrypt] for password hashing. The async stack is non-negotiable: SQLAlchemy's async session with asyncpg is the correct pairing, and lazy relationship loading must be disabled globally in favor of explicit `selectinload()` / `joinedload()`.

The frontend is Next.js 14 App Router (TypeScript, Tailwind CSS 3.4+). Three libraries are decided with HIGH confidence: dnd-kit (react-beautiful-dnd is abandoned — this is not a preference, it has unresolved React 18 Strict Mode bugs), Tiptap (Quill is stagnant since 2019), and shadcn/ui with Radix primitives (the dominant Tailwind+Next.js component pattern). TanStack Query v5 handles all server state including board polling. Zustand handles client state (filters, optimistic UI).

**Core technologies:**
- **FastAPI 0.111+ / Python 3.12:** Async-native, Pydantic v2 integrated, auto-generates OpenAPI docs — industry standard for new Python APIs
- **SQLAlchemy 2.x + asyncpg:** Async ORM with explicit loading — required for async correctness; never mix sync/async sessions
- **PostgreSQL 16:** JSONB for custom fields, mature managed service support, window functions for KPI aggregations
- **Next.js 14 App Router + TypeScript:** Server Components reduce bundle size; App Router route groups enable auth/non-auth layout split
- **dnd-kit (@dnd-kit/core + @dnd-kit/sortable):** Only actively maintained React drag-and-drop library with React 18 Strict Mode support; react-beautiful-dnd is abandoned
- **Tiptap 2.x:** ProseMirror-based, headless, JSON storage format — pairs with Tailwind, avoids XSS via JSON-not-HTML storage
- **shadcn/ui + Radix UI:** Copy-paste Tailwind-native primitives with built-in accessibility; no MUI/Ant Design bundle weight
- **TanStack Query v5:** `refetchInterval` provides the "polling first, WebSocket later" architecture natively
- **Recharts 2.x:** React-native composable charts for KPI dashboard; Recharts over Chart.js for declarative API fit
- **Ruff:** Replaces black + flake8 + isort — single tool, 10-100x faster
- **pytest + pytest-asyncio + httpx:** FastAPI standard test stack; httpx is FastAPI's own test transport

See `.planning/research/STACK.md` for full version table and alternatives considered.

### Expected Features

The product must prove one core loop to justify adoption: **request submitted → tracked on board → completed with accountability → ROI visible to executives.** Features outside this loop are v2+.

**Must have (table stakes) — users will revert to spreadsheets without these:**
- Kanban board with 5 fixed columns and drag-and-drop
- Ticket CRUD (title, rich text problem statement, urgency, business impact, success criteria, effort estimate, due date, next step)
- Owner assignment (prompted on column move out of Backlog)
- Column time tracking — `entered_at`/`exited_at` per column per ticket (the key differentiator; cheap to add early, expensive to retrofit)
- Department portal — structured intake form for requesters who don't manage the board
- Activity log and comment thread on each ticket
- Subtasks checklist with reorder
- Filtering and search (by owner, department, urgency, date range, aging)
- Three-role access control (admin, member, requester)
- Basic KPI cards (open count, throughput, overdue count)

**Should have (differentiators that justify building instead of buying):**
- ROI estimation panel (turns priority debates data-driven — the explicit "why we built this" moment for leadership)
- Executive KPI dashboard (throughput, avg cycle time, avg time per column, bottleneck column, workload per user)
- AI subtask generation — POST /ai/subtasks via Claude API, feature-flagged
- AI effort estimation — POST /ai/effort_estimate
- AI ticket summary — POST /ai/summary
- Ticket templates (reduces intake friction)
- Wiki / docs linked to tickets

**Defer to v2+:**
- Ticket dependencies (blocking relationships) — add when ticket volume is high enough to need it
- Sprints + velocity metrics — add when dev team requests cadence management
- Custom fields (JSONB schema) — add when departments report missing metadata
- Gantt / timeline view — add when executives explicitly request timeline visualization
- Saved filter presets (quick win, but not blocking MVP)

**Anti-features (do not build, ever):**
- Real-time WebSockets (v1) — polling suffices at <30 users
- SSO / OAuth login — email + password + JWT is sufficient
- File hosting / CDN — link to Google Drive; do not build S3 subsystem
- Multi-tenant workspace isolation — single-tenant by design
- Email / Slack notifications (v1) — add after usage patterns are established
- Native mobile app — responsive web is sufficient

See `.planning/research/FEATURES.md` for full feature table and dependency graph.

### Architecture Approach

The recommended architecture is a monorepo with two fully independent deployable units (backend/, frontend/) that communicate exclusively via HTTP REST. No shared code, no GraphQL, no BFF proxy layer in v1. The dependency graph is strictly one-directional: Browser → Next.js → FastAPI → PostgreSQL. For AI calls, FastAPI calls Claude API directly — the frontend never touches Claude.

The backend follows a three-layer pattern: thin routers (HTTP/auth only) → services (business logic, one transaction per service call) → SQLAlchemy models. This is not a preference — it is required for testability given that column moves trigger multi-table side effects (ColumnHistory close, ColumnHistory create, TicketEvent emit). The frontend follows a parallel pattern: App Router pages → hooks (TanStack Query) → typed API client lib → FastAPI. React components never call fetch directly.

**Major components:**
1. **FastAPI routers** — thin HTTP adapters; validate input, call service, return Pydantic schema; no SQL
2. **FastAPI services** — business logic; `move_ticket()` is the most critical (triggers column history + events in one transaction); `compute_roi()` is pure Python in `utils/roi.py`
3. **SQLAlchemy models** — 12 ORM models; all use `TimestampMixin` (UUID PK, created_at, updated_at); relationships configured with `lazy="raise"` to catch missing eager loads
4. **Alembic migrations** — autogenerate + mandatory human review before apply; `compare_type=True` required; CI must assert single head
5. **Next.js App Router** — route groups `(auth)/` and `(app)/` for layout separation; auth guard in `(app)/layout.tsx`
6. **Kanban components** — `KanbanBoard` → `KanbanColumn` → `TicketCard`; dnd-kit with optimistic updates and explicit rollback on API rejection
7. **Typed API client** — `lib/api/*.ts` typed wrappers; no raw fetch in components; axios interceptors for JWT injection
8. **Zustand store** — auth session + kanban filter state; TanStack Query `refetchInterval: 30000` for board polling

The architecture defines a **6-layer build order** where nothing in layer N+1 can ship without layer N functioning (Docker/DB → Auth → Ticket Core → Collaboration → Analytics/ROI → Advanced/AI). See `.planning/research/ARCHITECTURE.md` for full directory tree, model definitions, and API design patterns.

### Critical Pitfalls

1. **SQLAlchemy async lazy loading raises `MissingGreenlet`** — Set `lazy="raise"` on all relationships from day one. Define `TICKET_LOAD_OPTIONS` constants in `queries.py`. This error appears as a 500 on board load in production after it passes tests with small fixture data.

2. **JWT stored in localStorage → XSS account takeover** — Use `httpOnly; Secure; SameSite=Strict` cookies from auth setup day one. The rich text editor (problem statement, wiki) is a direct XSS vector if content is stored as HTML and rendered with `dangerouslySetInnerHTML`. Store Tiptap JSON, not HTML.

3. **Kanban board N+1 queries under polling** — Design the board as a single `GET /api/tickets?page_size=200` with `selectinload(owner, department)`. At 30 users polling every 30s, a naively written board endpoint will saturate the PostgreSQL connection pool within weeks of real usage.

4. **Alembic autogenerate silently misses CHECK constraints and column type changes** — Set `compare_type=True` in `env.py` immediately. Add `CheckConstraint(...)` via `__table_args__` in SQLAlchemy models. Add CI gate: `alembic heads | wc -l` must equal 1. Manual DDL in any environment is banned.

5. **JWT no revocation — deactivated user retains access** — Keep access token TTL at 15 minutes. Implement token versioning (`token_version` integer on the User row) so deactivation/role change takes effect within one token lifetime. This is an architectural decision that must be made in auth setup, not retrofitted.

**Additional notable pitfalls:**
- Column time tracking timestamps without `TIMESTAMPTZ` produce silent clock drift on executive dashboard
- ROI division-by-zero (effort_estimate = 0) propagates NaN to DB; store as `NUMERIC NULL`, display "Insufficient data"
- Rich text stored as raw HTML creates XSS risk; Tiptap JSON storage is the architectural fix
- `Subtask.position` column must be in the initial schema; retrofitting requires N-row updates on every reorder

See `.planning/research/PITFALLS.md` for full pitfall catalog with detection signs and prevention strategies.

---

## Implications for Roadmap

Based on the architectural build order and feature dependency graph, six phases are recommended:

### Phase 1: Foundation and Auth
**Rationale:** Auth gates every other feature. The foundational decisions made here (timezone-aware timestamps, `lazy="raise"` on relationships, `compare_type=True` in Alembic, httpOnly cookie JWT storage, token versioning) are cheapest to implement now and most expensive to retrofit. This phase has no user-visible output but determines the correctness of everything above it.
**Delivers:** Runnable Docker Compose stack (postgres, backend, frontend), database foundation (engine, session, migrations), User and Department models, Alembic configured with CI head check, auth endpoints (register, login, /me), `get_current_user` dependency, `require_role()` dependency, frontend auth pages with httpOnly cookie token storage, auth guard in `(app)/layout.tsx`, 7 seeded departments.
**Addresses features from FEATURES.md:** User roles and access control, department grouping
**Avoids pitfalls:** SQLAlchemy async lazy loading (Pitfall 2), JWT localStorage (Pitfall 3), JWT no revocation (Pitfall 4), Alembic autogenerate misses (Pitfall 1), Alembic state drift (Pitfall 10), TIMESTAMP without timezone (Pitfall 6), Pydantic v2 migration (Pitfall 13), FastAPI DI scope (Pitfall 16)
**Research flag:** Standard patterns — no additional research needed

### Phase 2: Kanban Core
**Rationale:** The Kanban board is the visible heart of the product. Column time tracking must be built alongside the board (not retrofitted) because `ColumnHistory` rows are written on every `move_ticket()` call. The board query must be designed with `selectinload()` from day one given the polling architecture.
**Delivers:** Ticket model + ColumnHistory + TicketEvent models with all indexes, ticket CRUD endpoints, `move_ticket()` service with column history side effects, Kanban board frontend with 5 columns, dnd-kit drag-and-drop with optimistic update + explicit rollback on rejection, ticket detail page with Tiptap rich text (JSON storage), subtasks checklist (with `position` field from day one), filtering and search (owner, department, urgency, date range, aging), activity timeline.
**Uses from STACK.md:** dnd-kit, Tiptap, TanStack Query (refetchInterval polling), shadcn/ui components
**Addresses features from FEATURES.md:** Kanban board, ticket CRUD, owner assignment, column time tracking, filtering/search, subtasks, activity log
**Avoids pitfalls:** N+1 queries on board load (Pitfall 5), drag-and-drop optimistic desync (Pitfall 7), rich text HTML storage (Pitfall 8), column time tracking timezone bugs (Pitfall 6), missing indexes (Pitfall 11), subtask position field (Pitfall 15), Next.js server/client boundary (Pitfall 14)
**Research flag:** Well-documented patterns for dnd-kit and TanStack Query — no additional research needed

### Phase 3: Collaboration and Department Portal
**Rationale:** Comments, the department portal, and ticket templates have no dependencies on Analytics or AI, but they have dependencies on tickets existing. Grouping them together lets requesters start submitting work while leadership waits for the executive dashboard.
**Delivers:** Comment thread on ticket detail, department portal (per-department submission form), ticket templates (CRUD + "create from template" on portal), basic KPI cards (open count, throughput, overdue).
**Addresses features from FEATURES.md:** Comments/threaded discussion, department portal, ticket templates, basic reporting/overview
**Avoids pitfalls:** None new; inherits Phase 1 and 2 foundations
**Research flag:** Standard patterns — no additional research needed

### Phase 4: ROI Estimation and Executive Dashboard
**Rationale:** ROI fields on tickets and the executive dashboard KPI aggregation are the explicit leadership buy-in features. They depend on real ticket data existing (from Phase 2) and on column history data (from Phase 2). Separating them into their own phase means the Kanban workflow is proven before leadership analytics are added.
**Delivers:** ROI fields on Ticket model (migration), `compute_roi()` utility with division-by-zero guards, ROI panel in ticket detail, `GET /api/dashboard/kpis` aggregation endpoint (single SQL query with window functions), executive KPI dashboard frontend (throughput, avg cycle time, avg time per column, bottleneck column, workload per user, department breakdown), Recharts visualizations.
**Uses from STACK.md:** Recharts, date-fns (differenceInHours for cycle time), PostgreSQL window functions
**Addresses features from FEATURES.md:** ROI estimation, executive KPI dashboard, column time analytics
**Avoids pitfalls:** ROI NaN/division-by-zero (Pitfall 9) — `NUMERIC NULL` storage, input validation, `NULLS LAST` ordering
**Research flag:** Dashboard SQL aggregation patterns are well-documented; no additional research needed

### Phase 5: Advanced Features
**Rationale:** Ticket dependencies, sprints, custom fields, and the wiki are valuable but not part of the core prove-the-loop MVP. Each is an independently scoped subsystem. Build them only after Phase 4 delivers measurable leadership value, using real user feedback to confirm which to prioritize.
**Delivers:** Ticket dependencies (blocking enforcement in `move_ticket()`), Sprint + SprintTicket models with velocity metrics, CustomFieldDefinition + CustomFieldValue (JSONB on tickets), Wiki pages with Tiptap editor, saved filter presets (JSONB on User).
**Addresses features from FEATURES.md:** Ticket dependencies, sprints/velocity, custom fields, wiki/docs, saved filters
**Avoids pitfalls:** Dependency enforcement must be server-side not just client-side (Pitfall 5 anti-pattern note); custom field JSONB schema complexity requires careful migration design
**Research flag:** May benefit from `/gsd:research-phase` for custom fields JSONB schema design and sprint velocity calculation patterns if complexity exceeds estimates

### Phase 6: AI Features
**Rationale:** AI features require real ticket data for useful prompt context and have zero blocking dependency on each other or on the earlier phases. Feature-flagging via `AI_ENABLED` env var means they can be deployed to production without activation until the team validates prompt quality. Anthropic API latency (1-5s) is acceptable as synchronous responses at <30 users; ARQ background job queue is not needed in v1.
**Delivers:** `AISubtaskRequest/Response` schemas, `POST /ai/subtasks` (Claude API, structured output), `POST /ai/effort_estimate`, `POST /ai/summary`, frontend AI trigger buttons in ticket detail (with loading states), Gantt/timeline view (read-only, derived from due dates).
**Uses from STACK.md:** Anthropic Claude API (direct from FastAPI service), TanStack Query for AI endpoint mutation handling
**Addresses features from FEATURES.md:** AI subtask generation, AI effort estimation, AI ticket summary, Gantt/timeline view
**Avoids pitfalls:** AI endpoints must check `settings.AI_ENABLED` and return 503 if disabled; prompt engineering quality is a research concern
**Research flag:** Needs `/gsd:research-phase` for prompt engineering — structured output format for Claude API, subtask extraction patterns, effort estimation prompt design. This is niche enough that training data alone is insufficient.

### Phase Ordering Rationale

- **Phase 1 must be first:** Alembic configuration, async session setup, JWT storage strategy, and timestamp timezone decisions propagate through every subsequent migration and endpoint. Retrofitting any of these is a rewrite.
- **Phase 2 must precede Phases 3-6:** All subsequent features depend on tickets existing. Column time tracking is co-located with Phase 2 because it is written on every ticket move — not a separate analytics concern.
- **Phase 3 before Phase 4:** The department portal (Phase 3) generates the ticket volume that makes the executive dashboard (Phase 4) meaningful. Building the dashboard with 5 test tickets produces misleading KPIs.
- **Phases 5 and 6 are independent:** If stakeholder feedback after Phase 4 prioritizes AI over advanced features, swap their order. The architecture supports either sequence.
- **AI features last:** The project explicitly defers AI until real ticket data exists. This is correct — AI subtask suggestions trained on empty context produce generic output that erodes trust.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6 (AI Features):** Prompt engineering for structured subtask extraction, effort estimation calibration, and Claude API response format design are not well-covered by general knowledge. Run `/gsd:research-phase` before planning Phase 6 in detail.
- **Phase 5 (Custom Fields, optional):** If the custom fields JSONB schema grows complex (nested types, validation rules, per-department schemas), the migration strategy and query performance implications warrant additional research.

**Phases with standard, well-documented patterns (skip research-phase):**
- **Phase 1:** FastAPI + SQLAlchemy async + Alembic patterns are extensively documented; training data is sufficient
- **Phase 2:** dnd-kit Kanban, TanStack Query polling, Tiptap JSON storage are all actively documented with examples
- **Phase 3:** Comment threads and form submission are standard CRUD patterns
- **Phase 4:** PostgreSQL window function aggregations and Recharts dashboard patterns are well-established

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (FastAPI, SQLAlchemy 2.x, dnd-kit, Tiptap, shadcn/ui) are HIGH confidence. Exact patch versions (asyncpg 0.29, TanStack Query 5.x) are MEDIUM — web verification unavailable. Tailwind v4 stability is LOW — verify before upgrading from 3.4. |
| Features | MEDIUM | Table stakes are HIGH (established SaaS comparison). Differentiator value props (ROI, cycle time analytics) are sound but adoption rates are unvalidated. Feature dependency graph is HIGH (derived from data model, not opinions). |
| Architecture | HIGH | FastAPI service/router separation, SQLAlchemy async patterns, Next.js App Router route groups, and Alembic autogenerate workflow are well-documented stable patterns. The build order is architecturally correct based on dependency analysis. |
| Pitfalls | MEDIUM-HIGH | SQLAlchemy async, Alembic autogenerate limitations, and JWT security patterns are explicitly documented in official sources. N+1 query risks and XSS patterns are reproducible and well-understood. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Tailwind v4 stability:** Research noted Tailwind v4 (Oxide engine) released early 2025. Before upgrading from 3.4, verify actual stability and shadcn/ui compatibility. Default to 3.4 unless confirmed stable.
- **python-jose maintenance:** FastAPI's tutorial standard but has had slow maintenance cadence since 2022. If the team finds it unmaintained during setup, use PyJWT (2.8+) as a drop-in — same API surface, similar claim validation.
- **Claude API structured output format:** The correct prompt format for extracting structured subtask lists from ticket descriptions needs validation against the actual Claude API at Phase 6 planning time.
- **Anthropic API latency in production:** Synchronous AI endpoints are acceptable at <30 users, but if latency exceeds 10s for summaries, streaming responses (`StreamingResponse` in FastAPI) should be evaluated before shipping Phase 6.
- **ROI formula calibration:** The formula inputs (strategic_value 1-5 scale, adjusted_roi weighting) are defined in PROJECT.md but not validated against real XBO data. The formula may need tuning after first use. Design for easy re-computation (pure Python utility, values stored flat and re-computable from inputs).

---

## Sources

### Primary (HIGH confidence)
- `/Users/charleskr/Desktop/XBO/XBO-AI-TeamHub/.planning/PROJECT.md` — XBO-specific requirements, constraints, out-of-scope decisions
- SQLAlchemy 2.0 async docs (https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) — async session, relationship loading
- Alembic autogenerate docs (https://alembic.sqlalchemy.org/en/latest/autogenerate.html) — explicit limitation documentation
- FastAPI security docs (https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — JWT patterns
- OWASP JWT Cheat Sheet (https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html) — token security
- dnd-kit GitHub (https://github.com/clauderic/dnd-kit) — react-beautiful-dnd deprecation is publicly documented
- shadcn/ui docs (https://ui.shadcn.com) — Tailwind+Next.js component standard

### Secondary (MEDIUM confidence)
- Training data: FastAPI/SQLAlchemy community patterns as of August 2025 — service/router separation, N+1 prevention
- Training data: Trello/Asana/Monday/ClickUp/Notion feature sets — table stakes derivation
- Training data: TanStack Query v5, Tiptap 2.x, Recharts 2.x — version and API surface

### Tertiary (LOW confidence)
- Tailwind v4 release timeline — verify actual stability status before adopting
- python-jose maintenance status — verify package activity before committing; PyJWT is the fallback

---

*Research completed: 2026-02-24*
*Ready for roadmap: yes*
