import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.ticket import Priority, StatusColumn
from app.schemas.auth import UserOut
from app.schemas.department import DepartmentOut


class TicketCreate(BaseModel):
    """Schema for creating a new ticket. owner_id is never accepted at creation time — always null."""
    title: str
    department_id: uuid.UUID
    problem_statement: Optional[dict] = None
    urgency: Optional[int] = None
    business_impact: Optional[str] = None
    success_criteria: Optional[str] = None
    due_date: Optional[date] = None
    effort_estimate: Optional[float] = None
    next_step: Optional[str] = None
    priority: Optional[Priority] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("title must be at least 1 character")
        if len(v) > 500:
            raise ValueError("title must be at most 500 characters")
        return v


class TicketUpdate(BaseModel):
    """Schema for partial updates. All fields optional. owner_id can be set for inline assignment."""
    title: Optional[str] = None
    problem_statement: Optional[dict] = None
    urgency: Optional[int] = None
    business_impact: Optional[str] = None
    success_criteria: Optional[str] = None
    due_date: Optional[date] = None
    effort_estimate: Optional[float] = None
    next_step: Optional[str] = None
    priority: Optional[Priority] = None
    owner_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class TicketMoveRequest(BaseModel):
    """Schema for moving a ticket to a new column."""
    target_column: StatusColumn
    owner_id: Optional[uuid.UUID] = None


class TicketOut(BaseModel):
    """Full ticket response with eagerly loaded owner and department."""
    id: uuid.UUID
    title: str
    problem_statement: Optional[dict] = None
    urgency: Optional[int] = None
    business_impact: Optional[str] = None
    success_criteria: Optional[str] = None
    due_date: Optional[date] = None
    effort_estimate: Optional[float] = None
    next_step: Optional[str] = None
    priority: Optional[Priority] = None
    status_column: StatusColumn
    department_id: uuid.UUID
    owner_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserOut] = None
    department: Optional[DepartmentOut] = None
    time_in_column: Optional[str] = None
    # Subtask counts — computed by board endpoint via subquery (Pitfall 3 avoidance)
    subtasks_total: int = 0
    subtasks_done: int = 0

    model_config = ConfigDict(from_attributes=True)


# Board endpoint uses same serialization as TicketOut
BoardTicketOut = TicketOut
