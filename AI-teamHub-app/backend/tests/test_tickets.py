# backend/tests/test_tickets.py
# Tests for ticket CRUD, move semantics, events, history, board, and auth/users endpoints.
# Uses shared fixtures from conftest.py (seeded_db, auth_client, dept_id, created_ticket, etc.).

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from tests.conftest import ADMIN_EMAIL


# ---------------------------------------------------------------------------
# Test 1: POST /api/tickets creates a ticket in Backlog with null owner_id
# ---------------------------------------------------------------------------

async def test_create_ticket_returns_backlog_with_null_owner(
    auth_client: AsyncClient, dept_id: uuid.UUID
):
    resp = await auth_client.post("/api/tickets/", json={
        "title": "New Backlog Ticket",
        "department_id": str(dept_id),
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status_column"] == "Backlog"
    assert data["owner_id"] is None
    assert data["title"] == "New Backlog Ticket"


# ---------------------------------------------------------------------------
# Test 2: POST /api/tickets emits a "created" TicketEvent
# ---------------------------------------------------------------------------

async def test_create_ticket_emits_created_event(
    auth_client: AsyncClient, created_ticket: dict
):
    ticket_id = created_ticket["id"]
    resp = await auth_client.get(f"/api/tickets/{ticket_id}/events")
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 1
    assert events[0]["event_type"] == "created"


# ---------------------------------------------------------------------------
# Test 3: POST /api/tickets opens a ColumnHistory row in Backlog
# ---------------------------------------------------------------------------

async def test_create_ticket_opens_column_history(
    auth_client: AsyncClient, created_ticket: dict
):
    ticket_id = created_ticket["id"]
    resp = await auth_client.get(f"/api/tickets/{ticket_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["column"] == "Backlog"
    assert history[0]["exited_at"] is None


# ---------------------------------------------------------------------------
# Test 4: PATCH /move without owner_id out of Backlog returns 400
# ---------------------------------------------------------------------------

async def test_move_ticket_out_of_backlog_without_owner_returns_400(
    auth_client: AsyncClient, created_ticket: dict
):
    ticket_id = created_ticket["id"]
    resp = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery",
    })
    assert resp.status_code == 400
    assert "owner_id" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Test 5: PATCH /move with owner_id succeeds
# ---------------------------------------------------------------------------

async def test_move_ticket_with_owner_succeeds(
    auth_client: AsyncClient, created_ticket: dict, admin_user_id: uuid.UUID
):
    ticket_id = created_ticket["id"]
    admin_id = str(admin_user_id)

    resp = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery",
        "owner_id": admin_id,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status_column"] == "Discovery"
    assert data["owner_id"] == admin_id


# ---------------------------------------------------------------------------
# Test 6: After move, Backlog history row is closed; Discovery row is open
# ---------------------------------------------------------------------------

async def test_move_ticket_closes_column_history(
    auth_client: AsyncClient, created_ticket: dict, admin_user_id: uuid.UUID
):
    ticket_id = created_ticket["id"]
    admin_id = str(admin_user_id)

    await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery",
        "owner_id": admin_id,
    })

    resp = await auth_client.get(f"/api/tickets/{ticket_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 2

    backlog_row = next(r for r in history if r["column"] == "Backlog")
    discovery_row = next(r for r in history if r["column"] == "Discovery")
    assert backlog_row["exited_at"] is not None
    assert discovery_row["exited_at"] is None


# ---------------------------------------------------------------------------
# Test 7: Moving TO Backlog with owner_id returns 400 (TICKET-07)
# ---------------------------------------------------------------------------

async def test_move_ticket_to_backlog_with_owner_returns_400(
    auth_client: AsyncClient, created_ticket: dict, admin_user_id: uuid.UUID
):
    ticket_id = created_ticket["id"]
    admin_id = str(admin_user_id)

    resp = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Backlog",
        "owner_id": admin_id,
    })
    assert resp.status_code == 400
    assert "owner" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Test 8: Moving already-owned ticket out of Backlog without owner_id succeeds
