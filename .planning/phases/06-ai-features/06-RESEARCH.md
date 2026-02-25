# Phase 6: AI Features - Research

**Researched:** 2026-02-25
**Domain:** Anthropic Claude API (Python SDK) + FastAPI AI router + React mutation + feature flag pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subtask generation flow**
- Generated subtasks appear in a modal with an editable list before saving
- Modal shows fully editable text fields — user can modify text, delete items, or add new ones
- If ticket already has subtasks, AI subtasks are **appended** (not replaced)
- AI uses full ticket context: title, description, comments, subtasks, and custom fields

**Feature flag UX**
- When `AI_ENABLED=false`: AI buttons are **hidden entirely** — do not appear in the UI
- Frontend reads the flag from a backend config endpoint (e.g. `GET /api/config`) — not a baked-in env var
- On AI request failure: toast notification with a short error message; button returns to normal state
- Loading state: button shows spinner and is disabled while request is in flight

**Effort estimate interaction**
- "Estimate effort with AI" button sits **next to the effort hours field** on the ticket creation form
- If the field already has a value: AI suggestion appears below the field with a "Use this" / replace action
- If field is empty: AI result fills the field directly
- Returns a **number only** — no confidence level or rationale
- AI uses full ticket context (same as subtask generation): title, description, comments, subtasks, custom fields

**Summary panel placement**
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

### Deferred Ideas (OUT OF SCOPE)
- **PRD import on ticket creation** — Upload a PRD document when creating a ticket; system auto-fills title, description, and other fields from the document, then uses it as context for AI subtask generation and effort estimation. Capture for roadmap backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | `POST /api/ai/subtasks` — accepts ticket fields, returns proposed subtask list; 503 if AI_ENABLED=false | Anthropic SDK `AsyncAnthropic.messages.create()` + `output_config.format` structured JSON; 503 guard pattern via `settings.AI_ENABLED` check at route entry |
| AI-02 | `POST /api/ai/effort_estimate` — accepts ticket fields, returns estimated effort hours; 503 if AI_ENABLED=false | Same SDK pattern; `output_config` JSON schema returning `{"hours": number}` object |
| AI-03 | `POST /api/ai/summary` — accepts ticket_id, reads comments + subtasks + events, returns progress summary text; 503 if AI_ENABLED=false | Requires DB read of comments/subtasks/events before calling Claude; returns plain text (no structured output needed) |
| AI-04 | Ticket detail has "Generate subtasks with AI" button (calls AI-01, populates subtask list for review) | `useMutation` calling `POST /api/ai/subtasks`; modal with editable list using local React state before `POST /api/tickets/{id}/subtasks` |
| AI-05 | Ticket creation form has "Estimate effort with AI" button (calls AI-02, pre-fills effort field) | `useMutation` calling `POST /api/ai/effort_estimate`; react-hook-form `setValue("effort_estimate", n)` or hint-display-then-replace pattern |
| AI-06 | Ticket detail has "Summarize progress" button (calls AI-03, shows summary in a panel) | Collapsible section in `TicketDetailModal.tsx`; local `useState` for summary text; no caching |
| AI-07 | All AI buttons show loading state; errors show a user-visible message (never silently fail) | `isPending` from `useMutation` → spinner + disabled; `onError` → `useToast` destructive toast |
</phase_requirements>

---

## Summary

Phase 6 adds three AI-assisted capabilities to an existing FastAPI + Next.js 14 application using the Anthropic Python SDK. The backend already has a clean router pattern (`app/routers/`), async SQLAlchemy via `AsyncSession`, the `get_current_user` dependency, and a `settings` object from pydantic-settings. The frontend already has `useMutation` from TanStack Query, `useToast` from shadcn, and a working fetch pattern with `credentials: "include"`.

The primary technical unknowns were: (1) the current Anthropic SDK structured output API shape, and (2) the correct async client pattern. Both are now confirmed: the SDK is `anthropic>=0.84.0`, uses `AsyncAnthropic`, and the structured output feature is GA via the `output_config.format` parameter on `messages.create()` — no beta headers required. The `/api/config` endpoint already exists and returns the hourly rate; it must be extended to also return `ai_enabled: bool` so the frontend can hide/show AI buttons without baking env vars into the build.

