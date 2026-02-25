# Phase 2: Kanban Core - Research

**Researched:** 2026-02-25
**Domain:** Drag-and-drop Kanban UI, rich text editing, URL state management, PostgreSQL event/history modeling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ticket Creation Flow**
- Quick-add input in the Backlog column (title + department required)
- On submit, ticket is created and the detail modal opens immediately
- Tickets can only be created in Backlog — no "+" in other columns
- Department is required at creation time alongside title; all other fields optional

**Owner-Assignment Modal**
- Modal fires only on moves out of Backlog for unowned tickets — already-owned tickets drag freely
- Hard gate: user must select an owner before the move commits; canceling returns the card to Backlog
- Owner selection is a searchable dropdown of team members
- Modal does NOT fire between non-Backlog columns (e.g., In Progress → Review)

**Card Metadata Display**
- Urgency/priority: left border color — red (urgent), orange (high), blue (normal), grey (low)
- Effort estimate: displayed as time text (e.g., "2h", "1d")
- Time in current column: small text at the bottom of the card (e.g., "3d in column")
- Due date: always shown; text turns red when the date is past due
- Owner: displayed as initials avatar
- Department: colored badge

**Ticket Detail View**
- Presented as a modal overlay; URL updates with ticket ID (shareable, e.g., /board?ticket=123)
- Tiptap rich text description auto-saves on blur / ~1s after typing stops (no save button)
- Activity timeline logs: column moves and owner changes only
- All metadata fields (priority, due date, owner, effort estimate, department) are editable inline in the modal

### Claude's Discretion
- Exact spacing, typography, and card layout within the above constraints
- Loading skeleton design for board and cards
- Error state handling (failed drag, failed save)
- Exact color values for priority border colors and due date warning threshold

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TICKET-01 | User can create a ticket with: title, problem_statement (rich text), urgency (1–5), business_impact, success_criteria, due_date, effort_estimate (hours), next_step, department_id | SQLAlchemy model with JSONB for problem_statement; Pydantic schema; FastAPI POST /api/tickets |
| TICKET-02 | New tickets created in Backlog column with owner_id = null | Enum column default + server-enforced; Alembic migration |
| TICKET-03 | Any authenticated user (admin/member) can edit any ticket field | PATCH /api/tickets/{id} with get_current_user dependency; no role restriction |
| TICKET-04 | Admin can delete a ticket | DELETE /api/tickets/{id} with require_admin dependency |
| TICKET-05 | Ticket has a priority field (low / medium / high / critical) | SQLAlchemy Enum column; Pydantic literal type |
| TICKET-06 | Ticket stores status_column (Backlog / Discovery / In Progress / Review/QA / Done) | SQLAlchemy Enum column; validated in move endpoint |
| TICKET-07 | Backlog tickets must have owner_id = null (enforced server-side) | Validator in move endpoint: reject moves to Backlog if owner_id is set; reject non-Backlog creation |
| TICKET-08 | Moving a ticket out of Backlog requires owner_id to be set in the same request | Combined move+assign endpoint PATCH /api/tickets/{id}/move; validates owner_id presence |
| TICKET-09 | Every move is recorded as a ColumnHistory entry | ColumnHistory model: ticket_id, column, entered_at TIMESTAMPTZ, exited_at TIMESTAMPTZ |
| TICKET-10 | Every state change emits a TicketEvent | TicketEvent model: ticket_id, event_type, payload JSON, created_at TIMESTAMPTZ, actor_id |
| BOARD-01 | Kanban board shows 5 columns: Backlog, Discovery, In Progress, Review/QA, Done | Frontend: 5 droppable containers in DndContext; columns are static |
| BOARD-02 | Ticket cards can be dragged between columns with optimistic UI update and explicit rollback on rejection | dnd-kit DndContext + DragOverlay; TanStack Query useMutation onMutate/onError rollback |
| BOARD-03 | Dragging out of Backlog opens owner-assignment modal before committing | onDragEnd intercept: detect source column = Backlog + ticket.owner_id = null → show modal; mutation fires only after owner selected |
| BOARD-04 | Card displays: department badge, title, owner initials/avatar, due date, time in current column, next_step, urgency badge, priority, business_impact snippet, effort estimate | Board API returns computed time_in_column from ColumnHistory.entered_at; format on frontend |
| BOARD-05 | Board filter bar: owner, department, created date range, due date range, priority/urgency, aging | nuqs useQueryStates for all filter params; API accepts query params; SQLAlchemy filter chaining |
| BOARD-06 | Applied filters persist in URL query params | nuqs handles this automatically |
| BOARD-07 | Board data polls every 30 seconds via TanStack Query refetchInterval | TanStack Query useQuery({ refetchInterval: 30_000 }) |
| BOARD-08 | Board loads via single API endpoint with eager loading (no N+1) | selectinload() on owner, department; single GET /api/board |
| DETAIL-01 | Clicking a card opens ticket detail modal/page | nuqs useQueryState('ticket') → open Radix Dialog; URL becomes /board?ticket=123 |
| DETAIL-02 | Detail view shows all ticket fields | GET /api/tickets/{id} response includes all fields |
| DETAIL-03 | Tiptap rich text for problem_statement — stored as JSON, never HTML | JSONB column in PostgreSQL; editor.getJSON() on save; editor content initialized from DB JSON |
| DETAIL-04 | User (admin/member) can edit ticket fields inline | PATCH /api/tickets/{id} per-field; optimistic local state in modal |
| DETAIL-05 | Activity timeline: all TicketEvents in chronological order | GET /api/tickets/{id}/events; TicketEvent model; frontend renders event list |
| DETAIL-06 | Column history section: all columns with enter/exit timestamps and time spent | GET /api/tickets/{id}/history; ColumnHistory model with exited_at nullable (open = still in column) |
</phase_requirements>

