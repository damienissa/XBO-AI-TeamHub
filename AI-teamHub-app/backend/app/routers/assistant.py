"""AI Assistant — streaming chat with per-user conversation memory."""

import json
import logging
import uuid
from collections import defaultdict
from typing import Annotated, AsyncIterator

from anthropic import AsyncAnthropic, APIConnectionError, APIStatusError, RateLimitError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.assistant import ChatRequest

router = APIRouter(prefix="/assistant", tags=["assistant"])

# Per-user conversation store: user_id -> conv_id -> message list
_store: dict[str, dict[str, list[dict]]] = defaultdict(dict)
MAX_HISTORY = 40  # 20 turns
MAX_CONVERSATIONS_PER_USER = 20

SYSTEM_PROMPT = """You are Alex, a senior tech lead and engineering manager at XBO — a fintech company building AI Hub, an internal project management platform.

You have 15+ years of hands-on experience and deep expertise in:
- **AI/ML**: Claude API (streaming, tool use, prompt engineering, RAG, agent design), LLM product development
- **Backend**: Python, FastAPI, SQLAlchemy 2.0 async, PostgreSQL, Alembic, JWT auth, REST API design
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Radix UI, React Query v5, dnd-kit, Tiptap
- **DevOps**: Docker, docker-compose, CI/CD, PostgreSQL tuning, container security, monitoring

The AI Hub stack you work on daily:
- Backend: FastAPI + SQLAlchemy 2.0 async + PostgreSQL, httpOnly JWT cookies (access 8h, refresh 30d), Alembic migrations
- Frontend: Next.js 14 App Router, React Query for all server state, Radix UI primitives, Tailwind CSS
- Design: Notion-inspired light theme (#37352F text, #2383E2 blue accent, #F7F7F5 sidebar, DM Sans font)
- Infrastructure: Docker Compose (postgres:5432, backend:8000, frontend:3000)
- Key files: backend/app/routers/, backend/app/models/, frontend/src/app/(app)/board/_components/

## CRITICAL — When ticket context is provided

Answer factual questions DIRECTLY from the ticket data. Do not ask for more info, do not say data is missing, do not flag red flags unless specifically asked.

Examples:
- "who do I need to contact?" → list the contact persons (name, email, type) from the context immediately
- "what is the effort?" → state the effort_estimate value directly (e.g. "200 hours / 25 days")
- "who owns this?" → state the owner from the context
- "what's the priority?" → state priority and urgency from the context
- "when is it due?" → state the due_date from the context

Only raise concerns, red flags, or analysis if:
1. The user explicitly asks for analysis/review
2. The field they asked about is genuinely not set (null/missing)

Your style:
- Direct and opinionated — give your best recommendation, skip the hedging
- Always concrete: code snippets, exact file paths, specific commands
- No long preambles — get straight to the answer
- Lead with the direct answer, then optionally add context"""


def _get_client() -> AsyncAnthropic:
    from app.routers.ai import get_ai_client, _require_ai_enabled
    _require_ai_enabled()
    return get_ai_client()


