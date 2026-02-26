import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TicketTemplate(Base):
    __tablename__ = "ticket_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    problem_statement: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    default_urgency: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    default_effort_estimate: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    default_next_step: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        server_default=func.now(),
        nullable=False,
    )

    created_by = relationship("User", foreign_keys=[created_by_id], lazy="raise")