---

## Summary

Phase 2 is a full-stack feature phase that spans five distinct technical domains: (1) a PostgreSQL data model with new Ticket, ColumnHistory, and TicketEvent tables; (2) a FastAPI REST layer with move semantics and eager loading; (3) a drag-and-drop Kanban board using dnd-kit with optimistic UI; (4) URL-synced filter state using nuqs; and (5) a Tiptap rich-text editor with debounced auto-save. The Phase 1 infrastructure (FastAPI + SQLAlchemy async + Next.js 14 App Router + shadcn/ui) is a complete foundation — Phase 2 extends it without replacing anything.

The highest-risk integration points are: (a) the owner-assignment modal that must intercept the dnd-kit `onDragEnd` event before committing the move mutation, requiring careful state machine design; (b) Tiptap's SSR incompatibility with Next.js (must be lazy-loaded or rendered client-side only); and (c) the ColumnHistory tracking, which requires the move endpoint to close the previous ColumnHistory row (set `exited_at = NOW()`) and open a new one atomically in a transaction.

**Primary recommendation:** Use dnd-kit for drag-and-drop (standard for React kanban in 2025), TanStack Query for server state with optimistic updates, nuqs for URL filter persistence, and Tiptap with `@tiptap/starter-kit` for the rich-text editor. All are production-proven with the existing Next.js 14 + shadcn/ui stack.

---

## Standard Stack

### Core — New Installs Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.x | Drag-and-drop primitives: DndContext, DragOverlay, sensors | Dominant kanban DnD library for React 2024–2025; accessible by default; replaces react-beautiful-dnd (deprecated) |
| @dnd-kit/utilities | ^3.x | CSS transform utilities for drag animations | Required companion to @dnd-kit/core |
| @tanstack/react-query | ^5.x | Server state, caching, polling, optimistic updates | Industry standard; project already decided on TanStack Query (BOARD-07); replaces useEffect+fetch |
| nuqs | ^2.x | Type-safe URL search params (BOARD-05, BOARD-06, DETAIL-01) | 6 kB; useState-like API synced to URL; supports Next.js App Router natively |
| @tiptap/react | ^2.x | Rich-text editor React bindings | Official Tiptap React package |
| @tiptap/pm | ^2.x | ProseMirror dependencies required by Tiptap | Must be installed alongside @tiptap/react |
| @tiptap/starter-kit | ^2.x | Bundled extensions: paragraph, heading, bold, italic, lists, code | Standard starter; covers all needed formatting for problem_statement |
| use-debounce | ^10.x | Debounced auto-save for Tiptap onUpdate | Lightweight; avoids per-keystroke API calls |

