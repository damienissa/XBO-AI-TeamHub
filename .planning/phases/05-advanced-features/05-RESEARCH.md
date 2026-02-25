# Phase 5: Advanced Features - Research

**Researched:** 2026-02-25
**Domain:** Ticket dependencies, sprints, custom fields, wiki (Tiptap), timeline view (Recharts), saved filters (nuqs)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sprint board model**
- Sprint board is a separate view — the existing kanban always shows all tickets unaffected
- "Sprints" is a top-level sidebar nav item (same level as Board, Dashboard)
- Tickets are assigned to a sprint via a Sprint field on the ticket detail modal (search/select from active sprints)
- Velocity metrics appear as a header bar at the top of the sprint board: "X of Y effort hours completed" + % progress

**Dependency visibility**
- Dependencies added via search picker on ticket detail (type to search by ID or title, select from dropdown)
- Blocked tickets on the kanban board show a subtle "blocked" badge only — no color change, no border accent
- When a user tries to move a blocked ticket and the server rejects it: toast notification listing the blocking tickets (e.g. "Blocked by PROJ-12, PROJ-34 — resolve first")
- Dependencies displayed in a dedicated "Dependencies" section on ticket detail, above subtasks; shows both "blocks" and "blocked by" separately

**Wiki placement & navigation**
- Wiki is a top-level sidebar nav item (same level as Board, Dashboard, Sprints)
- Wiki listing page uses a hierarchical tree (pages can have parent-child relationships, displayed as a tree in sidebar)
- Tickets link to wiki pages via a "Wiki" field on ticket detail (search picker to select a page)
- Rich text editor (Tiptap) supports basic formatting: bold, italic, H1–H3, bullet lists, numbered lists, code blocks

**Custom fields layout**
- Custom fields appear in a dedicated "Custom Fields" section at the bottom of the ticket detail (below system fields, above or after subtasks)
- Supported field types: Text, Number, Date
- Two scopes of custom fields:
  - Workspace fields: Admin-defined in Workspace Settings, shared across all users, appear on every ticket
  - Personal fields: User-defined, private — only the creating user sees them; created inline on ticket detail via an "Add my field" button in the Custom Fields section
- Admin manages workspace field definitions in Workspace Settings ("Custom Fields" tab)

**Saved filters**
- Saved filters accessible via a "Saved" dropdown in the board's existing filter bar — users can save current filter state with a name and reload presets from the same dropdown

### Claude's Discretion
- Timeline view: how tickets without due dates are shown (hide, show at end, or show as undated)
- Exact tree rendering approach for wiki hierarchy (left sidebar vs. outline on page)
- Sprint board column layout (mirror kanban columns vs. custom sprint columns)
- Personal field definitions storage schema (JSONB on user, separate table, etc.)
- Empty states for each new view (no sprints yet, no wiki pages yet, etc.)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIKI-01 | Wiki pages have: title, content (Tiptap JSON rich text), created_by, created_at, updated_at | WikiPage model with `parent_id` FK for hierarchy, content stored as JSONB (same as problem_statement pattern on Ticket) |
| WIKI-02 | Wiki page list shows all pages with title and last updated | GET /api/wiki endpoint returning WikiPageOut with parent_id for tree assembly |
| WIKI-03 | Admin and member roles can create and edit wiki pages | Role-based write: require_auth (both roles); only admin can DELETE (same pattern as TICKET-04) |
| WIKI-04 | All authenticated users can read wiki pages; only admin can delete pages | `get_current_user` for GET, `require_admin` for DELETE — existing dependency pattern |
| WIKI-05 | Ticket detail includes "Linked Pages" section where wiki pages can be linked | `wiki_page_id` FK on Ticket (nullable), cmdk-based Combobox picker in TicketDetailModal |
| ADV-01 | Custom field definitions per workspace: admin can define fields (name, type: text/number/date) | CustomFieldDef model with scope enum (workspace/personal), owner_id nullable (personal only) |
| ADV-02 | Per-ticket custom field values stored as JSONB | `custom_field_values` JSONB column on Ticket; use `flag_modified` on update to force dirty tracking |
| ADV-03 | Custom fields displayed and editable on ticket detail | CustomFields section component reads defs + ticket values, renders type-aware inputs |
| ADV-04 | Ticket dependencies: a ticket can block one or more other tickets | `ticket_dependencies` association table (blocker_id, blocked_id), self-referential M2M on Ticket |
| ADV-05 | Moving a blocked ticket out of Backlog is rejected server-side if any blocking dependency is not in Done | Add check in `move_ticket` service: query blockers, reject 409 if any not Done |
| ADV-06 | Dependencies shown on ticket detail with link to blocking ticket | DependenciesSection component shows "Blocks" list + "Blocked By" list |
| ADV-07 | Saved filters: user can save current board filter state with a name, reload it later | `saved_filters` table (id, user_id, name, filter_state JSONB), GET/POST/DELETE endpoints |
| ADV-08 | Sprints: admin can create a sprint (name, start_date, end_date) | Sprint model, admin-only POST; Sprints top-level page |
| ADV-09 | Tickets can be assigned to a sprint | `sprint_id` nullable FK on Ticket, PATCH /api/tickets/:id sprint_id field |
| ADV-10 | Sprint board shows tickets in that sprint; basic velocity metric (effort_hours completed vs total) | GET /api/sprints/:id/board — filter tickets by sprint_id, aggregate effort sums |
| ADV-11 | Simple timeline / Gantt view: read-only, derived from ticket due dates, shows tickets as bars | Custom Recharts BarChart with numeric X-axis (epoch ms), custom bar shape |
</phase_requirements>

