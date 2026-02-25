import uuid
from datetime import datetime
from pydantic import BaseModel


class WikiPageCreate(BaseModel):
    title: str
    content: dict | None = None
    parent_id: uuid.UUID | None = None


class WikiPageUpdate(BaseModel):
    title: str | None = None
    content: dict | None = None
    parent_id: uuid.UUID | None = None


class WikiPageOut(BaseModel):
    id: uuid.UUID
    title: str
    content: dict | None
    parent_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
