# backend/app/services/tickets.py
# Business logic for ticket creation and column moves.
# All operations are atomic: create_ticket and move_ticket use a single transaction.

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.column_history import ColumnHistory
from app.models.ticket import StatusColumn, Ticket
from app.models.ticket_dependency import ticket_dependencies
from app.models.ticket_event import TicketEvent
from app.schemas.ticket import TicketCreate, TicketMoveRequest


async def check_not_blocked(db: AsyncSession, ticket_id: uuid.UUID) -> None:
    """ADV-05: Raise 409 if ticket has any blocking dependency not in Done.

    Queries blockers (tickets in ticket_dependencies.blocker_id) for this ticket
    and rejects the move if any blocker is not in the Done status column.
    """
    result = await db.execute(
        select(Ticket)
        .join(ticket_dependencies, ticket_dependencies.c.blocker_id == Ticket.id)
        .where(ticket_dependencies.c.blocked_id == ticket_id)
        .where(Ticket.status_column != StatusColumn.Done)
    )
    blockers = result.scalars().all()
    if blockers:
        ids = ", ".join(str(b.id)[:8] for b in blockers)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "BLOCKED",
                "blocker_ids": [str(b.id) for b in blockers],
                "message": f"Blocked by {ids} — resolve first",
            },
        )


async def create_ticket(db: AsyncSession, data: TicketCreate, actor_id: uuid.UUID) -> Ticket:
    """Create a ticket in Backlog with owner_id=None and emit a TicketEvent.

    All three writes (ticket, column_history, ticket_event) happen in a single
    transaction so partial failures are impossible.
    """
    now = datetime.now(timezone.utc)

    ticket = Ticket(
        title=data.title,
        department_id=data.department_id,
        problem_statement=data.problem_statement,
        urgency=data.urgency,
        business_impact=data.business_impact,
        success_criteria=data.success_criteria,
        due_date=data.due_date,
        effort_estimate=data.effort_estimate,
        next_step=data.next_step,
        priority=data.priority,
        status_column=StatusColumn.Backlog,
        owner_id=None,
        current_time_cost_hours_per_week=data.current_time_cost_hours_per_week,
        employees_affected=data.employees_affected,
        avg_hourly_cost=data.avg_hourly_cost,
    )
    db.add(ticket)
    await db.flush()  # get ticket.id without committing

    history = ColumnHistory(
        ticket_id=ticket.id,
        column=StatusColumn.Backlog.value,
        entered_at=now,
        exited_at=None,
    )
    db.add(history)

    event = TicketEvent(
        ticket_id=ticket.id,
        event_type="created",
        payload={"title": data.title},
        actor_id=actor_id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def move_ticket(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    data: TicketMoveRequest,
    actor_id: uuid.UUID,
) -> Ticket:
    """Move a ticket to a new column atomically.

    Rules enforced (TICKET-07, TICKET-08):
    - Backlog tickets cannot have an owner.
    - Moving OUT of Backlog requires owner_id if ticket has no owner.

    Atomically:
    1. Close the open ColumnHistory row (exited_at = now)
    2. Open a new ColumnHistory row for the target column
    3. Emit TicketEvent(event_type="moved", ...)
    4. Optionally emit TicketEvent(event_type="assigned", ...) if owner changes
    """
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # TICKET-07: Backlog cannot have an owner
    if data.target_column == StatusColumn.Backlog and data.owner_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Backlog tickets cannot have an owner",
        )

    # TICKET-08: Moving out of Backlog requires owner_id unless ticket already has one
    is_backlog_exit = (
        ticket.status_column == StatusColumn.Backlog
        and data.target_column != StatusColumn.Backlog
    )
    if is_backlog_exit and ticket.owner_id is None and data.owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="owner_id required when moving out of Backlog",
        )

    # ADV-05: Reject Backlog exit if any blocking dependency is not in Done
    if is_backlog_exit:
        await check_not_blocked(db, ticket_id)

    now = datetime.now(timezone.utc)

    # Close the current open ColumnHistory row
    open_row_result = await db.execute(
        select(ColumnHistory).where(
            ColumnHistory.ticket_id == ticket_id,
            ColumnHistory.exited_at.is_(None),
        )
    )
    open_row = open_row_result.scalar_one_or_none()
    if open_row is not None:
        open_row.exited_at = now

    # Open a new ColumnHistory row for the target column
    new_history = ColumnHistory(
        ticket_id=ticket_id,
        column=data.target_column.value,
        entered_at=now,
        exited_at=None,
    )
    db.add(new_history)

    # Emit "moved" event
    moved_event = TicketEvent(
        ticket_id=ticket_id,
        event_type="moved",
        payload={
            "from": ticket.status_column.value,
            "to": data.target_column.value,
        },
        actor_id=actor_id,
    )
    db.add(moved_event)

    # Update ticket status
    ticket.status_column = data.target_column

    # Handle owner assignment
    if data.owner_id is not None and data.owner_id != ticket.owner_id:
        ticket.owner_id = data.owner_id
        assigned_event = TicketEvent(
            ticket_id=ticket_id,
            event_type="assigned",
            payload={"owner_id": str(data.owner_id)},
            actor_id=actor_id,
        )
        db.add(assigned_event)

    await db.commit()
    await db.refresh(ticket)
    return ticket
