# backend/tests/test_saved_filters.py
# Tests for saved filter presets: /api/saved-filters

import uuid

from httpx import AsyncClient


async def test_list_saved_filters_empty(auth_client: AsyncClient):
    r = await auth_client.get("/api/saved-filters/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_create_saved_filter(auth_client: AsyncClient):
    r = await auth_client.post("/api/saved-filters/", json={
        "name": "My Filter",
        "filter_state": {"priority": "high", "department_id": "abc"},
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "My Filter"
    assert data["filter_state"]["priority"] == "high"


async def test_list_saved_filters_after_create(auth_client: AsyncClient):
    await auth_client.post("/api/saved-filters/", json={
        "name": "Filter 1",
        "filter_state": {"status": "open"},
    })
    r = await auth_client.get("/api/saved-filters/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_delete_saved_filter(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/saved-filters/", json={
        "name": "Delete Me",
        "filter_state": {},
    })
    filter_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/saved-filters/{filter_id}")
    assert r.status_code == 204


async def test_delete_other_users_filter_404(auth_client: AsyncClient, member_client: AsyncClient):
    """A user cannot delete another user's filter (returns 404 since ownership is part of the query)."""
    create_r = await auth_client.post("/api/saved-filters/", json={
        "name": "Admin Filter",
        "filter_state": {},
    })
    filter_id = create_r.json()["id"]
    r = await member_client.delete(f"/api/saved-filters/{filter_id}")
    assert r.status_code == 404


async def test_delete_nonexistent_filter_404(auth_client: AsyncClient):
    r = await auth_client.delete(f"/api/saved-filters/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_saved_filters_unauthenticated(client, seeded_db):
    r = await client.get("/api/saved-filters/")
    assert r.status_code == 401
