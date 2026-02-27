import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    actor_id: uuid.UUID | None
    ticket_id: uuid.UUID | None
    type: str
    message: str
    read: bool
    created_at: datetime
