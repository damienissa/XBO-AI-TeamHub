# backend/tests/test_wiki.py
# Tests for wiki page CRUD: /api/wiki

import uuid

from httpx import AsyncClient


async def test_create_wiki_page(auth_client: AsyncClient):
    r = await auth_client.post("/api/wiki/", json={"title": "Test Page"})
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test Page"
    assert "id" in data
    assert "created_by" in data


async def test_list_wiki_pages(auth_client: AsyncClient):
    await auth_client.post("/api/wiki/", json={"title": "Page 1"})
    r = await auth_client.get("/api/wiki/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_list_wiki_pages_empty(auth_client: AsyncClient):
    r = await auth_client.get("/api/wiki/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_get_wiki_page_by_id(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Detail Page"})
    page_id = create_r.json()["id"]
    r = await auth_client.get(f"/api/wiki/{page_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "Detail Page"


async def test_get_nonexistent_page_404(auth_client: AsyncClient):
    r = await auth_client.get(f"/api/wiki/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_update_wiki_page_title(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Old Title"})
    page_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/wiki/{page_id}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"


async def test_update_wiki_page_content(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Content Page"})
    page_id = create_r.json()["id"]
    content = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}]}
    r = await auth_client.patch(f"/api/wiki/{page_id}", json={"content": content})
    assert r.status_code == 200
    assert r.json()["content"] == content


async def test_create_wiki_page_with_parent(auth_client: AsyncClient):
    parent_r = await auth_client.post("/api/wiki/", json={"title": "Parent"})
    parent_id = parent_r.json()["id"]
    r = await auth_client.post("/api/wiki/", json={"title": "Child", "parent_id": parent_id})
    assert r.status_code == 201
    assert r.json()["parent_id"] == parent_id


async def test_create_wiki_page_invalid_parent_404(auth_client: AsyncClient):
    r = await auth_client.post("/api/wiki/", json={"title": "Orphan", "parent_id": str(uuid.uuid4())})
    assert r.status_code == 404


async def test_update_self_reference_400(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Self Ref"})
    page_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/wiki/{page_id}", json={"parent_id": page_id})
    assert r.status_code == 400


async def test_update_invalid_parent_404(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Update Parent"})
    page_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/wiki/{page_id}", json={"parent_id": str(uuid.uuid4())})
    assert r.status_code == 404


async def test_delete_wiki_page_admin(auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Delete Me"})
    page_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/wiki/{page_id}")
    assert r.status_code == 204
    # Verify deleted
    get_r = await auth_client.get(f"/api/wiki/{page_id}")
    assert get_r.status_code == 404


async def test_delete_wiki_page_member_403(member_client: AsyncClient, auth_client: AsyncClient):
    create_r = await auth_client.post("/api/wiki/", json={"title": "Protected"})
    page_id = create_r.json()["id"]
    r = await member_client.delete(f"/api/wiki/{page_id}")
    assert r.status_code == 403


async def test_delete_nonexistent_page_404(auth_client: AsyncClient):
    r = await auth_client.delete(f"/api/wiki/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_wiki_unauthenticated(client, seeded_db):
    r = await client.get("/api/wiki/")
    assert r.status_code == 401
