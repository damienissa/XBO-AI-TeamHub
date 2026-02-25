# backend/app/routers/custom_fields.py
# Custom field definition management — ADV-01, ADV-02, ADV-03
# Workspace fields: admin-defined, shared across all users
# Personal fields: user-defined, private to creator

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.custom_field import CustomFieldDef, FieldScope
from app.models.user import User
from app.schemas.custom_field import CustomFieldDefCreate, CustomFieldDefOut

router = APIRouter()


@router.get("/", response_model=list[CustomFieldDefOut])
async def list_custom_field_defs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CustomFieldDef]:
    """Return workspace defs UNION personal defs for the current user.

    ADV-01: workspace fields (scope=workspace) shared by all
    Personal fields (scope=personal, owner_id=current_user.id) visible only to creator
    """
    result = await db.execute(
        select(CustomFieldDef)
        .where(
            or_(
                CustomFieldDef.scope == FieldScope.workspace,
                and_(
                    CustomFieldDef.scope == FieldScope.personal,
                    CustomFieldDef.owner_id == current_user.id,
                ),
            )
        )
        .order_by(CustomFieldDef.created_at)
    )
    return result.scalars().all()


@router.post("/", response_model=CustomFieldDefOut, status_code=201)
async def create_custom_field_def(
    data: CustomFieldDefCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CustomFieldDef:
    """Create a workspace or personal custom field definition.

    Workspace fields require admin role.
    Personal fields can be created by any authenticated user.
    """
    if data.scope == "workspace":
        # Workspace fields require admin
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required to create workspace fields",
            )
        owner_id = None
    else:
        # Personal fields: owner_id = current user
        owner_id = current_user.id

    field_def = CustomFieldDef(
        name=data.name,
        field_type=data.field_type,
        scope=data.scope,
        owner_id=owner_id,
    )
    db.add(field_def)
    await db.commit()
    await db.refresh(field_def)
    return field_def


@router.delete("/{def_id}", status_code=204)
async def delete_custom_field_def(
    def_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a custom field definition.

    Workspace fields: admin only.
    Personal fields: owner only (403 if not owner).
    """
    result = await db.execute(select(CustomFieldDef).where(CustomFieldDef.id == def_id))
    field_def = result.scalar_one_or_none()
    if field_def is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field definition not found")

    if field_def.scope == FieldScope.workspace:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required to delete workspace fields",
            )
    else:
        # Personal field: only owner can delete
        if field_def.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own personal fields",
            )

    await db.delete(field_def)
    await db.commit()
