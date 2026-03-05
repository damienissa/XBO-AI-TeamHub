# Backend Documentation

## Overview

The backend is a **FastAPI async application** (Python 3.12) providing 50+ REST endpoints across 17 routers. It uses SQLAlchemy 2.x with async sessions, Pydantic v2 for validation, and JWT authentication via httpOnly cookies.

**Entry point:** `app/main.py`
**API base URL:** `http://localhost:8000`
**Interactive docs:** `http://localhost:8000/docs` (Swagger UI)

## Directory Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app initialization, router registration
│   ├── dependencies.py        # Auth dependency injection (get_current_user, require_admin)
│   ├── core/
│   │   ├── config.py          # Settings (env vars via pydantic-settings)
│   │   ├── database.py        # Async engine, session factory, Base class
│   │   └── security.py        # JWT creation/validation, cookie management
│   ├── models/                # SQLAlchemy ORM models (14 tables)
│   ├── schemas/               # Pydantic request/response schemas
│   ├── routers/               # API endpoint handlers (17 routers)
│   ├── services/              # Business logic layer
│   │   ├── auth.py            # User authentication, token refresh
│   │   ├── tickets.py         # Ticket creation, moves, blocking checks
│   │   ├── contacts.py        # Contact person management
│   │   ├── roi.py             # ROI computation (pure function)
│   │   ├── notifications.py   # Notification creation, mentions, email triggers
│   │   ├── mention_parser.py  # Extract @mentions from Tiptap JSON
│   │   ├── file_extraction.py # Extract text from PDF/DOCX/TXT
│   │   └── email.py           # SMTP email sending (async)
│   └── scripts/
│       └── seed.py            # Database seed (departments + admin user)
├── alembic/                   # Database migrations
├── tests/                     # pytest test suite
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

## Configuration

Environment variables loaded via `pydantic-settings` from `.env`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | str | required | PostgreSQL async connection string |
| `SECRET_KEY` | str | required | JWT signing key (64+ random chars) |
| `SEED_ADMIN_PASSWORD` | str | required | Initial admin user password |
| `COOKIE_SAMESITE` | str | `"strict"` | Cookie SameSite attribute |
| `COOKIE_SECURE` | bool | `false` | HTTPS-only cookies |
| `DB_ECHO` | bool | `false` | SQL query logging |
| `AI_TEAM_HOURLY_RATE` | float | `75.0` | Dev cost per hour for ROI |
| `AI_ENABLED` | bool | `false` | Toggle AI features |
| `ANTHROPIC_API_KEY` | str | `""` | Claude API key |
| `AI_MODEL` | str | `"claude-haiku-4-5"` | AI model identifier |
| `UPLOAD_DIR` | str | `"/app/uploads"` | File storage path |
| `MAX_UPLOAD_BYTES` | int | `10485760` | Max upload size (10 MB) |
| `SMTP_HOST` | str | `""` | SMTP server (empty = skip emails) |
| `SMTP_PORT` | int | `587` | SMTP port |
| `SMTP_USER` | str | `""` | SMTP username |
| `SMTP_PASSWORD` | str | `""` | SMTP password |
| `SMTP_FROM` | str | `"noreply@xbo.com"` | Sender email address |

## Authentication & Security

### JWT Configuration
- **Algorithm:** HS256
- **Access token TTL:** 8 hours
- **Refresh token TTL:** 30 days
- **Access cookie:** `access_token`, path `/`, httpOnly
- **Refresh cookie:** `refresh_token`, path `/api/auth/refresh`, httpOnly

### Auth Dependencies

**`get_current_user(request, db) -> User`**
1. Extract `access_token` cookie
2. Decode JWT (verify signature + expiry)
3. Verify `type == "access"`
4. Load user from DB by `sub` (user_id)
5. Verify `token_version` matches
6. Return User object (or raise 401)

**`require_admin(current_user) -> User`**
- Checks `role == "admin"`, raises 403 otherwise
- Used for: user creation, ticket deletion, wiki deletion, workspace custom fields

### Password Hashing
Uses `pwdlib` with Argon2 (not bcrypt). Passwords never stored in plain text.

## Services

### Auth Service (`services/auth.py`)

