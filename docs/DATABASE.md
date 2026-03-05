# Database Schema

## Overview

PostgreSQL 16 with 14 tables managed by SQLAlchemy 2.x ORM and Alembic migrations. All timestamps use `TIMESTAMPTZ`. JSONB columns store rich text (Tiptap), custom field values, and event payloads.

## Entity Relationship Diagram

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  users   │────▶│  tickets   │◀────│ departments  │
│          │     │            │     │              │
│ id       │     │ id         │     │ id           │
│ email    │     │ title      │     │ slug         │
│ full_name│     │ status_col │     │ name         │
│ role     │     │ owner_id──▶│     └──────────────┘
│ is_active│     │ dept_id───▶│
│ token_ver│     │ ROI fields │
└──────┬───┘     │ custom_flds│
       │         └─────┬──────┘
       │               │
       │    ┌──────────┼──────────┬──────────────┬──────────────┐
       │    │          │          │              │              │
       │    ▼          ▼          ▼              ▼              ▼
       │ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ │comments│ │subtasks│ │  events   │ │ col_hist │ │ contacts │
       │ └────────┘ └────────┘ └──────────┘ └──────────┘ └──────────┘
       │
       ├──▶ notifications
       ├──▶ saved_filters
       └──▶ custom_field_defs

┌──────────┐     ┌──────────────────┐     ┌──────────┐
│  tickets │◀───▶│ticket_dependencies│◀───▶│ tickets  │
│ (blocker)│     │  (M2M join table) │     │ (blocked)│
└──────────┘     └──────────────────┘     └──────────┘

┌──────────┐     ┌──────────────┐
│  tickets │────▶│  wiki_pages  │───▶ wiki_pages (parent)
└──────────┘     └──────────────┘

┌──────────┐     ┌──────────────────┐
│  tickets │────▶│ticket_attachments│
└──────────┘     └──────────────────┘

