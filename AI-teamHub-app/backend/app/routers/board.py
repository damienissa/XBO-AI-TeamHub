# backend/app/routers/board.py
# GET /api/board — returns all tickets with eagerly loaded owner/department.
# BOARD-08: Uses selectinload to eliminate N+1 queries.
# Additional query for open ColumnHistory rows to compute time_in_column.

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.column_history import ColumnHistory
from app.models.ticket import Priority, StatusColumn, Ticket
from app.models.ticket_contact import TicketContact
from app.models.ticket_dependency import ticket_dependencies
from app.models.ticket_subtask import TicketSubtask
from app.models.user import User
from app.schemas.ticket import BoardTicketOut
from app.schemas.ticket_contact import ContactOut

router = APIRouter()


def _format_time_in_column(entered_at: datetime) -> str:
    """Compute human-readable time since a column was entered."""
    now = datetime.now(timezone.utc)
    if entered_at.tzinfo is None:
        entered_at = entered_at.replace(tzinfo=timezone.utc)
    delta = now - entered_at
    total_seconds = int(delta.total_seconds())
    if total_seconds < 3600:
        minutes = max(total_seconds // 60, 1)
        return f"{minutes}m in column"
    elif total_seconds < 86400:
        hours = total_seconds // 3600
        return f"{hours}h in column"
    else:
        days = total_seconds // 86400
        return f"{days}d in column"


@router.get("/board", response_model=list[BoardTicketOut])
async def get_board(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    owner_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    priority: Optional[Priority] = Query(None),
    min_urgency: Optional[int] = Query(None, ge=1, le=5),
    max_urgency: Optional[int] = Query(None, ge=1, le=5),
    due_before: Optional[date] = Query(None),
    due_after: Optional[date] = Query(None),
    created_after: Optional[date] = Query(None),
    created_before: Optional[date] = Query(None),
    min_age_days: Optional[int] = Query(None, ge=0),
) -> list[BoardTicketOut]:
    """BOARD-08: Return all tickets with eager-loaded owner and department.

    No N+1 queries: uses selectinload for owner/department, then a single
    batch query for all open ColumnHistory rows to compute time_in_column.
    """
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.owner),
            selectinload(Ticket.department),
            selectinload(Ticket.contacts).selectinload(TicketContact.user),
        )
        .order_by(Ticket.created_at.asc())
    )

    if owner_id is not None:
        stmt = stmt.where(Ticket.owner_id == owner_id)

    if department_id is not None:
        stmt = stmt.where(Ticket.department_id == department_id)

    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)

    if min_urgency is not None:
        stmt = stmt.where(Ticket.urgency >= min_urgency)

    if max_urgency is not None:
        stmt = stmt.where(Ticket.urgency <= max_urgency)

    if due_before is not None:
        stmt = stmt.where(Ticket.due_date <= due_before)

    if due_after is not None:
        stmt = stmt.where(Ticket.due_date >= due_after)

    if created_after is not None:
        stmt = stmt.where(Ticket.created_at >= datetime(
            created_after.year, created_after.month, created_after.day,
            tzinfo=timezone.utc
        ))

    if created_before is not None:
        stmt = stmt.where(Ticket.created_at <= datetime(
            created_before.year, created_before.month, created_before.day, 23, 59, 59,
            tzinfo=timezone.utc
        ))

    if min_age_days is not None:
        # Aging: ticket must have been in its current column for at least N days.
        # Join on the open ColumnHistory row and filter by entered_at.
        cutoff = datetime.now(timezone.utc) - timedelta(days=min_age_days)
        stmt = stmt.join(
            ColumnHistory,
            (ColumnHistory.ticket_id == Ticket.id) & (ColumnHistory.exited_at.is_(None)),
        ).where(ColumnHistory.entered_at <= cutoff)

    result = await db.execute(stmt)
    tickets = result.scalars().all()

    if not tickets:
        return []

    # Batch query for open ColumnHistory rows — avoids N+1
    ticket_ids = [t.id for t in tickets]
    open_rows_result = await db.execute(
        select(ColumnHistory).where(
            ColumnHistory.exited_at.is_(None),
            ColumnHistory.ticket_id.in_(ticket_ids),
        )
    )
    open_rows_by_ticket = {row.ticket_id: row for row in open_rows_result.scalars().all()}

    # Batch query for subtask counts per ticket — single query, no selectinload (Pitfall 3 fix)
    subtask_counts_result = await db.execute(
        select(
            TicketSubtask.ticket_id,
            func.count(TicketSubtask.id).label("total"),
            func.sum(case((TicketSubtask.done == True, 1), else_=0)).label("done"),  # noqa: E712
        )
        .where(TicketSubtask.ticket_id.in_(ticket_ids))
        .group_by(TicketSubtask.ticket_id)
    )
    subtask_counts_by_ticket: dict[uuid.UUID, tuple[int, int]] = {
        row.ticket_id: (row.total, row.done)
        for row in subtask_counts_result
    }

    # Batch query for blocked_by count per ticket (ADV-04 badge) — single COUNT query
    blocked_by_counts_result = await db.execute(
        select(
            ticket_dependencies.c.blocked_id,
            func.count(ticket_dependencies.c.blocker_id).label("blocker_count"),
        )
        .where(ticket_dependencies.c.blocked_id.in_(ticket_ids))
        .group_by(ticket_dependencies.c.blocked_id)
    )
    blocked_by_counts: dict[uuid.UUID, int] = {
        row.blocked_id: row.blocker_count
        for row in blocked_by_counts_result
    }

    output = []
    for ticket in tickets:
        ticket_out = BoardTicketOut.model_validate(ticket)
        open_row = open_rows_by_ticket.get(ticket.id)
        if open_row is not None:
            ticket_out.time_in_column = _format_time_in_column(open_row.entered_at)
        counts = subtask_counts_by_ticket.get(ticket.id)
        if counts is not None:
            ticket_out.subtasks_total = counts[0]
            ticket_out.subtasks_done = counts[1]
        ticket_out.blocked_by_count = blocked_by_counts.get(ticket.id, 0)
        ticket_out.contacts = [
            ContactOut(
                id=c.id,
                ticket_id=c.ticket_id,
                user_id=c.user_id,
                name=c.user.full_name if c.user_id is not None else c.external_name,
                email=c.user.email if c.user_id is not None else c.external_email,
            )
            for c in ticket.contacts
        ]
        output.append(ticket_out)

    return output