---

## Summary

Phase 5 adds six distinct features to an existing well-structured FastAPI + Next.js codebase. The project already has SQLAlchemy 2.0 async ORM, Alembic migrations, Tiptap v3 (with `immediatelyRender: false` established), nuqs for URL state, TanStack Query, shadcn/ui with cmdk (for search pickers), and Recharts for charts — all installed and battle-tested in earlier phases. No new runtime dependencies are required for any feature except possibly a tree rendering utility for the wiki hierarchy (but a custom recursive React component suffices given the small dataset of an internal wiki).

The five non-trivial technical decisions in this phase are: (1) the `ticket_dependencies` self-referential many-to-many association table and its server-side blocked-move check; (2) JSONB mutation tracking for per-ticket custom field values; (3) the wiki hierarchy tree (parent_id self-reference on WikiPage, recursive frontend component); (4) saved filter state serialization using the current nuqs filter shape as a JSONB snapshot; and (5) the timeline view, which Recharts does not support natively — the best zero-dependency approach is a custom BarChart with a numeric epoch-ms X axis and transparent "offset" bars to simulate Gantt positioning.

**Primary recommendation:** Build all five sub-features (05-01 through 05-05) using only the already-installed stack. Do not add Gantt or tree libraries. Use the cmdk Combobox pattern (already in the project via `command.tsx`) for every search picker (dependencies, sprint assignment, wiki page linking). Store saved filters as a JSONB snapshot on a new `saved_filters` table — not on User — to support named, deletable presets.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | ^3.20.0 | Rich text editor for wiki pages | Already powering problem_statement; v3 StarterKit includes bold, italic, H1-H3, lists, code blocks |
| @tiptap/starter-kit | ^3.20.0 | All basic formatting extensions | Covers all required wiki formatting in one import |
| @tiptap/pm | ^3.20.0 | ProseMirror peer dep | Required by Tiptap v3 |
| cmdk (via command.tsx) | ^1.1.1 | Combobox search pickers | Already powering OwnerModal; use same pattern for dep picker, sprint picker, wiki picker |
| recharts | ^3.7.0 | Timeline (Gantt) bars | Already installed for Dashboard; custom horizontal BarChart avoids new dependency |
| nuqs | ^2.8.8 | Filter state serialization | `useQueryStates` already manages board filter; serialize to JSONB for saved presets |
| @tanstack/react-query | ^5.90.21 | All data fetching/caching | Standard for all new pages (sprints, wiki, timeline) |
| SQLAlchemy (asyncio) | >=2.0 | New models + JSONB columns | Self-referential M2M, JSONB custom_field_values, flag_modified |
| Alembic | >=1.13 | Phase 5 migration | One migration covers all new tables/columns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlalchemy.ext.mutable.MutableDict | (built-in) | JSONB mutation tracking | Wrap `custom_field_values` column so ORM detects in-place dict changes |
| sqlalchemy.orm.attributes.flag_modified | (built-in) | Manual dirty flag | Alternative when reassigning entire dict (simpler than MutableDict for this case) |
| date-fns | ^4.1.0 | Timeline date-to-epoch conversion | Already installed; convert `due_date` to epoch ms for Recharts X axis |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Recharts BarChart (timeline) | Frappe Gantt or SVAR Gantt | Gantt libs add bundle weight + new learning curve; custom Recharts BarChart covers the read-only requirement with zero new deps |
| Custom recursive tree (wiki) | react-arborist | react-arborist is optimal for large trees; an internal wiki with <100 pages needs only a simple recursive component |
| saved_filters table | JSONB on User model | Separate table enables named/deletable presets and avoids unbounded JSONB growth on User rows |

**Installation:** No new packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

New files/folders this phase adds:

