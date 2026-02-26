import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TemplateCreate(BaseModel):
    title: str
    problem_statement: Optional[dict] = None
    default_urgency: Optional[int] = None
    default_effort_estimate: Optional[float] = None
    default_next_step: Optional[str] = None


class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    problem_statement: Optional[dict] = None
    default_urgency: Optional[int] = None
    default_effort_estimate: Optional[float] = None
    default_next_step: Optional[str] = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    title: str
    problem_statement: Optional[dict] = None
    default_urgency: Optional[int] = None
    default_effort_estimate: Optional[float] = None
    default_next_step: Optional[str] = None
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
