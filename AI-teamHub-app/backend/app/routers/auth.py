# backend/app/routers/auth.py
# All six auth endpoints: login, me, logout, refresh, admin create user, role update

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_access_token_from_request,
    set_auth_cookies,
)
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.auth import LoginRequest, RoleUpdate, UserCreate, UserOut
from app.core.limiter import limiter
from app.services.auth import authenticate_user, create_user, invalidate_user_tokens, refresh_tokens

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """AUTH-02: Validates credentials and sets httpOnly access_token + refresh_token cookies."""
    user = await authenticate_user(data.email, data.password, db)
    access_token = create_access_token(str(user.id), user.role, user.token_version)
    refresh_token = create_refresh_token(str(user.id), user.token_version)
    set_auth_cookies(response, access_token, refresh_token)
    return user


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """AUTH-03: Returns current user's info from the access_token cookie. 401 if not present."""
    return current_user


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """AUTH-04: Clears auth cookies and invalidates token server-side if possible."""
    token = get_access_token_from_request(request)
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") == "access":
                await invalidate_user_tokens(payload["sub"], db)
        except HTTPException:
            pass  # Invalid/expired token — still clear cookies
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/refresh", response_model=UserOut)
async def refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """AUTH-03: Sliding window token refresh — issues new access + refresh token pair.

    Reads refresh_token cookie (scoped to /api/auth/refresh path only).
    Returns the current user object to allow the frontend to update user state.
    """
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    new_access, new_refresh = await refresh_tokens(refresh_token_value, db)

    # Load user to return UserOut (required by response_model)
    payload = decode_token(new_access)
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one()

    set_auth_cookies(response, new_access, new_refresh)
    return user


@router.post("/users", response_model=UserOut, status_code=201)
async def admin_create_user(
    data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> User:
    """AUTH-01: Admin-only user creation. No self-registration exists (CONTEXT.md)."""
    return await create_user(data, db)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[User]:
    """Return all active users ordered by full_name. Used by owner selector on tickets."""
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.full_name)  # noqa: E712
    )
    return result.scalars().all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    data: RoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> User:
    """AUTH-06: Admin assigns/changes role. Increments token_version for immediate effect (AUTH-08)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    user.role = data.role
    user.token_version += 1  # Invalidate existing tokens — AUTH-08
    await db.commit()
    await db.refresh(user)
    return user
