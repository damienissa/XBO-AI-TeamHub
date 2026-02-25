import json
from typing import Annotated

from anthropic import AsyncAnthropic, APIConnectionError, APIStatusError, RateLimitError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_subtask import TicketSubtask
from app.models.ticket_comment import TicketComment
from app.models.ticket_event import TicketEvent
from app.models.user import User
from app.schemas.ai import (
    EffortRequest, EffortResponse,
    SubtaskRequest, SubtaskResponse,
    SummaryRequest, SummaryResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])

# Module-level singleton — reuses httpx connection pool (RESEARCH.md Pattern 1)
_ai_client: AsyncAnthropic | None = None


def get_ai_client() -> AsyncAnthropic:
    global _ai_client
    if _ai_client is None:
        _ai_client = AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            timeout=60.0,    # override 10-min default (RESEARCH.md Pitfall 2)
            max_retries=2,   # default — auto-retries 429, >=500
        )
    return _ai_client


def _require_ai_enabled() -> None:
    """Raises 503 if AI_ENABLED is false. Call at top of every AI route."""
    if not settings.AI_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not enabled on this server",
        )


def _extract_text_from_tiptap(node: dict | None) -> str:
    """Recursively extract plain text from a Tiptap JSON document node."""
    if not node:
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    parts = []
    for child in node.get("content", []):
        parts.append(_extract_text_from_tiptap(child))
    return " ".join(p for p in parts if p).strip()


def _build_ticket_prompt(req: SubtaskRequest | EffortRequest) -> str:
    parts = [f"Title: {req.title}"]
    if req.problem_statement:
        parts.append(f"Problem Statement: {req.problem_statement}")
    if req.business_impact:
        parts.append(f"Business Impact: {req.business_impact}")
    if req.success_criteria:
        parts.append(f"Success Criteria: {req.success_criteria}")
    if req.urgency:
        parts.append(f"Urgency (1-5): {req.urgency}")
    if req.existing_subtasks:
        parts.append(f"Existing Subtasks: {', '.join(req.existing_subtasks)}")
    if req.custom_fields:
        parts.append(f"Custom Fields: {json.dumps(req.custom_fields)}")
    return "\n".join(parts)


async def _call_claude(prompt: str, system: str, output_config: dict, max_tokens: int) -> str:
    """Shared Claude API call with unified error handling."""
    try:
        response = await get_ai_client().messages.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            **output_config,
        )
        return response.content[0].text
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily rate-limited. Please try again in a moment.",
        )
    except APIConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to AI service. Please try again.",
        )
    except APIStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {e.message}",
        )


@router.post("/subtasks", response_model=SubtaskResponse)
async def generate_subtasks(
    req: SubtaskRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubtaskResponse:
    """AI-01: Generate a proposed subtask list from ticket context."""
    _require_ai_enabled()
    prompt = _build_ticket_prompt(req)
    system = (
        "You are a project management assistant for an AI development team. "
        "Generate a concise, actionable subtask list for the given ticket. "
        "Return 3-10 subtasks as short imperative sentences (e.g. 'Write unit tests for X'). "
        "Do not include numbering or bullet prefixes -- plain strings only."
    )
    output_config = {
        "output_config": {
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
    }
    raw = await _call_claude(prompt, system, output_config, max_tokens=1024)
    parsed = json.loads(raw)
    return SubtaskResponse(subtasks=parsed["subtasks"])


@router.post("/effort_estimate", response_model=EffortResponse)
async def estimate_effort(
    req: EffortRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> EffortResponse:
    """AI-02: Estimate effort hours from ticket context."""
    _require_ai_enabled()
    prompt = _build_ticket_prompt(req)
    system = (
        "You are a project management assistant for an AI development team. "
        "Estimate the total development effort in hours for the given ticket. "
        "Consider the complexity, scope, and any subtasks mentioned. "
        "Return only a number -- no explanation, no units, just the numeric value."
    )
    output_config = {
        "output_config": {
            "format": {
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "hours": {"type": "number"}
                    },
                    "required": ["hours"],
                    "additionalProperties": False,
                }
            }
        }
    }
    raw = await _call_claude(prompt, system, output_config, max_tokens=64)
    parsed = json.loads(raw)
    return EffortResponse(hours=parsed["hours"])


@router.post("/summary", response_model=SummaryResponse)
async def summarize_ticket(
    req: SummaryRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> SummaryResponse:
    """AI-03: Generate a progress summary for a ticket, reading comments/subtasks/events from DB."""
    _require_ai_enabled()

    # Load ticket (needed for title/status)
    ticket = await db.get(Ticket, req.ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Load comments
    comments_result = await db.execute(
        select(TicketComment).where(TicketComment.ticket_id == req.ticket_id).order_by(TicketComment.created_at)
    )
    comments = comments_result.scalars().all()

    # Load subtasks
    subtasks_result = await db.execute(
        select(TicketSubtask).where(TicketSubtask.ticket_id == req.ticket_id).order_by(TicketSubtask.position)
    )
    subtasks = subtasks_result.scalars().all()

    # Load recent events (last 20)
    events_result = await db.execute(
        select(TicketEvent).where(TicketEvent.ticket_id == req.ticket_id).order_by(TicketEvent.created_at.desc()).limit(20)
    )
    events = events_result.scalars().all()

    # Build prompt context
    title_text = ticket.title
    problem_text = _extract_text_from_tiptap(ticket.problem_statement) if isinstance(ticket.problem_statement, dict) else ""
    comments_text = "\n".join(f"- {c.body}" for c in comments) if comments else "No comments."
    subtasks_done = sum(1 for s in subtasks if s.done)
    subtasks_text = f"{subtasks_done}/{len(subtasks)} subtasks complete" if subtasks else "No subtasks."
    events_text = "\n".join(f"- [{e.event_type}] {e.created_at.date()}" for e in reversed(events)) if events else "No events."

    prompt = (
        f"Ticket: {title_text}\n"
        f"Status: {ticket.status_column}\n"
        f"Problem: {problem_text}\n\n"
        f"Comments:\n{comments_text}\n\n"
        f"Subtasks: {subtasks_text}\n\n"
        f"Recent Activity:\n{events_text}"
    )
    system = (
        "You are a project management assistant. Summarize the current state of this ticket "
        "in 2-4 concise sentences covering: what has been done, what is pending, and any blockers. "
        "Write in plain English suitable for a team status update."
    )

    # Plain text -- no structured output needed for summary
    raw = await _call_claude(prompt, system, {}, max_tokens=512)
    return SummaryResponse(summary=raw.strip())
