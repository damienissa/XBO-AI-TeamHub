# backend/app/routers/templates.py
# Ticket Template CRUD endpoints.
# All routes require authentication. Any authenticated user (admin or member) can CRUD templates.

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.ticket_template import TicketTemplate
from app.models.user import User
from app.schemas.ticket_template import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[TemplateOut])
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[TemplateOut]:
    """PORTAL-07: List all ticket templates."""
    result = await db.execute(
        select(TicketTemplate)
        .options(selectinload(TicketTemplate.created_by))
        .order_by(TicketTemplate.created_at.asc())
    )
    templates = result.scalars().all()
    return [TemplateOut.model_validate(t) for t in templates]


@router.post("/", response_model=TemplateOut, status_code=201)
async def create_template(
    data: TemplateCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TemplateOut:
    """PORTAL-07: Create a new ticket template."""
    template = TicketTemplate(
        title=data.title,
        problem_statement=data.problem_statement,
        default_urgency=data.default_urgency,
        default_effort_estimate=data.default_effort_estimate,
        default_next_step=data.default_next_step,
        created_by_id=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.patch("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> TemplateOut:
    """PORTAL-07: Partial update of a ticket template. Any authenticated user can update."""
    result = await db.execute(
        select(TicketTemplate).where(TicketTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> None:
    """PORTAL-07: Delete a ticket template. Any authenticated user can delete."""
    result = await db.execute(
        select(TicketTemplate).where(TicketTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    await db.delete(template)
    await db.commit()