┌──────────┐
│ ticket_  │
│ templates│
└──────────┘
```

## Tables

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| email | VARCHAR(254) | UNIQUE, INDEX, NOT NULL | Login email |
| hashed_password | VARCHAR(255) | NOT NULL | Argon2 hash |
| full_name | VARCHAR(255) | NOT NULL | Display name |
| role | ENUM('admin','member') | NOT NULL, DEFAULT 'member' | Access role |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Soft delete flag |
| token_version | INTEGER | NOT NULL, DEFAULT 0 | JWT invalidation counter |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now(), ON UPDATE | |

### departments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| slug | VARCHAR(50) | UNIQUE, INDEX | URL-friendly ID (e.g., `xbo_dev`) |
| name | VARCHAR(100) | NOT NULL | Display name (e.g., "R&D") |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Seeded departments (23):** R&D, Back office, Banking, BI, Bizdev & Sales, Cashier, Compliance, Content, Creative Studio, Design, Customer Support, Dealing, DevOps & IT, Finance, HR&Recruitment (CY), HR&Recruitment (UKR), Legal, Onboarding, Product (XBO), Success, Technical Support, Technical Writers, UI/UX

### tickets

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| title | VARCHAR(500) | NOT NULL | Ticket title |
| status_column | ENUM | NOT NULL, DEFAULT 'Backlog' | Kanban column |
| priority | ENUM('low','medium','high','critical') | NULLABLE | Priority level |
| urgency | INTEGER | CHECK(1-5), NULLABLE | Urgency scale |
| department_id | UUID | FK departments.id, NOT NULL | |
| owner_id | UUID | FK users.id, NULLABLE | Assigned user |
| problem_statement | JSONB | NULLABLE | Tiptap rich text |
| business_impact | TEXT | NULLABLE | |
| success_criteria | TEXT | NULLABLE | |
| next_step | TEXT | NULLABLE | |
| due_date | DATE | NULLABLE | |
| effort_estimate | FLOAT | NULLABLE | Estimated hours |
| **ROI Inputs** | | | |
| current_time_cost_hours_per_week | FLOAT | NULLABLE | Hours/week of current process |
| employees_affected | FLOAT | NULLABLE | People impacted |
| avg_hourly_cost | FLOAT | NULLABLE | Cost per hour per employee |
| current_error_rate | FLOAT | NULLABLE | Error/defect rate |
| revenue_blocked | FLOAT | NULLABLE | Revenue impact |
| **ROI Outputs** | | | |
| weekly_cost | FLOAT | NULLABLE | Computed: hours x employees x cost |
| yearly_cost | FLOAT | NULLABLE | Computed: weekly x 52 |
| annual_savings | FLOAT | NULLABLE | Computed: = yearly_cost |
| dev_cost | FLOAT | NULLABLE | Computed: effort x hourly rate |
| roi | FLOAT | NULLABLE | Computed: (savings - dev) / dev |
| **Advanced** | | | |
| wiki_page_id | UUID | FK wiki_pages.id, NULLABLE | Linked wiki page |
| custom_field_values | JSONB | NULLABLE | `{"field_uuid": "value"}` |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now(), ON UPDATE | |

**Status Column Enum values:** `Backlog`, `Discovery`, `In Progress`, `Review/QA`, `Done`

### ticket_comments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE | |
| author_id | UUID | FK users.id | |
| body | TEXT | NOT NULL | Comment text (supports Tiptap JSON) |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### ticket_subtasks

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE | |
| title | VARCHAR(500) | NOT NULL | |
| done | BOOLEAN | NOT NULL, DEFAULT false | |
| position | INTEGER | NOT NULL | Sort order (0-based) |

### ticket_events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE | |
| event_type | VARCHAR(50) | NOT NULL | `created`, `edited`, `moved`, `comment_added` |
| payload | JSONB | NOT NULL, DEFAULT {} | Event-specific data |
| actor_id | UUID | FK users.id SET NULL, NULLABLE | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Index:** `ix_ticket_events_ticket_created` on (ticket_id, created_at)

### column_history

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE | |
| column | VARCHAR(100) | NOT NULL | Column name |
| entered_at | TIMESTAMPTZ | DEFAULT now() | When ticket entered column |
| exited_at | TIMESTAMPTZ | NULLABLE | When ticket left (NULL = current) |

**Index:** `ix_column_history_ticket_exited` on (ticket_id, exited_at)

### ticket_dependencies

M2M association table (no ORM model class).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| blocker_id | UUID | FK tickets.id CASCADE, PK | Ticket that blocks |
| blocked_id | UUID | FK tickets.id CASCADE, PK | Ticket being blocked |

**Composite primary key:** (blocker_id, blocked_id)

### ticket_attachments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE, INDEX | |
| filename | VARCHAR(500) | NOT NULL | Original filename |
| content_type | VARCHAR(200) | NOT NULL | MIME type |
| size_bytes | INTEGER | NOT NULL | File size |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Allowed MIME types:** `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`

### ticket_contacts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| ticket_id | UUID | FK tickets.id CASCADE, INDEX | |
| user_id | UUID | FK users.id CASCADE, INDEX, NULLABLE | Internal contact |
| external_name | VARCHAR(200) | NULLABLE | External contact name |
| external_email | VARCHAR(254) | NULLABLE | External contact email |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**CHECK:** Either `user_id` is set (internal) or `external_name` is set (external)

### notifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK users.id CASCADE | Recipient |
| actor_id | UUID | FK users.id SET NULL, NULLABLE | Trigger user |
| ticket_id | UUID | FK tickets.id CASCADE, NULLABLE | Related ticket |
| type | VARCHAR(50) | NOT NULL | `mention`, `assignment`, `status_change` |
| message | TEXT | NOT NULL | Display text |
| read | BOOLEAN | NOT NULL, DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### ticket_templates

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| title | VARCHAR(500) | NOT NULL | Template name |
| problem_statement | JSONB | NULLABLE | Tiptap content |
| default_urgency | INTEGER | NULLABLE | |
| default_effort_estimate | FLOAT | NULLABLE | |
| default_next_step | TEXT | NULLABLE | |
| created_by_id | UUID | FK users.id | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now(), ON UPDATE | |

### custom_field_defs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| name | VARCHAR(200) | NOT NULL | Field display name |
| field_type | ENUM('text','number','date') | NOT NULL | |
| scope | ENUM('workspace','personal') | NOT NULL | Visibility scope |
| owner_id | UUID | FK users.id, NULLABLE | Personal field owner |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**CHECK:** `(scope='personal' AND owner_id IS NOT NULL) OR (scope='workspace' AND owner_id IS NULL)`

### wiki_pages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| title | VARCHAR(500) | NOT NULL | |
| content | JSONB | NULLABLE | Tiptap editor content |
| parent_id | UUID | FK wiki_pages.id SET NULL, NULLABLE | Hierarchy parent |
| created_by | UUID | FK users.id | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now(), ON UPDATE | |

### saved_filters

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK users.id | Filter owner |
| name | VARCHAR(200) | NOT NULL | Preset name |
| filter_state | JSONB | NOT NULL | Board filter configuration |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

## Migrations

Alembic manages all schema changes. Migration history:

| Migration | Description |
|-----------|-------------|
| `bc1748a61656` | Initial schema (users, departments, tickets) |
| `e58d6c737dab` | Phase 2: Kanban core (events, column_history, subtasks, comments) |
| `93dab7e5b92c` | Phase 3: Collaboration & portal (templates, contacts) |
| `f9e6148f9818` | Phase 4: ROI fields on tickets |
| `9c6cd841fe34` | Phase 5: Advanced features (dependencies, custom_fields, wiki, saved_filters) |
| `b7e3f2c1d4a5` | Notifications table |
| `a3f2e1d8c9b0` | Ticket attachments table |
| `c2d4f6a8e1b3` | Ticket contacts table |
| `61b4cd2c3e5e` | Drop sprints table and sprint_id |
| `13444529af83` | Drop ROI adjustment fields |

### Running Migrations

```bash
# Inside backend container
alembic upgrade head      # Apply all pending
alembic downgrade -1      # Rollback one step
alembic revision --autogenerate -m "description"  # Generate new
```

## Database Configuration

```python
# Connection pool settings
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,    # Reconnect stale connections
    pool_size=5,           # Base pool size
    max_overflow=10,       # Additional overflow connections
    pool_timeout=30,       # Connection timeout (seconds)
    pool_recycle=1800,     # Recycle connections after 30 min
)
```

## Naming Conventions

All constraints follow a standardized naming convention:

| Type | Pattern | Example |
|------|---------|---------|
| Primary Key | `pk_<table>` | `pk_tickets` |
| Foreign Key | `fk_<table>_<col>_<ref_table>` | `fk_tickets_owner_id_users` |
| Unique | `uq_<table>_<col>` | `uq_users_email` |
| Index | `ix_<col>` | `ix_column_0_label` |
| Check | `ck_<table>_<name>` | `ck_tickets_urgency` |

## Cascade Rules

| Relationship | ON DELETE |
|-------------|-----------|
| Ticket → Comments | CASCADE |
| Ticket → Subtasks | CASCADE |
| Ticket → Events | CASCADE |
| Ticket → ColumnHistory | CASCADE |
| Ticket → Attachments | CASCADE |
| Ticket → Contacts | CASCADE |
| Ticket → Dependencies | CASCADE |
| Ticket → WikiPage | SET NULL |
| User → Tickets (owner) | SET NULL |
| User → Notifications | CASCADE |
| WikiPage → WikiPage (parent) | SET NULL |
