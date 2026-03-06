# backend/app/schemas/auth.py
# Pydantic v2 schemas for auth endpoints

import re
import uuid

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


class LoginRequest(BaseModel):
    # Plain str (not EmailStr) — so validation error doesn't reveal which field failed.
    # Generic error message is returned for both wrong email and wrong password (CONTEXT.md).
    email: str
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.member

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class RoleUpdate(BaseModel):
    role: UserRole
