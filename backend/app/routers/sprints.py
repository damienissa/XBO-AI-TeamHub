# backend/app/routers/sprints.py
# Sprint management — ADV-08 (create), ADV-09 (ticket assignment), ADV-10 (sprint board + velocity)

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.sprint import Sprint
from app.models.ticket import StatusColumn, Ticket
from app.models.user import User
from app.schemas.sprint import SprintBoardOut, SprintCreate, SprintOut, SprintUpdate, VelocityOut
from app.schemas.ticket import TicketOut

router = APIRouter()


@router.get("/", response_model=list[SprintOut])
async def list_sprints(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[Sprint]:
    """Return all sprints ordered by created_at DESC."""
    result = await db.execute(select(Sprint).order_by(Sprint.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=SprintOut, status_code=201)
async def create_sprint(
    data: SprintCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> Sprint:
    """ADV-08: Admin-only sprint creation."""
    sprint = Sprint(
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        created_by=current_user.id,
    )
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.get("/{sprint_id}", response_model=SprintOut)
async def get_sprint(
    sprint_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Sprint:
    """Get a single sprint by ID."""
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    return sprint


@router.patch("/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    sprint_id: uuid.UUID,
    data: SprintUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> Sprint:
    """Admin-only sprint update (name, start_date, end_date)."""
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sprint, field, value)

    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.delete("/{sprint_id}", status_code=204)
async def delete_sprint(
    sprint_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> None:
    """Admin-only sprint deletion. ON DELETE SET NULL on tickets.sprint_id handles orphan tickets."""
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    await db.delete(sprint)
    await db.commit()


@router.get("/{sprint_id}/board", response_model=SprintBoardOut)
async def get_sprint_board(
    sprint_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> SprintBoardOut:
    """ADV-10: Return sprint tickets + velocity metric (effort completed vs total).

    Velocity is calculated from effort_estimate on Done tickets vs all tickets in sprint.
    """
    # Verify sprint exists
    sprint_result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = sprint_result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    # Fetch tickets in sprint with eager-loaded owner + department
    tickets_result = await db.execute(
        select(Ticket)
        .where(Ticket.sprint_id == sprint_id)
        .options(selectinload(Ticket.owner), selectinload(Ticket.department))
    )
    tickets_list = tickets_result.scalars().all()

    # Compute velocity
    effort_total = sum(t.effort_estimate or 0 for t in tickets_list)
    effort_completed = sum(
        t.effort_estimate or 0 for t in tickets_list if t.status_column == StatusColumn.Done
    )
    pct = (effort_completed / effort_total * 100) if effort_total else 0

    return SprintBoardOut(
        sprint=SprintOut.model_validate(sprint),
        tickets=[TicketOut.model_validate(t) for t in tickets_list],
        velocity=VelocityOut(
            effort_completed=effort_completed,
            effort_total=effort_total,
            pct=pct,
        ),
    )
