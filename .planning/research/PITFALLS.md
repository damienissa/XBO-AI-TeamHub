# Domain Pitfalls

**Domain:** Internal task management platform (FastAPI + Next.js + PostgreSQL + Alembic + JWT)
**Project:** XBO AI TeamHub
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH (training data, no live web access during this session; these are well-documented, reproducible issues in these specific technologies)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major security incidents.

---

### Pitfall 1: Alembic Autogenerate Silently Misses Schema Changes

**What goes wrong:** Developers run `alembic revision --autogenerate` and assume the output captures all schema changes. It does not. Autogenerate compares what SQLAlchemy models know against what it sees in the DB — but it cannot detect: CHECK constraints defined outside the ORM, partial indexes, functional indexes, server-side default changes on existing columns, column TYPE changes on some backends, and any schema objects created via raw SQL. The migration is generated with no error, applied cleanly, and the production DB silently diverges from intent.

**Why it happens:** Trust in tooling without reading the autogenerate limitations section of Alembic docs. Developers treat `--autogenerate` as a diff tool that sees everything.

**Consequences:**
- CHECK constraints (e.g., `urgency IN ('low','medium','high','critical')`) missing in production, allowing invalid data insertion
- ROI formula values stored outside expected ranges with no DB-level guard
- Production data corruption discovered only at query time
- Migrations that "worked locally" fail in cloud because the local DB had manually applied DDL not in any migration file

**Prevention:**
- After every `--autogenerate`, manually inspect the generated migration file before applying
- For CHECK constraints and custom indexes, hand-write the `op.execute()` calls in the migration
- Define ALL constraints via SQLAlchemy model `__table_args__` so autogenerate can detect them: `CheckConstraint("urgency IN ('low','medium','high','critical')")`
- Set `compare_type=True` in `env.py` `context.configure()` to detect column type changes
- Keep a `schema_tests.py` that queries `information_schema` and asserts expected constraints exist

**Detection warning signs:**
- `alembic revision --autogenerate -m "add check constraint"` produces an empty migration
- Team applies a migration, manually verifies via `psql`, finds column constraints absent
- Unit tests pass but integration tests against real DB accept values that should be rejected

**Phase to address:** Phase 1 (database foundation) — establish `compare_type=True` and review discipline before any feature work.

---

### Pitfall 2: SQLAlchemy Async Lazy Loading Raises `MissingGreenlet` or Silent Detach Errors

**What goes wrong:** With `asyncpg` + SQLAlchemy async, all relationship loading must be explicit. Accessing `ticket.owner` after the session closes raises `MissingGreenlet: greenlet_spawn has not been called`. This is the async equivalent of `DetachedInstanceError` in sync SQLAlchemy. It happens silently when Pydantic serializes a model by accessing an un-loaded relationship outside the session context.

**Why it happens:** Developers familiar with sync SQLAlchemy assume lazy loading works the same way. It does not — async SQLAlchemy forbids implicit I/O, so lazy relationships raise instead of querying.

**Consequences:**
- 500 errors on Kanban board endpoint when serializing tickets with owners, departments, subtasks
- Ticket list API works in tests (small fixture data, relationships pre-loaded) but fails in production (larger relational graph, session closed before serialization)
- Hard to debug because the error message references greenlets, not the ORM relationship

**Prevention:**
- Use `selectinload()` or `joinedload()` on every relationship needed in the response: `select(Ticket).options(selectinload(Ticket.owner), selectinload(Ticket.subtasks))`
- Define a standard `TICKET_LOAD_OPTIONS` constant in `queries.py` used by all ticket-fetching functions
- Never use `lazy="dynamic"` with async sessions
- Set `lazy="raise"` on all relationships in async models to get loud failures early instead of silent misses
- Write an integration test that serializes a full ticket response including all nested relationships

**Detection warning signs:**
- `MissingGreenlet` or `greenlet_spawn` in stack traces
- `DetachedInstanceError` appearing on serialization
- Tests pass with `lazy="select"` but 500s appear against real data

