# API Reference

Base URL: `http://localhost:8000`

All endpoints require authentication (JWT in httpOnly cookie) unless marked as **Public**.

## Authentication

### POST /api/auth/login
Login with email and password. Sets httpOnly cookies.

**Request:**
```json
{ "email": "user@xbo.com", "password": "secret" }
```
**Response:** `200 OK` — `UserOut` + sets `access_token` and `refresh_token` cookies
**Errors:** `401` Invalid credentials

### GET /api/auth/me
Get current authenticated user.

**Response:** `200 OK` — `UserOut`
```json
{
  "id": "uuid",
  "email": "user@xbo.com",
  "full_name": "John Doe",
  "role": "admin",
  "is_active": true
}
```

### POST /api/auth/logout
Clear auth cookies.

**Response:** `200 OK` — `{"message": "Logged out"}`

### POST /api/auth/refresh
Refresh access token using refresh cookie.

**Response:** `200 OK` — `UserOut` + new cookies
**Errors:** `401` Invalid/expired refresh token

### POST /api/auth/users
Create a new user. **Admin only.**

**Request:**
```json
{
  "email": "new@xbo.com",
  "password": "secret",
  "full_name": "Jane Doe",
  "role": "member"
}
```
**Response:** `201 Created` — `UserOut`
**Errors:** `403` Not admin, `422` Duplicate email

### GET /api/auth/users
List all users. Used for owner selectors.

**Response:** `200 OK` — `list[UserOut]` (ordered by full_name)

---

## Departments

### GET /api/departments
**Public.** List all departments.

**Response:** `200 OK` — `list[DepartmentOut]` (ordered by name)
```json
[{ "id": "uuid", "slug": "xbo_dev", "name": "R&D" }]
```

---

## Tickets

### POST /api/tickets
Create a new ticket (starts in Backlog, no owner).

**Request:**
```json
{
  "title": "Implement feature X",
  "department_id": "uuid",
  "problem_statement": { "type": "doc", "content": [...] },
  "urgency": 3,
  "business_impact": "Reduces processing time by 50%",
  "success_criteria": "Feature deployed and tested",
  "due_date": "2026-04-01",
  "effort_estimate": 40,
  "priority": "high",
  "current_time_cost_hours_per_week": 10,
  "employees_affected": 5,
  "avg_hourly_cost": 50,
  "contacts": [
    { "user_id": "uuid" },
    { "external_name": "Client", "external_email": "client@ext.com" }
  ]
}
```
**Response:** `201 Created` — `TicketOut`

### GET /api/tickets/{ticket_id}
Get full ticket details.

**Response:** `200 OK` — `TicketOut` (with owner, department, contacts, time_in_column)

### PATCH /api/tickets/{ticket_id}
Update ticket fields (partial update).

**Request:** Any subset of `TicketUpdate` fields
**Response:** `200 OK` — `TicketOut`
**Side effects:** Emits events, notifications for assignment/status/mention changes

### DELETE /api/tickets/{ticket_id}
Delete a ticket. **Admin only.**

**Response:** `204 No Content`
**Cascade:** Deletes comments, subtasks, events, column_history, attachments, contacts

### POST /api/tickets/{ticket_id}/move
Move ticket to a different column.

**Request:**
```json
{ "target_column": "In Progress", "owner_id": "uuid" }
```
**Response:** `200 OK` — `TicketOut`
**Errors:** `409` Ticket blocked by unresolved dependencies

### GET /api/tickets/{ticket_id}/events
Get ticket activity timeline.

**Response:** `200 OK` — `list[TicketEventOut]` (chronological)
```json
[{
  "id": "uuid",
  "event_type": "moved",
  "payload": { "from": "Backlog", "to": "Discovery" },
  "actor_id": "uuid",
  "created_at": "2026-03-01T10:00:00Z"
}]
```

### GET /api/tickets/{ticket_id}/column-history
Get time spent in each column.

**Response:** `200 OK` — `list[ColumnHistoryOut]`
```json
[{
  "id": "uuid",
  "column": "Backlog",
  "entered_at": "2026-03-01T10:00:00Z",
  "exited_at": "2026-03-02T14:00:00Z",
  "time_spent": "1d in column"
}]
```

---

## Board

### GET /api/board
Get all tickets for the Kanban board (single optimized query).

**Query Parameters (all optional):**

| Param | Type | Description |
|-------|------|-------------|
| `owner_id` | UUID | Filter by owner |
| `department_id` | UUID | Filter by department |
| `priority` | string | `low`, `medium`, `high`, `critical` |
| `min_urgency` | int | Urgency >= value (1-5) |
| `max_urgency` | int | Urgency <= value (1-5) |
| `due_before` | date | Due date <= value |
| `due_after` | date | Due date >= value |
| `created_after` | date | Created >= value |
| `created_before` | date | Created <= value |
| `min_age_days` | int | Created <= (now - days) |

