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

    # ROI fields — accepted at creation time so portal can submit them in one request
    current_time_cost_hours_per_week: Optional[float] = None
    employees_affected: Optional[float] = None
    avg_hourly_cost: Optional[float] = None

    model_config = ConfigDict(extra="ignore")

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

    # Phase 4 ROI input fields (ROI-01)
    current_time_cost_hours_per_week: Optional[float] = None
    employees_affected: Optional[float] = None
    avg_hourly_cost: Optional[float] = None
    current_error_rate: Optional[float] = None
    revenue_blocked: Optional[float] = None

    # Phase 5 fields (WIKI-05, ADV-02)
    wiki_page_id: Optional[uuid.UUID] = None
    custom_field_values: Optional[dict] = None

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

    # Phase 4 ROI input fields (ROI-01)
    current_time_cost_hours_per_week: Optional[float] = None
    employees_affected: Optional[float] = None
    avg_hourly_cost: Optional[float] = None
    current_error_rate: Optional[float] = None
    revenue_blocked: Optional[float] = None

    # Phase 4 computed/persisted ROI output fields (ROI-02)
    weekly_cost: Optional[float] = None
    yearly_cost: Optional[float] = None
    annual_savings: Optional[float] = None
    dev_cost: Optional[float] = None
    roi: Optional[float] = None

    # Phase 5 fields (WIKI-05, ADV-02)
    wiki_page_id: Optional[uuid.UUID] = None
    custom_field_values: Optional[dict] = None

    # Phase 5 dependency badge (ADV-04) — computed by board endpoint via batch count query
    blocked_by_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# Board endpoint uses same serialization as TicketOut
BoardTicketOut = TicketOut