### Supporting — Likely Needed

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-popover | ^1.x | Popover primitive for Combobox (owner selector) | shadcn Combobox is built on Popover + Command |
| @radix-ui/react-command | ^1.x | Searchable command menu for owner selector | The Command component provides filtering logic |
| date-fns | ^3.x | Format dates, compute relative time ("3d in column") | Lightweight; pure functions; no global state |

**Note:** @radix-ui/react-dialog is already installed (package.json v1.1.15) — use it for both ticket detail and owner-assignment modals.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | react-beautiful-dnd | Deprecated by Atlassian; not maintained for React 18+ |
| @dnd-kit/core | @hello-pangea/dnd (rbd fork) | Community fork works but smaller ecosystem; dnd-kit has better TypeScript support |
| nuqs | Manual useSearchParams + router.push | Tedious, error-prone, no type safety; nuqs is the standard |
| TanStack Query | SWR | SWR lacks optimistic update rollback pattern needed for BOARD-02; TanStack Query was already decided |
| use-debounce | lodash.debounce | use-debounce is React-hook-native; lodash adds weight |

### Installation

```bash
# Frontend
cd frontend && npm install \
  @dnd-kit/core @dnd-kit/utilities \
  @tanstack/react-query \
  nuqs \
  @tiptap/react @tiptap/pm @tiptap/starter-kit \
  use-debounce \
  date-fns \
  @radix-ui/react-popover cmdk
```

```bash
# Backend — no new pip packages needed for Phase 2
# JSONB uses sqlalchemy.dialects.postgresql.JSONB (already in sqlalchemy[asyncio])
# New Alembic migration required
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   ├── ticket.py          # Ticket, StatusColumn enum, Priority enum, Urgency enum
│   ├── ticket_event.py    # TicketEvent model
│   └── column_history.py  # ColumnHistory model
├── schemas/
│   ├── ticket.py          # TicketCreate, TicketUpdate, TicketOut, BoardTicketOut
│   ├── ticket_event.py    # TicketEventOut
│   └── column_history.py  # ColumnHistoryOut
├── routers/
│   ├── tickets.py         # CRUD + move endpoint
│   └── board.py           # GET /api/board (eager-loaded board data)
└── services/
    └── tickets.py         # Business logic: move_ticket(), record_event(), close_history()

frontend/src/
├── app/(app)/board/
│   ├── page.tsx                  # Board server component — passes searchParams
│   └── _components/
│       ├── KanbanBoard.tsx       # "use client"; DndContext wrapper; QueryClientProvider child
│       ├── KanbanColumn.tsx      # useDroppable; renders ticket cards
│       ├── KanbanCard.tsx        # useDraggable; card layout
│       ├── DragOverlay.tsx       # DragOverlay with card preview
│       ├── BoardFilterBar.tsx    # nuqs useQueryStates for filter params
│       ├── QuickAddInput.tsx     # Title + department input in Backlog column
│       ├── OwnerModal.tsx        # Radix Dialog; fires on Backlog → other drag
│       └── TicketDetailModal.tsx # Radix Dialog; Tiptap; inline edit fields
├── lib/
│   ├── api/
│   │   ├── client.ts             # Existing; extend with ticket/board fetch functions
│   │   └── tickets.ts            # New: createTicket, moveTicket, updateTicket, deleteTicket
│   └── providers.tsx             # "use client"; QueryClientProvider + NuqsAdapter
└── hooks/
    ├── useBoard.ts               # useQuery({ queryKey: ['board'], refetchInterval: 30_000 })
    ├── useMoveTicket.ts          # useMutation with optimistic update + rollback
    └── useTicketDetail.ts        # useQuery for single ticket + events + history
```

### Pattern 1: TanStack Query Provider Setup

**What:** Wrap the app-level layout with a client component that provides QueryClient and NuqsAdapter.
**When to use:** Required before any `useQuery` or `useQueryState` hooks work in client components.

```typescript
// frontend/src/lib/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,       // 10s — board data refreshes every 30s
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
}
```

```typescript
// frontend/src/app/(app)/layout.tsx — add Providers wrapper
import { Providers } from "@/lib/providers";
export default function AppLayout({ children }) {
  return <Providers>{children}</Providers>;
}
```

### Pattern 2: Board Data Query with Polling

**What:** Single query fetching all board data at 30s intervals.
**When to use:** BOARD-07, BOARD-08.

