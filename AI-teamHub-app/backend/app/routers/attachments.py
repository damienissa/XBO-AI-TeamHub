"""Ticket attachment endpoints.

Registered under /api/tickets — so paths here start with /{ticket_id}/attachments.
"""

import logging
import re
import uuid

logger = logging.getLogger(__name__)
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_attachment import TicketAttachment
from app.schemas.ticket_attachment import AttachmentOut
from app.services.file_extraction import ALLOWED_CONTENT_TYPES, resolve_content_type
from app.models.user import User

router = APIRouter(tags=["attachments"])

_SAFE_RE = re.compile(r"[^\w.\-]")


def _safe_filename(name: str) -> str:
    """Sanitise a filename to safe ASCII characters."""
    return _SAFE_RE.sub("_", name)[:200]


def _attachment_path(ticket_id: uuid.UUID, attachment_id: uuid.UUID, filename: str) -> Path:
    return Path(settings.UPLOAD_DIR) / str(ticket_id) / f"{attachment_id}_{_safe_filename(filename)}"


# ---- LIST ------------------------------------------------------------------


@router.get("/{ticket_id}/attachments", response_model=list[AttachmentOut])
async def list_attachments(
    ticket_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> list[AttachmentOut]:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result = await db.execute(
        select(TicketAttachment)
        .where(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at)
    )
    return result.scalars().all()


# ---- UPLOAD ----------------------------------------------------------------


@router.post(
    "/{ticket_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    ticket_id: uuid.UUID,
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> AttachmentOut:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    content_type = resolve_content_type(
        file.content_type or "application/octet-stream",
        file.filename or "",
    )
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, TXT, MD.",
        )

    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(65_536):
        total += len(chunk)
        if total > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_BYTES // 1_048_576} MB.",
            )
        chunks.append(chunk)
    data = b"".join(chunks)

    attachment_id = uuid.uuid4()
    dest = _attachment_path(ticket_id, attachment_id, file.filename or "upload")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    attachment = TicketAttachment(
        id=attachment_id,
        ticket_id=ticket_id,
        filename=file.filename or "upload",
        content_type=content_type,
        size_bytes=len(data),
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment


# ---- DOWNLOAD --------------------------------------------------------------


@router.get("/{ticket_id}/attachments/{attachment_id}/download")
async def download_attachment(
    ticket_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    attachment = await db.get(TicketAttachment, attachment_id)
    if attachment is None or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = _attachment_path(ticket_id, attachment_id, attachment.filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(path),
        media_type=attachment.content_type,
        filename=attachment.filename,
    )


# ---- ATTACHMENT TEXT (for AI context) -------------------------------------


@router.get("/{ticket_id}/attachments/text")
async def get_attachments_text(
    ticket_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return concatenated extracted text from all ticket attachments (for AI context)."""
    from app.services.file_extraction import extract_text, AI_CONTEXT_CHARS

    result = await db.execute(
        select(TicketAttachment)
        .where(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at)
    )
    attachments = result.scalars().all()

    parts: list[str] = []
    for att in attachments:
        path = _attachment_path(ticket_id, att.id, att.filename)
        if path.exists():
            try:
                text = extract_text(path.read_bytes(), att.content_type)
                if text.strip():
                    parts.append(f"[{att.filename}]\n{text.strip()}")
            except Exception:
                logger.warning("Failed to extract text from %s", att.filename, exc_info=True)

    combined = "\n\n".join(parts)[:AI_CONTEXT_CHARS]
    return {"text": combined or None}


# ---- DELETE ----------------------------------------------------------------


@router.delete("/{ticket_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    ticket_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> None:
    attachment = await db.get(TicketAttachment, attachment_id)
    if attachment is None or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = _attachment_path(ticket_id, attachment_id, attachment.filename)
    if path.exists():
        path.unlink()

    await db.delete(attachment)
    await db.commit()
