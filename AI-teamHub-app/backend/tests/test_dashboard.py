# backend/tests/test_dashboard.py
# Tests for dashboard endpoints: GET /api/dashboard, GET /api/dashboard/dept/{slug}

import uuid
from datetime import date, timedelta

from httpx import AsyncClient


async def test_dashboard_empty_db_response_shape(auth_client: AsyncClient):
    """Dashboard returns correct shape even with no tickets."""
    r = await auth_client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "open_ticket_count" in data
    assert "overdue_count" in data
    assert "throughput_last_week" in data
    assert "avg_cycle_time_hours" in data
    assert "column_times" in data
    assert "workload" in data
    assert "dept_breakdown" in data
    assert "throughput_trend" in data
    assert "status_breakdown" in data
    assert "tickets_by_owner" in data
    assert "upcoming_releases" in data


async def test_dashboard_open_ticket_count(auth_client: AsyncClient, created_ticket: dict):
    r = await auth_client.get("/api/dashboard")
    assert r.status_code == 200
    assert r.json()["open_ticket_count"] >= 1


async def test_dashboard_overdue_count(auth_client: AsyncClient, created_ticket: dict):
    """Set due_date in the past and verify overdue_count increments."""
    ticket_id = created_ticket["id"]
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"due_date": yesterday})
    r = await auth_client.get("/api/dashboard")
    assert r.status_code == 200
    assert r.json()["overdue_count"] >= 1


async def test_dashboard_status_breakdown(auth_client: AsyncClient, created_ticket: dict):
    r = await auth_client.get("/api/dashboard")
    data = r.json()
    assert isinstance(data["status_breakdown"], list)
    statuses = [s["status"] for s in data["status_breakdown"]]
    assert "Backlog" in statuses


async def test_dashboard_dept_breakdown(auth_client: AsyncClient, created_ticket: dict):
    r = await auth_client.get("/api/dashboard")
    data = r.json()
    assert isinstance(data["dept_breakdown"], list)
    assert len(data["dept_breakdown"]) >= 1


async def test_dashboard_upcoming_releases(auth_client: AsyncClient, created_ticket: dict):
    """Ticket with due_date and not Done appears in upcoming_releases."""
    ticket_id = created_ticket["id"]
    future = (date.today() + timedelta(days=30)).isoformat()
    await auth_client.patch(f"/api/tickets/{ticket_id}", json={"due_date": future})
    r = await auth_client.get("/api/dashboard")
    releases = r.json()["upcoming_releases"]
    assert len(releases) >= 1
    assert releases[0]["ticket_id"] == ticket_id


async def test_dashboard_unauthenticated(client, seeded_db):
    r = await client.get("/api/dashboard")
    assert r.status_code == 401


async def test_dept_dashboard_valid_slug(auth_client: AsyncClient):
    r = await auth_client.get("/api/dashboard/dept/cashier")
    assert r.status_code == 200
    data = r.json()
    assert data["department"]["slug"] == "cashier"
    assert "open_ticket_count" in data
    assert "avg_age_open_hours" in data
    assert "avg_cycle_time_hours" in data
    assert "tickets" in data


async def test_dept_dashboard_invalid_slug_404(auth_client: AsyncClient):
    r = await auth_client.get("/api/dashboard/dept/nonexistent")
    assert r.status_code == 404


async def test_dept_dashboard_with_tickets(auth_client: AsyncClient, created_ticket: dict):
    """Department dashboard includes tickets for that department."""
    r = await auth_client.get("/api/dashboard/dept/cashier")
    assert r.status_code == 200
    data = r.json()
    assert data["open_ticket_count"] >= 1
    ticket_ids = [t["id"] for t in data["tickets"]]
    assert created_ticket["id"] in ticket_ids
