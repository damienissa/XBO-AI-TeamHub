# backend/app/routers/comments.py
# Comment CRUD endpoints nested under /tickets/{ticket_id}/comments.
# All routes require authentication. DELETE requires author or admin role.

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_comment import TicketComment
from app.models.ticket_event import TicketEvent
from app.models.user import User
from app.schemas.ticket_comment import CommentCreate, CommentOut

router = APIRouter(prefix="/tickets/{ticket_id}/comments", tags=["comments"])


async def _get_ticket_or_404(db: AsyncSession, ticket_id: uuid.UUID) -> Ticket:
    result = await db.execute(select(Ticket.id).where(Ticket.id == ticket_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    # Return a lightweight ticket shell — just need to confirm existence
    ticket_result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    return ticket_result.scalar_one()


@router.post("/", response_model=CommentOut, status_code=201)
async def create_comment(
    ticket_id: uuid.UUID,
    data: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentOut:
    """COLLAB-01: Create a comment on a ticket. Emits TicketEvent type='comment_added'."""
    await _get_ticket_or_404(db, ticket_id)

    comment = TicketComment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        body=data.body,
    )
    db.add(comment)

    event = TicketEvent(
        ticket_id=ticket_id,
        event_type="comment_added",
        payload={"body_preview": data.body[:100]},
        actor_id=current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(comment)

    # Eager-load author for response
    result = await db.execute(
        select(TicketComment)
        .options(selectinload(TicketComment.author))
        .where(TicketComment.id == comment.id)
    )
    loaded = result.scalar_one()
    out = CommentOut.model_validate(loaded)
    out.author_name = loaded.author.full_name if loaded.author else None
    return out


@router.get("/", response_model=list[CommentOut])
async def list_comments(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[CommentOut]:
    """COLLAB-02: List comments for a ticket in chronological order (ASC)."""
    await _get_ticket_or_404(db, ticket_id)

    result = await db.execute(
        select(TicketComment)
        .options(selectinload(TicketComment.author))
        .where(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
    )
    comments = result.scalars().all()

    out = []
    for c in comments:
        item = CommentOut.model_validate(c)
        item.author_name = c.author.full_name if c.author else None
        out.append(item)
    return out


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    ticket_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """COLLAB-03: Author or admin can delete a comment. 403 for non-author non-admin."""
    result = await db.execute(
        select(TicketComment).where(
            TicketComment.id == comment_id,
            TicketComment.ticket_id == ticket_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment",
        )

    await db.delete(comment)
    await db.commit()