**Response:** `200 OK` — `list[BoardTicketOut]`

Each ticket includes: owner, department, contacts, time_in_column, subtasks_total, subtasks_done, blocked_by_count.

---

## Comments

### GET /api/tickets/{ticket_id}/comments
List comments (chronological).

**Response:** `200 OK` — `list[CommentOut]`

### POST /api/tickets/{ticket_id}/comments
Add a comment.

**Request:** `{ "body": "Comment text" }`
**Response:** `201 Created` — `CommentOut`
**Side effects:** Extracts @mentions, creates notifications

### DELETE /api/tickets/{ticket_id}/comments/{comment_id}
Delete comment (author or admin only).

**Response:** `204 No Content`
**Errors:** `403` Not author or admin

---

## Subtasks

### GET /api/tickets/{ticket_id}/subtasks
List subtasks (ordered by position).

**Response:** `200 OK` — `list[SubtaskOut]`

### POST /api/tickets/{ticket_id}/subtasks
Add a subtask.

**Request:** `{ "title": "Subtask title" }`
**Response:** `201 Created` — `SubtaskOut`

### PATCH /api/tickets/{ticket_id}/subtasks/{subtask_id}
Toggle subtask completion.

**Request:** `{ "done": true }`
**Response:** `200 OK` — `SubtaskOut`

### PATCH /api/tickets/{ticket_id}/subtasks/reorder
Reorder subtasks.

**Request:** `{ "ordered_ids": ["uuid1", "uuid2", "uuid3"] }`
**Response:** `200 OK` — `list[SubtaskOut]`

### DELETE /api/tickets/{ticket_id}/subtasks/{subtask_id}
Delete subtask. Remaining subtasks are resequenced.

**Response:** `204 No Content`

---

## Dependencies

### GET /api/tickets/{ticket_id}/dependencies
Get blocking relationships.

**Response:** `200 OK`
```json
{
  "blocks": [{ "id": "uuid", "title": "...", "status_column": "In Progress" }],
  "blocked_by": [{ "id": "uuid", "title": "...", "status_column": "Backlog" }]
}
```

### POST /api/tickets/{ticket_id}/dependencies
Add a blocking dependency.

**Request:** `{ "blocking_ticket_id": "uuid" }`
**Response:** `201 Created` — `DependenciesOut`
**Errors:** `400` Self-dependency, `409` Already exists

### DELETE /api/tickets/{ticket_id}/dependencies/{blocking_ticket_id}
Remove a dependency.

**Response:** `204 No Content`

---

## Attachments

### GET /api/tickets/{ticket_id}/attachments
List attachments.

**Response:** `200 OK` — `list[AttachmentOut]`

### POST /api/tickets/{ticket_id}/attachments
Upload a file.

**Request:** `multipart/form-data` with `file` field
**Allowed types:** PDF, DOCX, TXT, MD
**Max size:** 10 MB
**Response:** `201 Created` — `AttachmentOut`
**Errors:** `413` File too large, `415` Unsupported type

### GET /api/tickets/{ticket_id}/attachments/{attachment_id}/download
Download attachment file.

**Response:** File content with appropriate Content-Type

---

## Templates

### GET /api/templates
List all templates.

**Response:** `200 OK` — `list[TemplateOut]`

### POST /api/templates
Create a template.

**Request:**
```json
{
  "title": "Bug Report",
  "problem_statement": { "type": "doc", "content": [...] },
  "default_urgency": 3,
  "default_effort_estimate": 8,
  "default_next_step": "Reproduce and investigate"
}
```
**Response:** `201 Created` — `TemplateOut`

### PATCH /api/templates/{template_id}
Update template (partial).

**Response:** `200 OK` — `TemplateOut`

### DELETE /api/templates/{template_id}
Delete template.

**Response:** `204 No Content`

---

## Custom Fields