```
backend/app/
├── models/
│   ├── ticket_dependency.py    # Association table model (blocker_id, blocked_id)
│   ├── sprint.py               # Sprint + SprintTicket (or sprint_id FK on Ticket)
│   ├── custom_field.py         # CustomFieldDef model
│   ├── wiki_page.py            # WikiPage model with parent_id self-ref
│   └── saved_filter.py         # SavedFilter model (user_id, name, filter_state JSONB)
├── routers/
│   ├── dependencies.py         # POST/DELETE /api/tickets/:id/dependencies
│   ├── sprints.py              # CRUD sprints + GET /api/sprints/:id/board
│   ├── custom_fields.py        # CRUD workspace/personal field defs
│   ├── wiki.py                 # CRUD wiki pages
│   └── saved_filters.py        # CRUD saved filter presets
├── schemas/
│   ├── ticket_dependency.py
│   ├── sprint.py
│   ├── custom_field.py
│   ├── wiki_page.py
│   └── saved_filter.py
└── alembic/versions/
    └── XXXX_phase5_advanced_features.py   # One migration for all phase 5 tables/columns

frontend/src/app/(app)/
├── sprints/
│   ├── page.tsx                # Sprint list page
│   └── [sprintId]/
│       └── page.tsx            # Sprint board page with velocity header
├── wiki/
│   ├── page.tsx                # Wiki tree listing page
│   └── [pageId]/
│       └── page.tsx            # Wiki page view/edit
├── timeline/
│   └── page.tsx                # Read-only timeline Gantt view
└── settings/
    └── custom-fields/
        └── page.tsx            # Admin workspace field definitions

frontend/src/app/(app)/board/_components/
├── DependenciesSection.tsx     # "Blocks" + "Blocked By" lists on ticket detail
├── SprintField.tsx             # Sprint picker on ticket detail
├── WikiLinkField.tsx           # Wiki page picker on ticket detail
└── CustomFieldsSection.tsx     # Custom fields section on ticket detail
```

### Pattern 1: Self-Referential Many-to-Many (Ticket Dependencies)

**What:** A ticket can block many tickets; a ticket can be blocked by many tickets. No extra columns on the association — just blocker_id and blocked_id.

**When to use:** ADV-04, ADV-05, ADV-06

**Example:**
```python
# Source: SQLAlchemy 2.0 docs — self-referential M2M via association table
# backend/app/models/ticket_dependency.py
import uuid
import sqlalchemy as sa
from app.models.base import Base

# Pure association table — no ORM class needed (no extra columns)
ticket_dependencies = sa.Table(
    "ticket_dependencies",
    Base.metadata,
    sa.Column("blocker_id", sa.Uuid, sa.ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("blocked_id", sa.Uuid, sa.ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
)
```

```python
# Add to Ticket model (backend/app/models/ticket.py):
from app.models.ticket_dependency import ticket_dependencies

# In Ticket class:
blocks = relationship(
    "Ticket",
    secondary=ticket_dependencies,
    primaryjoin="Ticket.id == ticket_dependencies.c.blocker_id",
    secondaryjoin="Ticket.id == ticket_dependencies.c.blocked_id",
    foreign_keys=[ticket_dependencies.c.blocker_id, ticket_dependencies.c.blocked_id],
    lazy="raise",
)
blocked_by = relationship(
    "Ticket",
    secondary=ticket_dependencies,
    primaryjoin="Ticket.id == ticket_dependencies.c.blocked_id",
    secondaryjoin="Ticket.id == ticket_dependencies.c.blocker_id",
    foreign_keys=[ticket_dependencies.c.blocker_id, ticket_dependencies.c.blocked_id],
    lazy="raise",
)
```

### Pattern 2: Dependency Check in move_ticket Service

**What:** Before allowing a Backlog → any column move, check if any blocker is not Done.

**When to use:** ADV-05

**Example:**
```python
# Source: project move_ticket service pattern + SQLAlchemy 2.0
# backend/app/services/tickets.py  (extension)
from sqlalchemy import select
from app.models.ticket_dependency import ticket_dependencies
from app.models.ticket import Ticket, StatusColumn
from fastapi import HTTPException

async def check_not_blocked(db: AsyncSession, ticket_id: uuid.UUID) -> None:
    """Raise 409 if ticket has any blocking dependency not in Done."""
    result = await db.execute(
        select(Ticket)
        .join(ticket_dependencies, ticket_dependencies.c.blocker_id == Ticket.id)
        .where(ticket_dependencies.c.blocked_id == ticket_id)
        .where(Ticket.status_column != StatusColumn.Done)
    )
    blockers = result.scalars().all()
    if blockers:
        ids = ", ".join(str(b.id)[:8] for b in blockers)
        raise HTTPException(
            status_code=409,
            detail={"code": "BLOCKED", "blocker_ids": [str(b.id) for b in blockers],
                    "message": f"Blocked by {ids} — resolve first"},
        )
```