```typescript
// frontend/src/hooks/useBoard.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsString, parseAsArrayOf } from "nuqs";

export function useBoard() {
  const [filters] = useQueryStates({
    owner:      parseAsString,
    department: parseAsString,
    priority:   parseAsString,
    // ... other filters
  });

  return useQuery({
    queryKey: ["board", filters],
    queryFn: () => fetchBoard(filters),
    refetchInterval: 30_000,
  });
}
```

### Pattern 3: Optimistic Drag-and-Drop with Rollback

**What:** Move ticket between columns optimistically; roll back if server rejects.
**When to use:** BOARD-02, BOARD-03.

```typescript
// frontend/src/hooks/useMoveTicket.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMoveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, targetColumn, ownerId }) =>
      moveTicketApi(ticketId, targetColumn, ownerId),

    onMutate: async ({ ticketId, targetColumn }) => {
      // 1. Cancel in-flight board queries (prevent race condition)
      await queryClient.cancelQueries({ queryKey: ["board"] });

      // 2. Snapshot current board state
      const previousBoard = queryClient.getQueryData(["board"]);

      // 3. Apply optimistic update
      queryClient.setQueryData(["board"], (old) =>
        moveBoardTicket(old, ticketId, targetColumn)
      );

      // 4. Return snapshot for rollback
      return { previousBoard };
    },

    onError: (_err, _vars, context) => {
      // Roll back to previous state on server rejection
      queryClient.setQueryData(["board"], context?.previousBoard);
    },

    onSettled: () => {
      // Always re-fetch to sync with server truth
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}
```

### Pattern 4: dnd-kit Kanban Board with Owner Modal Intercept

**What:** DndContext wraps all 5 columns; onDragEnd detects cross-column drops; Backlog → other triggers modal before mutation fires.
**When to use:** BOARD-01, BOARD-02, BOARD-03.

```typescript
// KanbanBoard.tsx (simplified)
"use client";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors
} from "@dnd-kit/core";

export function KanbanBoard({ initialData }) {
  const [activeTicket, setActiveTicket] = useState(null);
  const [pendingMove, setPendingMove] = useState(null); // { ticketId, targetColumn }
  const moveTicket = useMoveTicket();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over || active.data.current.column === over.id) return;

    const ticket = active.data.current;
    const targetColumn = over.id;

    // BOARD-03: intercept Backlog → any move for unowned tickets
    if (ticket.status_column === "Backlog" && !ticket.owner_id) {
      setPendingMove({ ticketId: ticket.id, targetColumn });
      return; // do NOT fire mutation yet — OwnerModal will fire it
    }

    // All other moves: commit immediately
    moveTicket.mutate({ ticketId: ticket.id, targetColumn, ownerId: ticket.owner_id });
  }

  function handleDragCancel() {
    setActiveTicket(null);
    // DragOverlay animates back automatically; no manual state reset needed
    // because optimistic update in onMutate was not called (mutation never fired)
  }

  return (
    <DndContext sensors={sensors} onDragStart={...} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      {COLUMNS.map(col => <KanbanColumn key={col} column={col} />)}
      <DragOverlay>
        {activeTicket ? <KanbanCard ticket={activeTicket} isOverlay /> : null}
      </DragOverlay>
      {pendingMove && (
        <OwnerModal
          ticketId={pendingMove.ticketId}
          targetColumn={pendingMove.targetColumn}
          onConfirm={(ownerId) => {
            moveTicket.mutate({ ...pendingMove, ownerId });
            setPendingMove(null);
          }}
          onCancel={() => setPendingMove(null)} // card snaps back: mutation was never called
        />
      )}
    </DndContext>
  );
}
```

**Key insight on snap-back:** When the owner modal is cancelled, the card automatically returns to its original position because `onMutate` (and the optimistic update) was never called. The `pendingMove` state is cleared; the board query data was not changed. No manual position reset required.

### Pattern 5: Ticket Detail Modal with URL State

**What:** Dialog state stored in URL query param `ticket`; shareable; survives refresh.
**When to use:** DETAIL-01.