def _inject_context(req: ChatRequest) -> str:
    """Prepend full ticket context block to the user message when provided."""
    if not req.ticket_context:
        return req.message
    ctx = req.ticket_context
    parts = [f"[TICKET CONTEXT — {ctx.get('title', '?')}]"]

    # Identity & scheduling
    for key, label in [
        ("id", "Ticket ID"),
        ("status", "Status"),
        ("department", "Department"),
        ("owner", "Owner"),
        ("owner_email", "Owner email"),
        ("priority", "Priority"),
        ("urgency", "Urgency (1–5)"),
        ("due_date", "Due date"),
        ("effort_estimate", "Effort estimate (hours)"),
        ("time_in_column", "Time in current column"),
        ("created_at", "Created at"),
        ("updated_at", "Last updated"),
        ("blocked_by_count", "Blocked by (# tickets)"),
        ("wiki_page_id", "Wiki page ID"),
    ]:
        val = ctx.get(key)
        if val is not None:
            parts.append(f"{label}: {val}")

    # Contacts
    contacts = ctx.get("contacts")
    if contacts:
        contact_lines = []
        for c in contacts:
            line = f"  - {c.get('name', '?')}"
            if c.get("email"):
                line += f" <{c['email']}>"
            line += f" [{c.get('type', 'unknown')}]"
            contact_lines.append(line)
        parts.append("Contact persons:\n" + "\n".join(contact_lines))

    # Subtasks
    total = ctx.get("subtasks_total")
    done = ctx.get("subtasks_done")
    if total is not None:
        parts.append(f"Subtasks: {done}/{total} completed")

    # Content fields
    for key, label in [
        ("problem_statement", "Problem statement"),
        ("next_step", "Next step"),
        ("business_impact", "Business impact"),
        ("success_criteria", "Success criteria"),
    ]:
        val = ctx.get(key)
        if val:
            parts.append(f"{label}: {str(val)[:600]}")

    # ROI inputs
    roi_inputs = []
    for key, label in [
        ("current_time_cost_hours_per_week", "Time cost (hrs/week)"),
        ("employees_affected", "Employees affected"),
        ("avg_hourly_cost", "Avg hourly cost ($)"),
        ("current_error_rate", "Current error rate (%)"),
        ("revenue_blocked", "Revenue blocked ($)"),
    ]:
        val = ctx.get(key)
        if val is not None:
            roi_inputs.append(f"  {label}: {val}")
    if roi_inputs:
        parts.append("ROI inputs:\n" + "\n".join(roi_inputs))

    # ROI computed outputs
    roi_outputs = []
    for key, label in [
        ("weekly_cost", "Weekly cost ($)"),
        ("yearly_cost", "Yearly cost ($)"),
        ("annual_savings", "Annual savings ($)"),
        ("dev_cost", "Dev cost ($)"),
        ("roi", "ROI (%)"),
    ]:
        val = ctx.get(key)
        if val is not None:
            roi_outputs.append(f"  {label}: {val}")
    if roi_outputs:
        parts.append("ROI computed:\n" + "\n".join(roi_outputs))

    # Custom fields
    custom = ctx.get("custom_field_values")
    if custom:
        parts.append(f"Custom fields: {json.dumps(custom)[:300]}")

    return "\n".join(parts) + "\n\n---\n\n" + req.message


async def _stream(
    client: AsyncAnthropic,
    messages: list[dict],
    history: list[dict],
) -> AsyncIterator[str]:
    full: list[str] = []
    try:
        async with client.messages.stream(
            model=settings.AI_MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                full.append(text)
                yield f"data: {json.dumps({'text': text})}\n\n"
    except (RateLimitError, APIConnectionError, APIStatusError) as e:
        logger.exception("AI assistant stream error: %s", getattr(e, "message", str(e)))
        yield f"data: {json.dumps({'error': 'AI service temporarily unavailable. Please try again.'})}\n\n"
        return
    history.append({"role": "assistant", "content": "".join(full)})
    yield "data: [DONE]\n\n"


@router.post("/chat")
@limiter.limit("30/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    client = _get_client()
    uid = str(current_user.id)
    conv_id = req.conversation_id or str(uuid.uuid4())

    if conv_id not in _store[uid]:
        # Evict oldest conversation if at capacity
        user_convs = _store[uid]
        if len(user_convs) >= MAX_CONVERSATIONS_PER_USER:
            oldest_key = next(iter(user_convs))
            del user_convs[oldest_key]
        _store[uid][conv_id] = []
    history = _store[uid][conv_id]

    history.append({"role": "user", "content": _inject_context(req)})
    if len(history) > MAX_HISTORY:
        history[:] = history[-MAX_HISTORY:]

    messages = list(history)

    async def generate():
        async for chunk in _stream(client, messages, history):
            yield chunk
        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/chat/{conversation_id}")
async def clear(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    _store[str(current_user.id)].pop(conversation_id, None)
    return {"cleared": True}
