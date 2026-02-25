from pydantic import BaseModel


class TicketContext(BaseModel):
    title: str
    problem_statement: str | None = None   # plain text extracted from Tiptap JSON by caller
    business_impact: str | None = None
    success_criteria: str | None = None
    urgency: int | None = None
    existing_subtasks: list[str] = []
    custom_fields: dict | None = None


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