```typescript
// TicketDetailModal.tsx
"use client";
import { useQueryState, parseAsString } from "nuqs";
import * as Dialog from "@radix-ui/react-dialog";

export function TicketDetailModal() {
  const [ticketId, setTicketId] = useQueryState("ticket", parseAsString);

  return (
    <Dialog.Root open={!!ticketId} onOpenChange={(open) => !open && setTicketId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 w-[640px] bg-white shadow-xl overflow-y-auto">
          {ticketId && <TicketDetailContent ticketId={ticketId} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Pattern 6: Tiptap Auto-Save with Debounce

**What:** Tiptap fires `onUpdate` on every keystroke; debounce delays API call until 1 second of silence.
**When to use:** DETAIL-03, DETAIL-04. Locked decision: auto-save on blur / ~1s after typing.

```typescript
// TiptapEditor.tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useDebouncedCallback } from "use-debounce";

interface Props {
  initialContent: object | null; // JSON from DB
  onSave: (json: object) => void;
}

export function TiptapEditor({ initialContent, onSave }: Props) {
  const debouncedSave = useDebouncedCallback((json) => onSave(json), 1000);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ?? "",
    immediatelyRender: false, // CRITICAL for Next.js SSR — prevents hydration mismatch
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      // Flush immediately on blur regardless of debounce timer
      debouncedSave.flush();
      onSave(editor.getJSON());
    },
  });

  return <EditorContent editor={editor} className="prose max-w-none" />;
}
```

### Pattern 7: Backend Move Endpoint with ColumnHistory

**What:** PATCH /api/tickets/{id}/move atomically: updates ticket status_column + owner_id, closes current ColumnHistory row, opens new one, emits TicketEvents.
**When to use:** TICKET-07, TICKET-08, TICKET-09, TICKET-10.

```python
# backend/app/routers/tickets.py
@router.patch("/{ticket_id}/move")
async def move_ticket(
    ticket_id: uuid.UUID,
    data: TicketMoveRequest,   # { target_column, owner_id }
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await db.get(Ticket, ticket_id)

    # TICKET-07: Backlog tickets must have owner_id = null
    if data.target_column == "Backlog" and data.owner_id is not None:
        raise HTTPException(400, "Backlog tickets cannot have an owner")

    # TICKET-08: Moving out of Backlog requires owner_id
    if ticket.status_column == "Backlog" and data.target_column != "Backlog":
        if data.owner_id is None:
            raise HTTPException(400, "owner_id required when moving out of Backlog")

    # Close current ColumnHistory row
    result = await db.execute(
        select(ColumnHistory)
        .where(ColumnHistory.ticket_id == ticket_id)
        .where(ColumnHistory.exited_at == None)
    )
    current_history = result.scalar_one_or_none()
    if current_history:
        current_history.exited_at = func.now()

    # Open new ColumnHistory row
    db.add(ColumnHistory(ticket_id=ticket_id, column=data.target_column, entered_at=func.now()))

    # Emit TicketEvent
    db.add(TicketEvent(
        ticket_id=ticket_id,
        event_type="moved",
        payload={"from": ticket.status_column, "to": data.target_column},
        actor_id=current_user.id,
    ))

    # Update ticket
    ticket.status_column = data.target_column
    if data.owner_id is not None:
        ticket.owner_id = data.owner_id
        db.add(TicketEvent(
            ticket_id=ticket_id,
            event_type="assigned",
            payload={"owner_id": str(data.owner_id)},
            actor_id=current_user.id,
        ))

    await db.commit()
    return ticket
```

### Pattern 8: Board Eager Loading (No N+1)

**What:** Single query fetches all tickets with owner and department loaded in 2 SQL queries total.
**When to use:** BOARD-08.

```python
# backend/app/routers/board.py
@router.get("/api/board")
async def get_board(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # Filter params as Query params
    owner_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
):
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.owner),      # user object
            selectinload(Ticket.department), # department object
        )
        .order_by(Ticket.created_at.asc())
    )
    if owner_id:
        stmt = stmt.where(Ticket.owner_id == owner_id)
    if department_id:
        stmt = stmt.where(Ticket.department_id == department_id)

    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return tickets
```

### Pattern 9: Time In Column Computation

**What:** Compute "time in current column" for BOARD-04 from ColumnHistory.entered_at at query time.

```python
# Include in BoardTicketOut schema / serialization
# The open ColumnHistory row (exited_at IS NULL) gives entered_at
# Compute in Python after loading:
from datetime import datetime, timezone