**Phase to address:** Phase 1 (database models) — configure `lazy="raise"` and document load options pattern before any endpoint is written.

---

### Pitfall 3: JWT Stored in localStorage — XSS Attack Surface

**What goes wrong:** The simplest Next.js JWT implementation stores the access token in `localStorage`. Any XSS vulnerability (a third-party npm package, a rich text editor that renders unsanitized HTML, a React `dangerouslySetInnerHTML` call) can exfiltrate the token. Internal tools are not immune — a compromised token gives full API access as that user, including reading all tickets across all departments.

**Why it happens:** `localStorage` is the default shown in most JWT tutorials. It requires zero configuration.

**Consequences:**
- Complete account takeover if any XSS exists in the app
- The rich text editor (problem statement, wiki pages) is a direct XSS vector if not sandboxed
- No logout mechanism can truly invalidate a stolen token (JWTs are stateless)

**Prevention:**
- Store JWTs in `httpOnly; Secure; SameSite=Strict` cookies — inaccessible to JavaScript
- Use Next.js API routes as a BFF (backend-for-frontend) to set cookies on the server side
- Sanitize all rich text editor output with DOMPurify before storing and before rendering
- Set a short access token TTL (15 minutes) with a longer-lived refresh token in a separate httpOnly cookie
- Add `Content-Security-Policy` headers to prevent inline script execution

**Detection warning signs:**
- Auth implementation stores token with `localStorage.setItem('token', ...)`
- Rich text content rendered with `dangerouslySetInnerHTML` without sanitization
- No CSP headers on the Next.js app

**Phase to address:** Phase 1 (auth foundation) — the cookie/httpOnly pattern must be established at auth setup, retrofitting is painful.

---

### Pitfall 4: JWT with No Revocation — Fired Employee Retains Access

**What goes wrong:** Standard stateless JWT means a valid token works until expiry even after the user is deactivated. For an internal platform with access to all XBO ticket data, a deactivated user with a 24-hour token retains full API access for up to 24 hours after being removed.

**Why it happens:** JWT revocation requires server-side state (a blocklist), which feels like it defeats the "stateless" benefit. Developers skip it to keep the architecture clean.

**Consequences:**
- Deactivated employee continues reading/modifying tickets
- No way to force logout a compromised account without waiting for token expiry
- Role changes (admin → member) don't take effect until token expires

**Prevention:**
- Keep access tokens short (15 minutes)
- Maintain a Redis-backed or PostgreSQL-backed blocklist for explicitly invalidated tokens (logout, deactivation, role change events add the JTI to the blocklist)
- On user deactivation, add the JTI to `revoked_tokens` table and check it on every request
- Alternatively, encode a `token_version` in the token and store `token_version` on the user row; invalidate by incrementing the version

