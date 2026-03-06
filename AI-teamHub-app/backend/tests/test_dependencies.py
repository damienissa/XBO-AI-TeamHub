# backend/tests/test_dependencies.py
# Tests for ticket dependency management: /api/tickets/{ticket_id}/dependencies

import uuid

from httpx import AsyncClient


async def test_get_dependencies_empty(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/dependencies")
    assert r.status_code == 200
    data = r.json()
    assert data["blocks"] == []
    assert data["blocked_by"] == []


async def test_add_dependency(auth_client: AsyncClient, created_ticket: dict, dept_id):
    """Add a blocker to a ticket."""
    ticket_id = created_ticket["id"]
    # Create a second ticket to be the blocker
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker Ticket",
        "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]

    r = await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    assert r.status_code == 201
    data = r.json()
    assert len(data["blocked_by"]) == 1
    assert data["blocked_by"][0]["id"] == blocker_id


async def test_add_self_dependency_400(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": ticket_id,
    })
    assert r.status_code == 400


async def test_add_duplicate_dependency_409(auth_client: AsyncClient, created_ticket: dict, dept_id):
    ticket_id = created_ticket["id"]
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker", "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    r = await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    assert r.status_code == 409


async def test_add_dependency_nonexistent_ticket_404(auth_client: AsyncClient):
    fake_id = str(uuid.uuid4())
    r = await auth_client.post(f"/api/tickets/{fake_id}/dependencies", json={
        "blocking_ticket_id": str(uuid.uuid4()),
    })
    assert r.status_code == 404


async def test_add_dependency_nonexistent_blocker_404(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": str(uuid.uuid4()),
    })
    assert r.status_code == 404


async def test_remove_dependency(auth_client: AsyncClient, created_ticket: dict, dept_id):
    ticket_id = created_ticket["id"]
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker", "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/dependencies/{blocker_id}")
    assert r.status_code == 204


async def test_remove_nonexistent_dependency_404(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/dependencies/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_dependency_blocks_move_out_of_backlog(
    auth_client: AsyncClient, created_ticket: dict, dept_id, admin_user_id
):
    """A ticket blocked by a non-Done ticket cannot be moved out of Backlog (ADV-05)."""
    ticket_id = created_ticket["id"]
    # Create a blocker that stays in Backlog (not Done)
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker in Backlog", "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    # Try to move blocked ticket out of Backlog
    r = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery",
        "owner_id": str(admin_user_id),
    })
    assert r.status_code == 409


async def test_dependency_allows_move_when_blocker_done(
    auth_client: AsyncClient, created_ticket: dict, dept_id, admin_user_id
):
    """When blocker is Done, the blocked ticket can move out of Backlog."""
    ticket_id = created_ticket["id"]
    admin_id = str(admin_user_id)
    # Create blocker and move it to Done
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker to Done", "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]
    # Move blocker: Backlog -> Discovery -> Done
    await auth_client.patch(f"/api/tickets/{blocker_id}/move", json={
        "target_column": "Discovery", "owner_id": admin_id,
    })
    await auth_client.patch(f"/api/tickets/{blocker_id}/move", json={
        "target_column": "Done",
    })
    # Add dependency
    await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    # Move blocked ticket — should succeed
    r = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery", "owner_id": admin_id,
    })
    assert r.status_code == 200


async def test_dependencies_unauthenticated(client, seeded_db, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await client.get(f"/api/tickets/{ticket_id}/dependencies")
    assert r.status_code == 401