### Pattern 3: JSONB Custom Field Values with Mutation Tracking

**What:** Store per-ticket custom field values as a JSONB dict keyed by field definition ID.

**When to use:** ADV-02, ADV-03

**Example:**
```python
# backend/app/models/ticket.py — add to Ticket class
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.dialects.postgresql import JSONB

# In Ticket class:
custom_field_values: Mapped[dict | None] = mapped_column(
    MutableDict.as_mutable(JSONB),
    nullable=True,
    default=None,
)
```

```python
# In the PATCH handler: after updating custom_field_values, use flag_modified
# if assigning a whole new dict (simpler when replacing entire payload):
from sqlalchemy.orm.attributes import flag_modified

ticket.custom_field_values = updated_values
flag_modified(ticket, "custom_field_values")
await db.flush()
```

### Pattern 4: WikiPage Hierarchy (parent_id Self-Reference)

**What:** Pages have an optional parent. The frontend assembles a tree by grouping pages by parent_id.

**When to use:** WIKI-01, WIKI-02

**Example:**
```python
# backend/app/models/wiki_page.py
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from app.models.base import Base

class WikiPage(Base):
    __tablename__ = "wiki_pages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Tiptap JSON
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, ForeignKey("wiki_pages.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), onupdate=func.now(), server_default=func.now()
    )
```

```typescript
// Frontend: recursive tree component (no library needed)
// Source: project pattern — small dataset, no virtualization required
interface WikiPageNode {
  id: string;
  title: string;
  parent_id: string | null;
  updated_at: string;
  children?: WikiPageNode[];
}

function buildTree(pages: WikiPageNode[]): WikiPageNode[] {
  const map = new Map(pages.map((p) => [p.id, { ...p, children: [] as WikiPageNode[] }]));
  const roots: WikiPageNode[] = [];
  for (const page of map.values()) {
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children!.push(page);
    } else {
      roots.push(page);
    }
  }
  return roots;
}

function WikiTreeNode({ node }: { node: WikiPageNode }) {
  return (
    <div className="pl-3 border-l border-slate-200">
      <a href={`/wiki/${node.id}`} className="block py-1 text-sm hover:text-slate-900">
        {node.title}
      </a>
      {node.children?.map((child) => <WikiTreeNode key={child.id} node={child} />)}
    </div>
  );
}
```

### Pattern 5: Saved Filters — Serialize nuqs State as JSONB

**What:** Capture current useQueryStates values as a plain object, POST to server, store as JSONB. On load, restore by calling setFilters with the stored object.

**When to use:** ADV-07

**Example:**
```typescript
// Source: nuqs docs — useQueryStates returns plain object matching filter shape
// The saved filter_state JSONB is this exact object:
// { owner: string|null, department: string|null, priority: string|null, ... }

// Save current filter state:
const [filters, setFilters] = useQueryStates({ owner: parseAsString, ... });

async function saveCurrentFilter(name: string) {
  await fetch(`${API_BASE}/api/saved-filters`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filter_state: filters }),
  });
}

// Restore a saved filter:
function applyFilter(preset: { filter_state: Record<string, unknown> }) {
  setFilters(preset.filter_state as Parameters<typeof setFilters>[0]);
}
```

```python
# backend/app/models/saved_filter.py
class SavedFilter(Base):
    __tablename__ = "saved_filters"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    filter_state: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now()
    )
```

### Pattern 6: Timeline View — Custom Recharts Horizontal BarChart

**What:** Recharts does not have a native Gantt/timeline chart. Build one using a horizontal BarChart with a numeric (epoch ms) X axis, a transparent "offset" bar, and a visible "duration" bar. For tickets that have only a due date (no start), use a fixed 1-day width at the due date.

**When to use:** ADV-11