The three AI endpoints are stateless reads on the backend: subtasks and effort estimation receive ticket fields in the POST body (no DB read needed for AI-01/AI-02), while summary (AI-03) must read comments, subtasks, and events from the DB before calling Claude. No new DB migrations are required — AI results are never persisted.

**Primary recommendation:** Add `anthropic>=0.50` to `requirements.txt`, add `AI_ENABLED` and `ANTHROPIC_API_KEY` to `Settings`, create `app/routers/ai.py` with three routes sharing a module-level `AsyncAnthropic` client, extend `/api/config` to include `ai_enabled`, and add a `useAiEnabled` hook on the frontend that reads from the config query.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` (Python) | `>=0.50` (latest 0.84.0) | Anthropic Claude API client | Official SDK; `AsyncAnthropic` is drop-in with FastAPI's async model |
| `AsyncAnthropic` | (part of SDK) | Async Claude API client for FastAPI | FastAPI is async-first; synchronous `Anthropic` client blocks the event loop |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pydantic-settings` | already installed | Adds `AI_ENABLED: bool` and `ANTHROPIC_API_KEY: str` to `Settings` | Read from `.env`; already used by `config.py` |
| `useMutation` (TanStack Query) | already installed `^5.90` | Fire-and-forget AI calls from components | All three AI buttons use mutation (not query) — result is ephemeral, not cached |
| `useToast` (shadcn) | already installed | Error toast on AI failure | Already used in Phase 5 for BLOCKED errors; consistent pattern |
| `lucide-react` (`Loader2`) | already installed `^0.575` | Spinning loader icon for button loading state | Already used throughout app |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `output_config.format` (GA structured outputs) | Prompt engineering + `json.loads()` | Structured outputs guarantee schema compliance; prompt engineering can silently return invalid JSON |
| `useMutation` | `useQuery` with `enabled: false` / manual `refetch` | Mutation semantics are correct for user-triggered, side-effect actions; `useQuery` is for data fetching |
| Module-level `AsyncAnthropic()` singleton | Per-request instantiation | SDK re-uses httpx connection pool; creating client per request wastes connections |

**Installation:**
```bash
# Backend only — no new frontend packages needed
pip install anthropic
# or add to requirements.txt:
# anthropic>=0.50
```

---

## Architecture Patterns

### Recommended Project Structure

The AI router follows the exact same pattern as every other Phase 5 router:

```
backend/app/
├── routers/
│   ├── ai.py           # NEW — three AI endpoints + 503 guard
│   └── ... (existing)
├── schemas/
│   ├── ai.py           # NEW — request/response Pydantic models
│   └── ... (existing)
├── core/
│   └── config.py       # EXTEND — add AI_ENABLED, ANTHROPIC_API_KEY, AI_MODEL
└── main.py             # EXTEND — include ai_router; extend /api/config

frontend/src/
├── hooks/
│   └── useAiEnabled.ts   # NEW — reads ai_enabled from /api/config query
├── lib/api/
│   └── ai.ts             # NEW — fetch functions for 3 AI endpoints
└── app/(app)/board/_components/
    ├── TicketDetailModal.tsx   # EXTEND — add AI buttons + subtask modal + summary section
    ├── SubtaskAiModal.tsx      # NEW — editable subtask list before save
    └── AiSummarySection.tsx    # NEW — collapsible progress summary panel
```

The portal page (`/portal/[dept]/page.tsx`) also gets the effort estimate button:
```
frontend/src/app/(app)/portal/[dept]/page.tsx   # EXTEND — effort estimate button next to effort field
```

### Pattern 1: AI Router with Feature Flag Guard

