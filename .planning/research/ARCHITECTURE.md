# Architecture Patterns

**Project:** XBO AI TeamHub
**Domain:** Internal task management platform (FastAPI + Next.js + PostgreSQL monorepo)
**Researched:** 2026-02-24
**Confidence:** HIGH — well-established patterns for this stack

---

## Recommended Architecture

### High-Level System View

```
monorepo root/
├── backend/          FastAPI application (Python)
├── frontend/         Next.js application (TypeScript)
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md
```

The two services communicate exclusively through HTTP. The frontend calls the backend REST API. No shared code between them — they are separate deployable units that happen to live in the same repository.

```
Browser
  └─► Next.js (port 3000)
        └─► FastAPI (port 8000)
              └─► PostgreSQL (port 5432)
```

For AI features: FastAPI calls Claude API directly. The frontend never touches Claude.

---

## Monorepo Layout

### Root Files

```
/
├── docker-compose.yml          # Local dev: postgres, backend, frontend
├── docker-compose.prod.yml     # Production overrides
├── .env.example                # All env vars documented, no defaults for secrets
├── Makefile                    # Dev shortcuts: make dev, make migrate, make test
└── README.md
```

### Backend Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, mounts routers, CORS, lifespan
│   ├── config.py               # Pydantic Settings, reads env vars
│   ├── database.py             # SQLAlchemy engine, SessionLocal, get_db dependency
│   │
│   ├── models/                 # SQLAlchemy ORM models (one file per domain)
│   │   ├── __init__.py         # Re-exports all models (needed for Alembic autogenerate)
│   │   ├── user.py
│   │   ├── department.py
│   │   ├── ticket.py
│   │   ├── column_history.py
│   │   ├── ticket_event.py
│   │   ├── comment.py
│   │   ├── subtask.py
│   │   ├── custom_field.py
│   │   ├── dependency.py
│   │   ├── sprint.py
│   │   └── wiki_page.py
│   │
│   ├── schemas/                # Pydantic request/response models (one file per domain)
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── ticket.py
│   │   ├── comment.py
│   │   ├── subtask.py
│   │   ├── custom_field.py
│   │   ├── sprint.py
│   │   └── wiki_page.py
│   │
│   ├── routers/                # FastAPI route handlers (thin: validate, call service, return)
│   │   ├── auth.py             # POST /auth/register, POST /auth/login, GET /auth/me
│   │   ├── users.py            # GET /users, GET /users/{id}
│   │   ├── departments.py      # GET /departments, GET /departments/{slug}/tickets
│   │   ├── tickets.py          # CRUD + move + filters
│   │   ├── comments.py         # POST/GET /tickets/{id}/comments
│   │   ├── subtasks.py         # CRUD /tickets/{id}/subtasks
│   │   ├── custom_fields.py    # Workspace schema + per-ticket values
│   │   ├── sprints.py          # Sprint CRUD + ticket assignment
│   │   ├── wiki.py             # Wiki page CRUD
│   │   ├── dashboard.py        # GET /dashboard/kpis, GET /dashboard/workload
│   │   └── ai.py               # POST /ai/subtasks, /ai/effort_estimate, /ai/summary
│   │
│   ├── services/               # Business logic (pure functions, no HTTP concerns)
│   │   ├── auth.py             # JWT encode/decode, password hash/verify
│   │   ├── ticket.py           # move_ticket(), compute_roi(), assign_owner()
│   │   ├── dashboard.py        # aggregate KPIs from DB queries
│   │   ├── ai.py               # Claude API calls (gated by AI_ENABLED)
│   │   └── column_history.py   # record_column_entry(), record_column_exit()
│   │
│   ├── dependencies/           # FastAPI Depends() providers
│   │   ├── auth.py             # get_current_user, require_role(roles)
│   │   └── pagination.py       # PaginationParams, FilterParams
│   │
│   └── utils/
│       └── roi.py              # ROI formula calculations (pure math, easy to test)
│
├── migrations/
│   ├── env.py                  # Alembic env — imports all models for autogenerate
│   └── versions/               # Migration files
│
├── tests/
│   ├── conftest.py             # pytest fixtures: test db, test client, seeded users
│   ├── test_auth.py
│   ├── test_tickets.py
│   ├── test_dashboard.py
│   └── ...
│
├── alembic.ini
├── requirements.txt
├── requirements-dev.txt
└── Dockerfile
```

### Frontend Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout: providers, fonts
│   │   ├── page.tsx            # Root redirect → /kanban or /login
│   │   │
│   │   ├── (auth)/             # Route group: no sidebar layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (app)/              # Route group: authenticated, with sidebar
│   │   │   ├── layout.tsx      # Sidebar, topbar, auth guard
│   │   │   ├── kanban/
│   │   │   │   └── page.tsx    # Kanban board (all departments or filtered)
│   │   │   ├── tickets/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Ticket detail
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Executive KPI dashboard
│   │   │   ├── sprints/
│   │   │   │   └── page.tsx
│   │   │   ├── wiki/
│   │   │   │   ├── page.tsx    # Wiki home
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Wiki page detail/edit
│   │   │   └── departments/
│   │   │       └── [slug]/
│   │   │           └── page.tsx # Department portal (submission form)
│   │   │
│   │   └── api/                # Next.js API Routes (thin proxies only if needed)
│   │       └── ...             # Likely unused — frontend calls FastAPI directly
│   │
│   ├── components/
│   │   ├── ui/                 # Primitive components (Button, Input, Badge, Modal)
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── TicketCard.tsx
│   │   │   └── TicketFilters.tsx
│   │   ├── ticket/
│   │   │   ├── TicketDetail.tsx
│   │   │   ├── SubtaskList.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   ├── ActivityTimeline.tsx
│   │   │   ├── ROIPanel.tsx
│   │   │   └── ColumnHistoryView.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICards.tsx
│   │   │   ├── WorkloadTable.tsx
│   │   │   └── DepartmentBreakdown.tsx
│   │   ├── wiki/
│   │   │   └── WikiEditor.tsx
│   │   └── shared/
│   │       ├── RichTextEditor.tsx  # Wraps Tiptap or similar
│   │       ├── DepartmentBadge.tsx
│   │       └── UserAvatar.tsx
│   │
│   ├── lib/
│   │   ├── api/                # Typed API client (fetch wrappers, one file per resource)
│   │   │   ├── client.ts       # Base fetch with auth header injection
│   │   │   ├── tickets.ts
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   └── ...
│   │   ├── auth.ts             # Token storage (httpOnly cookie or localStorage strategy)
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useTickets.ts       # Data fetching + polling hooks
│   │   ├── useAuth.ts
│   │   ├── useDashboard.ts
│   │   └── ...
│   │
│   ├── store/                  # Zustand or Context (auth state, filters, optimistic UI)
│   │   ├── auth.ts
│   │   └── kanban.ts
│   │
│   └── types/                  # TypeScript types mirroring backend schemas
│       ├── ticket.ts
│       ├── user.ts
│       └── ...
│
├── public/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **FastAPI routers** | HTTP request/response, input validation via Pydantic, auth enforcement | Services (call), DB session (inject via Depends) |
| **FastAPI services** | Business logic: move ticket, compute ROI, aggregate KPIs, call Claude | Models (read/write via session), utils |
| **SQLAlchemy models** | Database schema definition, relationships, constraints | PostgreSQL only |
| **Pydantic schemas** | API contract: request bodies, response shapes, validation rules | Routers (consume), Frontend types (mirror) |
| **Alembic migrations** | Schema versioning, forward/rollback, never manual DDL | Database only |
| **Next.js App Router pages** | Routing, auth guards, page-level data orchestration | API client lib, components |
| **React components** | Rendering, user interaction, optimistic UI | Hooks, store |
| **API client lib** | Typed fetch wrappers, token injection, error normalization | FastAPI (HTTP) |
| **Zustand store** | Client-side state: auth session, kanban filter state, optimistic moves | Components, hooks |

### Strict Layer Rules

- Routers NEVER contain SQL. They call services.
- Services NEVER import routers. One-way dependency.
- Models NEVER import schemas. Zero coupling between ORM and API layer.
- Frontend components NEVER call fetch directly. Always through `lib/api/`.
- Frontend `lib/api/` NEVER imports React. Plain TypeScript functions.

---

## SQLAlchemy Data Model

### Core Design Decisions

- All models inherit from a `Base` declarative base defined in `database.py`
- UUIDs as primary keys (prevents enumeration attacks on internal tool)
- `created_at` / `updated_at` on every table via mixin
- Soft deletes NOT used — hard delete is fine for internal tool
- All foreign keys have explicit `ondelete` behavior

### Base Mixin

```python
# app/models/base.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

class TimestampMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
```

### Model Definitions

```python
# app/models/user.py
class User(TimestampMixin, Base):
    __tablename__ = "users"
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum("admin", "member", "requester", name="user_role"), nullable=False)
    department_id = Column(UUID, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    department = relationship("Department", back_populates="members")
    owned_tickets = relationship("Ticket", back_populates="owner", foreign_keys="Ticket.owner_id")
    saved_filters = Column(JSONB, default=list)  # Saved filter presets


# app/models/department.py
class Department(TimestampMixin, Base):
    __tablename__ = "departments"
    slug = Column(String, unique=True, nullable=False)  # "xbo_dev", "cashier", etc.
    name = Column(String, nullable=False)
    tickets = relationship("Ticket", back_populates="department")
    members = relationship("User", back_populates="department")


# app/models/ticket.py
class Ticket(TimestampMixin, Base):
    __tablename__ = "tickets"

    # Core fields
    title = Column(String, nullable=False)
    problem_statement = Column(Text)           # Rich text stored as JSON (Tiptap format)
    status = Column(
        Enum("backlog","discovery","in_progress","review_qa","done", name="ticket_status"),
        nullable=False, default="backlog"
    )

    # Ownership
    department_id = Column(UUID, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    owner_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # owner_id = null enforced when status = "backlog"

    # Planning fields
    urgency = Column(Enum("low","medium","high","critical", name="urgency_level"))
    business_impact = Column(Text)
    success_criteria = Column(Text)
    effort_estimate = Column(Float)            # Hours
    due_date = Column(Date, nullable=True)
    next_step = Column(String)

    # ROI fields (stored flat on ticket — see KEY DECISIONS)
    current_time_cost_hours_per_week = Column(Float)
    employees_affected = Column(Integer)
    avg_hourly_cost = Column(Float)
    current_error_rate = Column(Float)
    revenue_blocked = Column(Float)
    strategic_value = Column(Integer)          # 1–5
    # Computed ROI (denormalized for query simplicity)
    weekly_cost = Column(Float)
    yearly_cost = Column(Float)
    annual_savings = Column(Float)
    roi = Column(Float)
    adjusted_roi = Column(Float)

    # Attachment metadata (v1: no file hosting)
    attachments = Column(JSONB, default=list)  # [{filename, size, uploaded_by, uploaded_at}]

    # Relationships
    department = relationship("Department", back_populates="tickets")
    owner = relationship("User", back_populates="owned_tickets", foreign_keys=[owner_id])
    column_history = relationship("ColumnHistory", back_populates="ticket",
                                  order_by="ColumnHistory.entered_at")
    events = relationship("TicketEvent", back_populates="ticket",
                          order_by="TicketEvent.created_at")
    comments = relationship("Comment", back_populates="ticket", order_by="Comment.created_at")
    subtasks = relationship("Subtask", back_populates="ticket", order_by="Subtask.position")
    custom_field_values = relationship("CustomFieldValue", back_populates="ticket")
    sprint_tickets = relationship("SprintTicket", back_populates="ticket")

    # Dependencies
    blocking = relationship("Dependency",
                            foreign_keys="Dependency.blocking_ticket_id",
                            back_populates="blocking_ticket")
    blocked_by = relationship("Dependency",
                              foreign_keys="Dependency.blocked_ticket_id",
                              back_populates="blocked_ticket")


# app/models/column_history.py
class ColumnHistory(TimestampMixin, Base):
    __tablename__ = "column_history"
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    column = Column(String, nullable=False)    # "backlog", "in_progress", etc.
    entered_at = Column(DateTime(timezone=True), nullable=False)
    exited_at = Column(DateTime(timezone=True), nullable=True)  # null = currently in this column
    ticket = relationship("Ticket", back_populates="column_history")


# app/models/ticket_event.py
class TicketEvent(TimestampMixin, Base):
    __tablename__ = "ticket_events"
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(
        Enum("created","moved","assigned","edited","commented","subtask_done",
             name="event_type"),
        nullable=False
    )
    payload = Column(JSONB, default=dict)  # {from_col, to_col} or {field, old, new}
    ticket = relationship("Ticket", back_populates="events")
    actor = relationship("User")


# app/models/comment.py
class Comment(TimestampMixin, Base):
    __tablename__ = "comments"
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)        # Rich text as JSON
    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User")


# app/models/subtask.py
class Subtask(TimestampMixin, Base):
    __tablename__ = "subtasks"
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)
    position = Column(Integer, nullable=False)  # For drag-to-reorder
    ticket = relationship("Ticket", back_populates="subtasks")


