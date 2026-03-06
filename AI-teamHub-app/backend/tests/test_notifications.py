# backend/tests/test_notifications.py
# Tests for notification endpoints: /api/notifications

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def _create_notification(db: AsyncSession, user_id, ticket_id=None) -> Notification:
    """Insert a notification directly into the DB for testing."""
    notif = Notification(
        user_id=user_id,
        type="test",
        message="Test notification",
        ticket_id=ticket_id,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


async def test_list_notifications_empty(auth_client: AsyncClient):
    r = await auth_client.get("/api/notifications/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_list_notifications_after_insert(
    auth_client: AsyncClient, seeded_db: AsyncSession, admin_user_id
):
    await _create_notification(seeded_db, admin_user_id)
    r = await auth_client.get("/api/notifications/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_mark_all_read(
    auth_client: AsyncClient, seeded_db: AsyncSession, admin_user_id
):
    await _create_notification(seeded_db, admin_user_id)
    r = await auth_client.patch("/api/notifications/read-all")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # Verify all are read
    list_r = await auth_client.get("/api/notifications/")
    for n in list_r.json():
        assert n["read"] is True


async def test_mark_single_read(
    auth_client: AsyncClient, seeded_db: AsyncSession, admin_user_id
):
    notif = await _create_notification(seeded_db, admin_user_id)
    r = await auth_client.patch(f"/api/notifications/{notif.id}/read")
    assert r.status_code == 200
    assert r.json()["read"] is True


async def test_mark_nonexistent_notification_404(auth_client: AsyncClient):
    r = await auth_client.patch(f"/api/notifications/{uuid.uuid4()}/read")
    assert r.status_code == 404


async def test_mark_other_users_notification_404(
    member_client: AsyncClient, seeded_db: AsyncSession, admin_user_id
):
    """A user cannot mark another user's notification as read."""
    notif = await _create_notification(seeded_db, admin_user_id)
    r = await member_client.patch(f"/api/notifications/{notif.id}/read")
    assert r.status_code == 404


async def test_notifications_unauthenticated(client, seeded_db):
    r = await client.get("/api/notifications/")
    assert r.status_code == 401