### GET /api/custom-field-defs
List custom field definitions (workspace + current user's personal).

**Response:** `200 OK` — `list[CustomFieldDefOut]`
```json
[{
  "id": "uuid",
  "name": "Sprint Points",
  "field_type": "number",
  "scope": "workspace",
  "owner_id": null
}]
```

### POST /api/custom-field-defs
Create a custom field. Workspace scope requires admin.

**Request:**
```json
{ "name": "Sprint Points", "field_type": "number", "scope": "workspace" }
```
**Response:** `201 Created` — `CustomFieldDefOut`

### DELETE /api/custom-field-defs/{field_id}
Delete custom field (admin for workspace, owner for personal).

**Response:** `204 No Content`

---

## Saved Filters

### GET /api/saved-filters
List current user's saved filters (newest first).

**Response:** `200 OK` — `list[SavedFilterOut]`

### POST /api/saved-filters
Save a board filter preset.

**Request:**
```json
{ "name": "My High Priority", "filter_state": { "priority": "high", "department_id": "uuid" } }
```
**Response:** `201 Created` — `SavedFilterOut`

### DELETE /api/saved-filters/{filter_id}
Delete a saved filter (owner only).

**Response:** `204 No Content`

---

## Wiki

### GET /api/wiki
List all wiki pages (frontend assembles tree from parent_id).

**Response:** `200 OK` — `list[WikiPageOut]`

### POST /api/wiki
Create wiki page.

**Request:**
```json
{ "title": "Setup Guide", "content": { "type": "doc", "content": [...] }, "parent_id": "uuid" }
```
**Response:** `201 Created` — `WikiPageOut`

### GET /api/wiki/{page_id}
Get single wiki page.

**Response:** `200 OK` — `WikiPageOut`

### PATCH /api/wiki/{page_id}
Update wiki page.

**Response:** `200 OK` — `WikiPageOut`

### DELETE /api/wiki/{page_id}
Delete wiki page. **Admin only.**

**Response:** `204 No Content`

---

## Dashboard

### GET /api/dashboard
Executive KPI dashboard. All aggregations computed in PostgreSQL.

**Response:** `200 OK`
```json
{
  "open_ticket_count": 42,
  "overdue_count": 5,
  "throughput_last_week": 8,
  "avg_cycle_time_hours": 120.5,
  "column_times": [
    { "column": "Backlog", "avg_hours": 48.2 },
    { "column": "In Progress", "avg_hours": 36.1 }
  ],
  "workload": [
    { "user_id": "uuid", "user_name": "John", "total_hours": 80 }
  ],
  "dept_breakdown": [
    { "department_id": "uuid", "department_name": "R&D", "ticket_count": 15, "avg_cycle_hours": 96.3 }
  ],
  "throughput_trend": [
    { "week": "2026-02-24", "count": 6 }
  ],
  "status_breakdown": [
    { "status": "Backlog", "count": 20 }
  ],
  "tickets_by_owner": [
    { "user_id": "uuid", "user_name": "John", "ticket_count": 12 }
  ],
  "upcoming_releases": [
    { "ticket_id": "uuid", "title": "...", "due_date": "2026-03-15", "status": "Review/QA", "owner_name": "John" }
  ]
}
```

### GET /api/dashboard/dept/{slug}
Department-specific dashboard.

**Response:** `200 OK`
```json
{
  "department": { "id": "uuid", "slug": "xbo_dev", "name": "R&D" },
  "open_ticket_count": 10,
  "avg_age_open_hours": 72.5,
  "avg_cycle_time_hours": 96.3,
  "avg_roi": 2.5,
  "tickets": [...]
}
```

---

## Notifications

### GET /api/notifications
List current user's notifications (newest first, limit 50).

**Response:** `200 OK` — `list[NotificationOut]`

### PATCH /api/notifications/read-all
Mark all notifications as read.

**Response:** `200 OK` — `{"ok": true}`

### PATCH /api/notifications/{notification_id}/read
Mark single notification as read.

**Response:** `200 OK` — `NotificationOut`

---

## AI Endpoints

All AI endpoints return `503` when `AI_ENABLED=false`.

### POST /api/ai/subtasks
Generate subtask suggestions.

**Request:**
```json
{
  "title": "Implement OAuth",
  "problem_statement": "...",
  "business_impact": "...",
  "success_criteria": "...",
  "urgency": 3,
  "existing_subtasks": ["Setup OAuth provider"],
  "custom_fields": {},
  "file_context": "extracted document text..."
}
```
**Response:** `200 OK` — `{ "subtasks": ["subtask1", "subtask2", ...] }`

### POST /api/ai/effort
Estimate effort in hours.

**Request:** `{ "title": "...", "problem_statement": "...", ... }`
**Response:** `200 OK` — `{ "effort_hours": 24 }`

### POST /api/ai/summary
Summarize ticket progress.

**Request:** `{ "comments": ["..."], "events": ["..."] }`
**Response:** `200 OK` — `{ "summary": "..." }`

### POST /api/ai/extract-fields
Extract structured fields from document text.

**Request:** `{ "attachment_text": "..." }`
**Response:** `200 OK` — extracted field suggestions

---

## Assistant

### POST /api/assistant/chat
Streaming chat with AI assistant (SSE).

**Request:**
```json
{
  "message": "How should I implement this feature?",
  "conversation_id": "optional-uuid",
  "ticket_context": { "title": "...", "status": "...", ... }
}
```
**Response:** `200 OK` — Server-Sent Events stream

---

## Public Endpoints

### GET /health
Health check.

**Response:** `200 OK` — `{"status": "ok"}`

### GET /api/config
Application configuration (public).

**Response:** `200 OK`
```json
{ "ai_team_hourly_rate": 75.0, "ai_enabled": false }
```
