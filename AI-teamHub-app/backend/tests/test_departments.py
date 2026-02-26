# backend/tests/test_departments.py
# Tests for GET /api/departments (DEPT-03)
#
# Uses asyncio_mode = "auto" from pyproject.toml — no @pytest.mark.anyio needed.

import pytest
from httpx import AsyncClient


async def test_list_departments_returns_all(client: AsyncClient, seeded_db):
    """DEPT-03: GET /api/departments returns all 23 departments without authentication."""
    r = await client.get("/api/departments")
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


async def test_list_departments_no_auth_required(client: AsyncClient, seeded_db):
    """GET /api/departments is accessible without any authentication cookie."""
    r = await client.get("/api/departments")
    assert r.status_code == 200


async def test_department_has_expected_fields(client: AsyncClient, seeded_db):
    """Each department object has id, slug, and name fields."""
    r = await client.get("/api/departments")
    assert r.status_code == 200
    first = r.json()[0]
    assert "id" in first
    assert "slug" in first
    assert "name" in first
