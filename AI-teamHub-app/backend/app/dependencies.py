# backend/app/dependencies.py
# Pattern 4 from RESEARCH.md — get_current_user dependency with token_version check

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token, get_access_token_from_request
from app.models.user import User


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Reads the access_token cookie, decodes it, and returns the authenticated User.

    Raises 401 at each failure point:
      - No cookie present
      - Invalid or expired JWT
      - Wrong token type (e.g., refresh token used as access token)
      - User not found in DB
      - Token version mismatch (AUTH-08 — role change / deactivation invalidates token)
    """
    token = get_access_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(token)  # raises 401 on invalid/expired

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    token_version = payload.get("token_version")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # AUTH-08: Verify token_version — incremented on role change or deactivation
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated",
        )

    return user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Dependency that requires the current user to have the admin role.

    Returns the user if admin; raises 403 Forbidden otherwise.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
