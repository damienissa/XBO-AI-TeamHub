import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class CustomFieldDefCreate(BaseModel):
    name: str
    field_type: Literal["text", "number", "date"]
    scope: Literal["workspace", "personal"]


class CustomFieldDefOut(BaseModel):
    id: uuid.UUID
    name: str
    field_type: str
    scope: str
    owner_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}
