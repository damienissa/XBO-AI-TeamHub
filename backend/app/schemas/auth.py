# backend/app/schemas/auth.py
# Pydantic v2 schemas for auth endpoints

import uuid

from pydantic import BaseModel

from app.models.user import UserRole


class LoginRequest(BaseModel):
    # Plain str (not EmailStr) — so validation error doesn't reveal which field failed.
    # Generic error message is returned for both wrong email and wrong password (CONTEXT.md).
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole = UserRole.member


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class RoleUpdate(BaseModel):
    role: UserRole
