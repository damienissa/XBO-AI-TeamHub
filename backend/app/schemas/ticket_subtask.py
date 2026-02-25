import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SubtaskCreate(BaseModel):
    title: str


class SubtaskOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    title: str
    done: bool
    position: int

    model_config = ConfigDict(from_attributes=True)


class SubtaskToggle(BaseModel):
    done: bool


class SubtaskReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID]