**Example:**
```typescript
// Source: recharts docs + community pattern (github.com/rudrodip/recharts-gantt-chart)
// Each data point: { title, start: epochMs, duration: durationMs, id }
// Two Bar components: first is transparent offset, second is the visible bar.

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TimelineEntry {
  title: string;
  start: number;      // epoch ms — created_at or (due_date - 1 day)
  duration: number;   // ms — always at least 24h for visibility
  id: string;
  status_column: string;
}

function TimelineChart({ tickets }: { tickets: TimelineEntry[] }) {
  const minDate = Math.min(...tickets.map((t) => t.start));
  const maxDate = Math.max(...tickets.map((t) => t.start + t.duration));

  return (
    <ResponsiveContainer width="100%" height={Math.max(tickets.length * 36, 200)}>
      <BarChart data={tickets} layout="vertical" margin={{ left: 160 }}>
        <XAxis type="number" domain={[minDate, maxDate]} tickFormatter={(v) => format(v, "MMM d")} />
        <YAxis type="category" dataKey="title" width={150} tick={{ fontSize: 12 }} />
        <Bar dataKey="start" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {tickets.map((entry) => (
            <Cell key={entry.id} fill={STATUS_COLOR[entry.status_column]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 7: Sprint Model (sprint_id FK on Ticket)

**What:** Sprints are first-class entities. Tickets get a nullable `sprint_id` FK. Sprint board queries tickets WHERE sprint_id = :id.

**When to use:** ADV-08, ADV-09, ADV-10

**Example:**
```python
# backend/app/models/sprint.py
class Sprint(Base):
    __tablename__ = "sprints"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(300), nullable=False)
    start_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now()
    )
```

```python
# Add to Ticket model:
sprint_id: Mapped[uuid.UUID | None] = mapped_column(
    sa.Uuid, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True
)
```

```python
# Sprint board velocity endpoint:
# GET /api/sprints/{sprint_id}/board
# Returns: tickets[] + velocity: { effort_completed: float, effort_total: float, pct: float }

async def get_sprint_board(sprint_id: uuid.UUID, db: AsyncSession) -> SprintBoardOut:
    result = await db.execute(
        select(Ticket)
        .where(Ticket.sprint_id == sprint_id)
        .options(selectinload(Ticket.owner), selectinload(Ticket.department))
    )
    tickets = result.scalars().all()
    effort_total = sum(t.effort_estimate or 0 for t in tickets)
    effort_completed = sum(t.effort_estimate or 0 for t in tickets if t.status_column == StatusColumn.Done)
    pct = (effort_completed / effort_total * 100) if effort_total else 0
    return SprintBoardOut(
        tickets=[TicketOut.model_validate(t) for t in tickets],
        velocity=VelocityOut(effort_completed=effort_completed, effort_total=effort_total, pct=pct),
    )
```

### Pattern 8: cmdk Combobox Search Picker (Dependency / Sprint / Wiki)

**What:** Reuse the existing `command.tsx` (cmdk) + `popover.tsx` shadcn primitives for all search pickers this phase introduces.

**When to use:** Dependencies picker, Sprint assignment picker, Wiki page linker on ticket detail

**Example:**
```typescript
// Source: shadcn/ui Combobox docs + existing OwnerModal pattern in project
// Uses Popover + Command (cmdk) — both already in frontend/src/components/ui/
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";

interface ComboboxPickerProps {
  options: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
}

