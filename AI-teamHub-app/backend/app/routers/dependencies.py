# backend/app/routers/dependencies.py
# Ticket dependency management — routes nested under /api/tickets/{ticket_id}/dependencies
# ADV-04: ticket can block one or more other tickets
# ADV-05: blocker check is in services/tickets.py move_ticket

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_dependency import ticket_dependencies
from app.models.user import User
from app.schemas.ticket_dependency import DependenciesOut, DependencyCreate, DependencyOut

router = APIRouter()


@router.get("/{ticket_id}/dependencies", response_model=DependenciesOut)
async def get_dependencies(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DependenciesOut:
    """Return both blocks and blocked_by lists for a ticket."""
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.blocks),
            selectinload(Ticket.blocked_by),
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    return DependenciesOut(
        blocks=[DependencyOut(id=t.id, title=t.title, status_column=t.status_column.value) for t in ticket.blocks],
        blocked_by=[DependencyOut(id=t.id, title=t.title, status_column=t.status_column.value) for t in ticket.blocked_by],
    )


@router.post("/{ticket_id}/dependencies", response_model=DependenciesOut, status_code=201)
async def add_dependency(
    ticket_id: uuid.UUID,
    data: DependencyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DependenciesOut:
    """Add a dependency: blocking_ticket_id blocks ticket_id.

    The blocker ticket must exist. Cannot add self-dependency.
    """
    if data.blocking_ticket_id == ticket_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A ticket cannot block itself",
        )

    # Verify both tickets exist
    blocked_result = await db.execute(select(Ticket.id).where(Ticket.id == ticket_id))
    if blocked_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    blocker_result = await db.execute(select(Ticket.id).where(Ticket.id == data.blocking_ticket_id))
    if blocker_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blocking ticket not found")

    # Check if dependency already exists
    existing = await db.execute(
        select(ticket_dependencies).where(
            ticket_dependencies.c.blocker_id == data.blocking_ticket_id,
            ticket_dependencies.c.blocked_id == ticket_id,
        )
    )
    if existing.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dependency already exists",
        )

    # Insert the dependency row
    await db.execute(
        ticket_dependencies.insert().values(
            blocker_id=data.blocking_ticket_id,
            blocked_id=ticket_id,
        )
    )
    await db.commit()

    # Return updated dependency lists
    return await _get_dependencies_out(db, ticket_id)


@router.delete("/{ticket_id}/dependencies/{blocking_ticket_id}", status_code=204)
async def remove_dependency(
    ticket_id: uuid.UUID,
    blocking_ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> None:
    """Remove dependency where blocking_ticket_id blocks ticket_id."""
    result = await db.execute(
        delete(ticket_dependencies).where(
            ticket_dependencies.c.blocker_id == blocking_ticket_id,
            ticket_dependencies.c.blocked_id == ticket_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")
    await db.commit()


async def _get_dependencies_out(db: AsyncSession, ticket_id: uuid.UUID) -> DependenciesOut:
    """Helper: reload ticket with eager-loaded blocks/blocked_by and return DependenciesOut."""
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.blocks),
            selectinload(Ticket.blocked_by),
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    return DependenciesOut(
        blocks=[DependencyOut(id=t.id, title=t.title, status_column=t.status_column.value) for t in ticket.blocks],
        blocked_by=[DependencyOut(id=t.id, title=t.title, status_column=t.status_column.value) for t in ticket.blocked_by],
    )
