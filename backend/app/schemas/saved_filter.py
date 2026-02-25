import uuid
from datetime import datetime
from pydantic import BaseModel


class SavedFilterCreate(BaseModel):
    name: str
    filter_state: dict


class SavedFilterOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    filter_state: dict
    created_at: datetime
    model_config = {"from_attributes": True}