| Function | Description |
|----------|-------------|
| `authenticate_user(email, password, db)` | Validate credentials, return User or raise 401 |
| `create_user(data, db)` | Create user with hashed password, check email uniqueness |
| `refresh_tokens(refresh_token, db)` | Validate refresh token, return new token pair |
| `invalidate_user_tokens(user, db)` | Increment token_version (invalidates all sessions) |

### Tickets Service (`services/tickets.py`)

| Function | Description |
|----------|-------------|
| `create_ticket(db, data, actor_id)` | Atomic: insert ticket + column_history + event + contacts |
| `move_ticket(db, ticket_id, data, actor_id)` | Check blocking, close old column, open new column, emit event |
| `check_not_blocked(db, ticket_id)` | Raise 409 if any non-Done blocker exists |

### ROI Service (`services/roi.py`)

**`compute_roi_fields(...) -> dict`** — Pure function (no I/O):
```
weekly_cost    = hours_per_week x employees x hourly_cost
yearly_cost    = weekly_cost x 52
annual_savings = yearly_cost
dev_cost       = effort_estimate x ai_team_hourly_rate
roi            = (annual_savings - dev_cost) / dev_cost
```
Returns None for any field where inputs are insufficient. Guards against `dev_cost == 0`.

### Notifications Service (`services/notifications.py`)

| Function | Description |
|----------|-------------|
| `create_notification(...)` | Insert notification row + schedule async email |
| `notify_mentions(content, actor, ticket)` | Parse @mentions from text, create notifications |
| `notify_assignment(old_owner, new_owner, ticket, actor)` | Notify on assignment changes |
| `notify_status_change(old_col, new_col, ticket, actor)` | Notify ticket owner on column change |

### Contacts Service (`services/contacts.py`)

**`replace_contacts(db, ticket_id, contacts_in)`** — Replace-all strategy:
1. DELETE all existing contacts for ticket
2. Batch-fetch User objects for internal contacts
3. INSERT new rows (internal or external)
4. Return resolved `ContactOut[]`

### File Extraction Service (`services/file_extraction.py`)

**`extract_text(data, content_type) -> str`**
- PDF: `pypdf.PdfReader` → text per page (limit 15,000 chars)
- DOCX: `python-docx.Document` → paragraph text
- TXT/MD: UTF-8 decode
- AI context limit: 8,000 chars

### Mention Parser (`services/mention_parser.py`)

**`extract_mentioned_user_ids(content) -> list[str]`**
Recursively walks Tiptap JSON tree, extracts `{"type": "mention", "attrs": {"id": "user-uuid"}}` nodes.

### Email Service (`services/email.py`)

**`send_email(to, subject, body)`**
Non-blocking SMTP (called via `BackgroundTasks`). Silently skips if `SMTP_HOST` is empty.

## Seed Script

`app/scripts/seed.py` — Idempotent database seeder:
- Upserts 23 departments (canonical list)
- Removes non-canonical departments
- Creates admin user with `SEED_ADMIN_PASSWORD`

## Testing

```bash
# Run tests inside backend container
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
```

**Configuration:**
- `pytest-asyncio` with `asyncio_mode=auto`
- `NullPool` for test engines (avoids cross-event-loop errors)
- `httpx.AsyncClient` for endpoint testing

**Test files:**
- `tests/test_auth.py` — Authentication flow tests
- `tests/test_tickets.py` — Ticket CRUD and move tests
- `tests/test_departments.py` — Department listing tests

## Dependencies

Key Python packages:

| Package | Purpose |
|---------|---------|
| `fastapi >= 0.115` | REST framework |
| `uvicorn[standard] >= 0.29` | ASGI server |
| `sqlalchemy[asyncio] >= 2.0` | ORM + async |
| `asyncpg >= 0.29` | PostgreSQL async driver |
| `alembic >= 1.13` | Database migrations |
| `pyjwt >= 2.8` | JWT encode/decode |
| `pwdlib[argon2] >= 0.2` | Password hashing |
| `pydantic-settings >= 2.0` | Config management |
| `anthropic >= 0.50` | Claude API client |
| `pypdf >= 4.0` | PDF text extraction |
| `python-docx >= 1.0` | DOCX text extraction |
| `python-multipart >= 0.0.9` | File upload parsing |