def time_in_column_text(entered_at: datetime) -> str:
    delta = datetime.now(timezone.utc) - entered_at
    days = delta.days
    if days >= 1:
        return f"{days}d in column"
    hours = delta.seconds // 3600
    return f"{hours}h in column"
```

### Anti-Patterns to Avoid

- **Conditionally rendering DragOverlay:** Always keep `<DragOverlay>` mounted; conditionally render its children. Unmounting DragOverlay kills drop animations.
- **Storing editor HTML, not JSON:** DETAIL-03 explicitly requires JSON storage. Never call `editor.getHTML()` for persistence.
- **Firing mutation before owner is selected:** The owner modal intercepts `onDragEnd`; mutation fires only in `onConfirm`. Never fire the mutation speculatively.
- **Using `useDraggable` inside DragOverlay:** DragOverlay children must not use `useDraggable` — this causes infinite re-render loops.
- **Calling `editor.getJSON()` outside onUpdate:** Tiptap is a mutable ProseMirror instance; always get JSON from the callback parameter, not stale closures.
- **Missing `immediatelyRender: false` in Tiptap:** Without this, Next.js SSR produces a hydration mismatch because ProseMirror renders differently server-side vs client-side.
- **Using joinedload for one-to-many:** Use `selectinload` for the ticket→events and ticket→history relationships to avoid Cartesian product in SQL results.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop with accessibility | Custom mousedown/touchstart logic | @dnd-kit/core | Keyboard nav, screen reader announcements, pointer vs touch sensor disambiguation — hundreds of edge cases |
| URL filter state | Manual `router.push` + URLSearchParams | nuqs useQueryStates | Handles batching, type coercion, SSR, shallow routing, and back/forward navigation automatically |
| Optimistic UI rollback | Custom optimistic state with useReducer | TanStack Query useMutation onMutate | Race condition handling (cancelQueries), automatic invalidation on settle, devtools visibility |
| Rich text editor | Contenteditable + custom toolbar | Tiptap StarterKit | ProseMirror state machine, selection handling, cross-browser paste, undo history — not feasible to build |
| Debounced save | Custom setTimeout/clearTimeout | use-debounce useDebouncedCallback | Handles React strict mode double-invocation, flush-on-unmount, TypeScript generics |
| Searchable dropdown | Custom filter + input | shadcn Combobox (Popover + Command) | Already part of the shadcn ecosystem; accessible keyboard navigation |

**Key insight:** Drag-and-drop, rich text editing, and URL state management all contain hundreds of browser compatibility and accessibility edge cases. Each "looks simple" but takes weeks to harden. The standard libraries exist precisely to absorb that complexity.

---

## Common Pitfalls

### Pitfall 1: Tiptap SSR Hydration Mismatch

**What goes wrong:** Next.js renders the editor server-side with ProseMirror's initial state; client hydration produces different DOM → React hydration error.
**Why it happens:** ProseMirror creates DOM nodes that differ between server and browser environments.
**How to avoid:** Always set `immediatelyRender: false` in `useEditor()`. If the component is in a server component context, lazy-import TiptapEditor with `next/dynamic` and `ssr: false`.
**Warning signs:** "Hydration failed because the server rendered HTML didn't match the client" in console.

### Pitfall 2: DragOverlay Mounted Conditionally

**What goes wrong:** Drop animation is skipped; card teleports instead of animating to destination.
**Why it happens:** React unmounts DragOverlay before the animation plays if you conditionally render the whole component.
**How to avoid:** Always render `<DragOverlay>` at all times. Only conditionally render its children:
```tsx
<DragOverlay>
  {activeTicket ? <KanbanCard ticket={activeTicket} isOverlay /> : null}
