# backend/app/core/security.py
# Pattern 3 from RESEARCH.md — JWT in httpOnly Cookie, FastAPI Set + Read + Clear

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import HTTPException, Request, Response, status

from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"


def create_access_token(user_id: str, role: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "token_version": token_version,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "token_version": token_version,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from e


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set access and refresh tokens as httpOnly cookies.

    CONTEXT.md locked decision: SameSite=Strict.
    settings.COOKIE_SAMESITE allows override via env var for local dev (e.g., Lax).
    """
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=True,
        samesite=settings.COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite=settings.COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh",  # Scoped: browser only sends on refresh endpoint
    )


def clear_auth_cookies(response: Response) -> None:
    """Delete both auth cookies (logout)."""
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth/refresh")


def get_access_token_from_request(request: Request) -> Optional[str]:
    """Read the access_token cookie from the incoming request."""
    return request.cookies.get(ACCESS_COOKIE_NAME)
