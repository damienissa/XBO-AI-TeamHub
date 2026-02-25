---
phase: 05-advanced-features
plan: 01
subsystem: backend-data-layer
tags: [backend, orm, alembic, fastapi, postgresql, phase5]
dependency_graph:
  requires: []
  provides:
    - ticket-dependencies-api
    - sprints-api
    - custom-fields-api
    - saved-filters-api
    - wiki-api
    - phase5-migration
  affects:
    - backend/app/models/ticket.py
    - backend/app/services/tickets.py
    - backend/app/main.py
tech_stack:
  added: []
  patterns:
    - self-referential-m2m-association-table
    - mutabledict-jsonb-mutation-tracking
    - wiki-parent-id-self-reference
    - scope-enum-check-constraint
    - check-not-blocked-service-function
key_files:
  created:
    - backend/app/models/ticket_dependency.py
    - backend/app/models/sprint.py
    - backend/app/models/custom_field.py
    - backend/app/models/saved_filter.py
    - backend/app/models/wiki_page.py
    - backend/alembic/versions/9c6cd841fe34_phase5_advanced_features.py
    - backend/app/schemas/ticket_dependency.py
    - backend/app/schemas/sprint.py
    - backend/app/schemas/custom_field.py
    - backend/app/schemas/saved_filter.py
    - backend/app/schemas/wiki_page.py
    - backend/app/routers/dependencies.py
    - backend/app/routers/sprints.py
    - backend/app/routers/custom_fields.py
    - backend/app/routers/saved_filters.py
    - backend/app/routers/wiki.py
  modified:
    - backend/app/models/ticket.py
    - backend/app/schemas/ticket.py
    - backend/app/services/tickets.py
    - backend/app/main.py
    - backend/alembic/env.py
decisions:
  - "ticket_dependency is a pure association table (no ORM class) — no extra columns needed; blocker_id and blocked_id both CASCADE on ticket delete"
  - "blocks/blocked_by M2M relationships specify primaryjoin/secondaryjoin/foreign_keys explicitly — required for self-referential M2M ambiguity resolution (RESEARCH.md Pitfall 2)"
  - "custom_field_values uses MutableDict.as_mutable(JSONB) on model column — auto-detects in-place dict mutation without flag_modified call (RESEARCH.md Pattern 3)"
  - "CHECK constraint on custom_field_defs enforces scope/owner consistency: personal requires owner_id, workspace requires owner_id=NULL"
  - "wiki parent_id uses ON DELETE SET NULL — orphaned child pages become top-level, preventing accidental bulk deletion (RESEARCH.md Pitfall 5)"
  - "check_not_blocked() added to move_ticket service, called only when is_backlog_exit=True — returns HTTP 409 with {code: BLOCKED, blocker_ids, message}"
  - "dependencies router registered with /api/tickets prefix so paths form /api/tickets/{ticket_id}/dependencies"
metrics:
  duration: 6 min
  completed_date: "2026-02-25"
  tasks_completed: 3
  files_created: 16
  files_modified: 5
---

# Phase 5 Plan 01: Backend Data Layer Summary

**One-liner:** Complete Phase 5 backend: 5 new ORM models, 1 Alembic migration (5 tables + 3 columns), 5 schema files, 5 routers, Ticket extensions with M2M dependency relationships and MutableDict JSONB custom fields, and ADV-05 blocker check in move_ticket service.

## What Was Built

The complete server-side foundation for all Phase 5 advanced features:

1. **Ticket Dependencies (ADV-04, ADV-05):** `ticket_dependencies` association table (pure, no class), self-referential M2M `blocks`/`blocked_by` relationships on Ticket with explicit join conditions, `GET/POST/DELETE /api/tickets/{id}/dependencies` router, `check_not_blocked()` service function called in `move_ticket` when exiting Backlog

2. **Sprints (ADV-08, ADV-09, ADV-10):** `Sprint` model, `sprint_id` FK on Ticket, full CRUD router at `/api/sprints`, sprint board endpoint returning tickets + velocity (effort completed / effort total / pct)

3. **Custom Fields (ADV-01, ADV-02):** `CustomFieldDef` model with `FieldScope`/`FieldType` enums and scope/owner CHECK constraint, `custom_field_values` MutableDict JSONB on Ticket, router at `/api/custom-field-defs` with scope-based auth (admin for workspace, owner for personal)

4. **Saved Filters (ADV-07):** `SavedFilter` model (user_id, name, filter_state JSONB), router at `/api/saved-filters` scoped to current user

5. **Wiki Pages (WIKI-01 through WIKI-04):** `WikiPage` model with parent_id self-reference (ON DELETE SET NULL), router at `/api/wiki` with role-based access (all authenticated can read/create/edit, admin-only DELETE)

6. **Ticket Schema Extensions (ADV-09, WIKI-05, ADV-02):** `TicketUpdate` and `TicketOut` extended with `sprint_id`, `wiki_page_id`, `custom_field_values`

## Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ORM models, Ticket extensions, Alembic migration | 2383738 | 5 new model files, ticket.py, migration 9c6cd841fe34, env.py |
| 2 | Pydantic schemas + routers for all 5 sub-features | 0984352 | 5 schema files, 5 router files |
| 3 | Register routers in main.py + ADV-05 blocker check | 02cdc16 | main.py, services/tickets.py |

## Verification

- Migration `9c6cd841fe34` applied at head with all 5 new tables confirmed in DB
- All Phase 5 models import without errors
- All 5 new route groups return HTTP 401 without auth (confirming routes registered)
- `GET /api/wiki/`, `GET /api/sprints/`, `GET /api/custom-field-defs/`, `GET /api/saved-filters/` all return 401
- Swagger UI (`/docs`) loads successfully showing all new route groups
- Backend container running with no import errors or tracebacks

## Deviations from Plan

None — plan executed exactly as written.

The migration autogenerate detected all expected changes:
- CREATE TABLE custom_field_defs (with CHECK constraint, fieldtype/fieldscope enums)
- CREATE TABLE saved_filters
- CREATE TABLE sprints
- CREATE TABLE wiki_pages (parent_id self-ref ON DELETE SET NULL)
- CREATE TABLE ticket_dependencies (composite PK, both FKs ON DELETE CASCADE)
- ADD COLUMN tickets.sprint_id (FK to sprints ON DELETE SET NULL)
- ADD COLUMN tickets.wiki_page_id (FK to wiki_pages ON DELETE SET NULL)
- ADD COLUMN tickets.custom_field_values (JSONB)

## Self-Check: PASSED

All 11 key created files confirmed present on disk.
All 3 task commits confirmed in git log (2383738, 0984352, 02cdc16).