</DragOverlay>
```
**Warning signs:** Cards snap to position instead of animating on drop.

### Pitfall 3: JSONB asyncpg Type Handling

**What goes wrong:** asyncpg may return JSONB values as strings rather than dicts depending on codec configuration.
**Why it happens:** asyncpg has its own JSON codec that differs from psycopg2. SQLAlchemy's JSONB type handles this, but raw asyncpg codec interactions can bypass it.
**How to avoid:** Use `from sqlalchemy.dialects.postgresql import JSONB` with `mapped_column(JSONB)` — SQLAlchemy handles codec negotiation. Do not use raw `sa.JSON` for columns that need JSONB operators.
**Warning signs:** `json.loads()` called on an already-decoded dict → TypeError.

### Pitfall 4: ColumnHistory Open Row Not Closed on Move

**What goes wrong:** Multiple open ColumnHistory rows for same ticket; exited_at stays NULL; time-in-column queries return wrong data.
**Why it happens:** Move endpoint creates new row but forgets to close old one.
**How to avoid:** The move endpoint must atomically: (1) SELECT the open row (exited_at IS NULL), (2) set exited_at = NOW(), (3) INSERT new row with entered_at = NOW() — all in the same transaction.
**Warning signs:** Multiple rows with exited_at = NULL for the same ticket_id.

### Pitfall 5: nuqs Adapter Not Wrapped

**What goes wrong:** `useQueryState` throws "Missing NuqsAdapter" error at runtime.
**Why it happens:** nuqs requires `NuqsAdapter` (for Next.js App Router: `nuqs/adapters/next/app`) to be present in the component tree.
**How to avoid:** Add `<NuqsAdapter>` to the shared `Providers` component in the app layout. See Pattern 1 above.
**Warning signs:** Runtime error: "useQueryState called outside of a NuqsAdapter".

### Pitfall 6: Card Snap-Back Confusion with Optimistic Updates

**What goes wrong:** When owner modal is cancelled, the card visually stays in the target column because an optimistic update was already applied.
**Why it happens:** If the optimistic update runs in `onDragEnd` (before the modal decision), `setQueryData` already moved the card.
**How to avoid:** The `onDragEnd` handler must NOT call `moveTicket.mutate()` for Backlog → other drags. Store `pendingMove` state; only call `mutate()` inside `onConfirm`. The board data is untouched until `onConfirm` fires.
**Warning signs:** Dragging from Backlog and cancelling the modal leaves the card in the wrong column.

### Pitfall 7: TanStack Query Not Available Without Provider in Server Components

**What goes wrong:** `useQuery` called in a server component (not marked `"use client"`) throws "no QueryClient set" error.
**Why it happens:** TanStack Query client-side hooks require React context.
**How to avoid:** `KanbanBoard.tsx` must be `"use client"`. The board page (`page.tsx`) can be a server component that renders `<KanbanBoard />` as a client boundary.
**Warning signs:** "No QueryClient set, use QueryClientProvider to set one" at runtime.

---

## Code Examples

Verified patterns from official sources:

### JSONB Column in SQLAlchemy 2.0 model

```python
# Source: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from typing import Any

class Ticket(Base):
    __tablename__ = "tickets"
    # ... other columns ...
    problem_statement: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # DETAIL-03: stored as JSON, never HTML
```

### TanStack Query Board Polling

```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/queries
import { useQuery } from "@tanstack/react-query";

const { data: board, isPending } = useQuery({
  queryKey: ["board", filters],
  queryFn: () => fetchBoard(filters),
  refetchInterval: 30_000,    // BOARD-07: 30-second polling
  staleTime: 10_000,
});
```

### nuqs Filter State with Multiple Params

```typescript
// Source: https://nuqs.dev (official docs)
import { useQueryStates, parseAsString, parseAsIsoDateTime } from "nuqs";

const [filters, setFilters] = useQueryStates({
  owner:      parseAsString,
  department: parseAsString,
  priority:   parseAsString,
  due_before: parseAsIsoDateTime,
  due_after:  parseAsIsoDateTime,
  // BOARD-06: all params automatically persisted in URL
});
```

### Ticket Detail URL State

```typescript
// Source: https://nuqs.dev
import { useQueryState, parseAsString } from "nuqs";

// Opens modal with ?ticket=abc-123 in URL
// DETAIL-01: URL is shareable
const [ticketId, setTicketId] = useQueryState("ticket", parseAsString);
```

### SQLAlchemy selectinload for Eager Loading

```python
# Source: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html
from sqlalchemy.orm import selectinload

