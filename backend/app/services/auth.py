# backend/app/services/auth.py
# Auth service functions — business logic for login, user creation, refresh, invalidation

from fastapi import HTTPException, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import UserCreate

# Note: Plan sample used PasswordHasher() which does not exist in pwdlib.
# Correct class is PasswordHash with factory method .recommended() — per Plan 01-01 deviation fix.
ph = PasswordHash.recommended()


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    """Verify credentials and return the User.

    Raises 401 with a generic message — per CONTEXT.md locked decision:
    never reveal which field (email or password) was wrong.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Use a single generic error for both "not found" and "wrong password"
    # pwdlib API: ph.verify(password, hash) — plaintext first, hash second
    if user is None or not ph.verify(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",  # Generic — CONTEXT.md locked decision
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    return user


async def create_user(data: UserCreate, db: AsyncSession) -> User:
    """Admin-only user creation. No self-registration route exists (CONTEXT.md)."""
    # Check email uniqueness before hashing password
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        hashed_password=ph.hash(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def refresh_tokens(refresh_token_value: str, db: AsyncSession) -> tuple[str, str]:
    """Sliding window refresh — issues new access + refresh tokens.

    Pattern 5 from RESEARCH.md: validates type, user exists, token_version matches.
    """
    payload = decode_token(refresh_token_value)  # raises 401 on invalid/expired

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload["sub"]
    token_version = payload["token_version"]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalidated",
        )

    new_access = create_access_token(str(user.id), user.role, user.token_version)
    new_refresh = create_refresh_token(str(user.id), user.token_version)
    return new_access, new_refresh


async def invalidate_user_tokens(user_id: str, db: AsyncSession) -> None:
    """Increment token_version — existing tokens are rejected within the 15-min TTL (AUTH-08).

    Called on logout or role change to force re-authentication.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    user.token_version += 1
    await db.commit()
