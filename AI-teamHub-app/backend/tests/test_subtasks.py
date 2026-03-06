# backend/tests/test_subtasks.py
# Tests for subtask CRUD + reorder: /api/tickets/{ticket_id}/subtasks

import uuid

from httpx import AsyncClient


async def test_create_subtask(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "First"})
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "First"
    assert data["position"] == 0
    assert data["done"] is False


async def test_create_second_subtask_position_1(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "B"})
    assert r.status_code == 201
    assert r.json()["position"] == 1


async def test_list_subtasks_ordered_by_position(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "B"})
    r = await auth_client.get(f"/api/tickets/{ticket_id}/subtasks/")
    assert r.status_code == 200
    titles = [s["title"] for s in r.json()]
    assert titles == ["A", "B"]


async def test_list_subtasks_empty(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/subtasks/")
    assert r.status_code == 200
    assert r.json() == []


async def test_toggle_subtask_done(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    create_r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "Task"})
    subtask_id = create_r.json()["id"]
    r = await auth_client.patch(f"/api/tickets/{ticket_id}/subtasks/{subtask_id}", json={"done": True})
    assert r.status_code == 200
    assert r.json()["done"] is True


async def test_toggle_subtask_undone(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    create_r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "Task"})
    subtask_id = create_r.json()["id"]
    await auth_client.patch(f"/api/tickets/{ticket_id}/subtasks/{subtask_id}", json={"done": True})
    r = await auth_client.patch(f"/api/tickets/{ticket_id}/subtasks/{subtask_id}", json={"done": False})
    assert r.status_code == 200
    assert r.json()["done"] is False


async def test_delete_subtask(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    create_r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "Del"})
    subtask_id = create_r.json()["id"]
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/subtasks/{subtask_id}")
    assert r.status_code == 204
    # Verify deleted
    list_r = await auth_client.get(f"/api/tickets/{ticket_id}/subtasks/")
    assert all(s["id"] != subtask_id for s in list_r.json())


async def test_delete_subtask_resequences_positions(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r0 = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    r1 = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "B"})
    r2 = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "C"})
    # Delete middle subtask
    await auth_client.delete(f"/api/tickets/{ticket_id}/subtasks/{r1.json()['id']}")
    list_r = await auth_client.get(f"/api/tickets/{ticket_id}/subtasks/")
    positions = [s["position"] for s in list_r.json()]
    assert positions == [0, 1]  # Resequenced without gaps


async def test_reorder_subtasks(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r0 = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    r1 = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "B"})
    id_a = r0.json()["id"]
    id_b = r1.json()["id"]
    # Reverse order
    r = await auth_client.patch(
        f"/api/tickets/{ticket_id}/subtasks/reorder",
        json={"ordered_ids": [id_b, id_a]},
    )
    assert r.status_code == 200
    titles = [s["title"] for s in r.json()]
    assert titles == ["B", "A"]


async def test_reorder_mismatched_ids_400(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    r = await auth_client.patch(
        f"/api/tickets/{ticket_id}/subtasks/reorder",
        json={"ordered_ids": [str(uuid.uuid4())]},
    )
    assert r.status_code == 400


async def test_subtask_on_nonexistent_ticket(auth_client: AsyncClient):
    fake_id = str(uuid.uuid4())
    r = await auth_client.post(f"/api/tickets/{fake_id}/subtasks/", json={"title": "Nope"})
    assert r.status_code == 404


async def test_toggle_nonexistent_subtask(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    fake_id = str(uuid.uuid4())
    r = await auth_client.patch(f"/api/tickets/{ticket_id}/subtasks/{fake_id}", json={"done": True})
    assert r.status_code == 404


async def test_subtask_unauthenticated(client, seeded_db, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await client.get(f"/api/tickets/{ticket_id}/subtasks/")
    assert r.status_code == 401
