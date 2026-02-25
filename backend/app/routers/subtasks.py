# backend/app/routers/subtasks.py
# Subtask CRUD + reorder endpoints nested under /tickets/{ticket_id}/subtasks.
# All routes require authentication.

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_subtask import TicketSubtask
from app.models.user import User
from app.schemas.ticket_subtask import SubtaskCreate, SubtaskOut, SubtaskReorderRequest, SubtaskToggle

router = APIRouter(prefix="/tickets/{ticket_id}/subtasks", tags=["subtasks"])


async def _get_ticket_or_404(db: AsyncSession, ticket_id: uuid.UUID) -> None:
    result = await db.execute(select(Ticket.id).where(Ticket.id == ticket_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")


@router.post("/", response_model=SubtaskOut, status_code=201)
async def create_subtask(
    ticket_id: uuid.UUID,
    data: SubtaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubtaskOut:
    """COLLAB-04: Create a subtask at the end of the list (position = max + 1 or 0)."""
    await _get_ticket_or_404(db, ticket_id)

    max_pos_result = await db.execute(
        select(func.max(TicketSubtask.position)).where(TicketSubtask.ticket_id == ticket_id)
    )
    max_pos = max_pos_result.scalar()
    position = (max_pos + 1) if max_pos is not None else 0

    subtask = TicketSubtask(
        ticket_id=ticket_id,
        title=data.title,
        position=position,
    )
    db.add(subtask)
    await db.commit()
    await db.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


@router.patch("/{subtask_id}", response_model=SubtaskOut)
async def toggle_subtask(
    ticket_id: uuid.UUID,
    subtask_id: uuid.UUID,
    data: SubtaskToggle,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> SubtaskOut:
    """COLLAB-05: Toggle the done boolean on a subtask."""
    result = await db.execute(
        select(TicketSubtask).where(
            TicketSubtask.id == subtask_id,
            TicketSubtask.ticket_id == ticket_id,
        )
    )
    subtask = result.scalar_one_or_none()
    if subtask is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    subtask.done = data.done
    await db.commit()
    await db.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


@router.delete("/{subtask_id}", status_code=204)
async def delete_subtask(
    ticket_id: uuid.UUID,
    subtask_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a subtask and resequence remaining positions (Pitfall 2 fix: no gaps)."""
    result = await db.execute(
        select(TicketSubtask).where(
            TicketSubtask.id == subtask_id,
            TicketSubtask.ticket_id == ticket_id,
        )
    )
    subtask = result.scalar_one_or_none()
    if subtask is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    await db.delete(subtask)
    await db.flush()

    # Resequence remaining subtasks to eliminate gaps (0..N-1 by current position)
    remaining_result = await db.execute(
        select(TicketSubtask)
        .where(TicketSubtask.ticket_id == ticket_id)
        .order_by(TicketSubtask.position.asc())
    )
    remaining = remaining_result.scalars().all()
    for i, s in enumerate(remaining):
        s.position = i

    await db.commit()


@router.patch("/reorder", response_model=list[SubtaskOut])
async def reorder_subtasks(
    ticket_id: uuid.UUID,
    data: SubtaskReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[SubtaskOut]:
    """COLLAB-06: Reorder subtasks atomically. Assigns positions 0..N-1 per ordered_ids."""
    await _get_ticket_or_404(db, ticket_id)

    result = await db.execute(
        select(TicketSubtask).where(TicketSubtask.ticket_id == ticket_id)
    )
    subtasks = result.scalars().all()
    subtask_map = {s.id: s for s in subtasks}

    # Validate that all submitted IDs belong to this ticket
    if set(data.ordered_ids) != set(subtask_map.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_ids must contain exactly the subtask IDs for this ticket",
        )

    for i, subtask_id in enumerate(data.ordered_ids):
        subtask_map[subtask_id].position = i

    await db.commit()
    return [SubtaskOut.model_validate(s) for s in sorted(subtasks, key=lambda s: s.position)]
