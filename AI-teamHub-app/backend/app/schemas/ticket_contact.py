import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ContactIn(BaseModel):
    """Accepted on ticket create/update. user_id → internal; external_name → external."""
    user_id: Optional[uuid.UUID] = None
    external_name: Optional[str] = None
    external_email: Optional[str] = None

    @field_validator("external_name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                raise ValueError("external_name must not be empty")
            if len(v) > 200:
                raise ValueError("external_name must be at most 200 characters")
        return v

    model_config = ConfigDict(extra="ignore")


class ContactOut(BaseModel):
    """Response schema. name/email are always resolved (from User record or external columns)."""
    id: uuid.UUID
    ticket_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    name: str
    email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
