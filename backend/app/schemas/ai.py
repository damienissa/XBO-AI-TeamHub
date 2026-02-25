from typing import Any

from pydantic import BaseModel, field_validator


def _tiptap_to_text(node: Any) -> str:
    """Extract plain text from a Tiptap JSON document node."""
    if not isinstance(node, dict):
        return str(node) if node else ""
    if node.get("type") == "text":
        return node.get("text", "")
    parts = [_tiptap_to_text(child) for child in node.get("content", [])]
    return " ".join(p for p in parts if p).strip()


class TicketContext(BaseModel):
    title: str
    problem_statement: str | None = None
    business_impact: str | None = None
    success_criteria: str | None = None
    urgency: int | None = None
    existing_subtasks: list[str] = []
    custom_fields: dict | None = None

    @field_validator("problem_statement", mode="before")
    @classmethod
    def coerce_tiptap(cls, v: Any) -> str | None:
        """Accept Tiptap JSON objects from the frontend and extract plain text."""
        if isinstance(v, dict):
            return _tiptap_to_text(v) or None
        return v


class SubtaskRequest(TicketContext):
    pass


class SubtaskResponse(BaseModel):
    subtasks: list[str]


class EffortRequest(TicketContext):
    pass


class EffortResponse(BaseModel):
    hours: float


class SummaryRequest(BaseModel):
    ticket_id: str  # UUID as string — backend reads from DB


class SummaryResponse(BaseModel):
    summary: str