# app/models/custom_field.py
class CustomFieldDefinition(TimestampMixin, Base):
    """Workspace-level field schema (admin-managed)"""
    __tablename__ = "custom_field_definitions"
    name = Column(String, nullable=False, unique=True)
    field_type = Column(Enum("text","number","date","select", name="custom_field_type"))
    options = Column(JSONB, default=list)       # For "select" type

class CustomFieldValue(TimestampMixin, Base):
    """Per-ticket value for a custom field"""
    __tablename__ = "custom_field_values"
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(UUID, ForeignKey("custom_field_definitions.id", ondelete="CASCADE"))
    value = Column(JSONB)                       # String, number, date, or array
    ticket = relationship("Ticket", back_populates="custom_field_values")
    field = relationship("CustomFieldDefinition")


# app/models/dependency.py
class Dependency(TimestampMixin, Base):
    __tablename__ = "dependencies"
    blocking_ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"))
    blocked_ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"))
    blocking_ticket = relationship("Ticket", foreign_keys=[blocking_ticket_id],
                                   back_populates="blocking")
    blocked_ticket = relationship("Ticket", foreign_keys=[blocked_ticket_id],
                                  back_populates="blocked_by")
    __table_args__ = (
        UniqueConstraint("blocking_ticket_id", "blocked_ticket_id"),
    )


