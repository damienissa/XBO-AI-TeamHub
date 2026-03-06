from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentOut

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()
