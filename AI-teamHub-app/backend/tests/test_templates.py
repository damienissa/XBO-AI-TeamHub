# backend/tests/test_templates.py
# Tests for ticket template CRUD: /api/templates

import uuid

from httpx import AsyncClient


async def test_create_template(auth_client: AsyncClient):
    r = await auth_client.post("/api/templates/", json={"title": "Bug Report"})
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Bug Report"
    assert "id" in data
    assert "created_by_id" in data


async def test_list_templates(auth_client: AsyncClient):
    await auth_client.post("/api/templates/", json={"title": "Template A"})
    r = await auth_client.get("/api/templates/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_list_templates_empty(auth_client: AsyncClient):
    r = await auth_client.get("/api/templates/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_update_template_by_creator(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/templates/", json={"title": "Original"})
    template_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/templates/{template_id}", json={"title": "Updated"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"


async def test_update_template_by_admin(auth_client: AsyncClient, member_client: AsyncClient):
    """Admin can update a template created by a member."""
    create_r = await member_client.post("/api/templates/", json={"title": "Member Template"})
    template_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/templates/{template_id}", json={"title": "Admin Updated"})
    assert r.status_code == 200
    assert r.json()["title"] == "Admin Updated"


async def test_update_template_by_other_member_403(auth_client: AsyncClient, member_client: AsyncClient):
    """A different member cannot update a template they didn't create."""
    create_r = await auth_client.post("/api/templates/", json={"title": "Admin Template"})
    template_id = create_r.json()["id"]
    r = await member_client.patch(f"/api/templates/{template_id}", json={"title": "Nope"})
    assert r.status_code == 403


async def test_delete_template_by_creator(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/templates/", json={"title": "Delete Me"})
    template_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/templates/{template_id}")
    assert r.status_code == 204


async def test_delete_template_by_admin(auth_client: AsyncClient, member_client: AsyncClient):
    """Admin can delete a template created by a member."""
    create_r = await member_client.post("/api/templates/", json={"title": "Member Template"})
    template_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/templates/{template_id}")
    assert r.status_code == 204


async def test_delete_template_by_other_member_403(auth_client: AsyncClient, member_client: AsyncClient):
    create_r = await auth_client.post("/api/templates/", json={"title": "Admin Template"})
    template_id = create_r.json()["id"]
    r = await member_client.delete(f"/api/templates/{template_id}")
    assert r.status_code == 403


async def test_delete_nonexistent_template_404(auth_client: AsyncClient):
    r = await auth_client.delete(f"/api/templates/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_update_nonexistent_template_404(auth_client: AsyncClient):
    r = await auth_client.patch(f"/api/templates/{uuid.uuid4()}", json={"title": "Nope"})
    assert r.status_code == 404


async def test_templates_unauthenticated(client, seeded_db):
    r = await client.get("/api/templates/")
    assert r.status_code == 401