# app/models/sprint.py
class Sprint(TimestampMixin, Base):
    __tablename__ = "sprints"
    name = Column(String, nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    is_active = Column(Boolean, default=False)
    sprint_tickets = relationship("SprintTicket", back_populates="sprint")

class SprintTicket(Base):
    """Association table: sprint <-> ticket"""
    __tablename__ = "sprint_tickets"
    sprint_id = Column(UUID, ForeignKey("sprints.id", ondelete="CASCADE"), primary_key=True)
    ticket_id = Column(UUID, ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True)
    sprint = relationship("Sprint", back_populates="sprint_tickets")
    ticket = relationship("Ticket", back_populates="sprint_tickets")


# app/models/wiki_page.py
class WikiPage(TimestampMixin, Base):
    __tablename__ = "wiki_pages"
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    content = Column(JSONB)                    # Tiptap JSON format
    author_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    parent_id = Column(UUID, ForeignKey("wiki_pages.id", ondelete="SET NULL"), nullable=True)
    author = relationship("User")
    children = relationship("WikiPage", backref=backref("parent", remote_side="WikiPage.id"))
```

---

## API Design Patterns

### REST Conventions

```
GET    /api/tickets                     # List with filters + pagination
POST   /api/tickets                     # Create
GET    /api/tickets/{id}                # Detail
PATCH  /api/tickets/{id}               # Partial update (most fields)
DELETE /api/tickets/{id}               # Hard delete
POST   /api/tickets/{id}/move          # Column transition (special — triggers events)
GET    /api/tickets/{id}/history       # Column history
GET    /api/tickets/{id}/events        # Activity timeline
POST   /api/tickets/{id}/comments      # Add comment
GET    /api/tickets/{id}/comments      # List comments
POST   /api/tickets/{id}/subtasks      # Add subtask
PATCH  /api/tickets/{id}/subtasks/{sid} # Update subtask (done/undone/reorder)
DELETE /api/tickets/{id}/subtasks/{sid}
POST   /api/tickets/{id}/dependencies  # Add blocking dependency
DELETE /api/tickets/{id}/dependencies/{dep_id}
```

### Pagination Pattern (cursor-based for timeline feeds, offset for lists)

```python
# Ticket lists use offset pagination (simpler for filtered views)
GET /api/tickets?page=1&page_size=50&status=in_progress&owner_id=...&department=xbo_dev

# Response envelope:
{
  "items": [...],
  "total": 143,
  "page": 1,
  "page_size": 50,
  "pages": 3
}
```

### Filtering Pattern

All list endpoints accept filter query params. Use a shared `FilterParams` dependency:

```python
# app/dependencies/pagination.py
class TicketFilter(BaseModel):
    status: Optional[TicketStatus] = None
    owner_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    urgency: Optional[UrgencyLevel] = None
    due_date_from: Optional[date] = None
    due_date_to: Optional[date] = None
    created_from: Optional[date] = None
    created_to: Optional[date] = None
    min_days_in_column: Optional[int] = None   # Aging filter
    sprint_id: Optional[UUID] = None
    search: Optional[str] = None               # ILIKE on title
```

### Column Move Pattern (critical — triggers side effects)

Moving a ticket is not a plain PATCH. It's a domain action with side effects:

```python
# POST /api/tickets/{id}/move
# Body: { "to_column": "in_progress", "owner_id": "..." }

# Service logic:
def move_ticket(ticket, to_column, owner_id, actor, db):
    # 1. Validate: if to_column != "backlog" and no owner → 422
    # 2. Validate: if blocked_by dependencies not Done → 422
    # 3. Close current ColumnHistory entry (set exited_at)
    # 4. Create new ColumnHistory entry (entered_at = now)
    # 5. Update ticket.status and ticket.owner_id
    # 6. Emit TicketEvent(type="moved", payload={from, to})
    # 7. If owner changed: emit TicketEvent(type="assigned")
    # All in one DB transaction
```

### Auth Pattern

```python
# All protected routes use Depends(get_current_user)
# Role enforcement via Depends(require_role(["admin", "member"]))

# app/dependencies/auth.py
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    payload = verify_jwt(token)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401)
    return user

