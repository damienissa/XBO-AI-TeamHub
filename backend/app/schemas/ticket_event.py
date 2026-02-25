import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TicketEventOut(BaseModel):
    """Schema for ticket event log entries."""
    id: uuid.UUID
    ticket_id: uuid.UUID
    event_type: str
    payload: dict
    actor_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
