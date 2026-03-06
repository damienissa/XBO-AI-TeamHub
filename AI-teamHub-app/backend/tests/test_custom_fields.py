# backend/tests/test_custom_fields.py
# Tests for custom field definition CRUD: /api/custom-field-defs

import uuid

from httpx import AsyncClient


async def test_create_workspace_field_as_admin(auth_client: AsyncClient):
    r = await auth_client.post("/api/custom-field-defs/", json={
        "name": "Sprint", "field_type": "text", "scope": "workspace",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Sprint"
    assert data["scope"] == "workspace"
    assert data["owner_id"] is None


async def test_create_workspace_field_as_member_403(member_client: AsyncClient):
    r = await member_client.post("/api/custom-field-defs/", json={
        "name": "Sprint", "field_type": "text", "scope": "workspace",
    })
    assert r.status_code == 403


async def test_create_personal_field_as_member(member_client: AsyncClient):
    r = await member_client.post("/api/custom-field-defs/", json={
        "name": "My Notes", "field_type": "text", "scope": "personal",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["scope"] == "personal"
    assert data["owner_id"] is not None


async def test_create_personal_field_as_admin(auth_client: AsyncClient):
    r = await auth_client.post("/api/custom-field-defs/", json={
        "name": "Admin Notes", "field_type": "number", "scope": "personal",
    })
    assert r.status_code == 201
    assert r.json()["scope"] == "personal"


async def test_list_fields_admin_sees_workspace(auth_client: AsyncClient):
    await auth_client.post("/api/custom-field-defs/", json={
        "name": "WS Field", "field_type": "text", "scope": "workspace",
    })
    r = await auth_client.get("/api/custom-field-defs/")
    assert r.status_code == 200
    names = [f["name"] for f in r.json()]
    assert "WS Field" in names


async def test_member_doesnt_see_others_personal(auth_client: AsyncClient, member_client: AsyncClient):
    """Member should not see admin's personal fields."""
    await auth_client.post("/api/custom-field-defs/", json={
        "name": "Admin Personal", "field_type": "text", "scope": "personal",
    })
    r = await member_client.get("/api/custom-field-defs/")
    assert r.status_code == 200
    names = [f["name"] for f in r.json()]
    assert "Admin Personal" not in names


async def test_delete_workspace_field_admin(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/custom-field-defs/", json={
        "name": "Del WS", "field_type": "text", "scope": "workspace",
    })
    field_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/custom-field-defs/{field_id}")
    assert r.status_code == 204


async def test_delete_workspace_field_member_403(auth_client: AsyncClient, member_client: AsyncClient):
    create_r = await auth_client.post("/api/custom-field-defs/", json={
        "name": "Protected WS", "field_type": "text", "scope": "workspace",
    })
    field_id = create_r.json()["id"]
    r = await member_client.delete(f"/api/custom-field-defs/{field_id}")
    assert r.status_code == 403


async def test_delete_personal_field_owner(member_client: AsyncClient):
    create_r = await member_client.post("/api/custom-field-defs/", json={
        "name": "My Field", "field_type": "date", "scope": "personal",
    })
    field_id = create_r.json()["id"]
    r = await member_client.delete(f"/api/custom-field-defs/{field_id}")
    assert r.status_code == 204


async def test_delete_personal_field_non_owner_403(auth_client: AsyncClient, member_client: AsyncClient):
    """Admin cannot delete a member's personal field (403)."""
    create_r = await member_client.post("/api/custom-field-defs/", json={
        "name": "Member Only", "field_type": "text", "scope": "personal",
    })
    field_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/custom-field-defs/{field_id}")
    assert r.status_code == 403


async def test_delete_nonexistent_404(auth_client: AsyncClient):
    r = await auth_client.delete(f"/api/custom-field-defs/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_custom_fields_unauthenticated(client, seeded_db):
    r = await client.get("/api/custom-field-defs/")
    assert r.status_code == 401
