# Backend Test Coverage Report

**Date:** 2026-03-06
**Python:** 3.12.13 | **Framework:** FastAPI + SQLAlchemy 2.x async
**Tests:** 171 passed | **Overall coverage: 81%**

## Summary

| Category | Stmts | Miss | Cover |
|----------|------:|-----:|------:|
| **TOTAL** | **2318** | **432** | **81%** |

## Detailed Coverage by Module

### Core

| Module | Stmts | Miss | Cover | Missing Lines |
|--------|------:|-----:|------:|---------------|
| `app/core/config.py` | 17 | 0 | 100% | — |
| `app/core/database.py` | 15 | 2 | 87% | 47-48 |
| `app/core/limiter.py` | 3 | 0 | 100% | — |
| `app/core/security.py` | 33 | 2 | 94% | 48-49 |
| `app/dependencies.py` | 29 | 3 | 90% | 38, 47, 57 |
| `app/main.py` | 54 | 4 | 93% | 44-45, 78, 84 |

### Models (100% coverage)

| Module | Stmts | Miss | Cover |
|--------|------:|-----:|------:|
| `app/models/column_history.py` | 14 | 0 | 100% |
| `app/models/custom_field.py` | 23 | 0 | 100% |
| `app/models/department.py` | 11 | 0 | 100% |
| `app/models/notification.py` | 16 | 0 | 100% |
| `app/models/saved_filter.py` | 14 | 0 | 100% |
| `app/models/ticket.py` | 61 | 0 | 100% |
| `app/models/ticket_attachment.py` | 14 | 0 | 100% |
| `app/models/ticket_comment.py` | 15 | 0 | 100% |
| `app/models/ticket_contact.py` | 17 | 0 | 100% |
| `app/models/ticket_dependency.py` | 3 | 0 | 100% |
| `app/models/ticket_event.py` | 16 | 0 | 100% |
| `app/models/ticket_subtask.py` | 13 | 0 | 100% |
| `app/models/ticket_template.py` | 19 | 0 | 100% |
| `app/models/user.py` | 20 | 0 | 100% |
| `app/models/wiki_page.py` | 16 | 0 | 100% |

### Routers

| Module | Stmts | Miss | Cover | Missing Lines |
|--------|------:|-----:|------:|---------------|
| `app/routers/comments.py` | 58 | 0 | 100% | — |
| `app/routers/custom_fields.py` | 40 | 0 | 100% | — |
| `app/routers/departments.py` | 14 | 0 | 100% | — |
| `app/routers/notifications.py` | 30 | 0 | 100% | — |
| `app/routers/saved_filters.py` | 30 | 0 | 100% | — |
| `app/routers/templates.py` | 50 | 0 | 100% | — |
| `app/routers/subtasks.py` | 67 | 1 | 99% | 142 |
| `app/routers/wiki.py` | 63 | 1 | 98% | 85 |
| `app/routers/dependencies.py` | 48 | 2 | 96% | 41, 132 |
| `app/routers/auth.py` | 65 | 3 | 95% | 66-67, 134 |
| `app/routers/board.py` | 81 | 8 | 90% | 33, 39-44, 113-114 |
| `app/routers/dashboard.py` | 97 | 12 | 88% | 180-190, 277-284, 319-324 |
| `app/routers/attachments.py` | 92 | 18 | 80% | 53, 96, 137, 156-177 |
| `app/routers/tickets.py` | 151 | 36 | 76% | 47, 53-58, 140, 153, 160-170, 174-178, 192, 196, 201, 216, 234, 263-276, 289, 309 |
| `app/routers/ai.py` ¹ | 150 | 112 | 25% | 38-44, 49-50, 58-65, 70-85, 90-111, 125-174, 185-217, 229-278, 289-363 |
| `app/routers/assistant.py` ¹ | 107 | 80 | 25% | 66-68, 73-163, 171-187, 197-221, 233-234 |

### Schemas

| Module | Stmts | Miss | Cover | Missing Lines |
|--------|------:|-----:|------:|---------------|
| `app/schemas/ticket.py` | 102 | 6 | 94% | 41, 43, 143-147 |
| `app/schemas/auth.py` | 35 | 5 | 86% | 29, 31, 33, 35, 37 |
| `app/schemas/column_history.py` | 26 | 5 | 81% | 28-33 |
| `app/schemas/ai.py` | 43 | 9 | 79% | 8-13, 30-32 |
| `app/schemas/ticket_contact.py` | 25 | 7 | 72% | 16-22 |
| All other schemas | — | 0 | 100% | — |

### Services

| Module | Stmts | Miss | Cover | Missing Lines |
|--------|------:|-----:|------:|---------------|
| `app/services/mention_parser.py` | 24 | 0 | 100% | — |
| `app/services/roi.py` | 14 | 0 | 100% | — |
| `app/services/tickets.py` | 61 | 2 | 97% | 92, 120 |
| `app/services/auth.py` | 43 | 3 | 93% | 36, 74, 86 |
| `app/services/notifications.py` | 40 | 20 | 50% | 15-16, 29-42, 60-68, 89-90, 112-116 |
| `app/services/file_extraction.py` ¹ | 32 | 20 | 38% | 39-65 |
| `app/services/contacts.py` | 33 | 25 | 24% | 25-86 |
| `app/services/email.py` ¹ | 28 | 22 | 21% | 11-36 |

### Scripts

| Module | Stmts | Miss | Cover | Notes |
|--------|------:|-----:|------:|-------|
| `app/scripts/seed.py` | 24 | 24 | 0% | One-time seed script, not tested |

## Notes

¹ **Intentionally not tested** — these modules require external service mocking (Anthropic Claude API, SMTP) that would add significant complexity for limited value.

## Test Files

| Test File | Tests |
|-----------|------:|
| `test_auth.py` | 9 |
| `test_departments.py` | 4 |
| `test_tickets.py` | 13 |
| `test_services_roi.py` | 9 |
| `test_services_mention_parser.py` | 11 |
| `test_comments.py` | 11 |
| `test_subtasks.py` | 13 |
| `test_wiki.py` | 15 |
| `test_templates.py` | 12 |
| `test_custom_fields.py` | 12 |
| `test_dependencies.py` | 11 |
| `test_saved_filters.py` | 7 |
| `test_notifications.py` | 7 |
| `test_board.py` | 15 |
| `test_dashboard.py` | 10 |
| `test_attachments.py` | 9 |
| **Total** | **171** |