stmt = (
    select(Ticket)
    .options(
        selectinload(Ticket.owner),       # User — loads in 2nd SELECT
        selectinload(Ticket.department),  # Department — loads in 3rd SELECT
    )
    # BOARD-08: Single endpoint, no N+1
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core | 2022 (rbd deprecated) | dnd-kit has better TypeScript, React 18 concurrent mode support |
| HTML storage in rich text | JSON storage (Tiptap) | 2021 (Tiptap v2) | JSON is portable, editable, no XSS risk from sanitization gaps |
| Manual URLSearchParams state | nuqs useQueryStates | 2023 | Eliminates router.push boilerplate; type-safe; batched updates |
| useEffect + fetch for server state | TanStack Query v5 | 2024 (v5 stable) | Built-in caching, deduplication, optimistic updates, devtools |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated by Atlassian 2022; not compatible with React 18 strict mode
- Tiptap v1 (original `tiptap` package): Replaced by `@tiptap/react`; different API entirely
- TanStack Query v4: v5 changed the `onSuccess`/`onError` callback signatures — do not mix patterns from v4 docs

---

## Open Questions

1. **Where does `GET /api/users` live for the owner selector?**
   - What we know: `POST /api/auth/users` creates users (admin only); no list endpoint exists yet
   - What's unclear: Does Phase 2 need a `GET /api/auth/users` (or `GET /api/users`) to populate the owner selector dropdown?
   - Recommendation: Add `GET /api/auth/users` (admin + member access) to the auth router in Phase 2 Wave 0; it needs to return id + full_name + initials for the dropdown

2. **Alembic migration strategy for new tables**
   - What we know: One migration exists (`bc1748a61656`) for users + departments
   - What's unclear: Should Phase 2 be one migration or multiple (one per model)?
   - Recommendation: One migration covering all three new tables (tickets, column_history, ticket_events) keeps rollback atomic; name it `phase2_kanban_core`

3. **effort_estimate unit storage**
   - What we know: TICKET-01 says "effort_estimate (hours)"; BOARD-04 says display as "2h", "1d"
   - What's unclear: Store as float hours in DB, format to display string on frontend?
   - Recommendation: Store as `float` (hours) in DB; `formatEffort(hours: number): string` utility on frontend converts to "2h" / "1d" / "1.5h" as appropriate

4. **Urgency vs Priority — two separate fields**
   - What we know: TICKET-01 has `urgency (1–5)` and TICKET-05 has `priority (low/medium/high/critical)`
   - What's unclear: BOARD-04 says card shows both "urgency badge" and "priority" — are these truly separate fields?
   - Recommendation: Yes, two separate columns: `urgency: int (1–5)` and `priority: Enum(low/medium/high/critical)`. Urgency is a 1–5 numeric scale (user-assessed); priority is a 4-way categorical. The left border color from CONTEXT.md maps to urgency.

---

## Sources

### Primary (HIGH confidence)
- https://docs.sqlalchemy.org/en/20/dialects/postgresql.html — JSONB type, import path, mapped_column usage
- https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html — selectinload vs joinedload
- https://dndkit.com/api-documentation/context-provider — DndContext events: onDragEnd, onDragCancel, sensors
- https://dndkit.com/api-documentation/draggable/drag-overlay — DragOverlay props, dropAnimation, must-stay-mounted rule
- https://tiptap.dev/docs/editor/getting-started/install/react — useEditor, @tiptap/react install, immediatelyRender flag
- https://tiptap.dev/docs/editor/core-concepts/persistence — getJSON(), recommended JSON storage
- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates — useMutation, onMutate, rollback pattern
- https://nuqs.dev — useQueryState, useQueryStates, NuqsAdapter, Next.js App Router integration

### Secondary (MEDIUM confidence)
- https://ui.shadcn.com/docs/components/radix/combobox — Combobox built on Popover + Command for owner selector
- https://github.com/ueberdosis/tiptap/discussions/2871 — Tiptap debounced save patterns (community-verified)
- https://github.com/clauderic/dnd-kit/discussions/1522 — dnd-kit optimistic update timing with React Query (community-verified)

### Tertiary (LOW confidence)
- None — all critical claims verified with official sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs; dnd-kit, TanStack Query v5, nuqs, Tiptap all have current 2025 documentation
- Architecture: HIGH — patterns derived from official API docs; board data model from requirements
- Pitfalls: HIGH — pitfalls derived from known dnd-kit/Tiptap/TanStack Query documented behaviors and confirmed GitHub issues

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days — all libraries are stable; dnd-kit and Tiptap v2 APIs are frozen)