```python
# Source: official Anthropic SDK docs + FastAPI patterns
# app/routers/ai.py

import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from anthropic import AsyncAnthropic, APIError
from app.core.config import settings
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ai import SubtaskRequest, SubtaskResponse, EffortRequest, EffortResponse, SummaryRequest, SummaryResponse

router = APIRouter(prefix="/ai", tags=["ai"])

# Module-level singleton — reuses httpx connection pool
_ai_client: AsyncAnthropic | None = None

def get_ai_client() -> AsyncAnthropic:
    global _ai_client
    if _ai_client is None:
        _ai_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _ai_client


def _require_ai_enabled() -> None:
    """Raises 503 if AI_ENABLED is false. Call at top of every AI route."""
    if not settings.AI_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not enabled on this server",
        )
```

### Pattern 2: Structured Output for Subtask Generation (GA API)

```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# Uses GA output_config.format — no beta headers needed

response = await get_ai_client().messages.create(
    model=settings.AI_MODEL,  # e.g. "claude-haiku-4-5"
    max_tokens=1024,
    system="You are a project management assistant. Generate a focused subtask list.",
    messages=[{"role": "user", "content": prompt}],
    output_config={
        "format": {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "subtasks": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "maxItems": 15,
                    }
                },
                "required": ["subtasks"],
                "additionalProperties": False,
            }
        }
    }
)
parsed = json.loads(response.content[0].text)
return SubtaskResponse(subtasks=parsed["subtasks"])
```

### Pattern 3: Structured Output for Effort Estimation

```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
response = await get_ai_client().messages.create(
    model=settings.AI_MODEL,
    max_tokens=64,
    system="Return only an effort estimate in hours as a number.",
    messages=[{"role": "user", "content": prompt}],
    output_config={
        "format": {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "hours": {"type": "number", "minimum": 0.5, "maximum": 10000}
                },
                "required": ["hours"],
                "additionalProperties": False,
            }
        }
    }
)
parsed = json.loads(response.content[0].text)
return EffortResponse(hours=parsed["hours"])
```

### Pattern 4: Summary Endpoint (Plain Text — No Structured Output)

```python
# Summary is free-form text — no structured output needed
# DB reads required: comments, subtasks, events
response = await get_ai_client().messages.create(
    model=settings.AI_MODEL,
    max_tokens=512,
    system="Summarize the current state of a ticket in 2–4 sentences.",
    messages=[{"role": "user", "content": prompt}]
)
return SummaryResponse(summary=response.content[0].text.strip())
```

### Pattern 5: Extending `/api/config` for Feature Flag

```python
# Source: app/main.py — already exists
@app.get("/api/config")
async def get_config() -> dict:
    return {
        "ai_team_hourly_rate": settings.AI_TEAM_HOURLY_RATE,
        "ai_enabled": settings.AI_ENABLED,  # ADD THIS
    }
```

### Pattern 6: Frontend `useAiEnabled` Hook

```typescript
// Source: pattern matches existing useQuery usage in hooks/useBoard.ts
// hooks/useAiEnabled.ts
"use client";
import { useQuery } from "@tanstack/react-query";

const API = process.env.NEXT_PUBLIC_API_URL;

interface AppConfig {
  ai_team_hourly_rate: number;
  ai_enabled: boolean;
}

async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API}/api/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export function useAiEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: 300_000, // 5 min — rarely changes
  });
  return data?.ai_enabled ?? false;
}
```

### Pattern 7: AI Mutation + Toast Error + Loading Button

```typescript
// Source: existing pattern in useMoveTicket.ts + CommentSection.tsx
"use client";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// In component:
const { toast } = useToast();
const aiMutation = useMutation({
  mutationFn: () => callAiEndpoint(ticketId),
  onError: (err) => {
    toast({
      title: "AI request failed",
      description: err instanceof Error ? err.message : "Please try again.",
      variant: "destructive",
    });
  },
});

// Button JSX:
<button
  onClick={() => aiMutation.mutate()}
  disabled={aiMutation.isPending}
  className="..."
>
  {aiMutation.isPending ? (
    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Generating...</>
  ) : (
    "Generate subtasks with AI"
  )}
</button>
```

### Pattern 8: Settings Extension (Backend)

