# backend/app/routers/wiki.py
# Wiki page management — WIKI-01 through WIKI-04
# All authenticated users can read; admin and member can create/edit; only admin can delete.

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.wiki_page import WikiPage
from app.schemas.wiki_page import WikiPageCreate, WikiPageOut, WikiPageUpdate

router = APIRouter()


@router.get("/", response_model=list[WikiPageOut])
async def list_wiki_pages(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[WikiPage]:
    """WIKI-02: Return all wiki pages ordered by created_at. Frontend assembles tree from parent_id."""
    result = await db.execute(select(WikiPage).order_by(WikiPage.created_at))
    return result.scalars().all()


@router.post("/", response_model=WikiPageOut, status_code=201)
async def create_wiki_page(
    data: WikiPageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> WikiPage:
    """WIKI-03: Admin and member roles can create wiki pages."""
    # Validate parent_id if provided
    if data.parent_id is not None:
        parent_result = await db.execute(select(WikiPage.id).where(WikiPage.id == data.parent_id))
        if parent_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent wiki page not found",
            )

    page = WikiPage(
        title=data.title,
        content=data.content,
        parent_id=data.parent_id,
        created_by=current_user.id,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page


@router.get("/{page_id}", response_model=WikiPageOut)
async def get_wiki_page(
    page_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> WikiPage:
    """WIKI-04: All authenticated users can read wiki pages."""
    result = await db.execute(select(WikiPage).where(WikiPage.id == page_id))
    page = result.scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki page not found")
    return page


@router.patch("/{page_id}", response_model=WikiPageOut)
async def update_wiki_page(
    page_id: uuid.UUID,
    data: WikiPageUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> WikiPage:
    """WIKI-03: Admin and member roles can edit wiki pages."""
    result = await db.execute(select(WikiPage).where(WikiPage.id == page_id))
    page = result.scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki page not found")

    update_data = data.model_dump(exclude_unset=True)

    # Validate parent_id if being updated (prevent self-reference)
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        if update_data["parent_id"] == page_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A wiki page cannot be its own parent",
            )
        parent_result = await db.execute(
            select(WikiPage.id).where(WikiPage.id == update_data["parent_id"])
        )
        if parent_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent wiki page not found",
            )

    _allowed = frozenset(WikiPageUpdate.model_fields.keys())
    for field, value in update_data.items():
        if field in _allowed:
            setattr(page, field, value)

    page.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(page)
    return page


@router.delete("/{page_id}", status_code=204)
async def delete_wiki_page(
    page_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> None:
    """WIKI-04: Only admin can delete wiki pages.

    Child pages' parent_id becomes NULL via DB ON DELETE SET NULL cascade.
    """
    result = await db.execute(select(WikiPage).where(WikiPage.id == page_id))
    page = result.scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki page not found")
    await db.delete(page)
    await db.commit()
