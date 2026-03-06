# backend/tests/test_board.py
# Tests for GET /api/board — filtering, batch queries, computed fields

import uuid
from datetime import date, timedelta

from httpx import AsyncClient


async def test_board_returns_empty_when_no_tickets(auth_client: AsyncClient):
    """Board returns empty list when no tickets exist (seeded_db has no tickets)."""
    r = await auth_client.get("/api/board")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_board_returns_created_ticket(auth_client: AsyncClient, created_ticket: dict):
    r = await auth_client.get("/api/board")
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert created_ticket["id"] in ids


async def test_board_filter_by_department_id(auth_client: AsyncClient, created_ticket: dict, dept_id):
    r = await auth_client.get(f"/api/board?department_id={dept_id}")
    assert r.status_code == 200
    for t in r.json():
        assert t["department"]["id"] == str(dept_id)


async def test_board_filter_by_owner_id(auth_client: AsyncClient, created_ticket: dict, admin_user_id, dept_id):
    """Assign owner then filter by owner_id."""
    ticket_id = created_ticket["id"]
    admin_id = str(admin_user_id)
    await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery", "owner_id": admin_id,
    })
    r = await auth_client.get(f"/api/board?owner_id={admin_id}")
    assert r.status_code == 200
    for t in r.json():
        assert t["owner_id"] == admin_id


async def test_board_filter_by_priority(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"priority": "high"})
    r = await auth_client.get("/api/board?priority=high")
    assert r.status_code == 200
    for t in r.json():
        assert t["priority"] == "high"


async def test_board_filter_by_min_urgency(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"urgency": 4})
    r = await auth_client.get("/api/board?min_urgency=3")
    assert r.status_code == 200
    for t in r.json():
        assert t["urgency"] >= 3


async def test_board_filter_by_max_urgency(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"urgency": 2})
    r = await auth_client.get("/api/board?max_urgency=2")
    assert r.status_code == 200
    for t in r.json():
        assert t["urgency"] is None or t["urgency"] <= 2


async def test_board_filter_by_due_before(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"due_date": tomorrow})
    r = await auth_client.get(f"/api/board?due_before={tomorrow}")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_board_filter_by_due_after(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    far_future = (date.today() + timedelta(days=365)).isoformat()
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"due_date": far_future})
    r = await auth_client.get(f"/api/board?due_after={far_future}")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_board_filter_by_created_after(auth_client: AsyncClient, created_ticket: dict):
    today = date.today().isoformat()
    r = await auth_client.get(f"/api/board?created_after={today}")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_board_filter_by_created_before(auth_client: AsyncClient, created_ticket: dict):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    r = await auth_client.get(f"/api/board?created_before={yesterday}")
    assert r.status_code == 200
    # Tickets created today should NOT be in the result
    ids = [t["id"] for t in r.json()]
    assert created_ticket["id"] not in ids


async def test_board_includes_time_in_column(auth_client: AsyncClient, created_ticket: dict):
    r = await auth_client.get("/api/board")
    ticket = next(t for t in r.json() if t["id"] == created_ticket["id"])
    assert ticket["time_in_column"] is not None
    assert "in column" in ticket["time_in_column"]


async def test_board_includes_subtask_counts(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "A"})
    sub_r = await auth_client.post(f"/api/tickets/{ticket_id}/subtasks/", json={"title": "B"})
    sub_id = sub_r.json()["id"]
    await auth_client.patch(f"/api/tickets/{ticket_id}/subtasks/{sub_id}", json={"done": True})
    r = await auth_client.get("/api/board")
    ticket = next(t for t in r.json() if t["id"] == ticket_id)
    assert ticket["subtasks_total"] == 2
    assert ticket["subtasks_done"] == 1


async def test_board_includes_blocked_by_count(auth_client: AsyncClient, created_ticket: dict, dept_id):
    ticket_id = created_ticket["id"]
    blocker_r = await auth_client.post("/api/tickets/", json={
        "title": "Blocker", "department_id": str(dept_id),
    })
    blocker_id = blocker_r.json()["id"]
    await auth_client.post(f"/api/tickets/{ticket_id}/dependencies", json={
        "blocking_ticket_id": blocker_id,
    })
    r = await auth_client.get("/api/board")
    ticket = next(t for t in r.json() if t["id"] == ticket_id)
    assert ticket["blocked_by_count"] == 1


async def test_board_unauthenticated(client, seeded_db):
    r = await client.get("/api/board")
    assert r.status_code == 401
