# CLAUDE.md — Project Conventions for XBO AI TeamHub

## Project Overview

Internal task management platform (replaces Trello/Monday/Asana) for XBO departments. Monorepo with Next.js 14 frontend + FastAPI backend + PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix)
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x (async), Pydantic v2
- **Database**: PostgreSQL 16
- **AI**: Anthropic Claude API (feature-flagged via `AI_ENABLED`)

## Key Directories

```
AI-teamHub-app/
  backend/app/
    routers/         # FastAPI route handlers
    services/        # Business logic
    models/          # SQLAlchemy ORM models
    schemas/         # Pydantic schemas
  frontend/src/
    app/(app)/       # Protected pages (board, roadmap, dashboard, portal, wiki)
    app/(auth)/      # Public pages (login)
    components/      # Shared components (sidebar, ui/, assistant, notifications)
    hooks/           # Custom React hooks (useBoard, useRoadmap, useTicketDetail, etc.)
    lib/api/         # API client functions (tickets.ts, client.ts, ai.ts)
docs/                # Project documentation
feature-request/     # Feature request specifications
.planning/           # Internal planning documents
```

## Coding Conventions

### Frontend

- **Theme colors**: Use inline `style={{ color: "#37352F" }}` for the Notion-inspired palette, NOT Tailwind color classes:
  - Foreground: `#37352F`
  - Muted text: `#9B9A97`
  - Border: `#E9E9E6`
  - Surface: `#F7F7F5`
  - Accent blue: `#2383E2`
- **Layout/utilities**: Use Tailwind CSS classes (`flex`, `rounded-md`, `px-4`, etc.)
- **URL state**: Use `nuqs` (`useQueryStates`, `parseAsString`, etc.) for filter params — makes pages shareable/bookmarkable
- **Data fetching**: TanStack React Query v5 with custom hooks (e.g., `useBoard`, `useRoadmap`)
- **Component library**: shadcn/ui built on Radix UI primitives — check `components/ui/` before creating new base components
- **Icons**: Lucide React (tree-shakeable)
- **Dates**: `date-fns` v4 for all date manipulation
- **Modals via URL**: TicketDetailModal opens via `?ticket=<id>` URL param (nuqs)

### Backend

- **All relationships**: Use `lazy="raise"` to prevent N+1 queries; use `selectinload()` explicitly
- **Three-layer architecture**: Routers (thin HTTP) -> Services (business logic) -> Models (ORM)
- **Auth**: JWT in httpOnly cookies, `get_current_user` dependency on all protected endpoints
- **Validation**: Pydantic v2 schemas on all endpoints

## Patterns to Follow

- **New pages**: Create under `app/(app)/<name>/page.tsx` with `_components/` subfolder
- **New hooks**: Place in `hooks/use<Name>.ts`, use React Query for server state
- **Department colors**: Reuse `DEPT_COLORS` map from `board/_components/KanbanCard.tsx`
- **Priority colors**: Reuse `PRIORITY_COLORS` map from `board/_components/KanbanCard.tsx`
- **Filter bars**: Follow `BoardFilterBar.tsx` pattern — nuqs for state, department dropdown via `useQuery(["departments"])`
- **Protected routes**: Add new routes to both `middleware.ts` `protectedRoutes` array AND `AppSidebar.tsx` `NAV_ITEMS`

## What NOT to Do

- Do not add heavy external libraries without discussion (no Gantt libraries, charting frameworks beyond recharts, etc.)
- Do not create new backend endpoints when existing ones suffice — the `GET /api/board` endpoint supports rich filtering
- Do not use HTML color classes from Tailwind for theme colors — use inline styles with the hex values above
- Do not use `lazy="select"` or `lazy="joined"` on SQLAlchemy relationships
- Do not store HTML in the database — use Tiptap JSON format for rich text

## Running the Project

```bash
# Start all services
docker compose up

# Frontend only (dev)
cd AI-teamHub-app/frontend && npm run dev

# Backend only (dev)
cd AI-teamHub-app/backend && uvicorn app.main:app --reload

# Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Documentation

- Update `docs/FRONTEND.md` when adding new pages, hooks, or components
- Update `docs/ARCHITECTURE.md` when adding new routes or changing data flow
- Update `README.md` when adding new features
- Place feature specs in `feature-request/` folder as markdown files
