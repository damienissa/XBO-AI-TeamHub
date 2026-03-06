# Frontend Documentation

## Overview

The frontend is a **Next.js 14 App Router** application built with React 18, TypeScript 5, and Tailwind CSS. It provides a Kanban board, executive dashboard, department portal, wiki, and AI assistant.

**Entry point:** `src/app/layout.tsx`
**Dev URL:** `http://localhost:3000`

## Tech Stack

| Category | Libraries |
|----------|-----------|
| **Framework** | Next.js 14.2.35, React 18, TypeScript 5 |
| **State** | TanStack React Query 5, nuqs (URL state) |
| **Forms** | React Hook Form 7, Zod 4, @hookform/resolvers |
| **Drag-Drop** | @dnd-kit/core 6, @dnd-kit/sortable 10 |
| **Editor** | Tiptap 3 (React, starter-kit, mention extension) |
| **UI** | Radix UI primitives, shadcn/ui, Lucide icons |
| **Charts** | Recharts 3 |
| **Dates** | date-fns 4 |
| **Auth** | jose 6 (JWT verification) |
| **CSS** | Tailwind CSS 3.4, tailwindcss-animate, clsx, tailwind-merge |

## Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root HTML layout
│   ├── page.tsx                # Redirect → /board
│   ├── globals.css             # Tailwind base + CSS variables
│   ├── actions/
│   │   └── auth.ts             # Server actions (logout)
│   ├── (auth)/
│   │   ├── layout.tsx          # Centered auth layout
│   │   └── login/page.tsx      # Login page
│   └── (app)/
│       ├── layout.tsx          # Protected layout (sidebar + notifications)
│       ├── board/
│       │   ├── page.tsx        # Kanban board page
│       │   └── _components/    # Board-specific components (20+)
│       ├── roadmap/
│       │   ├── page.tsx        # Roadmap timeline page
│       │   └── _components/    # Roadmap components (5)
│       ├── dashboard/page.tsx  # Executive KPI dashboard
│       ├── portal/
│       │   ├── page.tsx        # Department portal index
│       │   └── [dept]/page.tsx # Department submission form
│       ├── wiki/
│       │   ├── page.tsx        # Wiki index (tree view)
│       │   └── [pageId]/page.tsx # Wiki page detail
│       ├── dept/
│       │   └── [slug]/page.tsx # Department dashboard
│       └── settings/
│           ├── templates/page.tsx    # Template management
│           └── custom-fields/page.tsx # Custom field definitions
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, dialog, card, etc.)
│   ├── sidebar/
│   │   └── AppSidebar.tsx      # Main navigation sidebar
│   ├── auth/
│   │   └── LoginForm.tsx       # Login form component
│   ├── assistant/
│   │   └── AssistantDrawer.tsx # AI assistant chat panel
│   └── notifications/
│       ├── NotificationBar.tsx # Top notification bar
│       └── NotificationBell.tsx # Bell icon with unread count
├── hooks/
│   ├── useBoard.ts             # Board data fetching + filtering
│   ├── useRoadmap.ts           # Roadmap data fetching + department grouping
│   ├── useTicketDetail.ts      # Single ticket data + mutations
│   ├── useMoveTicket.ts        # Ticket move mutation
│   ├── useNotifications.ts     # Notification polling
│   ├── useAiEnabled.ts         # AI feature flag check
│   ├── use-toast.ts            # Toast notification hook
│   └── use-mobile.tsx          # Mobile detection
└── lib/
    ├── utils.ts                # cn() utility (clsx + tailwind-merge)
    ├── dal.ts                  # Data access layer (verifySession)
    ├── providers.tsx           # React Query + nuqs providers
    └── api/
        ├── client.ts           # Axios instance with auth interceptor
        ├── tickets.ts          # Ticket API functions
        └── ai.ts               # AI API functions
