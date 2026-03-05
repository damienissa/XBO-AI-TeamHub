# Architecture

## System Overview

XBO AI TeamHub is a monorepo containing two independent services connected via HTTP REST API, backed by PostgreSQL and optionally integrated with the Anthropic Claude API.

```
┌──────────────────────────────────────────────────────────┐
│                     Docker Compose                        │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────┐  │
│  │ Frontend  │───▶│ Backend  │───▶│   PostgreSQL 16   │  │
│  │ Next.js   │◀───│ FastAPI  │◀───│                   │  │
│  │ :3000     │    │ :8000    │    │   :5432           │  │
│  └──────────┘    └────┬─────┘    └───────────────────┘  │
│                       │                                  │
│                  ┌────▼─────┐                            │
│                  │  Claude  │  (optional, feature-flagged)│
│                  │   API    │                            │
│                  └──────────┘                            │
└──────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Async-First Backend
All database operations use async SQLAlchemy with asyncpg. FastAPI routes are async, enabling high concurrency with minimal threads.

### 2. Strict N+1 Prevention
All SQLAlchemy relationships use `lazy="raise"`, forcing explicit `selectinload()` on every query. N+1 regressions are caught at test time, not in production.

### 3. Three-Layer Architecture
```
Routers (thin HTTP handlers)
    │
    ▼
Services (business logic, pure functions)
    │
    ▼
Models (SQLAlchemy ORM, database access)
```

- **Routers**: Request parsing, response formatting, dependency injection
- **Services**: Business rules, validation, computations (testable in isolation)
- **Models**: Database schema, relationships, constraints

### 4. JWT in httpOnly Cookies
Tokens stored in httpOnly cookies prevent XSS-based account takeover. Access tokens (8h TTL) and refresh tokens (30d TTL) use sliding-window refresh. A `token_version` integer on the User model enables instant session invalidation.

### 5. Feature-Flagged AI
`AI_ENABLED` environment variable gates all Claude API calls. When disabled, AI endpoints return HTTP 503. The application runs fully without AI credentials.

## Frontend Architecture

### Route Groups
```
src/app/
├── (auth)/           # Public routes (login)
│   └── login/
├── (app)/            # Protected routes (requires auth)
│   ├── board/        # Kanban board
│   ├── dashboard/    # Executive KPI dashboard
│   ├── portal/       # Department intake portal
│   ├── wiki/         # Wiki pages
│   ├── dept/         # Department detail views
│   └── settings/     # Templates, custom fields
└── layout.tsx        # Root layout
```

### State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| **Server State** | TanStack Query v5 | API data, polling (30s), cache invalidation |
| **URL State** | nuqs | Filter params in URL query string (shareable) |
| **Client State** | React state / hooks | UI toggles, form state, optimistic updates |
| **Form State** | React Hook Form + Zod | Validation, submission, error handling |

### Key Patterns

**Polling Strategy**: TanStack Query `refetchInterval: 30000` for the board endpoint. Dashboard uses `staleTime: 300000` (5 min). Config endpoint cached with `staleTime: 300000`.

**Drag-and-Drop**: DND Kit with `DragOverlay` always mounted (children=null when inactive). Backlog drops trigger an owner assignment modal before completing the move.

**Rich Text**: Tiptap 2.x with JSON storage (never HTML in the database). Mention extension for @user notifications.

**API Client**: Axios instance with interceptor for 401 → auto-refresh → retry. Base URL switches between `NEXT_PUBLIC_API_URL` (browser) and `INTERNAL_API_URL` (server-side).

## Backend Architecture

### Router Registration Order
```python
# app/main.py
app.include_router(auth_router,         prefix="/api/auth")
app.include_router(departments_router,  prefix="/api/departments")
app.include_router(tickets_router,      prefix="/api/tickets")
app.include_router(board_router,        prefix="/api")
app.include_router(dashboard_router,    prefix="/api")
app.include_router(comments_router,     prefix="/api")
app.include_router(subtasks_router,     prefix="/api")
app.include_router(templates_router,    prefix="/api")
app.include_router(dependencies_router, prefix="/api/tickets")
app.include_router(custom_fields_router,prefix="/api/custom-field-defs")
app.include_router(saved_filters_router,prefix="/api/saved-filters")
app.include_router(wiki_router,         prefix="/api/wiki")
app.include_router(ai_router,          prefix="/api")
app.include_router(attachments_router,  prefix="/api/tickets")
app.include_router(notifications_router,prefix="/api")
app.include_router(assistant_router,    prefix="/api")
```

### Authentication Flow
```
1. POST /api/auth/login (email + password)
       │
       ▼
2. Validate credentials (Argon2 hash check)
       │
       ▼
3. Generate JWT (access 8h + refresh 30d)
       │
       ▼
4. Set httpOnly cookies (access_token, refresh_token)
       │
       ▼
