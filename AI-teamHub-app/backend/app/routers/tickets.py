# backend/app/routers/tickets.py
# Ticket CRUD + move + events/history endpoints.
# All routes require authentication. DELETE requires admin role (TICKET-04).

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.column_history import ColumnHistory
from app.models.ticket import StatusColumn, Ticket
from app.models.ticket_contact import TicketContact
from app.models.ticket_event import TicketEvent
from app.models.user import User
from app.schemas.column_history import ColumnHistoryOut
from app.schemas.ticket import TicketCreate, TicketMoveRequest, TicketOut, TicketUpdate
from app.schemas.ticket_contact import ContactOut
from app.schemas.ticket_event import TicketEventOut
from app.services.contacts import replace_contacts
from app.services.notifications import notify_assignment, notify_mentions, notify_status_change
from app.services.roi import compute_roi_fields
from app.services.tickets import create_ticket, move_ticket

# ROI input fields that trigger server-side recomputation when any is present
_ROI_INPUT_FIELDS = frozenset({
    "current_time_cost_hours_per_week",
    "employees_affected",
    "avg_hourly_cost",
    "effort_estimate",
})

router = APIRouter()


def _compute_time_in_column(entered_at: datetime) -> str:
    """Compute human-readable time since a column was entered."""
    now = datetime.now(timezone.utc)
    # Ensure entered_at is timezone-aware
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


async def _load_ticket_out(db: AsyncSession, ticket_id: uuid.UUID) -> TicketOut:
    """Fetch ticket with eager-loaded owner/department/contacts and compute time_in_column."""
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.owner),
            selectinload(Ticket.department),
            selectinload(Ticket.contacts).selectinload(TicketContact.user),
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Find the open column history row for time_in_column
    hist_result = await db.execute(
        select(ColumnHistory).where(
            ColumnHistory.ticket_id == ticket_id,
            ColumnHistory.exited_at.is_(None),
        )
    )
    open_row = hist_result.scalar_one_or_none()

    ticket_out = TicketOut.model_validate(ticket)
    if open_row is not None:
        ticket_out.time_in_column = _compute_time_in_column(open_row.entered_at)

    # Manually resolve contacts (name/email are computed, not raw ORM columns)
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

    return ticket_out


