"""Replace-all contacts for a ticket within an existing transaction."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_contact import TicketContact
from app.models.user import User
from app.schemas.ticket_contact import ContactIn, ContactOut


async def replace_contacts(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    contacts_in: list[ContactIn],
) -> list[ContactOut]:
    """Delete existing contacts and insert the new list.

    Runs within the caller's transaction — caller must commit.
    Returns the resolved ContactOut list for use in the API response.
    """
    # 1. Remove all existing contacts for this ticket
    await db.execute(
        delete(TicketContact).where(TicketContact.ticket_id == ticket_id)
    )

    if not contacts_in:
        return []

    # 2. Batch-fetch internal users to avoid N+1
    internal_ids = [c.user_id for c in contacts_in if c.user_id is not None]
    user_map: dict[uuid.UUID, User] = {}
    if internal_ids:
        result = await db.execute(select(User).where(User.id.in_(internal_ids)))
        user_map = {u.id: u for u in result.scalars().all()}

    # 3. Insert new rows
    out: list[ContactOut] = []
    for c in contacts_in:
        if c.user_id is not None:
            user = user_map.get(c.user_id)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"User {c.user_id} not found",
                )
            row = TicketContact(
                ticket_id=ticket_id,
                user_id=c.user_id,
                external_name=None,
                external_email=None,
            )
            db.add(row)
            await db.flush()
            out.append(ContactOut(
                id=row.id,
                ticket_id=ticket_id,
                user_id=c.user_id,
                name=user.full_name,
                email=user.email,
            ))
        else:
            if not c.external_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="external_name is required for external contacts",
                )
            row = TicketContact(
                ticket_id=ticket_id,
                user_id=None,
                external_name=c.external_name,
                external_email=c.external_email,
            )
            db.add(row)
            await db.flush()
            out.append(ContactOut(
                id=row.id,
                ticket_id=ticket_id,
                user_id=None,
                name=c.external_name,
                email=c.external_email,
            ))

    return out