```python
# app/core/config.py — extend existing Settings
class Settings(BaseSettings):
    # ... existing fields ...
    AI_ENABLED: bool = False                    # safe default — no API key needed in dev
    ANTHROPIC_API_KEY: str = ""                 # empty string when AI_ENABLED=false
    AI_MODEL: str = "claude-haiku-4-5"          # fastest/cheapest model; override via env
```

### Anti-Patterns to Avoid

- **Calling `AsyncAnthropic()` inside a route handler:** Creates a new httpx client per request. Use the module-level singleton pattern (Pattern 1).
- **Importing `AsyncAnthropic` at module top without `ANTHROPIC_API_KEY` check:** If `AI_ENABLED=false` and `ANTHROPIC_API_KEY=""`, the import itself is fine (SDK doesn't connect at import time), but calling `.create()` will raise `AuthenticationError`. Always guard with `_require_ai_enabled()` first.
- **Using `useQuery` instead of `useMutation` for AI buttons:** Queries run automatically on mount. AI calls must be user-triggered. Use `useMutation`.
- **Caching AI results in TanStack Query cache:** Summary is ephemeral by design. Don't set a `queryKey` for AI results or they'll be stale on re-open. Use local `useState` in the component.
- **Appending AI subtasks directly to DB without user review:** The flow is: AI result → editable modal → user confirms → `POST /api/tickets/{id}/subtasks` per item. Never auto-save without review.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema enforcement on AI responses | Custom regex/parsing + retry loop | `output_config.format` with `json_schema` | SDK + API enforces schema via constrained decoding; no retry needed |
| AI client lifecycle / connection pooling | Custom httpx session management | `AsyncAnthropic()` singleton | SDK manages httpx connection pool internally |
| Exponential backoff on rate limits | Custom retry decorator | SDK default (`max_retries=2`) | SDK auto-retries 429, 408, 409, >=500 with backoff |
| Effort estimate parsing (string → float) | Custom regex on free-text response | `output_config` returning `{"hours": number}` | Structured output guarantees a number; no parsing needed |

**Key insight:** The Anthropic SDK handles retries, timeout, connection pooling, and type enforcement. The only custom logic needed is: feature flag guard, prompt construction, and DB reads for the summary endpoint.

---

## Common Pitfalls

### Pitfall 1: `ANTHROPIC_API_KEY` Not Optional When AI_ENABLED=False
**What goes wrong:** pydantic-settings validates `ANTHROPIC_API_KEY: str` at startup. If the field has no default and the env var is missing, startup fails even when `AI_ENABLED=false`.
**Why it happens:** Pydantic validates all fields at initialization regardless of feature flags.
**How to avoid:** Set `ANTHROPIC_API_KEY: str = ""` as default so the app starts without the key. The `_require_ai_enabled()` guard at route entry prevents any actual API call.
**Warning signs:** `ValidationError` on `settings = Settings()` in Docker/CI environments without the key.

### Pitfall 2: SDK Default Timeout is 10 Minutes
**What goes wrong:** Claude requests for summarization or subtask generation may take 15–60 seconds. The SDK's default timeout is 10 minutes, which is acceptable for short AI calls but produces a hanging request if something goes wrong with a long context.
**Why it happens:** SDK default `timeout=600.0` seconds. FastAPI has no independent timeout on the endpoint.
**How to avoid:** Set a reasonable timeout on the `AsyncAnthropic` client: `AsyncAnthropic(api_key=..., timeout=60.0)`. This also limits user wait time.
**Warning signs:** AI button stays in spinner state indefinitely.

### Pitfall 3: Subtask Modal Loses State on Ticket Detail Re-render
**What goes wrong:** If `TicketDetailModal` re-renders (e.g., TanStack Query refetch fires) while the subtask modal is open, the modal's local `useState` list is discarded.
**Why it happens:** Modal state lives in `TicketDetailModal` which is controlled by a `?ticket=` query param — a full re-render on query invalidation resets child state.
**How to avoid:** Keep the subtask modal's editable list in local `useState` inside `SubtaskAiModal`. Lift the "open" boolean, not the subtask content, to the parent. Don't trigger board/ticket invalidation until the user confirms saves.
**Warning signs:** User edits subtask text in modal, board refetch fires, edits are gone.

### Pitfall 4: Effort Estimate Button in Portal Form Conflicts with react-hook-form Registration
**What goes wrong:** The effort field uses `{...register("effort_estimate", { valueAsNumber: true })}`. Calling `setValue` programmatically from the AI suggestion works, but if you render a separate hint element and use `field.onChange`, the form state may not update.
**Why it happens:** `register` returns `ref`/`onChange` handlers that must receive a DOM `ChangeEvent`. Direct `setValue` bypasses this.
**How to avoid:** Use `react-hook-form`'s `setValue("effort_estimate", hours, { shouldValidate: true })` from the AI result handler. This correctly updates form state and triggers validation.
**Warning signs:** Field shows AI value visually but form still has old value on submit.

### Pitfall 5: 503 Response Shape Must Match Frontend Error Handling
**What goes wrong:** The frontend's AI fetch functions throw an error on non-ok responses. If the 503 body is not JSON (e.g., plain text), `.json()` throws, and the error message shown to the user is "Failed to fetch" instead of "AI features not enabled."
**Why it happens:** FastAPI `HTTPException` serializes the detail as `{"detail": "..."}` — that's correct. But if something else returns a non-JSON 503 (e.g., a load balancer), `.json()` will fail.
**How to avoid:** In the fetch functions, always do `await res.json().catch(() => ({}))` before extracting `detail`, consistent with the existing pattern in `moveTicket` and the auth client.
**Warning signs:** Toast shows "AI request failed" with no description instead of the actual error text.

### Pitfall 6: Collapsible Summary Section Needs Controlled State, Not CSS-Only
**What goes wrong:** Using a `<details>` HTML element for the collapsible section works visually but loses the generated summary text when collapsed/expanded because the DOM subtree may be removed.
**Why it happens:** `<details>` toggling in React can unmount the content.
**How to avoid:** Use a `useState(false)` for `isOpen` and conditionally render with CSS visibility or a `{isOpen && <p>...</p>}` block. Keep the summary text in a separate `useState<string | null>(null)` that is independent of the open state.
**Warning signs:** User generates summary, collapses the section, re-opens, and finds empty content.

---

## Code Examples

Verified patterns from official sources:

### AsyncAnthropic client initialization
```python
# Source: https://platform.claude.com/docs/en/api/sdks/python
import os
from anthropic import AsyncAnthropic

client = AsyncAnthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
    timeout=60.0,  # override default 10 min; AI calls should complete in <60s
    max_retries=2,  # default — retries 429, >=500 automatically
)

message = await client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=1024,
    system="You are a project management assistant.",
    messages=[{"role": "user", "content": "Generate subtasks for: Build user auth"}],
)
print(message.content[0].text)
```

### Structured output for subtask list
```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# GA feature — no beta headers required as of late 2025
import json

response = await client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=1024,
    system="Generate a concise subtask list for the given ticket.",
    messages=[{"role": "user", "content": user_prompt}],
    output_config={
        "format": {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "subtasks": {
                        "type": "array",
                        "items": {"type": "string"},
                    }
                },
                "required": ["subtasks"],
                "additionalProperties": False,
            }
        }
    }
)
result = json.loads(response.content[0].text)
subtask_titles: list[str] = result["subtasks"]
```

### Error handling in FastAPI AI route
```python
# Source: https://platform.claude.com/docs/en/api/sdks/python
import anthropic
from fastapi import HTTPException, status

try:
    response = await get_ai_client().messages.create(...)
except anthropic.RateLimitError:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI service is temporarily rate-limited. Please try again in a moment.",
    )
except anthropic.APIConnectionError:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not connect to AI service. Please try again.",
    )
except anthropic.APIStatusError as e:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"AI service error: {e.message}",
    )
```

### react-hook-form setValue from AI result
```typescript
// Source: react-hook-form docs — setValue with shouldValidate
// In portal page component:
const { register, setValue, watch } = useForm<PortalFormValues>({ ... });

const effortMutation = useMutation({
  mutationFn: () => fetchEffortEstimate(watchedFields),
  onSuccess: (data) => {
    const currentEffort = watch("effort_estimate");
    if (!currentEffort) {
      // Field is empty — fill directly
      setValue("effort_estimate", data.hours, { shouldValidate: true });
    } else {
      // Field has value — show suggestion hint
      setAiSuggestion(data.hours);
    }
  },
  onError: (err) => {
    toast({ title: "Estimate failed", description: err.message, variant: "destructive" });
  },
});
```

### useToast destructive toast (existing pattern from Phase 5)
```typescript
// Source: existing pattern in Phase 5 useMoveTicket.ts
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

// In onError handler:
toast({
  title: "AI request failed",
  description: error instanceof Error ? error.message : "Please try again.",
  variant: "destructive",
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Beta header `structured-outputs-2025-11-13` + `output_format` param | GA `output_config.format` param (no beta header) | Late 2025 | Old approach still works in transition period but new code should use `output_config.format` |
| Synchronous `Anthropic` client in FastAPI | `AsyncAnthropic` client | SDK >=0.20 | Required for FastAPI async handlers — sync client blocks the event loop |
| Prompt engineering for JSON extraction + manual parsing | `output_config.format` with `json_schema` | 2025 | Eliminates parsing errors; schema guaranteed by constrained decoding |

**Deprecated/outdated:**
- Beta header `anthropic-beta: structured-outputs-2025-11-13`: Still works in transition but do not use for new code. Use `output_config.format` instead.
- `output_format` param (old beta API shape): Replaced by `output_config.format`.

---

## Project-Specific Integration Notes

### Backend: How AI Router Plugs In

The existing `main.py` includes all Phase 5 routers at module bottom. The AI router follows the same pattern:

```python
# main.py addition
from app.routers.ai import router as ai_router
app.include_router(ai_router, prefix="/api", tags=["ai"])
```

`/api/config` already exists as a bare function in `main.py`. It just needs `ai_enabled` added:
```python
@app.get("/api/config")
async def get_config() -> dict:
    return {
        "ai_team_hourly_rate": settings.AI_TEAM_HOURLY_RATE,
        "ai_enabled": settings.AI_ENABLED,  # NEW
    }
```

### Backend: Schemas Needed

Three request schemas and three response schemas in `app/schemas/ai.py`:

```python
from pydantic import BaseModel

# Shared ticket context (same for subtasks + effort)
class TicketContext(BaseModel):
    title: str
    problem_statement: str | None = None   # plain text extracted from Tiptap JSON
    business_impact: str | None = None
    success_criteria: str | None = None
    urgency: int | None = None
    existing_subtasks: list[str] = []
    custom_fields: dict | None = None

class SubtaskRequest(TicketContext): pass
class SubtaskResponse(BaseModel):
    subtasks: list[str]

class EffortRequest(TicketContext): pass
class EffortResponse(BaseModel):
    hours: float

class SummaryRequest(BaseModel):
    ticket_id: str  # UUID as string — route reads DB

class SummaryResponse(BaseModel):
    summary: str
```

**Note on `problem_statement`:** The Ticket model stores `problem_statement` as Tiptap JSONB. For AI context, extract plain text from the JSON on the backend before passing to the prompt. Do NOT pass raw JSON to Claude — it wastes tokens and confuses the prompt.

### Frontend: Where Buttons Live

1. **"Generate subtasks with AI"** — in `SubtaskSection` within `TicketDetailModal.tsx` (next to the "Subtasks" heading). Opens `SubtaskAiModal`.
2. **"Estimate effort with AI"** — in `/portal/[dept]/page.tsx` next to the effort hours `<Input>` field, inside the "Request Details" `<FormSection>`. Also visible in `TicketDetailModal.tsx` next to the "Effort (hours)" metadata field.
3. **"Summarize progress"** — new `<AiSummarySection>` component inserted in `TicketDetailContent` between `CustomFieldsSection` and "Activity Timeline" sections.

### Frontend: Config Query Caching

The existing `useQuery` for `/api/config` can be added to `useAiEnabled` with `staleTime: 300_000` (5 min). The portal page already queries departments with `staleTime: 300_000`, so this is consistent. The `queryKey: ["config"]` will not conflict with any existing keys.

### Frontend: Subtask Modal Flow

```
User clicks "Generate subtasks with AI"
  → aiMutation.mutate(ticketContext)
    → POST /api/ai/subtasks → { subtasks: string[] }
    → onSuccess: setModalSubtasks(data.subtasks); setModalOpen(true)

SubtaskAiModal opens with editable list:
  - Each item: <input value={title} onChange=.../>
  - "Delete" button per item
  - "Add item" button
  - "Save to ticket" button
    → for each title: POST /api/tickets/{id}/subtasks { title }
    → onAllSaved: setModalOpen(false); invalidate(["subtasks", ticketId])
```

---

## Open Questions

1. **Effort estimate button also on TicketDetailModal (not just portal form)?**
   - What we know: CONTEXT.md says the button is on the ticket creation form. AI-05 says "ticket creation form."
   - What's unclear: Whether "ticket creation form" includes the `TicketDetailModal` effort field (edit mode). The detail modal has a clickable effort field that enters edit mode inline.
   - Recommendation: Scope the AI estimate button to the portal form only (explicit in CONTEXT.md). The detail modal's effort field remains inline-edit only. This avoids scope creep.

2. **Tiptap JSON → plain text extraction for AI context**
   - What we know: `problem_statement` is stored as Tiptap JSONB. The AI prompt needs readable text, not `{"type":"doc","content":[...]}`.
   - What's unclear: Whether to extract text server-side (Python) or expect the frontend to send pre-extracted text in the request body.
   - Recommendation: Extract server-side. The backend already has the Ticket model with `problem_statement: dict | None`. Write a simple recursive text extractor: `def extract_text(node: dict) -> str` that walks Tiptap JSON and concatenates text nodes. This keeps the frontend schema clean — the request body for AI-03 just needs `ticket_id`.

3. **Model choice: which Claude model?**
   - What we know: `claude-haiku-4-5` is the fastest/cheapest Claude model supporting structured outputs. `claude-sonnet-4-6` is more capable but ~5x more expensive.
   - What's unclear: Whether subtask quality requires Sonnet or Haiku is sufficient.
   - Recommendation: Default to `claude-haiku-4-5` via `AI_MODEL` env var (overridable). Haiku is sufficient for list generation and effort estimation from structured prompts. Summary may benefit from Sonnet — make model configurable per endpoint type or use a single env var for simplicity.

---

## Sources

### Primary (HIGH confidence)
- `https://platform.claude.com/docs/en/api/sdks/python` — async client pattern, error types, timeout configuration, `AsyncAnthropic` usage
- `https://platform.claude.com/docs/en/build-with-claude/structured-outputs` — GA `output_config.format` API (no beta header), `json_schema` format, supported models
- `https://github.com/anthropics/anthropic-sdk-python` — current version (0.84.0), installation, requirements

### Secondary (MEDIUM confidence)
- Project codebase inspection — `main.py`, `config.py`, `requirements.txt`, `TicketDetailModal.tsx`, `SubtaskSection.tsx`, `portal/[dept]/page.tsx`, `use-toast.ts`, `providers.tsx` — confirmed existing patterns, dependencies, and integration points

### Tertiary (LOW confidence)
- None — all claims verified against official docs or project source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Anthropic SDK version and async pattern confirmed from official docs and GitHub
- Architecture: HIGH — Router/schema pattern confirmed by reading all existing Phase 5 routers; integration points confirmed by reading TicketDetailModal and portal page source
- Pitfalls: MEDIUM-HIGH — Feature flag and SDK pitfalls confirmed by official docs; modal state pitfall inferred from React patterns (verified against existing Phase 2/3 DndContext patterns in project)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (Anthropic API is fast-moving; verify structured outputs API shape if planning is delayed >30 days)