export function ComboboxPicker({ options, selected, onSelect, placeholder }: ComboboxPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="border rounded px-3 py-1.5 text-sm text-slate-700 w-full text-left">
          {options.find((o) => o.id === selected)?.label ?? placeholder ?? "Select..."}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {options.map((opt) => (
              <CommandItem key={opt.id} value={opt.label} onSelect={() => { onSelect(opt.id); setOpen(false); }}>
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Anti-Patterns to Avoid

- **Storing saved filters as a JSONB column on User:** Grows unboundedly without a named list UX; a separate `saved_filters` table gives named, deletable presets.
- **SprintTicket association table:** Unnecessary complexity — a direct `sprint_id` FK on Ticket is sufficient for single-sprint-per-ticket assignment. Only build M2M if tickets can belong to multiple sprints (out of scope).
- **DragOverlay for sprint board:** Sprint board is a separate view, not drag-and-drop. Use column cards or simple group-by-status rows — no dnd-kit needed.
- **Custom Gantt library for timeline:** Recharts is already installed and sufficient for a read-only date bar visualization. New Gantt libs add bundle weight and licensing complexity.
- **Tiptap toolbar for wiki editor:** The decision is basic formatting only. Implement a minimal toolbar (bold, italic, H1/H2/H3, bullet, numbered, code) — do not add advanced Tiptap extensions.
- **Circular dependency check server-side:** ADV-05 only requires blocking move when blockers are not Done. Full cycle detection (A→B→A) is a v2 concern; do not build graph traversal for v1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing for wiki | Custom contentEditable | Tiptap v3 (already installed) | ProseMirror handles all cursor/selection edge cases |
| Search picker with keyboard nav | Custom input + dropdown | cmdk Command (already installed via command.tsx) | Arrow key nav, fuzzy search, accessibility built in |
| Timeline Gantt chart | Custom SVG renderer | Recharts BarChart (already installed) with stacked offset bar pattern | Recharts handles responsive sizing, tooltips, axis formatting |
| JSONB mutation detection | Manual "dirty" flag tracking | `MutableDict.as_mutable(JSONB)` or `flag_modified` | ORM update events fire automatically; hand-rolled flags silently miss nested changes |
| Wiki tree structure | Third-party tree library | Simple recursive React component | Internal wiki has <100 pages; no virtualization needed; zero new dep |
| Filter state serialization | Custom serializer | Serialize the nuqs `useQueryStates` plain object directly as JSON | nuqs already provides a plain object matching the filter shape; round-trips cleanly through JSONB |

**Key insight:** Every tool this phase needs is already in the project. The only new work is models, migrations, routers, schemas, and UI components — no new npm packages or Python packages required.

---

## Common Pitfalls

### Pitfall 1: JSONB In-Place Mutation Not Detected by ORM

**What goes wrong:** `ticket.custom_field_values["field_id"] = "new_value"` — SQLAlchemy does not detect this as a change; no UPDATE is issued; data appears saved but is not persisted.

**Why it happens:** JSONB columns are treated as immutable by default in the ORM. In-place dict mutation bypasses the change-detection mechanism.

**How to avoid:** Either (a) use `MutableDict.as_mutable(JSONB)` on the column definition so mutations auto-propagate, or (b) when replacing the whole dict, call `flag_modified(ticket, "custom_field_values")` before flush. The project already has this pattern for `problem_statement` — replaces entire dict via PATCH payload, no in-place mutation needed.

**Warning signs:** Stale data returned on GET after PATCH; no UPDATE SQL emitted in logs.

### Pitfall 2: Self-Referential M2M Ambiguous Join

**What goes wrong:** SQLAlchemy raises `AmbiguousForeignKeysError` or produces wrong JOIN direction when both FKs in `ticket_dependencies` point to `tickets`.

**Why it happens:** Two FKs on the same table — SQLAlchemy cannot determine which is `primaryjoin` vs `secondaryjoin` automatically.

**How to avoid:** Always specify `primaryjoin`, `secondaryjoin`, and `foreign_keys` explicitly on both `blocks` and `blocked_by` relationships. See Pattern 1 example above.

**Warning signs:** `AmbiguousForeignKeysError` at startup; or relationship returns the same ticket in both directions.

### Pitfall 3: move_ticket Service Missing Dependency Check for Non-Backlog Moves

**What goes wrong:** ADV-05 says "moving a blocked ticket out of Backlog is rejected" — but the existing `move_ticket` service only enforces the owner rule for Backlog exits. The dependency check must be added to the same code path.

**Why it happens:** The PATCH endpoint already rejects Backlog→X without owner. The dep check must be inserted into the same guard block, not as a separate endpoint.

**How to avoid:** In `move_ticket`, after the existing `is_backlog_exit` check, add `await check_not_blocked(db, ticket_id)` when `is_backlog_exit is True`. Return HTTP 409 with structured error body: `{"code": "BLOCKED", "blocker_ids": [...], "message": "..."}` so the frontend toast can list the blocking tickets.

**Warning signs:** Blocked tickets can be dragged out of Backlog; no toast appears.

### Pitfall 4: Sprint Board Page Duplicates Kanban Logic

**What goes wrong:** Replicating drag-and-drop, DndContext, and board polling from KanbanBoard.tsx into the sprint board page creates maintenance debt.

**Why it happens:** The sprint board looks like the kanban but is a different view.

**How to avoid:** Sprint board is intentionally simpler — it shows tickets grouped by status column (read: display-only columns), no drag. Render simple column groups using `Object.groupBy` or a `reduce`, no dnd-kit. The velocity header bar is a plain div with a filled progress bar using Tailwind width utility.

**Warning signs:** SprintBoard imports `@dnd-kit/core` — stop immediately and remove.

### Pitfall 5: Wiki Page Delete Cascading Content Loss

**What goes wrong:** Deleting a parent wiki page also deletes or orphans child pages if cascade is not handled intentionally.

**Why it happens:** `parent_id` FK with `ON DELETE CASCADE` would delete the entire subtree silently.

**How to avoid:** Use `ON DELETE SET NULL` on `parent_id`. Orphaned child pages become top-level pages, preventing accidental bulk deletion. Admin gets a confirmation UI before deleting a page with children.

**Warning signs:** DELETE on parent returns 200 but child pages disappear from the tree.

### Pitfall 6: Recharts Timeline X-Axis Uses String Dates (Not Numbers)

**What goes wrong:** Passing `"2026-03-01"` strings as X values causes Recharts to treat the axis as categorical, rendering all bars at the same position.

**Why it happens:** Recharts `type="number"` X-axis requires numeric values; ISO date strings are not numeric.

**How to avoid:** Convert `due_date` to epoch milliseconds using `date-fns` `parseISO(ticket.due_date).getTime()` before passing to BarChart data. Format ticks back to human-readable using `tickFormatter={(v) => format(new Date(v), "MMM d")}`.

**Warning signs:** All bars stack at the left edge of the chart.

### Pitfall 7: CustomFieldDef Scope Confusion (Workspace vs Personal)

**What goes wrong:** Personal fields bleed into other users' ticket details, or workspace fields are editable by members.

**Why it happens:** Scope filtering not applied on the GET /api/custom-field-defs query.

**How to avoid:** Backend query always filters: return workspace fields (scope='workspace') UNION personal fields (scope='personal', owner_id=current_user.id). Frontend never renders personal fields for other users. Admin-only guards on POST/DELETE for workspace defs.

**Warning signs:** User sees another user's personal field names; member can define workspace-wide fields.

---

## Code Examples

Verified patterns from existing project code and official sources:

### Existing TiptapEditor Pattern (Reuse for Wiki)

```typescript
// Source: frontend/src/app/(app)/board/_components/TiptapEditor.tsx (existing file)
// Wiki editor reuses this EXACT component with editable prop:
// <TiptapEditor initialContent={page.content} onSave={handleSave} editable={canEdit} />
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useDebouncedCallback } from "use-debounce";

export function TiptapEditor({ initialContent, onSave, editable = true }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ?? "",
    editable,
    immediatelyRender: false,  // CRITICAL: prevents Next.js SSR hydration mismatch
    onUpdate: ({ editor }) => debouncedSave(editor.getJSON()),
    onBlur: ({ editor }) => { debouncedSave.flush(); onSave(editor.getJSON()); },
  });
  if (!editor) return null;
  return <EditorContent editor={editor} className="prose prose-sm max-w-none ..." />;
}
```

### Existing Alembic Migration Pattern

```python
# Source: backend/alembic/versions/f9e6148f9818_phase4_roi_fields.py (existing)
# Phase 5 migration follows this exact pattern:
revision: str = 'XXXX_phase5'
down_revision: Union[str, None] = '13444529af83'  # latest Phase 4 migration

def upgrade() -> None:
    # New tables:
    op.create_table('wiki_pages', ...)
    op.create_table('sprints', ...)
    op.create_table('ticket_dependencies', ...)
    op.create_table('custom_field_defs', ...)
    op.create_table('saved_filters', ...)
    # New columns on tickets:
    op.add_column('tickets', sa.Column('sprint_id', sa.Uuid(), nullable=True))
    op.add_column('tickets', sa.Column('wiki_page_id', sa.Uuid(), nullable=True))
    op.add_column('tickets', sa.Column('custom_field_values', postgresql.JSONB(), nullable=True))
    # FKs:
    op.create_foreign_key(None, 'tickets', 'sprints', ['sprint_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'tickets', 'wiki_pages', ['wiki_page_id'], ['id'], ondelete='SET NULL')
```

### Dependency Check Integration in move_ticket

```python
# Source: backend/app/services/tickets.py (extend existing move_ticket)
async def move_ticket(
    db: AsyncSession, ticket_id: uuid.UUID, new_column: StatusColumn, owner_id: uuid.UUID | None
) -> Ticket:
    ticket = await _get_ticket(db, ticket_id)
    is_backlog_exit = (ticket.status_column == StatusColumn.Backlog and new_column != StatusColumn.Backlog)

    if is_backlog_exit:
        if not owner_id:
            raise HTTPException(status_code=422, detail="owner_id required to move out of Backlog")
        # ADV-05: check blockers
        await check_not_blocked(db, ticket_id)
        ticket.owner_id = owner_id
    # ... rest of move logic unchanged
```

### Sprint Velocity Header (Frontend)

```typescript
// Source: CONTEXT.md decisions + project Tailwind patterns
interface VelocityHeaderProps {
  effortCompleted: number;
  effortTotal: number;
  pct: number;
}

export function VelocityHeader({ effortCompleted, effortTotal, pct }: VelocityHeaderProps) {
  return (
    <div className="px-6 py-3 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">
          {effortCompleted} of {effortTotal} effort hours completed
        </span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-xs">
          <div
            className="h-2 bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-sm font-medium text-slate-700">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tiptap v2 History extension | Tiptap v3 UndoRedo (renamed) | v3.0 (2024) | Import name change only; StarterKit handles it automatically |
| Tiptap v2 Placeholder in @tiptap/extension-placeholder | Tiptap v3 Placeholder now in @tiptap/extensions | v3.0 | Not needed for this phase (wiki editor does not need placeholder extension) |
| SprintTicket join table (M2M tickets ↔ sprints) | sprint_id FK on Ticket (single sprint per ticket) | Design decision | Simpler schema; aligns with ADV-09 spec (tickets assigned to "a sprint", not multiple) |
| React Google Charts for Gantt | Custom Recharts horizontal BarChart | Now | Zero new dependency; Recharts already installed; read-only requirement fits |

**Deprecated/outdated:**
- `History` extension name in Tiptap v2: Now `UndoRedo` in v3 StarterKit — but since StarterKit is used directly, this is transparent.
- `MutableJson` from third-party `sqlalchemy-json` library: Use built-in `MutableDict.as_mutable(JSONB)` from SQLAlchemy instead — same behavior, no extra dependency.

---

## Open Questions

1. **Personal field definitions storage schema**
   - What we know: CONTEXT.md marks this as Claude's discretion. Options are (a) JSONB column on User, (b) same `custom_field_defs` table with `scope='personal'` + `owner_id`, (c) separate `personal_field_defs` table.
   - What's unclear: Whether personal fields will ever be queried/filtered across users (unlikely for personal fields).
   - Recommendation: Use a single `custom_field_defs` table with a `scope` enum (`workspace` | `personal`) and a nullable `owner_id` FK. A `CHECK` constraint ensures `(scope = 'personal' AND owner_id IS NOT NULL) OR (scope = 'workspace' AND owner_id IS NULL)`. Simplest schema, single endpoint, no join complexity.

2. **Timeline tickets without due dates**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether to hide them, show as "undated" at the end, or show with a placeholder bar.
   - Recommendation: Hide tickets without `due_date` from the timeline view. Show an informational banner: "X tickets without due dates are hidden." This is the cleanest Gantt UX — undated tickets have no meaningful position on a date axis.

3. **Sprint board column layout**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether to mirror the 5 kanban columns or show only active sprint columns.
   - Recommendation: Mirror the 5 kanban columns (Backlog, Discovery, In Progress, Review/QA, Done) using simple group-by on `status_column`. This reuses the STATUS_BADGE color map already in the project and avoids introducing custom sprint-specific column configuration.

4. **Wiki page linked from ticket detail: one page or many?**
   - What we know: WIKI-05 says "wiki pages can be linked" (plural) but CONTEXT.md says "Wiki field on ticket detail (search picker to select a page)" (singular).
   - What's unclear: Is it a single FK (`wiki_page_id`) or a join table?
   - Recommendation: Single `wiki_page_id` nullable FK on Ticket. The CONTEXT.md decision locks a single-picker UI, which implies single selection. A join table would be a v2 enhancement.

---

## Sources

### Primary (HIGH confidence)
- Tiptap official docs (https://tiptap.dev/docs/editor/getting-started/install/nextjs) — Next.js setup, immediatelyRender: false, StarterKit contents
- Tiptap v3 changelog (https://tiptap.dev/docs/resources/whats-new) — breaking changes, UndoRedo rename, Placeholder move
- SQLAlchemy 2.0 Mutation Tracking docs (https://docs.sqlalchemy.org/en/20/orm/extensions/mutable.html) — MutableDict.as_mutable(JSONB)
- SQLAlchemy 2.0 Self-Referential docs (https://docs.sqlalchemy.org/en/20/orm/self_referential.html) — M2M association table primaryjoin/secondaryjoin
- nuqs official docs (https://nuqs.dev/docs/utilities) — createSerializer, useQueryStates plain object
- Existing project code (TiptapEditor.tsx, BoardFilterBar.tsx, ticket.py, alembic migrations) — confirmed patterns

### Secondary (MEDIUM confidence)
- shadcn/ui Combobox docs (https://ui.shadcn.com/docs/components/radix/combobox) — cmdk Popover+Command pattern, verified against existing command.tsx in project
- Recharts GitHub issues #753, #813, #4038 — confirmed no native Gantt support; stacked BarChart workaround is community-standard approach
- recharts-gantt-chart GitHub (https://github.com/rudrodip/recharts-gantt-chart) — MIT-licensed reference implementation confirming stacked offset bar approach

### Tertiary (LOW confidence)
- None — all key claims verified with official docs or existing project code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in prior phases; versions confirmed from package.json
- Architecture: HIGH — patterns derived from official SQLAlchemy 2.0 docs, existing project code patterns, and Tiptap v3 official docs
- Pitfalls: HIGH — JSONB mutation pitfall is from official SQLAlchemy docs; M2M ambiguous join from official docs; others from prior phase decisions in STATE.md

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days — stable libraries; Tiptap v3 is recent but API is stable)