def require_role(allowed: list[str]):
    def check(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed:
            raise HTTPException(403)
        return current_user
    return check
```

### AI Endpoints Pattern

```python
# app/routers/ai.py
router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/subtasks")
async def generate_subtasks(
    body: AISubtaskRequest,
    current_user = Depends(get_current_user),
    settings = Depends(get_settings)
):
    if not settings.AI_ENABLED:
        raise HTTPException(503, "AI features not enabled")
    return await ai_service.generate_subtasks(body)
```

---

## Data Flow

### Kanban Board Load

```
Browser → GET /api/tickets?page_size=200 (all active tickets, no pagination UI needed at <30 users)
       → GET /api/departments (for filter dropdowns)
       → GET /api/users (for owner filter)
Frontend groups tickets by status column client-side (avoids 5 parallel requests)
```

### Ticket Move (Drag and Drop)

```
Browser DnD event → optimistic UI update (move card immediately)
                  → POST /api/tickets/{id}/move { to_column, owner_id }
                  → success: confirm optimistic state
                  → failure: revert optimistic state, show error toast
```

### Dashboard KPIs

```
Browser → GET /api/dashboard/kpis
Backend aggregates in a single SQL query with window functions:
  - open_count: COUNT WHERE status != done
  - throughput: COUNT WHERE done AND done_at > 7 days ago
  - avg_cycle_time: AVG(done_at - created_at) WHERE done
  - avg_time_per_column: AVG(exited_at - entered_at) per column from column_history
  - bottleneck: column with highest avg_time
  - overdue: COUNT WHERE due_date < today AND status != done
```

### Activity Timeline

```
Browser → GET /api/tickets/{id}/events (returns TicketEvents)
       → GET /api/tickets/{id}/comments (returns Comments)
Frontend merges and sorts by timestamp client-side (simple at this scale)
```

---

## Patterns to Follow

### Pattern 1: Service Layer Isolation

**What:** Routers are thin HTTP adapters. Business logic lives in services.

**When:** Always. Routers handle: parse request → call service → return response.

```python
# CORRECT — thin router
@router.patch("/{ticket_id}")
def update_ticket(ticket_id: UUID, body: TicketUpdate,
                  db = Depends(get_db), user = Depends(get_current_user)):
    ticket = ticket_service.update(db, ticket_id, body, actor=user)
    return ticket

# WRONG — fat router (logic in route handler)
@router.patch("/{ticket_id}")
def update_ticket(ticket_id: UUID, body: TicketUpdate, db = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    ticket.title = body.title
    db.commit()
    return ticket
```

### Pattern 2: Transaction Boundaries in Services

**What:** Services receive a `db` session. One service call = one transaction.

**When:** Any write operation that touches multiple tables (move_ticket, create_ticket).

```python
def move_ticket(db: Session, ticket_id: UUID, to_col: str, owner_id: UUID, actor: User):
    ticket = db.get(Ticket, ticket_id)
    # ... all writes ...
    db.commit()
    db.refresh(ticket)
    return ticket
```

### Pattern 3: Schema Separation (Request vs Response)

**What:** Separate Pydantic models for input (Create, Update) and output (Read).

**When:** Always. Never use ORM model directly as response.

```python
class TicketCreate(BaseModel):
    title: str
    department_id: UUID
    # ... required fields only

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    # ... all optional

class TicketRead(BaseModel):
    id: UUID
    title: str
    owner: UserRead | None     # nested, not just owner_id
    department: DepartmentRead
    # ...
    model_config = ConfigDict(from_attributes=True)
```

### Pattern 4: Alembic Autogenerate Safety

**What:** Never write migrations by hand. Always autogenerate, then review.

**When:** Every schema change.

```bash
# Workflow
alembic revision --autogenerate -m "add sprint_id to tickets"
# Review the generated file before applying
alembic upgrade head
```

### Pattern 5: Frontend API Client Layer

**What:** All API calls go through typed functions in `lib/api/`. No raw `fetch` in components.

**When:** Always.

```typescript
// lib/api/tickets.ts
export async function moveTicket(
  id: string,
  body: { to_column: TicketStatus; owner_id?: string }
): Promise<Ticket> {
  return apiPost(`/tickets/${id}/move`, body)
}

// Component calls:
const result = await moveTicket(ticket.id, { to_column: 'in_progress', owner_id: userId })
// NEVER: await fetch('/api/tickets/...')
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct SQL in Routers

**What:** Writing `db.execute(text("SELECT ..."))` inside a route handler.

**Why bad:** Untestable, mixes HTTP and data concerns, impossible to reuse.

**Instead:** Push all DB access into services or dedicated query functions.

### Anti-Pattern 2: Lazy Loading in API Responses

**What:** Accessing `ticket.owner.email` after the session is closed (triggers N+1).

**Why bad:** Each ticket card access hits the DB separately; silent performance killer.

**Instead:** Use `joinedload()` or `selectinload()` explicitly in service query functions.

```python
# CORRECT
def get_tickets(db, filters) -> list[Ticket]:
    return db.scalars(
        select(Ticket)
        .options(joinedload(Ticket.owner), joinedload(Ticket.department))
        .where(...)
    ).all()
```

### Anti-Pattern 3: Putting ROI Computation in the Database

**What:** Using PostgreSQL computed columns or triggers for ROI math.

**Why bad:** Hard to change formula, harder to test, migration-coupled.

**Instead:** Compute in `app/utils/roi.py` (pure Python) and store the result.

### Anti-Pattern 4: Storing Rich Text as Raw HTML

**What:** Saving `<p>text</p>` strings from the rich text editor.

**Why bad:** XSS risk, hard to diff, hard to render consistently.

**Instead:** Store Tiptap JSON format. Render client-side. Sanitize on read if rendering raw HTML.

### Anti-Pattern 5: Skipping Dependency Validation Client-Side

**What:** Only enforcing "blocked dependency must be Done" on the server.

**Why bad:** Drag fails silently; user is confused why card snaps back.

**Instead:** Check dependencies before allowing drag. Show "blocked by X tickets" tooltip on card.

---

## Build Order Implications

The architecture creates hard dependencies between layers. Build in this order:

### Layer 0: Foundation (nothing depends on this being empty)
1. `docker-compose.yml` — postgres + backend + frontend services
2. `backend/app/database.py` — engine, session, `get_db` dependency
3. `backend/app/models/__init__.py` + base mixin
4. `backend/alembic.ini` + `migrations/env.py`

### Layer 1: Auth (everything else requires users)
5. `User` model + `Department` model
6. Initial Alembic migration (users + departments tables)
7. Seed departments (7 fixed slugs)
8. Auth service (JWT encode/decode, bcrypt)
9. Auth router (`/auth/register`, `/auth/login`, `/auth/me`)
10. `get_current_user` dependency
11. Frontend auth pages + token storage + auth guard in `(app)/layout.tsx`

### Layer 2: Ticket Core (kanban depends on this)
12. `Ticket` model (without ROI fields first — add after core works)
13. `ColumnHistory` model
14. `TicketEvent` model
15. Migration for tickets + column_history + ticket_events
16. Ticket CRUD service + router (create, read, list, update)
17. Column move service (triggers column history + events)
18. Frontend kanban board (static columns, drag-and-drop)
19. Frontend ticket detail page

### Layer 3: Collaboration Features (depends on tickets existing)
20. `Comment` model + router
21. `Subtask` model + router
22. Activity timeline (renders TicketEvents + Comments merged)
23. Column history view

### Layer 4: Analytics + ROI
24. ROI fields on Ticket model + migration
25. ROI computation utility + schema fields
26. Executive dashboard KPI aggregation service + router
27. Frontend dashboard page

### Layer 5: Advanced Features
28. `CustomFieldDefinition` + `CustomFieldValue` models
29. `Dependency` model + dependency enforcement in move_ticket
30. `Sprint` + `SprintTicket` models
31. Department portal (submission form + templates)
32. Saved filters (JSONB on User)

### Layer 6: Wiki + AI
33. `WikiPage` model + router + editor
34. AI service (Claude API) behind `AI_ENABLED` flag
35. AI router (`/ai/subtasks`, `/ai/effort_estimate`, `/ai/summary`)

### Critical Dependency Chain

```
Docker/DB → Auth → Ticket Core → Collaboration → Analytics → Advanced → Wiki/AI
```

Nothing in Layer N+1 can be shipped without Layer N functioning. Each layer
leaves the app in a runnable state — this is the core constraint from PROJECT.md.

---

## Scalability Considerations

At <30 users this system will never hit scaling problems. These notes exist to avoid
premature decisions that make scaling harder later.

| Concern | At <30 users (v1) | If scaling needed |
|---------|-------------------|-------------------|
| Polling cadence | Every 30s on kanban board | Switch to WebSocket per PROJECT.md plan |
| Dashboard queries | Single SQL aggregation | Add materialized view if slow |
| Ticket list | Offset pagination, no cursor | Cursor pagination if >10K tickets |
| File attachments | Metadata only (JSONB) | Add S3 + presigned URLs |
| AI latency | Synchronous response ok | Add background job queue |
| Auth | JWT stateless | Add token revocation table if needed |

---

## Docker Compose Structure

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: teamhub
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/teamhub
      JWT_SECRET: ${JWT_SECRET}
      AI_ENABLED: ${AI_ENABLED:-false}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    depends_on:
      - postgres
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app  # Hot reload in dev

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - backend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app  # Hot reload in dev

volumes:
  postgres_data:
```

---

## Sources

- FastAPI documentation: service/router separation patterns — HIGH confidence (well-established community pattern)
- SQLAlchemy documentation: relationship loading strategies (joinedload, selectinload) — HIGH confidence
- Next.js App Router documentation: route groups, layout nesting — HIGH confidence
- Alembic documentation: autogenerate workflow — HIGH confidence
- PostgreSQL JSONB: custom fields and attachment metadata pattern — HIGH confidence
- Tiptap rich text editor: JSON storage format — MEDIUM confidence (verify version compatibility)
- Project context: /XBO-AI-TeamHub/.planning/PROJECT.md — constraints, decisions, feature requirements