# ---------------------------------------------------------------------------

async def test_move_already_owned_ticket_freely(
    auth_client: AsyncClient, dept_id: uuid.UUID, admin_user_id: uuid.UUID
):
    """Ticket with an existing owner can move out of Backlog without specifying owner_id."""
    admin_id = str(admin_user_id)

    # Create and immediately assign owner via move
    create_resp = await auth_client.post("/api/tickets/", json={
        "title": "Owned Ticket",
        "department_id": str(dept_id),
    })
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["id"]

    # First move: assign owner while moving to Discovery
    move1 = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Discovery",
        "owner_id": admin_id,
    })
    assert move1.status_code == 200

    # Move back to Backlog without owner_id
    move2 = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "Backlog",
    })
    assert move2.status_code == 200

    # Now move from Backlog to InProgress without specifying owner_id (ticket already has one)
    move3 = await auth_client.patch(f"/api/tickets/{ticket_id}/move", json={
        "target_column": "In Progress",
    })
    assert move3.status_code == 200
    assert move3.json()["status_column"] == "In Progress"


# ---------------------------------------------------------------------------
# Test 9: PATCH /api/tickets/{id} updates a field
# ---------------------------------------------------------------------------

async def test_patch_ticket_updates_field(
    auth_client: AsyncClient, created_ticket: dict
):
    ticket_id = created_ticket["id"]
    resp = await auth_client.patch(f"/api/tickets/{ticket_id}", json={
        "priority": "high",
    })
    assert resp.status_code == 200
    assert resp.json()["priority"] == "high"


# ---------------------------------------------------------------------------
# Test 10: DELETE /api/tickets/{id} requires admin role
# ---------------------------------------------------------------------------

async def test_delete_ticket_requires_admin(
    seeded_db: AsyncSession, created_ticket: dict
):
    """A member user cannot delete a ticket (403)."""
    from sqlalchemy.dialects.postgresql import insert
    from app.models.user import User, UserRole
    from pwdlib import PasswordHash

    ph = PasswordHash.recommended()
    member_id = uuid.uuid4()
    await seeded_db.execute(
        insert(User).values(
            id=member_id,
            email="member@xbo.com",
            hashed_password=ph.hash("memberpass"),
            full_name="Member",
            role=UserRole.member,
            is_active=True,
            token_version=0,
        ).on_conflict_do_nothing(index_elements=["email"])
    )
    await seeded_db.commit()

    def override_get_db():
        yield seeded_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        login_resp = await ac.post("/api/auth/login", json={
            "email": "member@xbo.com",
            "password": "memberpass",
        })
        assert login_resp.status_code == 200

        resp = await ac.delete(f"/api/tickets/{created_ticket['id']}")
        assert resp.status_code == 403

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 11: Admin can delete a ticket; subsequent GET returns 404
# ---------------------------------------------------------------------------

async def test_delete_ticket_as_admin(
    auth_client: AsyncClient, created_ticket: dict
):
    ticket_id = created_ticket["id"]
    resp = await auth_client.delete(f"/api/tickets/{ticket_id}")
    assert resp.status_code == 204

    get_resp = await auth_client.get(f"/api/tickets/{ticket_id}")
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 12: GET /api/board returns all tickets
# ---------------------------------------------------------------------------

async def test_board_endpoint_returns_all_tickets(
    auth_client: AsyncClient, created_ticket: dict
):
    resp = await auth_client.get("/api/board")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    ids = [t["id"] for t in data]
    assert created_ticket["id"] in ids


# ---------------------------------------------------------------------------
# Test 13: GET /api/auth/users returns active users
# ---------------------------------------------------------------------------

async def test_list_users_returns_active_users(auth_client: AsyncClient):
    resp = await auth_client.get("/api/auth/users")
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    for user in users:
        assert "id" in user
        assert "email" in user
        assert "full_name" in user
