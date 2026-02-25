import uuid
import enum
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FieldScope(str, enum.Enum):
    workspace = "workspace"
    personal = "personal"


class FieldType(str, enum.Enum):
    text = "text"
    number = "number"
    date = "date"


class CustomFieldDef(Base):
    __tablename__ = "custom_field_defs"
    __table_args__ = (
        CheckConstraint(
            "(scope = 'personal' AND owner_id IS NOT NULL) OR (scope = 'workspace' AND owner_id IS NULL)",
            name="ck_custom_field_defs_scope_owner"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(
        sa.Enum(FieldType, name="fieldtype", values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    scope: Mapped[FieldScope] = mapped_column(
        sa.Enum(FieldScope, name="fieldscope", values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=func.now(), server_default=func.now()
    )
