# backend/tests/test_auth.py
# Auth endpoint test suite covering the full auth contract (AUTH-01 through AUTH-08)
#
# Uses asyncio_mode = "auto" from pyproject.toml — no @pytest.mark.anyio needed.
#
# Cookie note: httpx deprecated per-request cookies= with httpx.Cookies objects.
# Tests extract cookies from login responses as plain dicts before passing them
# to subsequent requests.

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def login(client: AsyncClient, email: str, password: str):
    """POST /api/auth/login and return the response."""
    return await client.post("/api/auth/login", json={"email": email, "password": password})


def extract_cookies(response) -> dict:
    """Extract cookies from a response as a plain dict for use in subsequent requests."""
    return dict(response.cookies)


async def create_test_user(
    client: AsyncClient,
    admin_cookies: dict,
    email: str = "user@test.com",
    password: str = "testpass123",
    role: str = "member",
    full_name: str = "Test User",
):
    """POST /api/auth/users as admin to create a new user."""
    return await client.post(
        "/api/auth/users",
        json={"email": email, "password": password, "full_name": full_name, "role": role},
        cookies=admin_cookies,
    )


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------


async def test_login_valid_credentials_sets_cookie(client: AsyncClient, seeded_db):
    """AUTH-02: Valid login sets access_token httpOnly cookie and returns user info."""
    r = await login(client, "admin@xbo.com", "seedpassword")
    assert r.status_code == 200
    assert "access_token" in r.cookies
    body = r.json()
    assert body["email"] == "admin@xbo.com"
    assert body["role"] == "admin"
    assert "id" in body
    assert "full_name" in body


async def test_login_invalid_password_returns_401(client: AsyncClient, seeded_db):
    """Wrong password returns 401 with generic message — per CONTEXT.md (don't reveal which field)."""
    r = await login(client, "admin@xbo.com", "wrongpassword")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"


async def test_login_unknown_email_returns_401(client: AsyncClient, seeded_db):
    """Unknown email returns 401 (generic) — do not reveal which field was wrong."""
    r = await login(client, "nobody@xbo.com", "anypassword")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"


# ---------------------------------------------------------------------------
# /me tests
# ---------------------------------------------------------------------------


async def test_get_me_with_valid_cookie(client: AsyncClient, seeded_db):
    """AUTH-03: /me with valid access_token cookie returns current user's email, full_name, role."""
    login_r = await login(client, "admin@xbo.com", "seedpassword")
    r = await client.get("/api/auth/me", cookies=extract_cookies(login_r))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "admin@xbo.com"
    assert body["role"] == "admin"
    assert "full_name" in body


async def test_get_me_without_cookie_returns_401(client: AsyncClient):
    """AUTH-07: Any protected endpoint without valid access_token cookie returns 401."""
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Logout test
# ---------------------------------------------------------------------------


async def test_logout_clears_cookies(client: AsyncClient, seeded_db):
    """AUTH-04: POST /api/auth/logout clears the access_token and refresh_token cookies."""
    login_r = await login(client, "admin@xbo.com", "seedpassword")
    r = await client.post("/api/auth/logout", cookies=extract_cookies(login_r))
    assert r.status_code == 200
    assert r.json()["message"] == "Logged out"
    # Cookie should be cleared (deleted or empty value)
    assert r.cookies.get("access_token") in (None, "")


# ---------------------------------------------------------------------------
# Admin user creation tests
# ---------------------------------------------------------------------------


async def test_admin_can_create_user(client: AsyncClient, seeded_db):
    """AUTH-01: Admin creates a new user account (POST /api/auth/users)."""
    login_r = await login(client, "admin@xbo.com", "seedpassword")
    r = await create_test_user(client, extract_cookies(login_r), email="new@xbo.com")
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new@xbo.com"
    assert body["role"] == "member"
    assert body["is_active"] is True


async def test_member_cannot_create_user(client: AsyncClient, seeded_db):
    """AUTH-05/AUTH-06: Member role calling admin endpoint gets 403 Forbidden."""
    admin_login = await login(client, "admin@xbo.com", "seedpassword")
    # Create a member user
    await create_test_user(client, extract_cookies(admin_login), email="member@xbo.com")
    member_login = await login(client, "member@xbo.com", "testpass123")
    # Member tries to create another user — must be rejected
    r = await create_test_user(client, extract_cookies(member_login), email="another@xbo.com")
    assert r.status_code == 403


async def test_create_user_duplicate_email_returns_400(client: AsyncClient, seeded_db):
    """Creating a user with an already-registered email returns 400."""
    admin_login = await login(client, "admin@xbo.com", "seedpassword")
    admin_cookies = extract_cookies(admin_login)
    await create_test_user(client, admin_cookies, email="dup@xbo.com")
    r = await create_test_user(client, admin_cookies, email="dup@xbo.com")
    assert r.status_code == 400
    assert "already registered" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Role change + token_version invalidation tests
# ---------------------------------------------------------------------------


async def test_admin_can_change_user_role(client: AsyncClient, seeded_db):
    """AUTH-06: Admin assigns role; response reflects new role."""
    admin_login = await login(client, "admin@xbo.com", "seedpassword")
    admin_cookies = extract_cookies(admin_login)
    create_r = await create_test_user(client, admin_cookies, email="roletest@xbo.com")
    user_id = create_r.json()["id"]
    r = await client.patch(
        f"/api/auth/users/{user_id}/role",
        json={"role": "admin"},
        cookies=admin_cookies,
    )
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


async def test_token_version_invalidation(client: AsyncClient, seeded_db):
    """AUTH-08: After role change, the old access token is rejected (token_version incremented)."""
    admin_login = await login(client, "admin@xbo.com", "seedpassword")
    admin_cookies = extract_cookies(admin_login)
    create_r = await create_test_user(client, admin_cookies, email="verstest@xbo.com")
    user_id = create_r.json()["id"]

    # Member logs in — capture old cookies
    member_login = await login(client, "verstest@xbo.com", "testpass123")
    old_cookies = extract_cookies(member_login)

    # Admin changes role (increments token_version on the user row)
    await client.patch(
        f"/api/auth/users/{user_id}/role",
        json={"role": "admin"},
        cookies=admin_cookies,
    )

    # Old access token must now be rejected
    r = await client.get("/api/auth/me", cookies=old_cookies)
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Refresh token test
# ---------------------------------------------------------------------------


async def test_refresh_issues_new_tokens(client: AsyncClient, seeded_db):
    """AUTH-03: POST /api/auth/refresh with valid refresh_token cookie issues new access + refresh tokens."""
    login_r = await login(client, "admin@xbo.com", "seedpassword")
    r = await client.post("/api/auth/refresh", cookies=extract_cookies(login_r))
    assert r.status_code == 200
    assert "access_token" in r.cookies
    body = r.json()
    assert body["email"] == "admin@xbo.com"


async def test_refresh_without_cookie_returns_401(client: AsyncClient):
    """POST /api/auth/refresh with no cookie returns 401."""
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 401
