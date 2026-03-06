# backend/tests/test_departments.py
# Tests for GET /api/departments (DEPT-03)
#
# Uses asyncio_mode = "auto" from pyproject.toml — no @pytest.mark.anyio needed.
# Note: The departments endpoint now requires authentication.

import pytest
from httpx import AsyncClient


async def test_list_departments_returns_all(auth_client: AsyncClient):
    """DEPT-03: GET /api/departments returns all 23 departments."""
    r = await auth_client.get("/api/departments")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 23
    slugs = {d["slug"] for d in data}
    assert slugs == {
        "rnd",
        "back_office",
        "banking",
        "bi",
        "bizdev_sales",
        "cashier",
        "compliance",
        "content",
        "creative_studio",
        "design",
        "customer_support",
        "dealing",
        "devops_it",
        "finance",
        "hr_recruitment_cy",
        "hr_recruitment_ukr",
        "legal",
        "onboarding",
        "product_xbo",
        "success",
        "technical_support",
        "technical_writers",
        "ui_ux",
    }


async def test_list_departments_unauthenticated_returns_401(client: AsyncClient, seeded_db):
    """GET /api/departments without auth returns 401."""
    r = await client.get("/api/departments")
    assert r.status_code == 401


async def test_department_has_expected_fields(auth_client: AsyncClient):
    """Each department object has id, slug, and name fields."""
    r = await auth_client.get("/api/departments")
    assert r.status_code == 200
    first = r.json()[0]
    assert "id" in first
    assert "slug" in first
    assert "name" in first
