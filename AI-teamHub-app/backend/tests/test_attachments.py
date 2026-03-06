# backend/tests/test_attachments.py
# Tests for attachment endpoints: /api/tickets/{ticket_id}/attachments
# Uses monkeypatch to redirect UPLOAD_DIR to a temp directory.

import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.fixture(autouse=True)
def _redirect_uploads(tmp_path, monkeypatch):
    """Point UPLOAD_DIR to a temp dir for safe file I/O during tests."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))


async def test_list_attachments_empty(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/attachments")
    assert r.status_code == 200
    assert r.json() == []


async def test_upload_txt_attachment(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(
        f"/api/tickets/{ticket_id}/attachments",
        files={"file": ("test.txt", b"Hello world", "text/plain")},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["filename"] == "test.txt"
    assert data["size_bytes"] == len(b"Hello world")
    assert data["content_type"] == "text/plain"


async def test_upload_unsupported_type_415(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.post(
        f"/api/tickets/{ticket_id}/attachments",
        files={"file": ("virus.exe", b"\x00\x01", "application/octet-stream")},
    )
    assert r.status_code == 415


async def test_upload_to_nonexistent_ticket_404(auth_client: AsyncClient):
    fake_id = str(uuid.uuid4())
    r = await auth_client.post(
        f"/api/tickets/{fake_id}/attachments",
        files={"file": ("test.txt", b"data", "text/plain")},
    )
    assert r.status_code == 404


async def test_download_attachment(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    upload_r = await auth_client.post(
        f"/api/tickets/{ticket_id}/attachments",
        files={"file": ("dl.txt", b"download me", "text/plain")},
    )
    att_id = upload_r.json()["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/attachments/{att_id}/download")
    assert r.status_code == 200
    assert r.content == b"download me"


async def test_download_nonexistent_attachment_404(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.get(f"/api/tickets/{ticket_id}/attachments/{uuid.uuid4()}/download")
    assert r.status_code == 404


async def test_delete_attachment(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    upload_r = await auth_client.post(
        f"/api/tickets/{ticket_id}/attachments",
        files={"file": ("del.txt", b"delete me", "text/plain")},
    )
    att_id = upload_r.json()["id"]
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/attachments/{att_id}")
    assert r.status_code == 204
    # Verify gone
    list_r = await auth_client.get(f"/api/tickets/{ticket_id}/attachments")
    assert all(a["id"] != att_id for a in list_r.json())


async def test_delete_nonexistent_attachment_404(auth_client: AsyncClient, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await auth_client.delete(f"/api/tickets/{ticket_id}/attachments/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_attachments_unauthenticated(client, seeded_db, created_ticket: dict):
    ticket_id = created_ticket["id"]
    r = await client.get(f"/api/tickets/{ticket_id}/attachments")
    assert r.status_code == 401