@router.post("/", response_model=TicketOut, status_code=201)
async def create_ticket_endpoint(
    data: TicketCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TicketOut:
    """TICKET-02: Create ticket in Backlog with owner_id=null. Emits TicketEvent."""
    ticket = await create_ticket(db, data, actor_id=current_user.id)
    return await _load_ticket_out(db, ticket.id)


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> TicketOut:
    """Fetch a single ticket with owner, department, and time_in_column."""
    return await _load_ticket_out(db, ticket_id)


_MENTION_FIELDS = frozenset({"problem_statement", "business_impact", "next_step", "success_criteria"})


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: uuid.UUID,
    data: TicketUpdate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TicketOut:
    """Partial update. Emits TicketEvent(event_type='edited') for changed fields."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    update_data = data.model_dump(exclude_unset=True)
    old_owner_id = ticket.owner_id
    changed_fields = []

    # Pop contacts before the setattr loop — handled separately via replace_contacts()
    contacts_in = update_data.pop("contacts", None)

    # Defense-in-depth: only allow fields explicitly defined in TicketUpdate schema
    _allowed = frozenset(TicketUpdate.model_fields.keys()) - {"contacts"}
    for field, value in update_data.items():
        if field not in _allowed:
            continue
        if getattr(ticket, field) != value:
            setattr(ticket, field, value)
            changed_fields.append(field)

    # If any ROI input field was updated, recompute all derived ROI output fields
    if _ROI_INPUT_FIELDS.intersection(update_data.keys()):
        roi_computed = compute_roi_fields(
            current_time_cost_hours_per_week=ticket.current_time_cost_hours_per_week,
            employees_affected=ticket.employees_affected,
            avg_hourly_cost=ticket.avg_hourly_cost,
            effort_estimate=ticket.effort_estimate,
            ai_team_hourly_rate=settings.AI_TEAM_HOURLY_RATE,
        )
        for col, val in roi_computed.items():
            setattr(ticket, col, val)
            if col not in changed_fields:
                changed_fields.append(col)

    # Replace contacts if provided (runs regardless of other field changes)
    if contacts_in is not None:
        from app.schemas.ticket_contact import ContactIn as _ContactIn
        contacts_in = [_ContactIn(**c) if isinstance(c, dict) else c for c in contacts_in]
        await replace_contacts(db, ticket_id, contacts_in)
        if "contacts" not in changed_fields:
            changed_fields.append("contacts")

    if changed_fields:
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type="edited",
            payload={"fields": changed_fields},
            actor_id=current_user.id,
        )
        db.add(event)
        await db.commit()

        # Notify new owner if owner_id changed
        if "owner_id" in changed_fields and ticket.owner_id and ticket.owner_id != old_owner_id:
            await notify_assignment(db, ticket.owner_id, current_user, ticket, background_tasks)

        # Notify @mentions in TipTap fields
        for field in _MENTION_FIELDS.intersection(update_data.keys()):
            await notify_mentions(db, update_data[field], current_user, ticket, background_tasks)

        await db.commit()
    else:
        # No real changes, still refresh for consistent response
        await db.refresh(ticket)

    return await _load_ticket_out(db, ticket_id)


@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    """TICKET-04: Admin-only delete. CASCADE removes history + events."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    await db.delete(ticket)
    await db.commit()


@router.patch("/{ticket_id}/move", response_model=TicketOut)
async def move_ticket_endpoint(
    ticket_id: uuid.UUID,
    data: TicketMoveRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TicketOut:
    """TICKET-07/08: Move ticket with Backlog enforcement rules."""
    # Capture state before the move
    old_result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    old_ticket = old_result.scalar_one_or_none()
    if old_ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    old_status = old_ticket.status_column
    old_owner_id = old_ticket.owner_id

    ticket = await move_ticket(db, ticket_id, data, actor_id=current_user.id)

    # Notify on Backlog exit
    if old_status == StatusColumn.Backlog and ticket.status_column != StatusColumn.Backlog:
        if ticket.owner_id:
            await notify_status_change(
                db, ticket.owner_id, current_user, ticket, "Backlog", background_tasks
            )

    # Notify on new assignment during move
    if data.owner_id and data.owner_id != old_owner_id:
        await notify_assignment(db, data.owner_id, current_user, ticket, background_tasks)

    await db.commit()
    return await _load_ticket_out(db, ticket.id)


@router.patch("/{ticket_id}/custom-fields")
async def update_custom_fields(
    ticket_id: uuid.UUID,
    values: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """ADV-03: Replace ticket's custom_field_values JSONB with the provided dict."""
    import json as _json
    if len(_json.dumps(values)) > 65_536:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Custom field values payload too large (max 64 KB)",
        )
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket.custom_field_values = values
    await db.commit()
    await db.refresh(ticket)
    return {"custom_field_values": ticket.custom_field_values}


@router.get("/{ticket_id}/events", response_model=list[TicketEventOut])
async def get_ticket_events(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[TicketEvent]:
    """DETAIL-05: Return all events for a ticket ordered by created_at asc."""
    # Verify ticket exists
    exists = await db.execute(select(Ticket.id).where(Ticket.id == ticket_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    result = await db.execute(
        select(TicketEvent)
        .where(TicketEvent.ticket_id == ticket_id)
        .order_by(TicketEvent.created_at.asc())
    )
    return result.scalars().all()


@router.get("/{ticket_id}/history", response_model=list[ColumnHistoryOut])
async def get_ticket_history(
    ticket_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[ColumnHistoryOut]:
    """DETAIL-06: Return all column history entries ordered by entered_at asc."""
    # Verify ticket exists
    exists = await db.execute(select(Ticket.id).where(Ticket.id == ticket_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    result = await db.execute(
        select(ColumnHistory)
        .where(ColumnHistory.ticket_id == ticket_id)
        .order_by(ColumnHistory.entered_at.asc())
    )
    rows = result.scalars().all()
    return [ColumnHistoryOut.model_validate(row) for row in rows]
