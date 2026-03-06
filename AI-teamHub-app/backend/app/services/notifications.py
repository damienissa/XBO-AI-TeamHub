import uuid
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from app.services.email import send_email
from app.services.mention_parser import extract_mentioned_user_ids


async def _get_user_email(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    result = await db.execute(select(User.email).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    ticket_id: uuid.UUID | None,
    type: str,
    message: str,
    background_tasks: BackgroundTasks,
) -> None:
    """Insert a Notification row and schedule an email send."""
    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        ticket_id=ticket_id,
        type=type,
        message=message,
    )
    db.add(notif)
    await db.flush()

    # Schedule email asynchronously (non-blocking)
    email = await _get_user_email(db, user_id)
    if email:
        background_tasks.add_task(
            send_email,
            to=email,
            subject=f"[AI Hub] {message}",
            body=message,
        )


async def notify_mentions(
    db: AsyncSession,
    content: Any,
    actor: User,
    ticket: Any,
    background_tasks: BackgroundTasks,
) -> None:
    """Extract @mentions from TipTap content and notify each mentioned user."""
    mentioned_ids = extract_mentioned_user_ids(content)
    for uid_str in mentioned_ids:
        try:
            uid = uuid.UUID(uid_str)
        except ValueError:
            continue
        # Don't notify the actor themselves
        if uid == actor.id:
            continue
        message = f"{actor.full_name} mentioned you in ticket: {ticket.title}"
        await create_notification(
            db=db,
            user_id=uid,
            actor_id=actor.id,
            ticket_id=ticket.id,
            type="mention",
            message=message,
            background_tasks=background_tasks,
        )


async def notify_assignment(
    db: AsyncSession,
    owner_id: uuid.UUID,
    actor: User,
    ticket: Any,
    background_tasks: BackgroundTasks,
) -> None:
    """Notify the newly assigned owner of a ticket."""
    if owner_id == actor.id:
        return
    message = f"{actor.full_name} assigned you to ticket: {ticket.title}"
    await create_notification(
        db=db,
        user_id=owner_id,
        actor_id=actor.id,
        ticket_id=ticket.id,
        type="assignment",
        message=message,
        background_tasks=background_tasks,
    )


async def notify_status_change(
    db: AsyncSession,
    owner_id: uuid.UUID,
    actor: User,
    ticket: Any,
    from_col: str,
    background_tasks: BackgroundTasks,
) -> None:
    """Notify the owner when a ticket moves out of Backlog."""
    if owner_id == actor.id:
        return
    message = (
        f"{actor.full_name} moved ticket '{ticket.title}' "
        f"from {from_col} to {ticket.status_column.value}"
    )
    await create_notification(
        db=db,
        user_id=owner_id,
        actor_id=actor.id,
        ticket_id=ticket.id,
        type="status_change",
        message=message,
        background_tasks=background_tasks,
    )
