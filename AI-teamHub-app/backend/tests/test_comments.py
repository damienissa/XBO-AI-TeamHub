# backend/tests/test_comments.py
# Tests for comment CRUD endpoints: /api/tickets/{ticket_id}/comments

import uuid

from httpx import AsyncClient


async def test_create_comment(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Hello"})
    assert r.status_code == 201
    data = r.json()
    assert data["body"] == "Hello"
    assert data["ticket_id"] == ticket_id


async def test_create_comment_emits_event(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "A comment"})
    r = await auth_client.get(f"/api/tickets/{ticket_id}/events")
    events = r.json()
    types = [e["event_type"] for e in events]
    assert "comment_added" in types


async def test_list_comments_empty(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/comments/")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_comments_ordered_asc(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "First"})
    await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Second"})
    r = await auth_client.get(f"/api/tickets/{ticket_id}/comments/")
    assert r.status_code == 200
    bodies = [c["body"] for c in r.json()]
    assert bodies == ["First", "Second"]


async def test_list_comments_includes_author_name(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Test"})
    r = await auth_client.get(f"/api/tickets/{ticket_id}/comments/")
    comment = r.json()[0]
    assert "author_name" in comment
    assert comment["author_name"] is not None


async def test_create_comment_on_nonexistent_ticket(auth_client: AsyncClient):
    fake_id = str(uuid.uuid4())
    r = await auth_client.post(f"/api/tickets/{fake_id}/comments/", json={"body": "Nope"})
    assert r.status_code == 404


async def test_delete_comment_by_author(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    create_r = await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Delete me"})
    comment_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/comments/{comment_id}")
    assert r.status_code == 204


async def test_delete_comment_by_admin(auth_client: AsyncClient, member_client: AsyncClient, created_ticket: dict):
    """Admin can delete another user's comment."""
    ticket_id = created_ticket["id"]
    # Member creates a comment
    create_r = await member_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Member comment"})
    comment_id = create_r.json()["id"]
    # Admin deletes it
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/comments/{comment_id}")
    assert r.status_code == 204


async def test_delete_comment_by_non_author_403(member_client: AsyncClient, auth_client: AsyncClient, created_ticket: dict):
    """Non-author non-admin cannot delete a comment."""
    ticket_id = created_ticket["id"]
    # Admin creates a comment
    create_r = await auth_client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "Admin comment"})
    comment_id = create_r.json()["id"]
    # Member tries to delete it
    r = await member_client.delete(f"/api/tickets/{ticket_id}/comments/{comment_id}")
    assert r.status_code == 403


async def test_delete_nonexistent_comment(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    fake_id = str(uuid.uuid4())
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/comments/{fake_id}")
    assert r.status_code == 404


async def test_create_comment_unauthenticated(client, seeded_db, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await client.post(f"/api/tickets/{ticket_id}/comments/", json={"body": "No auth"})
    assert r.status_code == 401