```

## Route Groups

### `(auth)` — Public Routes
- `/login` — Login page with centered card layout

### `(app)` — Protected Routes
Server-side `verifySession()` checks JWT on every page load. Redirects to `/login` if unauthenticated.

**Layout provides:**
- `AppSidebar` — Navigation (Board, Roadmap, Dashboard, Portal, Wiki, Settings)
- `NotificationBar` — Top notification area
- `AssistantDrawer` — Floating AI assistant panel
- `Providers` — React Query, nuqs, toaster

## Pages

### Board (`/board`)
The main Kanban interface. Renders `KanbanBoard` which orchestrates:
- 5 columns: Backlog, Discovery, In Progress, Review/QA, Done
- Drag-and-drop via DND Kit (PointerSensor + KeyboardSensor)
- Backlog → other column triggers owner assignment modal
- Filter bar with URL-synced params (owner, department, priority, urgency, dates)
- Quick-add input for new tickets
- Click card → opens `TicketDetailModal`

### Roadmap (`/roadmap`)
Gantt-style timeline view. Renders `RoadmapView` which orchestrates:
- Horizontal swimlanes grouped by department (color-coded labels)
- Ticket bars positioned by `created_at` → `due_date`, colored by status (Backlog, Discovery, In Progress, Review/QA, Done)
- 12-month window starting from today
- Three zoom levels: Year (months), Week, Day (default)
- Department filter (URL-synced via nuqs)
- Today marker (red vertical line) with "Today" button to scroll to it
- Unscheduled section for tickets without due dates
- Click bar → opens `TicketDetailModal` (reused from board)

### Dashboard (`/dashboard`)
Executive analytics page with:
- KPI cards: Open tickets, throughput (7d), avg cycle time, overdue count
- Upcoming due dates table
- Department breakdown table
- Throughput trend chart (8-week area chart)
- Status breakdown pills
- Tickets by owner table
- Active effort hours bar chart

### Portal (`/portal`, `/portal/[dept]`)
Department intake system:
- Index page: Grid of 23 departments
- Department form: Title, urgency, priority, business impact, success criteria, ROI fields, contacts, file attachments
- AI integration: Extract fields from uploads, estimate effort, generate subtasks

### Wiki (`/wiki`, `/wiki/[pageId]`)
Hierarchical documentation:
- Tree view of pages with parent-child relationships
- Tiptap rich text editor for content
- Create, edit, delete pages
- Link pages to tickets

### Department Dashboard (`/dept/[slug]`)
Per-department analytics:
- KPI cards: Open tickets, avg age, avg cycle time, avg ROI
- Open tickets table with status/priority badges
- Click row → opens ticket detail modal

### Settings (`/settings/templates`, `/settings/custom-fields`)
Admin configuration:
- Template CRUD with Tiptap editor
- Custom field definitions (text, number, date; workspace or personal scope)

## Key Components

### KanbanBoard
Main board orchestrator. Manages DND context, column ordering, ticket grouping.

**State:**
- `tickets` — from `useBoard()` React Query hook (30s polling)
- `activeTicket` — currently dragged ticket
- `pendingMove` — Backlog move awaiting owner assignment
- `columnOrder` — client-side ordering map (column → ticket IDs)

**Drag logic:**
- `onDragStart` — Set active ticket for DragOverlay
- `onDragEnd` — Move ticket to target column (or owner modal for Backlog)
- Optimistic updates via `columnOrder` state

### KanbanColumn
Single column container. Renders header (title + count), ticket cards, QuickAddInput.

### KanbanCard
Ticket card display: title, department badge, owner avatar, due date, urgency, effort, time in column, subtask count, blocked badge.

### TicketDetailModal
Full ticket detail view (opened from board or URL `?ticket=`):
- Title editing
- Tiptap rich text editor for problem statement
- Status, priority, urgency, due date, effort fields
- Owner assignment (OwnerModal)
- SubtaskSection (CRUD + reorder + AI generation)
- CommentSection (with @mention support)
- AttachmentSection (upload + download)
- ContactsSection (internal + external)
- DependenciesSection (blocking relationships)
- CustomFieldsSection (dynamic fields)
- RoiPanel (ROI inputs + computed outputs)
- AiSummarySection (AI-generated progress summary)
- WikiLinkField (link to wiki page)
- Activity timeline (events)
- Column history
- AI assistant chat panel integration

### BoardFilterBar
Filter controls synced to URL query params via `nuqs`:
- Owner dropdown
- Department dropdown
- Priority selector
- Urgency range
- Date range pickers
- Saved filter presets (SavedFilterDropdown)

### AssistantDrawer
Floating AI chat panel:
- Streaming SSE responses from POST /api/assistant/chat
- Conversation history (in-memory on backend)
- Ticket context injection
- "Alex" AI persona (senior tech lead)

### TiptapEditor
Rich text editor wrapper:
- Tiptap with starter-kit extensions
- Mention extension for @user references
- JSON output format (not HTML)
- Toolbar: bold, italic, lists, code, etc.

## Hooks

### `useBoard()`
Board data fetching with 30s polling.
- Fetches GET /api/board with filter params
- `refetchInterval: 30000`
- Returns tickets array + loading/error state

### `useRoadmap()`
Roadmap data fetching + department grouping.
- Fetches GET /api/board with department filter (shares cache with `useBoard`)
- Groups tickets into department swimlanes (scheduled) and unscheduled list
- Returns `swimlanes`, `unscheduled`, `departments`, loading/error state

### `useTicketDetail(ticketId)`
Single ticket data + mutations.
- Fetches GET /api/tickets/{id}
- Provides `updateTicket`, `deleteTicket` mutations
- Invalidates board and ticket queries on mutation

### `useMoveTicket()`
Ticket move mutation.
- POST /api/tickets/{id}/move
- Invalidates board query on success
- Returns mutation function + pending state

### `useNotifications()`
Notification polling.
- Fetches GET /api/notifications
- Provides `markRead`, `markAllRead` mutations
- Unread count computation

### `useAiEnabled()`
AI feature flag check.
- Reads `ai_enabled` from GET /api/config
- `staleTime: 300000` (5 min cache)
- Returns boolean

## API Client

### Axios Instance (`lib/api/client.ts`)
- Base URL: `NEXT_PUBLIC_API_URL` (browser) or `INTERNAL_API_URL` (SSR)
- `withCredentials: true` (sends cookies)
- 401 interceptor: Auto-refresh via POST /api/auth/refresh, then retry
- On refresh failure: Redirect to /login

### Ticket API (`lib/api/tickets.ts`)
Functions for all ticket operations: create, get, update, delete, move, events, column history.

### AI API (`lib/api/ai.ts`)
Functions for AI endpoints: subtasks, effort, summary, extract-fields.

## State Management Strategy

| Layer | Tool | Usage |
|-------|------|-------|
| **Server state** | TanStack Query | API data, polling, cache invalidation |
| **URL state** | nuqs | Board filters (owner, dept, priority, dates) |
| **Component state** | React useState | UI toggles, form inputs, modals |
| **Form state** | React Hook Form + Zod | Validated forms with schema |
| **Optimistic UI** | Local state + Query invalidation | Drag-drop column moves |

### Polling Configuration

| Endpoint | refetchInterval | staleTime |
|----------|----------------|-----------|
| Board | 30s | 0 (always fresh) |
| Dashboard | none | 5 min |
| Config | none | 5 min |
| Notifications | 30s | 0 |

## Design System

### Color Palette (CSS Variables)
- Primary: `#2383E2` (blue)
- Background: `hsl(var(--background))`
- Card, popover, accent, destructive via CSS vars
- Dark mode support via `class` strategy

### Typography
- Sans: IBM Plex Sans (primary)
- Display: Fraunces (headings)
- Mono: JetBrains Mono (code)

### Component Library
shadcn/ui primitives built on Radix UI:
- Button, Card, Dialog, Badge, Input, Label
- AlertDialog, Command, Popover, Sheet
- Tooltip, Separator, Skeleton, Form
- Toast/Toaster for notifications

### Icons
Lucide React (tree-shakeable SVG icons).

## Authentication Flow (Frontend)

1. **Login page** → POST /api/auth/login (sets httpOnly cookies)
2. **Page load** → `verifySession()` in server component (reads cookie, validates JWT via `jose`)
3. **API calls** → Axios sends cookies automatically (`withCredentials: true`)
4. **401 response** → Interceptor tries POST /api/auth/refresh
5. **Refresh success** → Retry original request with new cookies
6. **Refresh failure** → Redirect to /login
7. **Logout** → Server action calls POST /api/auth/logout (clears cookies)

## Middleware

`src/middleware.ts` — Next.js edge middleware:
- Runs on every request
- Checks for `access_token` cookie
- Redirects unauthenticated users to `/login`
- Allows public routes (`/login`, `/api`, `/_next`)
