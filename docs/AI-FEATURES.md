# AI Features

## Overview

XBO AI TeamHub integrates with the Anthropic Claude API to provide intelligent assistance across the ticket lifecycle. All AI features are gated behind the `AI_ENABLED` environment variable and return HTTP 503 when disabled.

## Feature Flag

```bash
# .env
AI_ENABLED=false        # Set to true to enable AI features
ANTHROPIC_API_KEY=      # Required when AI_ENABLED=true
AI_MODEL=claude-haiku-4-5  # Model identifier
```

- `AI_ENABLED=false` (default): All AI endpoints return `503 Service Unavailable`
- `AI_ENABLED=true`: Requires valid `ANTHROPIC_API_KEY`
- Frontend reads flag from GET /api/config → hides/disables AI buttons when false

## AI Client Configuration

```python
# Singleton AsyncAnthropic client
_ai_client = AsyncAnthropic(
    api_key=settings.ANTHROPIC_API_KEY,
    timeout=60.0,       # Override 10-min SDK default
    max_retries=2,      # Auto-retry 429 (rate limit), 5xx errors
)
```

## Features

### 1. Subtask Generation

**Endpoint:** `POST /api/ai/subtasks`

Generates actionable subtask suggestions based on ticket context.

**Input:**
```json
{
  "title": "Implement OAuth2 authentication",
  "problem_statement": "We need SSO support...",
  "business_impact": "Reduces onboarding friction",
  "success_criteria": "Users can login via Google/Microsoft",
  "urgency": 4,
  "existing_subtasks": ["Research OAuth providers"],
  "custom_fields": {},
  "file_context": "extracted text from attachments..."
}
```

**Output:**
```json
{
  "subtasks": [
    "Configure OAuth2 provider credentials",
    "Implement authorization code flow",
    "Add callback URL handling",
    "Create user session from OAuth token",
    "Add logout/session invalidation",
    "Write integration tests"
  ]
}
```

**Prompt strategy:** XML-wrapped ticket context with instructions to generate specific, actionable subtasks. Considers existing subtasks to avoid duplicates.

**Frontend integration:** "Generate subtasks" button in TicketDetailModal's SubtaskSection. Generated subtasks can be reviewed and added individually.

### 2. Effort Estimation

**Endpoint:** `POST /api/ai/effort`

Estimates development effort in hours based on ticket scope.

**Input:**
```json
{
  "title": "Implement OAuth2 authentication",
  "problem_statement": "...",
  "business_impact": "...",
  "success_criteria": "...",
  "urgency": 4
}
```

**Output:**
```json
{
  "effort_hours": 24
}
```

**Frontend integration:** "Estimate effort" button in ticket creation forms and detail view. Pre-fills the effort_estimate field when empty, shows "Use this" hint when field already has a value.

### 3. Ticket Summarization

**Endpoint:** `POST /api/ai/summary`

Summarizes ticket progress from comments and events.

**Input:**
```json
{
  "comments": ["Started implementation...", "Found edge case with..."],
  "events": ["created", "moved Backlog → Discovery", "assigned to John"]
}
```

**Output:**
```json
{
  "summary": "Implementation started with initial work on OAuth flow. An edge case was identified during development. Ticket has progressed from Backlog through Discovery with John assigned as owner."
}
```

**Frontend integration:** AiSummarySection in TicketDetailModal. Collapsible panel with ephemeral state (not persisted). Shows loading spinner during generation.

### 4. Field Extraction from Attachments

**Endpoint:** `POST /api/ai/extract-fields`

Extracts structured ticket fields from uploaded document text.

**Input:**
```json
{
  "attachment_text": "Project Requirements: We need to reduce customer onboarding time from 3 days to 1 day. Currently 50 employees are affected, costing approximately $45/hour..."
}
```

**Output:** Suggested values for ticket fields (title, business impact, ROI inputs, etc.)

**Flow:**
1. User uploads PDF/DOCX/TXT to ticket
2. Backend extracts text via `file_extraction.py` (pypdf, python-docx)
3. Frontend sends extracted text to `/api/ai/extract-fields`
4. Claude identifies and returns structured field values
5. Frontend offers to populate fields with extracted values

**Text extraction limits:**
- Storage: 15,000 chars max
- AI context: 8,000 chars max

### 5. AI Assistant (Contextual Chat)

**Endpoint:** `POST /api/assistant/chat` (Server-Sent Events)

Interactive chat with "Alex" — a senior tech lead persona with domain expertise.

**System prompt defines Alex as:**
- Senior tech lead and engineering manager at XBO
- Expertise: AI/ML, Backend (Python, FastAPI), Frontend (Next.js, React), DevOps
- Direct, opinionated, provides concrete code snippets
- When ticket context provided: answers factually from context

**Features:**
- Streaming responses via SSE (Server-Sent Events)
- Conversation history (in-memory, max 40 messages / 20 turns)
- Ticket context injection (passes current ticket data to Claude)
- Per-user, per-conversation isolation

**Frontend:** `AssistantDrawer` component — floating side panel accessible from any page. Can inject current ticket context for relevant answers.

## Architecture

```
Frontend                          Backend                          Claude API
  │                                 │                                │
  │  Click "Generate subtasks"      │                                │
  ├────────────────────────────────▶│                                │
  │                                 │  _require_ai_enabled()         │
  │                                 │  Check AI_ENABLED flag         │
  │                                 │                                │
  │                                 │  _build_ticket_prompt()        │
  │                                 │  XML-wrapped ticket data       │
  │                                 │                                │
  │                                 │  AsyncAnthropic.messages.create│
  │                                 ├───────────────────────────────▶│
  │                                 │                                │
  │                                 │  Streaming response            │
  │                                 │◀───────────────────────────────┤
  │                                 │                                │
  │                                 │  Parse structured output       │
  │  Return subtask list            │                                │
  │◀────────────────────────────────┤                                │
  │                                 │                                │
  │  Display for user review        │                                │
```

## Error Handling

| Scenario | HTTP Code | Frontend Behavior |
|----------|-----------|-------------------|
| AI disabled | 503 | Buttons hidden/disabled |
| Rate limited | 429 | Error toast, retry later |
| API error | 500+ | Error toast with message |
| Invalid API key | 401 | Error toast |
| Timeout (60s) | 504 | Error toast |

## Cost Management

- **Default model:** `claude-haiku-4-5` (fastest, cheapest)
- **Feature flag:** AI completely off in dev (zero API calls)
- **Timeout:** 60s max per request (prevents runaway costs)
- **Max retries:** 2 (for transient errors only)
- **Context limits:** 8,000 chars for attachment text in prompts

## Frontend Hooks

### `useAiEnabled()`
```typescript
// Reads ai_enabled from GET /api/config
// staleTime: 300_000 (5 min cache)
// Returns: boolean
const aiEnabled = useAiEnabled();
```

Used to conditionally render AI buttons and features across the application.

## Supported File Types for AI Context

| Type | MIME | Extraction Method |
|------|------|-------------------|
| PDF | `application/pdf` | pypdf.PdfReader |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | python-docx |
| TXT | `text/plain` | UTF-8 decode |
| Markdown | `text/markdown`, `text/x-markdown` | UTF-8 decode |
