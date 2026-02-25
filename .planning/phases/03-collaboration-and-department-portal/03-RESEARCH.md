# Phase 3: Collaboration and Department Portal - Research

**Researched:** 2026-02-25
**Domain:** FastAPI + Next.js 14 — comments, subtasks, drag-to-reorder, portal intake form, ROI computation, ticket templates
**Confidence:** HIGH (codebase verified directly; all patterns grounded in existing Phase 1–2 code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Comment UX**
- Comments are a separate section below the activity timeline — not merged into it
- Comments are not editable after posting (post is final)
- Deletion requires a confirm dialog (author or admin can delete)
- Always-visible text input + submit button at the bottom of the comments section

**Subtask UI**
- Dedicated "Subtasks" section in the ticket detail modal, between description and comments
- Add subtask via inline text input at the bottom of the list — type and press Enter
- Kanban card shows a text pill badge: checkmark icon + "2/5" (hidden when no subtasks)
- When all subtasks are checked off: badge turns green, no other action (no auto-move prompt)
- Drag-to-reorder within the subtask list

**Department Portal**
- Accessed via a "Portal" sidebar nav item → lands on a department selection page
- Selecting a department opens a full-page intake form with all ticket fields + ROI inputs
- Admin and Member roles can access the portal; viewer/read-only cannot
- After submission: success confirmation on the portal page with a "View on board" link (not auto-redirect to board)

**ROI Inputs**
- Three fields on the portal intake form: time saved (hours/month), cost savings ($/month), revenue impact ($)
- ROI dollar estimate is auto-calculated: hours_saved × fixed hourly rate (configurable, e.g. $75/hr)
- The computed ROI figure is shown live as the user types hours saved
- At least one ROI field must be non-zero before submission (enforced by form validation)

**Ticket Templates**
- Templates managed on a dedicated "Templates" settings page — created from scratch, not from existing tickets
- Admin and Member roles can create/edit/delete templates
- "Create from template" flow: selecting a template opens the ticket creation form pre-filled and editable; user reviews and submits manually (no instant auto-creation)

### Claude's Discretion
- Exact layout and spacing of the portal intake form
- Subtask drag handle visual (dots, bars, etc.)
- Comment author avatar display
- Template list UI on the settings page

### Deferred Ideas (OUT OF SCOPE)
- PRD/document upload that automatically fills in ticket fields using AI — Phase 6 (AI Features)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLLAB-01 | User can add a comment to a ticket (body text, author_id, created_at) | New `ticket_comments` table + POST /api/tickets/{id}/comments endpoint; follows existing TicketEvent pattern |
| COLLAB-02 | Comment thread displayed in chronological order on ticket detail | GET /api/tickets/{id}/comments; frontend section below activity timeline in TicketDetailModal |
| COLLAB-03 | Author can delete their own comment; admin can delete any comment | DELETE /api/tickets/{id}/comments/{comment_id} with author/admin guard; confirm dialog on frontend |
| COLLAB-04 | User can add subtasks to a ticket (title, done boolean, position integer) | New `ticket_subtasks` table + POST /api/tickets/{id}/subtasks endpoint |
| COLLAB-05 | Subtasks displayed as a checklist, can be checked/unchecked | PATCH /api/tickets/{id}/subtasks/{subtask_id} for done toggle; optimistic update via TanStack Query |
| COLLAB-06 | Subtasks can be reordered via drag-and-drop (position persisted server-side) | @dnd-kit/sortable (needs install) + PATCH /api/tickets/{id}/subtasks/reorder endpoint |
| COLLAB-07 | Card on Kanban shows subtask completion count (e.g., "2/5 subtasks") | Board endpoint eager-loads subtask counts; KanbanCard renders pill badge |
| PORTAL-01 | Department portal section lists all 7 departments | /portal route + department selection page; departments already seeded + API exists |
| PORTAL-02 | Each department page has a "Submit New Request" button | /portal/[dept] route; button opens/is the full-page intake form |
| PORTAL-03 | Ticket creation form includes all ticket fields plus ROI inputs (ROI inputs required for portal submissions) | Extends existing TicketCreate schema with ROI fields; server validates ROI required for portal source |
| PORTAL-04 | ROI inputs: current_time_cost_hours_per_week, employees_affected, avg_hourly_cost, current_error_rate (optional), revenue_blocked (optional), strategic_value (1–5) | New ROI columns on tickets table (or separate table); context says simpler fields — reconcile with REQUIREMENTS.md ROI-01 (deferred to Phase 4 for computed fields) |
| PORTAL-05 | Any AI team member (admin/member) can submit intake form for any department | Role check in portal route — same as existing auth guard; no new role needed |
| PORTAL-06 | Attachment metadata stub: filename + file size; no actual bytes | Two nullable columns on tickets: attachment_filename TEXT, attachment_size_bytes INTEGER |
| PORTAL-07 | Ticket templates: title, problem_statement template, default fields | New `ticket_templates` table + CRUD endpoints; settings page at /settings/templates |
| PORTAL-08 | User can create a ticket from a template (fields pre-filled, editable before submit) | "New ticket" form accepts optional template_id param; pre-populates fields client-side |
</phase_requirements>

---

## Summary

Phase 3 adds three distinct feature clusters to an existing FastAPI + Next.js 14 codebase: (1) ticket collaboration via comments and drag-reorderable subtasks embedded in the existing TicketDetailModal, (2) a full-page department portal for structured intake with live ROI calculation, and (3) ticket templates with a settings management page.

The codebase is well-established with clear patterns: SQLAlchemy async ORM with `lazy="raise"` + `selectinload`, Alembic migrations, FastAPI routers with Pydantic schemas, TanStack Query on the frontend, `@dnd-kit/core` already installed, `react-hook-form` + `zod` for forms, and shadcn/ui components. Phase 3 extends these patterns cleanly — no new technology is needed except `@dnd-kit/sortable` for subtask reorder (not yet in package.json).

The main complexity areas are: (a) subtask position management — maintaining a gapless integer sequence under concurrent add/delete/reorder operations, (b) the ROI field scope boundary between Phase 3 (portal intake ROI inputs) and Phase 4 (computed ROI fields and dashboard) — the ticket model needs ROI columns added now but computed fields deferred, and (c) the portal form being a full-page multi-field form with live computation that re-uses existing ticket creation logic rather than duplicating it.

**Primary recommendation:** Build backend models and migrations first (comments, subtasks, ROI stub columns, attachment stub, templates), then layer frontend features in order of dependency: subtasks in modal → comments in modal → kanban card badge → portal route + form → templates settings page.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 | Drag-and-drop primitives | Already used for Kanban; same library for subtask reorder |
| @dnd-kit/sortable | needs install | Sortable list abstraction over dnd-kit/core | SortableContext + useSortable is the correct abstraction for vertical list reorder |
| @dnd-kit/utilities | ^3.2.2 | CSS transform helpers (CSS.Transform.toString) | Already installed |
| react-hook-form | ^7.71.2 | Portal intake form, template form | Already used in project |
| zod | ^4.3.6 | Schema validation for forms | Already used |
| @tanstack/react-query | ^5.90.21 | Server state, optimistic updates | Already used |
| nuqs | ^2.8.8 | URL state for portal dept param | Already used for board filters |

### New Installs Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/sortable | ^8.0.0 | Vertical sortable list (subtasks) | Required for COLLAB-06 subtask reorder |

**Installation:**
```bash
# Frontend only
cd frontend && npm install @dnd-kit/sortable
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/sortable | react-beautiful-dnd | react-beautiful-dnd is unmaintained; dnd-kit is the current standard and already in project |
| @dnd-kit/sortable | Manual drag with @dnd-kit/core | Sortable abstracts position math and keyboard accessibility; use it |

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   ├── ticket_comment.py     # NEW: TicketComment model
│   ├── ticket_subtask.py     # NEW: TicketSubtask model
│   └── ticket_template.py   # NEW: TicketTemplate model
│   # ticket.py: add ROI stub columns + attachment stub columns
├── schemas/
│   ├── ticket_comment.py     # NEW
│   ├── ticket_subtask.py     # NEW
│   └── ticket_template.py   # NEW
├── routers/
│   ├── comments.py           # NEW: nested under /tickets/{id}/comments
│   ├── subtasks.py           # NEW: nested under /tickets/{id}/subtasks
│   └── templates.py          # NEW: /templates CRUD
└── alembic/versions/
    └── XXXX_phase3_collab_portal.py  # ONE migration for all new tables + columns

frontend/src/app/(app)/
├── portal/
│   ├── page.tsx              # Department selection grid
│   └── [dept]/
│       └── page.tsx          # Full-page intake form
├── settings/
│   └── templates/
│       └── page.tsx          # Template list + create/edit/delete
└── board/_components/
    ├── SubtaskSection.tsx    # NEW: subtask checklist + inline add + dnd reorder
    └── CommentSection.tsx    # NEW: comment thread + input
    # TicketDetailModal.tsx: add SubtaskSection + CommentSection sections
    # KanbanCard.tsx: add subtask count pill badge
```

### Pattern 1: Subtask Position Management

**What:** Subtasks have an integer `position` column used for display order. Reorder operations must update positions atomically.

**When to use:** Any ordered list with user-controlled sequence.

**Approach:** Use fractional indexing or simple integer reassignment. For this scale (<50 subtasks per ticket) simple reassignment is fine: on reorder, receive ordered list of subtask IDs from frontend, update all positions in a single transaction.

```python
# Source: Existing project pattern (tickets router, service layer)
# backend/app/routers/subtasks.py

@router.patch("/{ticket_id}/subtasks/reorder")
async def reorder_subtasks(
    ticket_id: uuid.UUID,
    data: SubtaskReorderRequest,  # ordered_ids: list[uuid.UUID]
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SubtaskOut]:
    # Fetch all subtasks for ticket, validate IDs match
    result = await db.execute(
        select(TicketSubtask).where(TicketSubtask.ticket_id == ticket_id)
    )
    subtasks = result.scalars().all()
    subtask_map = {s.id: s for s in subtasks}
    # Assign new positions 0..N-1
    for i, subtask_id in enumerate(data.ordered_ids):
        subtask_map[subtask_id].position = i
    await db.commit()
    return [SubtaskOut.model_validate(s) for s in sorted(subtasks, key=lambda s: s.position)]
```

### Pattern 2: dnd-kit Sortable for Subtask List

**What:** Use `SortableContext` + `useSortable` from `@dnd-kit/sortable` for the vertical subtask reorder list.

**When to use:** Any user-reorderable vertical list within an existing dnd-kit DnD context.

**Critical:** The subtask `DndContext` must be a separate, nested context from the Kanban board's `DndContext`. Use a separate `DndContext` instance inside `SubtaskSection` — dnd-kit supports nested contexts.

```tsx
// Source: @dnd-kit/sortable docs pattern
// frontend/src/app/(app)/board/_components/SubtaskSection.tsx

import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSubtaskItem({ subtask }: { subtask: Subtask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <span {...listeners} className="cursor-grab px-1 text-slate-400">⋮⋮</span>
      {/* checkbox + title */}
    </div>
  );
}

function SubtaskSection({ ticketId }: { ticketId: string }) {
  const [items, setItems] = useState<Subtask[]>([]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        // Fire PATCH /api/tickets/{ticketId}/subtasks/reorder with reordered IDs
        reorderSubtasks(ticketId, reordered.map((s) => s.id));
        return reordered;
      });
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {items.map((subtask) => <SortableSubtaskItem key={subtask.id} subtask={subtask} />)}
      </SortableContext>
    </DndContext>
  );
}
```

### Pattern 3: Live ROI Calculation in Portal Form

**What:** `react-hook-form` `watch()` drives live computed display without triggering re-renders on unrelated fields.

**When to use:** Any form field that derives a computed display value from other fields.

```tsx
// Source: react-hook-form docs — watch()
// frontend/src/app/(app)/portal/[dept]/page.tsx

const { register, watch, handleSubmit } = useForm<PortalFormValues>();

// Watch only the hours_saved field for live ROI calc
const hoursSaved = watch("hours_saved_per_month");
const HOURLY_RATE = 75; // from server config ideally, hardcoded fallback
const computedROI = hoursSaved ? hoursSaved * HOURLY_RATE : 0;

// In JSX:
// <p>Estimated monthly value: <strong>${computedROI.toLocaleString()}</strong></p>
```

**Note:** The `INTERNAL_AI_TEAM_HOURLY_RATE` setting should be exposed via a lightweight GET /api/config endpoint (public, no auth required) so the frontend can read the configured rate rather than hardcoding. This mirrors the `COOKIE_SECURE` pattern in settings.

### Pattern 4: Nested Router Registration (FastAPI)

**What:** New routers mounted under `/api/tickets/{ticket_id}/comments` and `/api/tickets/{ticket_id}/subtasks`.

**When to use:** Sub-resources with a parent ID in path.

```python
# Source: Existing project — backend/app/main.py pattern
# backend/app/routers/comments.py
router = APIRouter(prefix="/tickets/{ticket_id}/comments", tags=["comments"])

# backend/app/main.py
app.include_router(comments.router, prefix="/api")
app.include_router(subtasks.router, prefix="/api")
app.include_router(templates.router, prefix="/api/templates")
```

### Pattern 5: Portal ROI Validation (Zod)

**What:** At least one ROI field must be non-zero — cross-field validation with `zod.refine()`.

```tsx
// Source: zod docs — .refine()
const portalSchema = z.object({
  hours_saved_per_month: z.number().min(0).optional(),
  cost_savings_per_month: z.number().min(0).optional(),
  revenue_impact: z.number().min(0).optional(),
}).refine(
  (data) => (data.hours_saved_per_month ?? 0) > 0
    || (data.cost_savings_per_month ?? 0) > 0
    || (data.revenue_impact ?? 0) > 0,
  {
    message: "At least one ROI field must be non-zero",
    path: ["hours_saved_per_month"], // attach error to first field
  }
);
```

### Anti-Patterns to Avoid

- **Merging comment DnD context with Kanban DnD context:** Subtask DnD must be its own nested `DndContext` — dragging subtasks must not interfere with Kanban column drag.
- **Editing position as a user-visible field:** Position is an implementation detail; never expose it directly in API responses to the portal form.
- **Duplicating ticket creation logic for portal:** The portal form should POST to the same `POST /api/tickets/` endpoint with an extra `source: "portal"` flag (or rely on ROI fields being present). Do not create a separate portal ticket endpoint.
- **Re-fetching full board on every subtask toggle:** Subtask toggle should update only the ticket detail query cache (`['ticket', ticketId]`), not invalidate the full board query. The board only needs the count (from `subtasks_count` computed on board load).
- **Storing attachment bytes:** PORTAL-06 is a metadata stub only — `attachment_filename` and `attachment_size_bytes` columns; actual file storage is v2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subtask vertical sort | Custom mouse event handlers | @dnd-kit/sortable `SortableContext` + `useSortable` | Handles touch, keyboard, accessibility, scroll containers |
| Position resequencing | Custom fractional index math | Simple integer 0..N-1 reassignment on reorder | Fractional indexing only needed at very high frequency; overkill for subtasks |
| Cross-field form validation | Manual validation in submit handler | `zod.refine()` on schema | Integrates with react-hook-form error display automatically |
| Live computed display | `useEffect` watching form values | `react-hook-form` `watch()` | Zero-boilerplate reactive derived value |
| Comment delete confirmation | Custom modal state | shadcn `Dialog` (already in project) | Component already built; reuse pattern from OwnerModal |

---

## Common Pitfalls

### Pitfall 1: Nested DnD Context Interfering With Kanban

**What goes wrong:** Subtask drag events bubble up to the Kanban `DndContext`, causing card moves to misfire.

**Why it happens:** dnd-kit fires drag events on the closest `DndContext` ancestor, but pointer events can propagate unexpectedly if sensor setup is shared.

**How to avoid:** Wrap `SubtaskSection` in its own `<DndContext>`. Use `e.stopPropagation()` is not needed — nested DndContext isolation handles it — but confirm sensors are configured on the inner context.

**Warning signs:** Kanban DragOverlay briefly appears when dragging a subtask item.

### Pitfall 2: Position Gaps After Delete

**What goes wrong:** After deleting a subtask at position 2 in a list of 5, positions become [0,1,3,4]. A subsequent reorder sends [0,1,2,3] but the DB has [0,1,3,4], causing off-by-one mismatches.

**Why it happens:** Position is stored as-is, not recomputed on delete.

**How to avoid:** On `DELETE /subtasks/{id}`, recompute positions for the remaining subtasks in the same transaction — reassign 0..N-1 ordered by current position.

**Warning signs:** Subtasks appear in wrong order after deleting then reordering.

### Pitfall 3: Board N+1 on Subtask Count

**What goes wrong:** Board endpoint loads N tickets, then issues N extra queries to count subtasks per ticket.

**Why it happens:** Phase 2 board query uses `selectinload` for owner/department. Subtasks are a new relationship — it will lazy-load unless explicitly added.

**How to avoid:** Add `selectinload(Ticket.subtasks)` to the board query, or add a computed `subtask_count` / `subtask_done_count` to the board endpoint via a subquery. Preferred: use `func.count` subquery in board SQL to avoid loading subtask rows into memory.

**Warning signs:** SQLAlchemy `MissingGreenlet` / `lazy="raise"` exception when the board endpoint accesses `ticket.subtasks`.

### Pitfall 4: ROI Field Scope Confusion Between Phase 3 and Phase 4

**What goes wrong:** Phase 3 adds ROI input fields; Phase 4 (ROI Estimation) adds computed fields. If Phase 3 adds ALL columns from ROI-01 now, Phase 4's migration conflicts.

**Why it happens:** REQUIREMENTS.md ROI-01 lists 8 fields; CONTEXT.md (Phase 3 decision) uses 3 simpler fields for portal intake.

**How to avoid:** Phase 3 migration adds only what Phase 3 needs: `hours_saved_per_month`, `cost_savings_per_month`, `revenue_impact` (plus `attachment_filename`, `attachment_size_bytes`). Phase 4 migration adds the full ROI-01 field set and computed columns. Document this boundary clearly in the migration comment.

**Warning signs:** Phase 4 planning discovers columns already exist with conflicting names.

### Pitfall 5: Template Pre-Fill Not Triggering Zod Validation

**What goes wrong:** Pre-filling form fields from a template via `setValue()` doesn't trigger validation, so required-field errors don't clear.

**Why it happens:** `react-hook-form` `setValue` defaults to not running validation.

**How to avoid:** Use `setValue(field, value, { shouldValidate: true })` when pre-filling from a template, or call `trigger()` after setting all values.

**Warning signs:** Form shows stale validation errors after selecting a template.

### Pitfall 6: @dnd-kit/sortable Not Installed

**What goes wrong:** `import { SortableContext } from "@dnd-kit/sortable"` fails at build time.

**Why it happens:** Only `@dnd-kit/core` and `@dnd-kit/utilities` are in package.json — sortable is a separate package.

**How to avoid:** Install `@dnd-kit/sortable` in Wave 0 (setup task) before any subtask implementation.

---

## Code Examples

### Backend: TicketComment Model

```python
# Source: Existing project pattern — app/models/ticket_event.py
# backend/app/models/ticket_comment.py

import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now(), nullable=False
    )

    ticket = relationship("Ticket", back_populates="comments", lazy="raise")
    author = relationship("User", foreign_keys=[author_id], lazy="raise")
```

### Backend: TicketSubtask Model

```python
# backend/app/models/ticket_subtask.py

import uuid
import sqlalchemy as sa
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TicketSubtask(Base):
    __tablename__ = "ticket_subtasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    done: Mapped[bool] = mapped_column(sa.Boolean, default=False, server_default="false", nullable=False)
    position: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    ticket = relationship("Ticket", back_populates="subtasks", lazy="raise")
```

### Backend: TicketTemplate Model

```python
# backend/app/models/ticket_template.py

import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TicketTemplate(Base):
    __tablename__ = "ticket_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    problem_statement: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    default_urgency: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    default_effort_estimate: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    default_next_step: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False
    )

    created_by = relationship("User", foreign_keys=[created_by_id], lazy="raise")
```

### Backend: Ticket Model Additions (Phase 3 columns only)

```python
# Add to existing Ticket model — backend/app/models/ticket.py
# Phase 3 portal ROI stub inputs (3 fields per CONTEXT.md decision)
hours_saved_per_month: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
cost_savings_per_month: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
revenue_impact: Mapped[float | None] = mapped_column(sa.Float, nullable=True)

# Phase 3 attachment metadata stub (PORTAL-06)
attachment_filename: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
attachment_size_bytes: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)

# Relationships for new sub-resources
comments = relationship("TicketComment", back_populates="ticket", lazy="raise",
                        order_by="TicketComment.created_at", cascade="all, delete-orphan")
subtasks = relationship("TicketSubtask", back_populates="ticket", lazy="raise",
                        order_by="TicketSubtask.position", cascade="all, delete-orphan")
```

### Backend: Comment Delete Guard

```python
# Source: Existing project pattern — require_admin dependency
# Author or admin can delete — inline guard (no new dependency needed)
@router.delete("/{ticket_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    ticket_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    result = await db.execute(
        select(TicketComment).where(
            TicketComment.id == comment_id,
            TicketComment.ticket_id == ticket_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    await db.delete(comment)
    await db.commit()
```

### Frontend: Sidebar Portal Nav Item (enable the disabled stub)

```tsx
// Source: existing AppSidebar.tsx — NAV_ITEMS array
// Change enabled: false → enabled: true for "Department Portal"
{ label: "Department Portal", href: "/portal", enabled: true },
// Also add Templates to settings group or as a nav item
{ label: "Templates", href: "/settings/templates", enabled: true },
```

### Frontend: KanbanCard Subtask Badge

```tsx
// Source: existing KanbanCard pattern (board/_components/KanbanCard.tsx)
// Add after existing badges in card footer area
{ticket.subtasks_total > 0 && (
  <span className={cn(
    "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium",
    ticket.subtasks_done === ticket.subtasks_total
      ? "bg-green-100 text-green-700"
      : "bg-slate-100 text-slate-600"
  )}>
    <CheckIcon className="h-3 w-3" />
    {ticket.subtasks_done}/{ticket.subtasks_total}
  </span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd for sortable lists | @dnd-kit/sortable | 2022 (rbd unmaintained) | dnd-kit is the active standard; project already uses it |
| Separate endpoints per sub-resource | Nested FastAPI routers with parent ID in path | Established pattern | Keeps URL semantics clean: DELETE /tickets/{id}/comments/{cid} |
| Storing computed values in DB eagerly | Compute on read or on write with triggers | Ongoing | Phase 3 stores raw inputs; Phase 4 will add computed columns — clean separation |

**Deprecated/outdated:**
- `react-beautiful-dnd`: abandoned, not maintained — already avoided in this project.
- Tiptap v2 `immediatelyRender` pattern: project already uses correct `immediatelyRender: false` for SSR (Phase 2 decision).

---

## Open Questions

1. **Hourly rate config exposure to frontend**
   - What we know: `INTERNAL_AI_TEAM_HOURLY_RATE` is a server-side env var (per REQUIREMENTS.md ROI-03, Phase 4). CONTEXT.md says $75/hr as a configurable default.
   - What's unclear: Phase 3 portal live ROI display needs this value client-side. Phase 4 owns ROI-03 formally.
   - Recommendation: Add a lightweight `GET /api/config` endpoint in Phase 3 that returns `{ ai_team_hourly_rate: number }`. This is read-only, no auth required. Phase 4 can extend this endpoint rather than creating a conflict.

2. **ROI field naming: CONTEXT.md vs REQUIREMENTS.md**
   - What we know: CONTEXT.md (user decision) specifies 3 simple fields for portal: `hours_saved_per_month`, `cost_savings_per_month`, `revenue_impact`. REQUIREMENTS.md PORTAL-04 specifies: `current_time_cost_hours_per_week`, `employees_affected`, `avg_hourly_cost`, `current_error_rate`, `revenue_blocked`, `strategic_value`.
   - What's unclear: These are different schemas. CONTEXT.md wins for Phase 3 (user decision is locked). Phase 4 (ROI-01) adds the full field set.
   - Recommendation: Phase 3 migration adds the 3 CONTEXT.md fields. Phase 4 migration adds the remaining REQUIREMENTS.md ROI-01 fields. Document this in migration file header comment to avoid confusion.

3. **Board endpoint subtask count eager load strategy**
   - What we know: Board currently uses `selectinload(Ticket.owner)` and `selectinload(Ticket.department)`. Adding `selectinload(Ticket.subtasks)` would load all subtask rows for all cards.
   - What's unclear: At scale (100+ tickets, each with 10+ subtasks), this is wasteful — the board only needs `done_count` and `total_count`.
   - Recommendation: Use a correlated subquery with `func.count` and `func.sum(case(...))` on the board endpoint rather than `selectinload` for subtasks. Only load full subtask data in the ticket detail endpoint. Flag this as a task-level decision for the planner.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — `/backend/app/models/ticket.py`, `/backend/app/routers/tickets.py`, `/backend/app/core/settings.py`, `/frontend/src/components/sidebar/AppSidebar.tsx`, `/frontend/src/app/(app)/board/_components/TicketDetailModal.tsx`, `frontend/package.json` — existing patterns verified line-by-line
- @dnd-kit/core already in package.json at ^6.3.1; @dnd-kit/utilities at ^3.2.2; @dnd-kit/sortable absent — verified directly from package.json

### Secondary (MEDIUM confidence)

- @dnd-kit/sortable API (SortableContext, useSortable, arrayMove, verticalListSortingStrategy) — based on dnd-kit ecosystem knowledge consistent with @dnd-kit/core ^6.x patterns already in use; patterns cross-consistent with project's existing useDraggable usage
- react-hook-form `watch()` for live computed values — documented API, consistent with existing `@hookform/resolvers` usage in project
- zod `.refine()` for cross-field validation — documented API for zod ^4.x already in project

### Tertiary (LOW confidence)

- None — all critical claims grounded in codebase or well-established library APIs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from package.json and existing code
- Architecture: HIGH — follows established project patterns (routers, models, migrations, components)
- Pitfalls: HIGH for codebase-specific ones (lazy="raise", position gaps, nested DnD); MEDIUM for ROI field boundary (design decision, not a library issue)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable libraries; project patterns won't change)
