import uuid
from pydantic import BaseModel


class DependencyCreate(BaseModel):
    blocking_ticket_id: uuid.UUID  # the ticket that blocks the target ticket


class DependencyOut(BaseModel):
    id: uuid.UUID
    title: str
    status_column: str
    model_config = {"from_attributes": True}


class DependenciesOut(BaseModel):
    blocks: list[DependencyOut]      # tickets this ticket blocks
    blocked_by: list[DependencyOut]  # tickets that block this ticket
