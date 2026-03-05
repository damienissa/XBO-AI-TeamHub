# XBO AI TeamHub

**Internal task management platform replacing Trello, Monday, Asana, ClickUp, and Notion with a single self-hosted system.**

XBO AI TeamHub serves XBO departments with full request lifecycle tracking from submission through completion, featuring owner accountability, ROI justification, AI-powered assistance, and zero SaaS subscription costs.

## Key Features

- **Kanban Board** - 5-column workflow (Backlog, Discovery, In Progress, Review/QA, Done) with drag-and-drop
- **ROI Estimation** - Per-ticket business value calculation with weekly/annual cost projections
- **Executive Dashboard** - KPI cards, throughput metrics, cycle time analytics, department breakdowns
- **AI Assistant** - Claude-powered subtask generation, effort estimation, ticket summarization, and contextual chat
- **Department Portal** - Per-department intake forms for ticket submission
- **Wiki** - Hierarchical documentation pages linked to tickets
- **Advanced Features** - Dependencies, custom fields, saved filters, templates, notifications

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.x (async), Pydantic v2 |
| **Database** | PostgreSQL 16 (JSONB, window functions) |
| **AI** | Anthropic Claude API (feature-flagged) |
| **Infrastructure** | Docker Compose, Alembic migrations |

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd XBO-AI-TeamHub

# 2. Copy environment file and configure
cp AI-teamHub-app/.env.example AI-teamHub-app/.env
# Edit .env with your credentials

# 3. Start all services
docker compose up

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Project Structure

```
XBO-AI-TeamHub/
├── AI-teamHub-app/
│   ├── backend/              # FastAPI Python service
│   │   ├── app/
│   │   │   ├── core/         # Config, database, security
│   │   │   ├── models/       # SQLAlchemy ORM models (14 tables)
│   │   │   ├── schemas/      # Pydantic request/response schemas
│   │   │   ├── routers/      # API endpoint handlers (17 routers)
│   │   │   ├── services/     # Business logic layer
│   │   │   └── scripts/      # Database seed script
│   │   ├── alembic/          # Database migrations
│   │   ├── tests/            # pytest test suite
│   │   └── requirements.txt
│   ├── frontend/             # Next.js TypeScript service
│   │   └── src/
│   │       ├── app/          # Pages and route groups
│   │       │   ├── (auth)/   # Login page
│   │       │   └── (app)/    # Protected app pages
│   │       ├── components/   # Shared UI components
│   │       ├── hooks/        # Custom React hooks
│   │       └── lib/          # API client, utilities
│   └── .env.example
├── docker-compose.yml
├── docs/                     # Project documentation
└── .planning/                # Planning and research documents
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, design decisions, data flow |
| [Backend](docs/BACKEND.md) | Backend services, business logic, configuration |
| [Frontend](docs/FRONTEND.md) | Frontend components, state management, routing |
| [Database](docs/DATABASE.md) | Database schema, models, relationships, migrations |
| [API Reference](docs/API-REFERENCE.md) | Complete REST API endpoint documentation |
| [AI Features](docs/AI-FEATURES.md) | AI integration, Claude API usage, feature flag |
| [Deployment](docs/DEPLOYMENT.md) | Setup guide, Docker config, environment variables |

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation & Auth | Complete |
| 2 | Kanban Core | Complete |
| 3 | Collaboration & Department Portal | Complete |
| 4 | ROI & Executive Dashboard | Complete |
| 5 | Advanced Features | Complete |
| 6 | AI Features | In Progress (backend complete, frontend partial) |

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js 14 │────▶│   FastAPI     │
│  (React 18)  │◀────│  (SSR/CSR)  │◀────│  (async)      │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                         ┌─────────────────────┼──────────────┐
                         │                     │              │
                    ┌────▼────┐          ┌─────▼─────┐  ┌────▼────┐
                    │ Claude  │          │ PostgreSQL │  │  File   │
                    │  API    │          │    16      │  │ Storage │
                    └─────────┘          └───────────┘  └─────────┘
```

## License

Internal use only - XBO proprietary.
