import uuid
from datetime import date, datetime
from pydantic import BaseModel


class SprintCreate(BaseModel):
    name: str
    start_date: date | None = None
    end_date: date | None = None


class SprintUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date | None
    end_date: date | None
    created_by: uuid.UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class VelocityOut(BaseModel):
    effort_completed: float
    effort_total: float
    pct: float


class SprintBoardOut(BaseModel):
    sprint: SprintOut
    tickets: list  # list[TicketOut] — use list to avoid circular import
    velocity: VelocityOut
