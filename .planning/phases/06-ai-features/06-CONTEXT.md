# Phase 6: AI Features - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Three AI-assisted capabilities invoked from ticket creation and detail views: subtask generation, effort estimation, and progress summarization. All gated behind an `AI_ENABLED` environment flag — no visible impact when disabled. Creating tickets, editing fields, and all other interactions are unchanged by this phase.

</domain>

<decisions>
## Implementation Decisions

### Subtask generation flow
- Generated subtasks appear in a modal with an editable list before saving
- Modal shows fully editable text fields — user can modify text, delete items, or add new ones
- If ticket already has subtasks, AI subtasks are **appended** (not replaced)
- AI uses full ticket context: title, description, comments, subtasks, and custom fields

### Feature flag UX
- When `AI_ENABLED=false`: AI buttons are **hidden entirely** — do not appear in the UI
- Frontend reads the flag from a backend config endpoint (e.g. `GET /api/config`) — not a baked-in env var
- On AI request failure: toast notification with a short error message; button returns to normal state
- Loading state: button shows spinner and is disabled while request is in flight

### Effort estimate interaction
- "Estimate effort with AI" button sits **next to the effort hours field** on the ticket creation form
- If the field already has a value: AI suggestion appears below the field with a "Use this" / replace action
- If field is empty: AI result fills the field directly
- Returns a **number only** — no confidence level or rationale
- AI uses full ticket context (same as subtask generation): title, description, comments, subtasks, custom fields

### Summary panel placement
- Summary appears in a **collapsible section within the ticket detail view** — inline, not a modal
- Idle state: section header + "Summarize progress" button only; no content shown until generated
- Summary is **ephemeral** — generated fresh on demand, not persisted in the database
- Content sent to AI: comments, subtask completion status, and recent activity events

### Claude's Discretion
- Exact modal design and animation for subtask generation
- Exact positioning and styling of the effort suggestion hint
- Collapsible section expand/collapse animation
- Toast notification style and duration
- Prompt engineering and system prompts for each AI endpoint

</decisions>

<specifics>
## Specific Ideas

- No specific product references — standard patterns are fine for all three AI interactions

</specifics>

<deferred>
## Deferred Ideas

- **PRD import on ticket creation** — Upload a PRD document when creating a ticket; system auto-fills title, description, and other fields from the document, then uses it as context for AI subtask generation and effort estimation. This is a distinct capability (file upload, document parsing, multi-field population) that warrants its own phase. Capture for roadmap backlog.

</deferred>

---

*Phase: 06-ai-features*
*Context gathered: 2026-02-25*