**Detection warning signs:**
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440` (24 hours) in env config
- No `revoked_tokens` table or Redis blocklist in the schema
- User deactivation endpoint only sets `is_active=False` without invalidating tokens

**Phase to address:** Phase 1 (auth) — design the token versioning or blocklist approach upfront.

---

### Pitfall 5: Kanban Board N+1 Queries on Column Load

**What goes wrong:** The Kanban board loads 5 columns, each with N tickets. A naive implementation issues: 1 query for all tickets, then for each ticket: 1 query for the owner, 1 for the department, 1 for subtask count, 1 for column time entries = 4N+1 queries. With 50 tickets across the board, that's 201 queries per board load. Under polling (every 30 seconds), this hammers PostgreSQL.

**Why it happens:** The board is designed column-by-column or ticket-by-ticket in the UI, and the API follows that shape. Relationship access without eager loading issues a query per access.

**Consequences:**
- Board load takes 2-5 seconds with 50+ tickets
- PostgreSQL connection pool saturation under normal usage (polling every 30s from 30 users = 900 polls/minute)
- Executive dashboard KPI queries compound the problem

**Prevention:**
- Single query for all tickets with `selectinload` for owner, department, and column_time_entries
- Denormalize `subtask_count` and `done_subtask_count` as computed columns updated by trigger or on mutation, rather than counting at read time
- Add a `GET /board` endpoint that returns all 5 columns in one response, not per-column requests
- Use `EXPLAIN ANALYZE` on the board query before shipping any board feature
- Add query count assertions in integration tests: use SQLAlchemy's event system to count queries in tests and assert `query_count < 10` for a board load

**Detection warning signs:**
- SQLAlchemy debug logging shows repeated `SELECT * FROM users WHERE id = $1` for different IDs
- Board load time increases linearly with ticket count
- No `selectinload()` in the ticket list query

**Phase to address:** Phase 2 (Kanban board) — design the board query before the frontend is built against it.

---

## Moderate Pitfalls

---

### Pitfall 6: Column Time Tracking Clock Drift and Timezone Bugs

**What goes wrong:** Column time tracking (time in column = `exited_at - entered_at`) breaks when: timestamps are stored without timezone info (`TIMESTAMP` vs `TIMESTAMPTZ`), the server and DB are in different timezones, or a ticket is moved back into a column (creating multiple open `entered_at` records with no `exited_at`).

**Why it happens:** PostgreSQL `TIMESTAMP` stores no timezone offset. If FastAPI uses `datetime.utcnow()` on a server set to UTC but the DB is set to local time, timestamps silently disagree. Multiple column entries per ticket (re-entering a column) are not handled if the schema assumes one entry per column.

**Consequences:**
- "Time in Discovery: -3 hours" on the Kanban card
- Bottleneck column KPI reports wrong column as bottleneck
- Cycle time calculations wrong on executive dashboard
- Data cannot be corrected retroactively without knowing the correct timezone

**Prevention:**
- Use `TIMESTAMPTZ` for ALL timestamp columns, not `TIMESTAMP`
- In SQLAlchemy models: `Column(DateTime(timezone=True), server_default=func.now())`
- Use `datetime.now(timezone.utc)` not `datetime.utcnow()` (deprecated in Python 3.12)
- Design `column_time_entries` to allow multiple rows per ticket per column (a ticket can re-enter a column): `(ticket_id, column, entered_at, exited_at)` with no unique constraint on `(ticket_id, column)`
- The "time in column" computation should SUM all intervals for that column, not just the latest

**Detection warning signs:**
- Schema has `Column(DateTime)` without `timezone=True`
- Code uses `datetime.utcnow()`
- `column_history` table has a unique constraint on `(ticket_id, status)` preventing re-entry

**Phase to address:** Phase 2 (column time tracking schema design).

---

### Pitfall 7: Drag-and-Drop Optimistic Update Desync

**What goes wrong:** Drag-and-drop on the Kanban board updates the UI immediately (optimistic update) before the API confirms. If the API rejects (dependency blocker, auth error, network timeout), the card is in the wrong column visually but the server state is correct. If the rollback doesn't happen cleanly, the user sees a card in column X but the DB has it in column Y.

**Why it happens:** Optimistic updates without proper rollback logic. The failure path (API error handling) is written after the happy path and gets less testing.

**Consequences:**
- User drags card to "In Progress", card appears there, API returns 400 (dependency not done), card stays visually in "In Progress" but is actually in "Backlog" — user thinks task is started
- After page refresh, card jumps back — user confusion, trust erosion

**Prevention:**
- Use React Query or SWR's mutation `onError` callback to rollback optimistic updates explicitly
- Always call `queryClient.invalidateQueries(['board'])` after both success and failure
- Test the error path: mock the API to return 400 on a drag and assert card returns to original column
- The dependency blocker check must happen server-side (not just client-side) — client-side check is UX only

**Detection warning signs:**
- `onError` handler for drag-and-drop mutation is missing or does `console.error` only
- No test covers the case where a ticket move is rejected
- Dependency blocker enforced only in frontend UI, not in the API endpoint

**Phase to address:** Phase 2 (Kanban drag-and-drop implementation).

---

### Pitfall 8: Rich Text Editor Data Stored as Raw HTML — XSS and Migration Nightmare

**What goes wrong:** Rich text editors (TipTap, Quill, ProseMirror) can output either HTML strings or JSON (ProseMirror/TipTap document schema). Storing raw HTML in PostgreSQL creates: (1) XSS risk on render, (2) inability to query content, (3) format migration lock-in — if you ever switch editors, stored HTML is unportable.

**Why it happens:** HTML output is the path of least resistance. It renders directly in a `dangerouslySetInnerHTML`. JSON output requires a renderer.

**Consequences:**
- Stored XSS: a user stores `<script>` tag in problem statement, it executes for every viewer
- Cannot do server-side content search across tickets
- Switching from Quill HTML to TipTap JSON requires a data migration of every ticket's problem statement

**Prevention:**
- Use TipTap with JSONContent storage — store the editor's JSON document, not HTML
- Render JSON to HTML only at display time using TipTap's server-side renderer
- If HTML storage is necessary, run DOMPurify on every read before rendering, and on every write before storing
- Add a `content_format` column (`'tiptap_json'`, `'html'`) to enable future migrations

**Detection warning signs:**
- `problem_statement` column is `TEXT` storing raw HTML `<p>text</p>`
- Rendering done with `dangerouslySetInnerHTML={{ __html: ticket.problem_statement }}`
- No DOMPurify import anywhere in the codebase

**Phase to address:** Phase 2 (ticket detail form) — storage format decision must precede any data entry.

---

### Pitfall 9: ROI Formula Edge Cases Produce NaN, Infinity, or Misleading Values

**What goes wrong:** The ROI formula divides by `dev_cost`. If `dev_cost = 0` (effort_estimate = 0 hours), the formula produces division by zero. If `employees_affected = 0`, `weekly_cost = 0`. These propagate as `NaN` or `Infinity` into the DB and display as blank or bizarre values on the ticket detail.

**Why it happens:** Financial formulas are written for the happy path. Edge cases (zero employees, zero effort, missing optional fields) are not handled in the computed field logic.

**Consequences:**
- ROI panel on ticket shows "NaN%" or blank
- Executive dashboard aggregate ROI calculations break when including tickets with NaN values
- `adjusted_roi` sorted descending puts NaN tickets at top or bottom unpredictably

**Prevention:**
- Validate inputs: `dev_cost` must be > 0 before ROI computation; return `None` if not computable
- Store `roi` as `NUMERIC(10,4)` with `NULL` allowed — NULL means "not yet computable", not zero
- Display "Insufficient data" in the ROI panel when roi is NULL, not "0%"
- Write unit tests for all ROI edge cases: zero effort, zero employees, null optional fields, all minimums
- `adjusted_roi` queries must handle NULL with `ORDER BY adjusted_roi DESC NULLS LAST`

**Detection warning signs:**
- ROI fields are `Float` (allows NaN) rather than `Numeric` (does not)
- No validation in `compute_roi()` for division-by-zero
- No unit tests for ROI edge case inputs

**Phase to address:** Phase 3 (ROI estimation feature).

---

### Pitfall 10: Alembic Migration State Drift Between Environments

**What goes wrong:** Developer A creates a migration and runs it locally. Developer B creates a separate migration from a different base. Both are merged to main. Alembic sees two heads and refuses to run. Or: a developer applies a migration manually in staging to "fix something quickly," and staging DB state diverges from the migration history. Future migrations fail in staging only.

**Why it happens:** Teams treat Alembic like a database client rather than version control for schema. Manual DDL in any environment breaks the invariant.

**Consequences:**
- `alembic upgrade head` fails with "Multiple head revisions" or "Can't locate revision" on CI/CD
- Production deployment blocked at the schema migration step
- Requires manual intervention to resolve migration graph, risking data loss

**Prevention:**
- Enforce CI check: `alembic heads | wc -l` must equal 1; fail the pipeline if > 1
- NEVER apply manual DDL to any environment — all changes through migrations, always
- Use `alembic merge heads` as the standard procedure when multiple heads occur, and include in runbook
- On every PR that adds a migration, CI runs `alembic upgrade head` against a fresh test DB
- Document the migration procedure in `CONTRIBUTING.md`: create migration → test locally → commit migration + model change together

**Detection warning signs:**
- `alembic history` shows branching (multiple entries without a merge)
- Staging and production have different `alembic_version` values
- A migration file exists in git but was never run via `alembic upgrade`

**Phase to address:** Phase 1 (project setup) — establish CI pipeline check before any migrations exist.

---

### Pitfall 11: Missing Database Indexes on Kanban Filter Queries

**What goes wrong:** The Kanban board supports filtering by owner, department, created date range, due date, urgency, and aging. Without indexes, each filter is a full table scan. With 1,000 tickets (reasonable after 1 year), filters take 500ms+. The problem is invisible in development (10-20 tickets).

**Why it happens:** Indexes are added "later" when performance becomes a problem. By then, the query shapes are fixed and index design requires understanding all filter combinations.

**Consequences:**
- Board filters become unusably slow in production
- Adding indexes later requires `CREATE INDEX CONCURRENTLY` and careful timing to avoid locks
- Compound filter queries (owner + department + date range) may need composite indexes not obvious at design time

**Prevention:**
- Add indexes in the initial migration for: `(status)`, `(owner_id)`, `(department_id)`, `(due_date)`, `(urgency)`, `(created_at)`, `(column_entered_at)` on tickets table
- Add a composite index on `(status, owner_id)` for the most common filter combination (my board, by column)
- Run `EXPLAIN ANALYZE` on all filter query combinations before shipping
- For column aging queries: index `column_time_entries.entered_at` with a partial index `WHERE exited_at IS NULL` (currently-in-column tickets)

**Detection warning signs:**
- Initial migration has no `Index(...)` declarations beyond primary keys
- `EXPLAIN ANALYZE` output shows `Seq Scan` on tickets table for filter queries
- Development testing only with < 20 tickets

**Phase to address:** Phase 2 (Kanban filters) — define indexes alongside filter query design.

---

## Minor Pitfalls

---

### Pitfall 12: SQLAlchemy `Text` vs `String` for Rich Content

**What goes wrong:** Using `Column(String)` (maps to `VARCHAR(255)` on some backends) for problem_statement, comments, and wiki content. Content is silently truncated or the migration creates a 255-char limit column.

**Prevention:** Use `Column(Text)` for any free-form content field. Use `Column(String(N))` only for fields with a known max length (status enum, email).

**Phase:** Phase 1 (model definitions).

---

### Pitfall 13: Pydantic V2 Model Validator Confusion

**What goes wrong:** The project is likely using Pydantic V2 (FastAPI 0.100+). V2 broke many V1 patterns: `validator` → `field_validator`, `root_validator` → `model_validator`, `orm_mode = True` → `model_config = ConfigDict(from_attributes=True)`. Copy-pasted V1 examples silently fail or produce unexpected behavior.

**Prevention:** Pin to Pydantic V2 explicitly, use `from pydantic import model_validator, field_validator`, and do not mix V1/V2 patterns. Add `from __future__ import annotations` carefully — it changes how Pydantic resolves forward references.

**Phase:** Phase 1 (schema definitions).

---

### Pitfall 14: Next.js Server/Client Component Boundary Confusion

**What goes wrong:** Next.js App Router (v13+) has Server Components and Client Components. Mixing them incorrectly causes: context providers not available in server components, `useState`/`useEffect` called in server components (build error), or unnecessary client-side bundles from marking everything `"use client"`.

**Prevention:** Mark leaf interactive components `"use client"`, keep data-fetching in server components, pass data down as props. The Kanban board (drag-and-drop, optimistic updates) must be a client component; the surrounding layout can be a server component.

**Phase:** Phase 2 (frontend architecture).

---

### Pitfall 15: Subtask Ordering Without Position Field

**What goes wrong:** Subtasks require drag-to-reorder. Storing subtasks without a `position` (integer) column means order cannot be persisted. Developers add position later and discover the index-shift update problem: reordering one item requires updating N rows.

**Prevention:** Add `position INTEGER NOT NULL DEFAULT 0` to subtasks in the initial schema. Use fractional indexing (float positions) or the "gap" strategy to minimize reorder updates. Libraries like `lexorank` solve this specifically.

**Phase:** Phase 2 (ticket detail / subtasks).

---

### Pitfall 16: FastAPI Dependency Injection Scope Mismatch

**What goes wrong:** Using `Depends(get_db)` with a sync session factory in an async FastAPI app, or using a request-scoped session in a background task that outlives the request. The session closes when the request ends; the background task then accesses a closed session.

**Prevention:** Background tasks must create their own session using `async with AsyncSessionLocal() as session:`, not accept a session from the request dependency. Document this in the project's `CONTRIBUTING.md`.

**Phase:** Phase 1 (dependency injection setup), Phase 4 (any background task feature).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 1: Auth setup | JWT in localStorage, no revocation | httpOnly cookies + token versioning from day 1 |
| Phase 1: DB models | `lazy="select"` on async relationships | Set `lazy="raise"` globally, use explicit `selectinload()` |
| Phase 1: Alembic setup | Silent autogenerate misses | `compare_type=True` in env.py, CI head count check |
| Phase 1: Timestamps | `TIMESTAMP` without timezone | `TIMESTAMPTZ` / `DateTime(timezone=True)` everywhere |
| Phase 2: Kanban board | N+1 queries on board load | Single `GET /board` endpoint with `selectinload()` |
| Phase 2: Drag-and-drop | Missing rollback on API rejection | `onError` + `invalidateQueries` tested explicitly |
| Phase 2: Rich text | Raw HTML stored, XSS on render | TipTap JSON storage, DOMPurify on read |
| Phase 2: Column time tracking | Clock drift, re-entry not modeled | `TIMESTAMPTZ`, multi-row schema for column history |
| Phase 2: Subtasks | No position field, add later | `position` column in initial migration |
| Phase 2: Filters | Missing indexes | Define all filter indexes alongside query design |
| Phase 3: ROI calculation | Division-by-zero, NaN in DB | Input validation, `NULL` for uncomputable, `NULLS LAST` |
| Phase 4: Background tasks | Session outlives request | Background tasks own their session lifecycle |
| Phase N: Migration merges | Multiple Alembic heads | CI gate on `alembic heads` count |

---

## Sources

**Confidence note:** Web search and WebFetch were unavailable during this research session. All findings are based on:
- SQLAlchemy 2.0 async documentation (training data, HIGH confidence — these are fundamental, documented behaviors)
- Alembic 1.x autogenerate documentation (training data, HIGH confidence — limitations are explicitly documented)
- FastAPI security documentation (training data, HIGH confidence)
- OWASP JWT Cheat Sheet patterns (training data, HIGH confidence)
- Next.js App Router documentation (training data, MEDIUM-HIGH confidence)
- Known N+1 and ORM patterns in PostgreSQL-backed APIs (training data, HIGH confidence)

Specific official references for validation:
- SQLAlchemy async session: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- Alembic autogenerate limitations: https://alembic.sqlalchemy.org/en/latest/autogenerate.html#what-does-autogenerate-detect-and-what-does-it-not-detect
- FastAPI security (JWT): https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- OWASP JWT Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
