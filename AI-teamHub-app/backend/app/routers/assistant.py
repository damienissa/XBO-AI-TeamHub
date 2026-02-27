"""AI Assistant — streaming chat with per-user conversation memory."""

import json
import uuid
from collections import defaultdict
from typing import Annotated, AsyncIterator

from anthropic import AsyncAnthropic, APIConnectionError, APIStatusError, RateLimitError
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.assistant import ChatRequest

router = APIRouter(prefix="/assistant", tags=["assistant"])

# Per-user conversation store: user_id -> conv_id -> message list
_store: dict[str, dict[str, list[dict]]] = defaultdict(dict)
MAX_HISTORY = 40  # 20 turns

SYSTEM_PROMPT = """You are Alex, a senior tech lead and engineering manager at XBO — a fintech company building XBO TeamHub, an internal project management platform.

You have 15+ years of hands-on experience and deep expertise in:
- **AI/ML**: Claude API (streaming, tool use, prompt engineering, RAG, agent design), LLM product development
- **Backend**: Python, FastAPI, SQLAlchemy 2.0 async, PostgreSQL, Alembic, JWT auth, REST API design
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Radix UI, React Query v5, dnd-kit, Tiptap
- **DevOps**: Docker, docker-compose, CI/CD, PostgreSQL tuning, container security, monitoring

The XBO TeamHub stack you work on daily:
- Backend: FastAPI + SQLAlchemy 2.0 async + PostgreSQL, httpOnly JWT cookies (access 8h, refresh 30d), Alembic migrations
- Frontend: Next.js 14 App Router, React Query for all server state, Radix UI primitives, Tailwind CSS
- Design: Notion-inspired light theme (#37352F text, #2383E2 blue accent, #F7F7F5 sidebar, DM Sans font)
- Infrastructure: Docker Compose (postgres:5432, backend:8000, frontend:3000)
- Key files: backend/app/routers/, backend/app/models/, frontend/src/app/(app)/board/_components/

Your style:
- Direct and opinionated — give your best recommendation, skip the hedging
- Always concrete: code snippets, exact file paths, specific commands
- Brief "why" before the "what"
- When given a ticket, think like a tech lead: spot ambiguities, decompose tasks, flag risks
- No long preambles — get straight to the answer"""


def _get_client() -> AsyncAnthropic:
    if not settings.AI_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not enabled on this server.",
        )
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)


def _inject_context(req: ChatRequest) -> str:
    """Prepend ticket context block to the user message when provided."""
    if not req.ticket_context:
        return req.message
    ctx = req.ticket_context
    lines = [f"[Ticket context: {ctx.get('title', '?')}]"]
    for key, label in (
        ("status", "Status"),
        ("department", "Department"),
        ("urgency", "Urgency"),
        ("problem_statement", "Problem"),
        ("business_impact", "Business impact"),
        ("success_criteria", "Success criteria"),
    ):
        val = ctx.get(key)
        if val:
            lines.append(f"{label}: {str(val)[:400]}")
    if ctx.get("subtasks"):
        lines.append(f"Subtasks: {', '.join(ctx['subtasks'][:10])}")
    return "\n".join(lines) + "\n\n---\n\n" + req.message


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
        yield f"data: {json.dumps({'error': getattr(e, 'message', str(e))})}\n\n"
        return
    history.append({"role": "assistant", "content": "".join(full)})
    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    client = _get_client()
    uid = str(current_user.id)
    conv_id = req.conversation_id or str(uuid.uuid4())

    if conv_id not in _store[uid]:
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
