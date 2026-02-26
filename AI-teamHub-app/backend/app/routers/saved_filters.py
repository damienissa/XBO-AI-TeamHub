# backend/app/routers/saved_filters.py
# Saved filter presets — ADV-07
# Users can save current board filter state with a name and reload presets.

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.saved_filter import SavedFilter
from app.models.user import User
from app.schemas.saved_filter import SavedFilterCreate, SavedFilterOut

router = APIRouter()


@router.get("/", response_model=list[SavedFilterOut])
async def list_saved_filters(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SavedFilter]:
    """Return caller's saved filters ordered by created_at DESC."""
    result = await db.execute(
        select(SavedFilter)
        .where(SavedFilter.user_id == current_user.id)
        .order_by(SavedFilter.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=SavedFilterOut, status_code=201)
async def create_saved_filter(
    data: SavedFilterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SavedFilter:
    """Save current filter state as a named preset for the current user."""
    saved_filter = SavedFilter(
        user_id=current_user.id,
        name=data.name,
        filter_state=data.filter_state,
    )
    db.add(saved_filter)
    await db.commit()
    await db.refresh(saved_filter)
    return saved_filter


@router.delete("/{filter_id}", status_code=204)
async def delete_saved_filter(
    filter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a saved filter. Only the owning user can delete their own filters."""
    result = await db.execute(
        select(SavedFilter).where(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == current_user.id,
        )
    )
    saved_filter = result.scalar_one_or_none()
    if saved_filter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved filter not found or not owned by current user",
        )
    await db.delete(saved_filter)
    await db.commit()