5. Frontend reads /api/auth/me on every page load
       │
       ▼
6. On 401: Auto-refresh via /api/auth/refresh
       │
       ▼
7. On refresh failure: Redirect to /login
```

### Token Versioning
```
User.token_version = 0  (initial)
    │
    ▼  Admin changes user role / deactivates user
    │
User.token_version = 1  (incremented)
    │
    ▼  Next API call with old token
    │
JWT payload.token_version (0) != User.token_version (1)
    │
    ▼  401 Unauthorized → forces re-login
```

## Data Flow

### Ticket Lifecycle
```
Portal/Board Create
    │
    ▼
Ticket (status=Backlog, owner=null)
    │ + ColumnHistory(Backlog, entered_at=now)
    │ + TicketEvent(type=created)
    │
    ▼  Drag to Discovery (owner required)
    │
Ticket (status=Discovery, owner=assigned)
    │ + ColumnHistory(Backlog, exited_at=now)
    │ + ColumnHistory(Discovery, entered_at=now)
    │ + TicketEvent(type=moved, payload={from,to})
    │ + Notification(type=assignment)
    │
    ▼  Progress through columns...
    │
Ticket (status=Done)
    │ + ColumnHistory(Review/QA, exited_at=now)
    │ + ColumnHistory(Done, entered_at=now)
    │
    ▼  Analytics
    │
Dashboard: cycle_time, throughput, column_times
```

### Board Load (Single Request)
```
GET /api/board?owner_id=...&department_id=...
    │
    ▼
1. Build filtered query (WHERE conditions)
    │
    ▼
2. selectinload(owner, department, contacts.user)
    │
    ▼
3. Batch query: open ColumnHistory rows → time_in_column
    │
    ▼
4. Batch query: subtask counts (GROUP BY ticket_id)
    │
    ▼
5. Batch query: blocked_by counts (M2M count)
    │
    ▼
6. Resolve contact names/emails
    │
    ▼
Response: list[BoardTicketOut] (fully populated)
```

### ROI Computation
```
Input fields (on ticket):
  current_time_cost_hours_per_week
  employees_affected
  avg_hourly_cost
  effort_estimate
      │
      ▼  compute_roi_fields() — pure function
      │
Output fields (persisted on ticket):
  weekly_cost  = hours × employees × cost
  yearly_cost  = weekly_cost × 52
  annual_savings = yearly_cost
  dev_cost     = effort × AI_TEAM_HOURLY_RATE
  roi          = (annual_savings - dev_cost) / dev_cost
```

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Polling over WebSocket** | <30 users; 30s poll creates negligible load. WebSocket deferred to v2. |
| **JWT in httpOnly cookies** | Prevents XSS token theft. SameSite + Secure in production. |
| **`lazy="raise"` on all relationships** | Catches N+1 at development time, not production. |
| **TIMESTAMPTZ for all timestamps** | Prevents clock drift across timezones. |
| **ROI on Ticket model** | First-class fields, no joins; simpler dashboard aggregations. |
| **Column history from Phase 2** | Too expensive to retrofit; enables accurate cycle time metrics. |
| **Single-tenant** | XBO is the only tenant; no multi-workspace overhead. |
| **Tiptap JSON (not HTML)** | Prevents XSS. Structured data enables server-side text extraction. |
| **AI behind feature flag** | Zero API costs in dev; production enables selectively. |
| **Pydantic v2 only** | 5-17x faster validation; no v1 compatibility layers. |

## Security Model

### Authentication
- JWT access tokens (HS256, 8h TTL) in httpOnly cookies
- Refresh tokens (30d TTL) scoped to `/api/auth/refresh` path
- Password hashing: Argon2 via `pwdlib`
- Token version invalidation on role change / deactivation

### Authorization
- Two roles: `admin` and `member`
- Admin-only: create users, delete tickets, delete wiki pages, workspace custom fields
- All authenticated users: CRUD tickets, comments, subtasks, templates
- Public: department list, health check, config

### Input Validation
- Pydantic v2 schemas on all endpoints
- Zod validation on all frontend forms
- Title length validation (1-500 chars)
- File upload: type whitelist + size limit (10 MB)
- Filename sanitization (regex, max 200 chars)

### Cookie Security
- `httpOnly=True` (no JavaScript access)
- `SameSite=strict` in production (CSRF protection)
- `Secure=True` in production (HTTPS only)
- Refresh token path-scoped to `/api/auth/refresh`

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Board load | O(1) queries via selectinload + batch subqueries |
| Dashboard aggregation | PostgreSQL window functions (no app-side loops) |
| Polling interval | 30s (board), 5min (dashboard, config) |
| Expected server load | ~1 req/sec from all clients combined (<30 users) |
| Connection pool | 5 base + 10 overflow, 30s timeout, 30min recycle |
| JWT validation | Stateless (no DB query per request until token_version check) |
